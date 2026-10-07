import type { ActivityDownload } from "./types";

export function torrentActivityStatus(torrent: { state: string; seeding?: boolean; replacementFailure?: unknown }): ActivityDownload["state"] {
  if (torrent.replacementFailure) return "stalled";
  if (torrent.seeding && ["completed", "seeding", "blocked", "stalled"].includes(torrent.state)) return "seeding";
  switch (torrent.state) {
    case "blocked": case "stalled": return "stalled";
    case "paused": case "queued": case "seeding": case "completed": case "verifying": return torrent.state;
    default: return "downloading";
  }
}
