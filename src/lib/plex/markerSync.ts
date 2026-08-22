/**
 * Moteur de synchronisation des markers Plex (intros / génériques) vers le
 * store Movviz. Couche de navigation temporelle — jamais un pipeline vidéo :
 * la lecture n'interroge JAMAIS Plex pour les markers, elle lit
 * playback-markers.json via /api/stream/{ratingKey}/info.
 *
 * Règles d'or implémentées ici :
 *  - fetch TOUJOURS avec cfg.adminToken (métadonnées média, pas de profil) ;
 *  - erreur Plex ≠ zéro marker : une panne ne supprime jamais les données ;
 *  - signature déterministe : aucune écriture si rien n'a changé ;
 *  - plusieurs blocs credits préservés (mid/post-credit jamais fusionnés) ;
 *  - incrémental quotidien (dirty + retries + audit 1/7), full sur demande ;
 *  - job unique via sourceId "plex-marker-sync" + verrou interne.
 */
import { createHash } from "node:crypto";
import type { PlexServerConfig, PlexMarker } from "./types";
import { batchMarkers } from "./client";
import { loadPlexConfig } from "./store";
import {
  loadMarkerSyncState,
  saveMarkerSyncState,
  type DirtyReason,
} from "./markerSyncState";
import {
  getMarkerRecord,
  getAllMarkerRatingKeys,
  upsertMarkerRecord,
  removeMarkerRecord,
} from "@/lib/playback/markers/store";
import type { MediaMarkerRecord, PlaybackMarker, PlaybackMarkerType } from "@/lib/playback/markers/types";
import { yieldToUser } from "@/lib/priority/userActivity";
import { withKeyLock } from "@/lib/library/locks";

const SOURCE_ID = "plex-marker-sync";
const SUPPORTED_TYPES: PlaybackMarkerType[] = ["intro", "credits"];
/** Retry quotidien des médias sans marker — après N passages l'audit
 *  tournant hebdomadaire reste leur filet (Plex analyse parfois en J+2). */
const EMPTY_RETRY_MAX_ATTEMPTS = 7;
const EMPTY_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;

export interface MarkerSyncResult {
  mode: "incremental" | "full";
  candidates: number;
  processed: number;
  mediaWithMarkers: number;
  intros: number;
  credits: number;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  empty: number;
  errors: number;
  durationMs: number;
}

// ── Normalisation (PHASE 7-8) ───────────────────────────────────────────────

function normalizePlexMarker(raw: PlexMarker): PlaybackMarker | null {
  const type = raw.type as PlaybackMarkerType;
  if (!SUPPORTED_TYPES.includes(type)) return null; // autres types Plex ignorés en V1
  if (!Number.isFinite(raw.startTimeOffset) || !Number.isFinite(raw.endTimeOffset)) {
    console.warn(`[PlexMarkers] marker invalide ignoré (${raw.type}): offsets non numériques`);
    return null;
  }
  if (raw.startTimeOffset < 0 || raw.endTimeOffset <= raw.startTimeOffset) {
    console.warn(`[PlexMarkers] marker invalide ignoré (${raw.type}): ${raw.startTimeOffset}→${raw.endTimeOffset}`);
    return null;
  }
  return {
    id: `${type}-${Math.round(raw.startTimeOffset)}-${Math.round(raw.endTimeOffset)}`,
    source: "plex",
    sourceMarkerId: raw.id,
    type,
    startMs: Math.round(raw.startTimeOffset),
    endMs: Math.round(raw.endTimeOffset),
    final: Boolean(raw.final),
  };
}

export function normalizePlexMarkers(raws: PlexMarker[]): PlaybackMarker[] {
  const out: PlaybackMarker[] = [];
  for (const r of raws) {
    const m = normalizePlexMarker(r);
    if (m) out.push(m);
  }
  out.sort((a, b) => a.startMs - b.startMs); // tri stable avant signature/stockage
  return out;
}

