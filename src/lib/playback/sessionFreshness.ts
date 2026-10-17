/** Shared pure policies; reading them never initializes a playback store. */
export const PLAYBACK_ACTIVE_HEARTBEAT_MS = 60_000;
export function playbackEngineSessionTtlMs(): number {
  const value = Number(process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS);
  return Number.isFinite(value) && value > 0 ? value : 5 * 60_000;
}
