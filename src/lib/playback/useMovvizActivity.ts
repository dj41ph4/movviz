"use client";

import useSWR from "swr";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

/**
 * Mirrors PlexSession (src/lib/plex/usePlexActivity.ts) field for field so
 * the existing SessionRow component in ActivityMonitor.tsx can render either
 * kind with no branching. `origin` lets the UI tag the source; `location` is
 * nullable here (see src/app/api/movviz/activity/route.ts's comment) whereas
 * Plex's is not — native Movviz playback has no lan/wan signal to report.
 */
export interface MovvizSession {
  origin: "movviz";
  title: string;
  type: "movie" | "episode";
  user: string;
  userThumb: string | null;
  state: "playing" | "paused";
  progress: number;
  duration: number;
  bitrate: number;
  bandwidth: number;
  device: string;
  videoCodec: string | null;
  audioCodec: string | null;
  resolution: string | null;
  thumb: string | null;
  transcodeDecision: "transcode" | "copy" | "directplay";
  location: null;
}

/** Same admin-gated SWR pattern as usePlexActivity.ts — see that file. */
export function useMovvizActivity() {
  const user = useCurrentUser();
  const { data } = useSWR<{ sessions: MovvizSession[] }>(
    user?.role === "admin" ? "/api/movviz/activity" : null,
    { refreshInterval: 5000, dedupingInterval: 3000 }
  );
  return data?.sessions ?? [];
}
