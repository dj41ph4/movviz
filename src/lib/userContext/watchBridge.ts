import type { DatabaseSync } from "node:sqlite";
import { withUserContextDb } from "./database";
import { recordUserContextEvent } from "./ingest";

function movieStateKey(userId: string, tmdbId: number): string {
  return `${userId}:movie:${tmdbId}`;
}

function episodeStateKey(userId: string, tmdbId: number, season: number, episode: number): string {
  return `${userId}:episode:${tmdbId}:${season}:${episode}`;
}

export type WatchState = "watched" | "unwatched";
export type WatchCurrentState = "unknown" | "watched" | "unwatched";

/**
 * Ordre de priorité utilisé UNIQUEMENT en cas d'égalité stricte de
 * timestamp (`temps > priorité`, toujours — voir applyWatchDecision).
 * Remplace l'ancien tie-break alphabétique sur `watched_source`
 * (`excluded.watched_source > COALESCE(...)`), qui n'avait aucune
 * signification métier — un "watch_store" battait un "plex_history" juste
 * parce que 'w' > 'p', par accident d'ordre alphabétique.
 */
export type WatchSource = "movviz_manual" | "movviz_playback" | "plex_history" | "external_import" | "ai" | "legacy_migration";
const SOURCE_PRIORITY: Record<WatchSource, number> = {
  movviz_manual: 500,
  movviz_playback: 400,
  plex_history: 300,
  external_import: 200,
  ai: 200,
  legacy_migration: 100,
};
function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source as WatchSource] ?? 0;
}

export interface WatchDecisionInput {
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "episode";
  seasonNumber?: number;
  episodeNumber?: number;
  title?: string | null;
  state: WatchState;
  occurredAt: number;
  source: WatchSource;
  /** Identifiant stable pour la déduplication (voir §15-16 du plan) — un
   *  appelant qui connaît déjà un identifiant naturel (Plex : ratingKey +
   *  viewedAt) doit le fournir ; sinon un identifiant déterministe est
   *  synthétisé à partir des autres champs. */
  sourceEventId?: string;
}

export type WatchDecisionReason = "newer_event" | "older_event" | "tie_break" | "duplicate";

export interface WatchDecisionResult {
  changed: boolean;
  accepted: boolean;
  previousState: WatchCurrentState;
  effectiveState: WatchCurrentState;
  previousUpdatedAt: number | null;
  effectiveUpdatedAt: number | null;
  reason: WatchDecisionReason;
}

function defaultSourceEventId(input: WatchDecisionInput): string {
  const media = input.mediaType === "episode"
    ? `episode:${input.tmdbId}:${input.seasonNumber ?? -1}:${input.episodeNumber ?? -1}`
    : `movie:${input.tmdbId}`;
  return `${input.source}:${input.userId}:${media}:${input.state}:${input.occurredAt}`;
}

function stateKeyFor(input: Pick<WatchDecisionInput, "userId" | "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">): string {
  return input.mediaType === "episode"
    ? episodeStateKey(input.userId, input.tmdbId, input.seasonNumber ?? -1, input.episodeNumber ?? -1)
    : movieStateKey(input.userId, input.tmdbId);
}

interface CurrentWatchRow {
  watched: number;
  watched_updated_at: number | null;
  watched_source: string | null;
  watched_event_id: string | null;
}

/**
 * Lecture seule de l'état canonique courant — aucune écriture, aucun
 * événement de ledger. Sert de garde-fou pour tout code qui reçoit des
 * données "déjà décidées" par un appelant (ex. mergePlexWatchedState) : il
 * peut re-vérifier auprès de la même vérité avant de refléter quoi que ce
 * soit ailleurs (JSON, cache...), plutôt que de faire confiance aveuglément
 * à l'appelant.
 */
export function getCurrentWatchState(input: Pick<WatchDecisionInput, "userId" | "tmdbId" | "mediaType" | "seasonNumber" | "episodeNumber">): WatchCurrentState {
  const key = stateKeyFor(input);
  return withUserContextDb((db) => {
    const row = db.prepare(
      "SELECT watched, watched_updated_at FROM user_media_state WHERE state_key = ?"
    ).get(key) as CurrentWatchRow | undefined;
    if (!row || row.watched_updated_at == null) return "unknown";
    return row.watched ? "watched" : "unwatched";
  }, "unknown");
}

export interface CanonicalWatchStatus {
  movies: number[];
  episodes: { tmdbId: number; season: number; episode: number; at: number | null }[];
}

/**
 * Lecture canonique pour les clients (phase 4 du plan de finalisation,
 * 2026-09) : `/api/watch-status` doit répondre depuis `user_media_state`
 * — la vraie source de vérité — plutôt que depuis le miroir JSON legacy,
 * qui peut rester périmé si son écriture a échoué pour une raison qui
 * n'affecte pas SQLite (ex. `jsonCacheReadFailed`, cf. watchStore.ts).
 * Retourne `null` quand le moteur de contexte est indisponible — l'appelant
 * doit alors retomber sur `getWatchStatus()` (JSON), jamais halluciner
 * une liste vide comme "aucun titre vu".
 */
