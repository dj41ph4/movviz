/**
 * Real gap found during the playback engine audit (TODO_POST_MOTEUR_LECTURE.md
 * §5): the local engine (localExecutor.ts) and the Plex remux engine
 * (remuxSession.ts) each enforced their OWN independent MAX_CONCURRENT=3
 * ceiling, with neither module aware of the other — up to 6 real ffmpeg
 * child processes could run at once. Confirmed live (2026-08-24) the actual
 * target hardware (Synology DS923+) has only 2 CPU cores and no GPU — a
 * single demanding software transcode already struggles to keep up in real
 * time (see decidePlayback.ts's SOFTWARE_TONEMAP_MAX_WIDTH investigation);
 * 6 concurrent ones would be catastrophic, not just slow.
 *
 * Reads both engines' registries directly by their known globalThis keys
 * rather than importing the two engine modules into each other — matches
 * this project's own established pattern for cross-route shared state
 * (CLAUDE.md: "Next.js bundles modules per-route — cross-route shared state
 * must live on globalThis") and avoids a circular import between
 * src/lib/playback/engine/transcoderExecutor.ts and
 * src/lib/playback/ffmpeg/remuxSession.ts.
 */
export const MAX_CONCURRENT_TRANSCODES = 3;

export function totalActiveTranscodeSessions(): number {
  const g = globalThis as unknown as {
    __movvizLocalEngineSessions?: Map<string, unknown>;
    __movvizFfmpegSessions?: Map<string, unknown>;
  };
  return (g.__movvizLocalEngineSessions?.size ?? 0) + (g.__movvizFfmpegSessions?.size ?? 0);
}
