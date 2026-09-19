import { withUserContextDb } from "./database";

export type SyncCapability = "SYNCED" | "PENDING" | "UNSUPPORTED" | "ERROR";

export interface UserMediaSyncState {
  userId: string;
  stateKey: string;
  field: string;
  target: string;
  capability: SyncCapability;
  lastObservedAt: number | null;
  lastAppliedAt: number | null;
  lastAckAt: number | null;
  lastRemoteHash: string | null;
  lastError: string | null;
  updatedAt: number;
  revision?: number | null;
  desiredState?: string | null;
}

export function updateUserMediaSyncState(input: {
  userId: string;
  stateKey: string;
  field: string;
  target: string;
  capability: SyncCapability;
  observedAt?: number | null;
  appliedAt?: number | null;
  ackAt?: number | null;
  remoteHash?: string | null;
  error?: string | null;
  updatedAt?: number;
  revision?: number | null;
  desiredState?: string | null;
}): boolean {
  return withUserContextDb((db) => {
    const now = input.updatedAt ?? Date.now();
    db.prepare(`
      INSERT INTO user_media_sync_state(
        user_id, state_key, field, target, capability, last_observed_at,
        last_applied_at, last_ack_at, last_remote_hash, last_error, updated_at, revision, desired_state
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, state_key, field, target) DO UPDATE SET
        capability = excluded.capability,
        last_observed_at = COALESCE(excluded.last_observed_at, user_media_sync_state.last_observed_at),
        last_applied_at = COALESCE(excluded.last_applied_at, user_media_sync_state.last_applied_at),
        last_ack_at = COALESCE(excluded.last_ack_at, user_media_sync_state.last_ack_at),
        last_remote_hash = COALESCE(excluded.last_remote_hash, user_media_sync_state.last_remote_hash),
        last_error = excluded.last_error,
        updated_at = excluded.updated_at,
        revision = COALESCE(excluded.revision, user_media_sync_state.revision),
        desired_state = COALESCE(excluded.desired_state, user_media_sync_state.desired_state)
    `).run(input.userId, input.stateKey, input.field, input.target, input.capability, input.observedAt ?? null, input.appliedAt ?? null, input.ackAt ?? null, input.remoteHash ?? null, input.error ?? null, now, input.revision ?? null, input.desiredState ?? null);
    return true;
  }, false);
}

export function getUserMediaSyncStates(userId: string): UserMediaSyncState[] {
  return withUserContextDb((db) => db.prepare(`
    SELECT user_id as userId, state_key as stateKey, field, target, capability,
      last_observed_at as lastObservedAt, last_applied_at as lastAppliedAt,
      last_ack_at as lastAckAt, last_remote_hash as lastRemoteHash,
      last_error as lastError, updated_at as updatedAt, revision, desired_state as desiredState
    FROM user_media_sync_state WHERE user_id = ? ORDER BY updated_at DESC
  `).all(userId) as unknown as UserMediaSyncState[], []);
}

/**
 * Outbox durable (phase 6-7 du plan de finalisation, 2026-09) : requête SQL
 * directe plutôt que charger toute la table puis filtrer en JS (§51 du
 * plan). `before` sert de backoff simple — un appelant qui ne veut retenter
 * que les entrées "assez vieilles" passe `Date.now() - backoffMs`, sans
 * colonne retry_count dédiée (§52 : "ne pas ajouter sauf nécessité" — l'age
 * de `updated_at` suffit pour un backoff à paliers fixes).
 */
export function getPendingSyncStates(input: {
  target: string;
  field: string;
  capabilities: SyncCapability[];
  before?: number;
  limit?: number;
}): UserMediaSyncState[] {
  if (input.capabilities.length === 0) return [];
  return withUserContextDb((db) => {
    const placeholders = input.capabilities.map(() => "?").join(",");
    const params: (string | number)[] = [input.target, input.field, ...input.capabilities];
    let sql = `
      SELECT user_id as userId, state_key as stateKey, field, target, capability,
        last_observed_at as lastObservedAt, last_applied_at as lastAppliedAt,
        last_ack_at as lastAckAt, last_remote_hash as lastRemoteHash,
        last_error as lastError, updated_at as updatedAt, revision, desired_state as desiredState
      FROM user_media_sync_state
      WHERE target = ? AND field = ? AND capability IN (${placeholders})
    `;
    if (input.before != null) {
      sql += " AND updated_at <= ?";
      params.push(input.before);
    }
    sql += " ORDER BY updated_at ASC";
    if (input.limit != null) {
      sql += " LIMIT ?";
      params.push(input.limit);
    }
    return db.prepare(sql).all(...params) as unknown as UserMediaSyncState[];
  }, []);
}