export function getCanonicalWatchStatus(userId: string): CanonicalWatchStatus | null {
  return withUserContextDb((db) => {
    const movieRows = db.prepare(
      "SELECT tmdb_id FROM user_media_state WHERE user_id = ? AND media_type = 'movie' AND watched = 1 AND watched_updated_at IS NOT NULL"
    ).all(userId) as { tmdb_id: number }[];
    const episodeRows = db.prepare(
      "SELECT tmdb_id, season_number, episode_number, watched_at FROM user_media_state WHERE user_id = ? AND media_type = 'episode' AND watched = 1 AND watched_updated_at IS NOT NULL"
    ).all(userId) as { tmdb_id: number; season_number: number | null; episode_number: number | null; watched_at: number | null }[];
    return {
      movies: movieRows.map((r) => r.tmdb_id),
      episodes: episodeRows
        .filter((r) => r.season_number != null && r.episode_number != null)
        .map((r) => ({ tmdbId: r.tmdb_id, season: r.season_number as number, episode: r.episode_number as number, at: r.watched_at })),
    };
  }, null);
}

/**
 * L'unique opération métier qui décide et enregistre un changement de
 * statut vu/non vu (§10-19 du plan de centralisation) : toute source —
 * Plex, lecteur, action manuelle, IA, import externe, migration — doit
 * passer par ici plutôt que d'écrire `user_media_state` ou le JSON legacy
 * directement.
 *
 * Règle absolue : `occurredAt` (le moment RÉEL de la décision, jamais la
 * date de traitement) décide toujours en premier ("last write wins" par le
 * temps, jamais par l'ordre de synchronisation ni un OR booléen entre
 * sources) ; `source` ne départage qu'une égalité stricte de timestamp.
 * Absence d'événement ≠ non vu : cette fonction ne doit jamais être
 * appelée avec `state: "unwatched"` sur la seule base d'une absence dans
 * une liste externe (voir §3, §25 du plan).
 */
export function applyWatchDecision(input: WatchDecisionInput): WatchDecisionResult {
  const sourceEventId = input.sourceEventId ?? defaultSourceEventId(input);

  // Moteur de contexte indisponible (MOVVIZ_CONTEXT_ENGINE_DISABLED, ou
  // node:sqlite absent du runtime — ex. Node sans --experimental-sqlite en
  // production) : withUserContextDb retombe ICI, jamais dans le callback.
  // Bug réel corrigé (confirmé live, "j'ai marqué vu sur Plex, rien dans
  // Movviz après sync forcée") : cette valeur de repli renvoyait accepted:
  // false, donc TOUTE décision watched était silencieusement rejetée dès
  // que le moteur SQL était indisponible — alors qu'avant cette refonte,
  // l'écriture JSON ne dépendait d'aucune résolution de conflit et gagnait
  // toujours. Sans information de conflit disponible, on fait confiance à
  // l'appelant (fail-open) plutôt que de bloquer silencieusement — c'est le
  // filet de sécurité "Movviz doit continuer à fonctionner" du plan (§74).
  const engineUnavailable: WatchDecisionResult = {
    changed: true, accepted: true,
    previousState: "unknown", effectiveState: input.state,
    previousUpdatedAt: null, effectiveUpdatedAt: input.occurredAt,
    reason: "newer_event",
  };
  // Doublon RÉEL détecté alors que le moteur EST disponible (même
  // source_event_id déjà journalisé) : ce cas-ci doit rester un rejet, la
  // décision a déjà été tranchée une fois pour cet événement précis.
  const duplicate: WatchDecisionResult = {
    changed: false, accepted: false,
    previousState: "unknown", effectiveState: "unknown",
    previousUpdatedAt: null, effectiveUpdatedAt: null,
    reason: "duplicate",
  };

  return withUserContextDb((db) => {
    // Transaction explicite (phase 3 du plan de finalisation, 2026-09) :
    // sans elle, un crash entre l'INSERT du ledger et l'UPSERT de l'état
    // courant laisserait le ledger dire "événement connu" (INSERT OR IGNORE
    // le redéduplique au prochain retry) sans que le snapshot courant
    // n'ait jamais été mis à jour — un snapshot orphelin, silencieux.
    // node:sqlite n'a pas d'API de transaction native (DatabaseSync ne
    // l'expose pas) : BEGIN/COMMIT/ROLLBACK bruts, comme suggéré par le plan
    // quand aucune primitive de plus haut niveau n'existe déjà.
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = applyWatchDecisionTx(db, input, sourceEventId, duplicate);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* connexion déjà dans un état incertain — best-effort */ }
      throw error;
    }
  }, engineUnavailable);
}