export function markerSignature(markers: PlaybackMarker[]): string {
  // Trié par startMs déjà — l'ordre fait partie du contrat.
  const canonical = JSON.stringify(
    markers.map((m) => ({ t: m.type, s: m.startMs, e: m.endMs, f: m.final }))
  );
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Hash STABLE d'un redémarrage à l'autre (pas Math.random, pas Date.now) —
 *  le bucket d'audit d'un ratingKey doit être identique chaque jour. */
export function stableHash(input: string): number {
  const h = createHash("sha256").update(input).digest();
  return h.readUInt32BE(0);
}

// ── Signal venu de librarySync (PHASE 11) ───────────────────────────────────

/** Appelé par librarySync pour CHAQUE ratingKey traité avec son updatedAt :
 *  nouveau → dirty/new ; updatedAt supérieur → dirty/updated ; sinon rien.
 *  Le moteur markers profite ainsi gratuitement de la synchro bibliothèque
 *  existante — aucun scan séparé. */
export function registerMarkerCandidate(ratingKey: string, updatedAtSec: number | null | undefined) {
  if (!ratingKey) return;
  const state = loadMarkerSyncState();
  const prevKnown = state.knownUpdatedAt[ratingKey];
  const updated = typeof updatedAtSec === "number" ? updatedAtSec : null;
  let reason: DirtyReason | null = null;
  if (!(ratingKey in state.knownUpdatedAt)) reason = "new";
  else if (updated != null && (prevKnown == null || updated > prevKnown)) reason = "updated";
  state.knownUpdatedAt[ratingKey] = updated ?? prevKnown ?? 0;
  if (reason) {
    state.dirty[ratingKey] = { plexUpdatedAt: updated ?? Date.now() / 1000, reason };
  } else if (!(ratingKey in state.dirty) && !(ratingKey in state.emptyRetry)) {
    // Jamais synchronisé et pas dirty : le premier passage incr le prendra
    // via "ratingKeys jamais synchronisés" — on le marque connu sans dirty.
  }
  saveMarkerSyncState(state);
}

// ── Candidats (PHASE 13-15) ────────────────────────────────────────────────

function collectIncrementalCandidates(state: ReturnType<typeof loadMarkerSyncState>): string[] {
  const set = new Set<string>();
  for (const key of Object.keys(state.dirty)) set.add(key);
  // Médias jamais synchronisés mais connus de la biblio Plex-side.
  for (const [key] of Object.entries(state.knownUpdatedAt)) {
    if (!getMarkerRecord(key)) set.add(key);
  }
  // Retries arrivés à échéance uniquement (les autres attendent demain).
  const now = Date.now();
  for (const [key, retry] of Object.entries(state.emptyRetry)) {
    if (!getMarkerRecord(key)?.markers.length && retry.nextRetryAt <= now) set.add(key);
  }
  // Audit tournant : bucket du jour, seulement les records déjà là.
  const bucket = state.auditBucket % 7;
  for (const key of getAllMarkerRatingKeys()) {
    if (stableHash(key) % 7 === bucket) set.add(key);
  }
  return [...set];
}

function collectFullCandidates(): string[] {
  // Source = bibliothèque Movviz (pas une re-liste des sections Plex).
  // Import tardif pour éviter tout cycle plex↔library au chargement.
  const { loadMovies, loadSeries } = require("@/lib/library/store") as typeof import("@/lib/library/store");
  const keys = new Set<string>();
  for (const m of loadMovies()) if (m.plexRatingKey) keys.add(m.plexRatingKey);
  for (const s of loadSeries())
    for (const season of s.seasons)
      for (const ep of season.episodes) if (ep.plexRatingKey) keys.add(ep.plexRatingKey);
  return [...keys];
}

// ── Pipeline partagé (PHASE 9-10, 20-21, 52-53) ────────────────────────────

interface RunCtx {
  cfg: PlexServerConfig;
  token: string;
  setProgress?: (current: number, total: number) => void;
  isCancelled?: () => boolean;
}

async function processBatch(
  ctx: RunCtx,
  state: ReturnType<typeof loadMarkerSyncState>,
  keys: string[],
  acc: Omit<MarkerSyncResult, "mode" | "candidates" | "durationMs">,
  opts: { trackRemovedForGc?: (keys: { ratingKey: string; ok: boolean }[]) => void }
) {
  const results = await batchMarkers(ctx.cfg, ctx.token, keys);
  const removedNow: { ratingKey: string; ok: boolean }[] = [];
  for (const key of keys) {
    const res = results.get(key);
    delete state.dirty[key];
    if (!res) {
      acc.errors += 1;
      removedNow.push({ ratingKey: key, ok: false });
      continue;
    }
    if (!res.ok) {
      // ERREUR ≠ zéro marker : état distant inconnu → on ne touche à RIEN
      // localement (ni suppression, ni signature, ni lastSyncedAt). Le
      // ratingKey repart en dirty au prochain signal, ou l'audit le reprrend.
      acc.errors += 1;
      state.dirty[key] = { plexUpdatedAt: state.knownUpdatedAt[key] ?? Math.floor(Date.now() / 1000), reason: "file_changed" };
      removedNow.push({ ratingKey: key, ok: false });
      continue;
    }

    const markers = normalizePlexMarkers(res.markers);
    const existing = getMarkerRecord(key);

    if (markers.length === 0) {
      // Réponse VALIDE sans marker : Plex ne fournit actuellement rien.
      // Remplacement légitime par [] + retry quotidien pendant 7 passages,
      // puis couverture par l'audit tournant.
      if (existing?.markers.length) acc.removed += 1;
      upsertMarkerRecord({
        ratingKey: key,
        markers: [],
        signature: "",
        plexUpdatedAt: null,
        lastSyncedAt: Date.now(),
      });
      const prev = state.emptyRetry[key];
      const attempts = (prev?.attempts ?? 0) + 1;
      if (attempts < EMPTY_RETRY_MAX_ATTEMPTS) {
        state.emptyRetry[key] = { attempts, nextRetryAt: Date.now() + EMPTY_RETRY_DELAY_MS };
      } else {
        // Arrêt du retry agressif — l'audit tournant reprendra le relais.
        delete state.emptyRetry[key];
      }
      acc.empty += 1;
      acc.processed += 1;
      continue;
    }

    delete state.emptyRetry[key]; // des markers existent enfin

    const signature = markerSignature(markers);
    if (existing && existing.signature === signature && existing.markers.length > 0) {
      // UNCHANGED — aucune écriture inutile, on rafraîchit juste le tick.
      acc.unchanged += 1;
      upsertMarkerRecord({ ...existing, lastSyncedAt: Date.now() });
    } else {
      const rec: MediaMarkerRecord = {
        ratingKey: key,
        markers,
        signature,
        plexUpdatedAt: null,
        lastSyncedAt: Date.now(),
      };
      upsertMarkerRecord(rec);
      if (!existing) acc.added += 1;
      else acc.updated += 1;
      const intros = markers.filter((m) => m.type === "intro").length;
      const credits = markers.filter((m) => m.type === "credits").length;
      console.log(`[PlexMarkers] ratingKey=${key} ${!existing ? "ajouté" : "modifié"} (intro:${intros} credits:${credits})`);
    }

    for (const m of markers) {
      if (m.type === "intro") acc.intros += 1;
      else if (m.type === "credits") acc.credits += 1;
    }
    if (markers.length > 0) acc.mediaWithMarkers += 1;
    acc.processed += 1;
  }
  opts.trackRemovedForGc?.(removedNow);
  saveMarkerSyncState(state);
}

async function runSync(
  ctx: RunCtx,
  candidates: string[],
  mode: "incremental" | "full",
  isCancelled?: () => boolean
): Promise<MarkerSyncResult> {
  const startedAt = Date.now();
  const state = loadMarkerSyncState();
  const acc = {
    processed: 0,
    mediaWithMarkers: 0,
    intros: 0,
    credits: 0,
    added: 0,
    updated: 0,
    removed: 0,
    unchanged: 0,
    empty: 0,
    errors: 0,
  };

  // Full : suivi des clés traitées OK pour autoriser la GC uniquement si
  // TOUT a été vu avec succès (PHASE 17).
  const fullSeen = new Map<string, boolean>();
  let gcAllowed = mode !== "full";

  const chunkSize = 50;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    if (isCancelled?.()) break;
    const chunk = candidates.slice(i, i + chunkSize);
    await processBatch(ctx, state, chunk, acc, {
      trackRemovedForGc: mode === "full"
        ? (rows) => { for (const r of rows) fullSeen.set(r.ratingKey, r.ok); }
        : undefined,
    });
    ctx.setProgress?.(Math.min(i + chunkSize, candidates.length), candidates.length);
    await yieldToUser("sync markers Plex");
    if (i + chunkSize < candidates.length) await new Promise((r) => setTimeout(r, 150));
  }

  if (mode === "full") {
    // Garbage collection UNIQUEMENT si la full est allée au bout : chaque
    // candidat a été traité avec succès. Une panne Plex en cours de full
    // interdit toute purge globale (PHASE 17).
    gcAllowed = candidates.every((k) => fullSeen.get(k) === true);
    if (gcAllowed) {
      const liveSet = new Set(candidates);
      for (const key of getAllMarkerRatingKeys()) {
        if (!liveSet.has(key)) {
          removeMarkerRecord(key);
          acc.removed += 1;
          console.log(`[PlexMarkers] GC ratingKey=${key} (absent de Movviz)`);
        }
      }
      state.lastFullAt = Date.now();
    }
  }
  state.lastIncrementalAt = mode === "incremental" ? Date.now() : state.lastIncrementalAt;
  saveMarkerSyncState(state);

  console.log(
    `[PlexMarkers] ${mode}: ${acc.processed}/${candidates.length} traités · médias=${acc.mediaWithMarkers} intros=${acc.intros} credits=${acc.credits} +${acc.added}/~${acc.updated}/-${acc.removed}/${acc.unchanged}= vides=${acc.empty} erreurs=${acc.errors}`
  );

  return { mode, candidates: candidates.length, durationMs: Date.now() - startedAt, ...acc };
}

// ── Entrées publiques (PHASE 13-16, 19) ────────────────────────────────────

export async function syncPlexMarkers(opts: {
  mode: "incremental" | "full";
  setProgress?: (current: number, total: number) => void;
  isCancelled?: () => boolean;
}): Promise<MarkerSyncResult> {
  // Double sécurité : dédup job queue (sourceId) + verrou interne — un full
  // actif et un incremental simultané ne doivent jamais courir ensemble.
  return withKeyLock(SOURCE_ID, async () => {
    const cfg = loadPlexConfig();
    if (!cfg.hostname || !cfg.adminToken) {
      throw new Error("plex_not_configured");
    }
    const ctx: RunCtx = { cfg, token: cfg.adminToken, setProgress: opts.setProgress, isCancelled: opts.isCancelled };
    const state = loadMarkerSyncState();
    const candidates = opts.mode === "full" ? collectFullCandidates() : collectIncrementalCandidates(state);
    console.log(`[PlexMarkers] ${opts.mode}: ${candidates.length} candidats`);
    return runSync(ctx, candidates, opts.mode, opts.isCancelled);
  });
}

export function markerSyncSourceId(): string {
  return SOURCE_ID;
}
