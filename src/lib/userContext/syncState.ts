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
}): boolean {
  return withUserContextDb((db) => {
    const now = input.updatedAt ?? Date.now();
    db.prepare(`
      INSERT INTO user_media_sync_state(
        user_id, state_key, field, target, capability, last_observed_at,
        last_applied_at, last_ack_at, last_remote_hash, last_error, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, state_key, field, target) DO UPDATE SET
        capability = excluded.capability,
        last_observed_at = COALESCE(excluded.last_observed_at, user_media_sync_state.last_observed_at),
        last_applied_at = COALESCE(excluded.last_applied_at, user_media_sync_state.last_applied_at),
        last_ack_at = COALESCE(excluded.last_ack_at, user_media_sync_state.last_ack_at),
        last_remote_hash = COALESCE(excluded.last_remote_hash, user_media_sync_state.last_remote_hash),
        last_error = excluded.last_error,
        updated_at = excluded.updated_at
    `).run(input.userId, input.stateKey, input.field, input.target, input.capability, input.observedAt ?? null, input.appliedAt ?? null, input.ackAt ?? null, input.remoteHash ?? null, input.error ?? null, now);
    return true;
  }, false);
}

export function getUserMediaSyncStates(userId: string): UserMediaSyncState[] {
  return withUserContextDb((db) => db.prepare(`
    SELECT user_id as userId, state_key as stateKey, field, target, capability,
      last_observed_at as lastObservedAt, last_applied_at as lastAppliedAt,
      last_ack_at as lastAckAt, last_remote_hash as lastRemoteHash,
      last_error as lastError, updated_at as updatedAt
    FROM user_media_sync_state WHERE user_id = ? ORDER BY updated_at DESC
  `).all(userId) as unknown as UserMediaSyncState[], []);
}