function applyWatchDecisionTx(
  db: DatabaseSync,
  input: WatchDecisionInput,
  sourceEventId: string,
  duplicate: WatchDecisionResult,
): WatchDecisionResult {
    // Journal d'abord : idempotent via l'index unique (source, source_event_id)
    // déjà en place (ingest.ts) — un même événement Plex/import rejoué
    // plusieurs fois ne doit produire qu'une seule entrée logique et ne doit
    // pas redéclencher une résolution de conflit déjà tranchée.
    const inserted = recordUserContextEvent({
      userId: input.userId,
      eventType: input.state === "watched" ? "watched_marked" : "watched_unmarked",
      source: input.source,
      sourceEventId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      seasonNumber: input.seasonNumber ?? null,
      episodeNumber: input.episodeNumber ?? null,
      title: input.title ?? null,
      occurredAt: input.occurredAt,
    });
    if (!inserted) return duplicate;

    const key = stateKeyFor(input);
    const row = db.prepare(
      "SELECT watched, watched_updated_at, watched_source, watched_event_id FROM user_media_state WHERE state_key = ?"
    ).get(key) as CurrentWatchRow | undefined;

    const previousState: WatchCurrentState = !row || row.watched_updated_at == null
      ? "unknown"
      : row.watched ? "watched" : "unwatched";
    const previousUpdatedAt = row?.watched_updated_at ?? null;

    let wins = true;
    let reason: WatchDecisionReason = "newer_event";
    if (previousUpdatedAt != null) {
      if (input.occurredAt < previousUpdatedAt) {
        wins = false;
        reason = "older_event";
      } else if (input.occurredAt === previousUpdatedAt) {
        const currentPriority = sourcePriority(row?.watched_source ?? "");
        const newPriority = sourcePriority(input.source);
        if (newPriority > currentPriority) {
          reason = "tie_break";
        } else if (newPriority < currentPriority) {
          wins = false;
          reason = "tie_break";
        } else {
          // Égalité totale (même timestamp, même priorité) : dernier
          // départage déterministe, jamais Math.random(). Bug réel trouvé
          // par audit (2026-09) : comparait sourceEventId (longue chaîne
          // composite, ex. "movviz_manual:usr_xxx:movie:42:watched:169...")
          // à watched_source (juste "movviz_manual") au lieu du VRAI
          // identifiant du précédent événement (watched_event_id) — deux
          // chaînes sans rapport, dont l'une préfixe quasi toujours l'autre,
          // rendant ce départage gagnant presque systématiquement au lieu
          // d'être réellement déterministe sur l'ordre de traitement.
          wins = sourceEventId >= (row?.watched_event_id ?? "");
          reason = "tie_break";
        }
      }
    }

    if (!wins) {
      return {
        changed: false, accepted: false,
        previousState, effectiveState: previousState,
        previousUpdatedAt, effectiveUpdatedAt: previousUpdatedAt,
        reason,
      };
    }

    const watchedFlag = input.state === "watched" ? 1 : 0;
    db.prepare(`
      INSERT INTO user_media_state(
        state_key, user_id, tmdb_id, media_type, title_snapshot,
        season_number, episode_number, watched, watched_at, updated_at,
        watched_updated_at, watched_source, watched_event_id
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(state_key) DO UPDATE SET
        title_snapshot = COALESCE(excluded.title_snapshot, user_media_state.title_snapshot),
        season_number = COALESCE(excluded.season_number, user_media_state.season_number),
        episode_number = COALESCE(excluded.episode_number, user_media_state.episode_number),
        watched = excluded.watched,
        -- watched_at : date du dernier WATCHED positif retenu — ne recule
        -- jamais et n'est jamais effacée par une décision UNWATCHED, pour
        -- garder "la dernière fois où c'était vraiment vu" (§58 du plan).
        watched_at = CASE WHEN excluded.watched_at IS NOT NULL THEN excluded.watched_at ELSE user_media_state.watched_at END,
        updated_at = MAX(COALESCE(user_media_state.updated_at, 0), excluded.updated_at),
        watched_updated_at = excluded.watched_updated_at,
        watched_source = excluded.watched_source,
        watched_event_id = excluded.watched_event_id
    `).run(
      key, input.userId, input.tmdbId, input.mediaType, input.title ?? null,
      input.seasonNumber ?? null, input.episodeNumber ?? null,
      watchedFlag, input.state === "watched" ? input.occurredAt : null, input.occurredAt,
      input.occurredAt, input.source, sourceEventId,
    );

    return {
      changed: previousState !== input.state,
      accepted: true,
      previousState, effectiveState: input.state,
      previousUpdatedAt, effectiveUpdatedAt: input.occurredAt,
      reason,
    };
}
