import { externalMarkersEnabled } from "@/lib/settings/markerSources";
import { getSourceMarkers, getSourceState, replaceSourceMarkers, touchSourceSync } from "./store";
import { markerSignature } from "./signature";
import { fetchTheIntroDb, type TheIntroDbTarget } from "./theintrodb";

/**
 * Alimente le store de marqueurs depuis TheIntroDB, À LA DEMANDE : quand un
 * média est ouvert pour la lecture et qu'on ne l'a pas encore interrogé —
 * jamais de balayage de la bibliothèque (une requête par titre vu, pas un
 * flot de milliers d'appels, et aucune analyse de fichier : le NAS n'y perd
 * rien).
 *
 * Mêmes règles d'or que la sync Plex :
 *  - panne/limite ≠ « aucun marqueur » : on n'écrit RIEN, on réessaie plus tard ;
 *  - signature identique = aucune écriture ;
 *  - cette source ne remplace que SES marqueurs (ceux de Plex sont intacts).
 */
export interface ExternalMarkerTarget {
  /** Clé Movviz du média : id du film, ou `${seriesId}:s{S}e{E}`. */
  key: string;
  api: TheIntroDbTarget;
}

const DAY = 24 * 60 * 60 * 1000;
const REFRESH_WITH_MARKERS_MS = 30 * DAY;
/** Une communauté ajoute des soumissions : on reregarde les titres vides, sans insister. */
const REFRESH_EMPTY_MS = 7 * DAY;
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;
/** L'API anonyme accepte 30 requêtes / 10 s : on reste très en dessous. */
const MIN_GAP_MS = 500;

const g = globalThis as typeof globalThis & {
  __movvizExternalMarkers?: {
    inflight: Map<string, Promise<void>>;
    failedUntil: Map<string, number>;
    chain: Promise<unknown>;
    cooldownUntil: number;
  };
};
function state() {
  return (g.__movvizExternalMarkers ??= { inflight: new Map(), failedUntil: new Map(), chain: Promise.resolve(), cooldownUntil: 0 });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Espace les appels sortants : un seul à la fois, avec un intervalle minimal. */
function paced<T>(fn: () => Promise<T>): Promise<T> {
  const s = state();
  const run = s.chain.then(fn);
  s.chain = run.then(() => sleep(MIN_GAP_MS), () => sleep(MIN_GAP_MS));
  return run;
}

async function sync(target: ExternalMarkerTarget): Promise<void> {
  const s = state();
  if (Date.now() < s.cooldownUntil) return;
  const result = await fetchTheIntroDb(target.api);
  if (!result.ok) {
    if (result.retryAfterMs) s.cooldownUntil = Date.now() + result.retryAfterMs;
    s.failedUntil.set(target.key, Date.now() + FAILURE_BACKOFF_MS);
    console.warn(`[TheIntroDB] ${target.key}: ${result.error}`);
    return;
  }
  const signature = markerSignature(result.markers);
  const existing = getSourceState(target.key, "theintrodb");
  if (existing && existing.signature === signature && getSourceMarkers(target.key, "theintrodb").length === result.markers.length) {
    touchSourceSync(target.key, "theintrodb", Date.now());
    return;
  }
  replaceSourceMarkers(target.key, "theintrodb", result.markers, { signature, sourceUpdatedAt: null, lastSyncedAt: Date.now() });
  if (result.markers.length > 0) {
    console.log(`[TheIntroDB] ${target.key}: ${result.markers.map((m) => m.type).join(", ")}`);
  }
}

/** Ce média doit-il être (re)demandé à TheIntroDB ? Jamais interrogé, ou
 *  résultat trop ancien — et pas en pause après une panne récente. */
export function needsExternalSync(key: string, opts: { onlyNew?: boolean } = {}): boolean {
  if ((state().failedUntil.get(key) ?? 0) > Date.now()) return false;
  const known = getSourceState(key, "theintrodb");
  if (!known) return true;
  if (opts.onlyNew) return false;
  const hasMarkers = getSourceMarkers(key, "theintrodb").length > 0;
  return Date.now() - known.lastSyncedAt >= (hasMarkers ? REFRESH_WITH_MARKERS_MS : REFRESH_EMPTY_MS);
}

/** Vrai tant qu'une limite de l'API (429) impose d'attendre. */
export function externalCoolingDown(): boolean {
  return Date.now() < state().cooldownUntil;
}

/** Résout quand les marqueurs de ce média sont à jour dans le store (ou qu'il
 *  n'y a rien à faire). Ne rejette jamais. L'appelant peut ne pas l'attendre :
 *  la requête continue en arrière-plan. */
export function ensureExternalMarkers(target: ExternalMarkerTarget): Promise<void> {
  if (!externalMarkersEnabled()) return Promise.resolve();
  const s = state();
  if (!needsExternalSync(target.key)) return Promise.resolve();
  const pending = s.inflight.get(target.key);
  if (pending) return pending;
  const run = paced(() => sync(target)).catch(() => undefined).finally(() => s.inflight.delete(target.key));
  s.inflight.set(target.key, run);
  return run;
}

/** Attend au plus `ms` : la lecture ne dépend jamais de la source externe. */
export function ensureExternalMarkersWithin(target: ExternalMarkerTarget, ms: number): Promise<void> {
  return Promise.race([ensureExternalMarkers(target), sleep(ms)]);
}
