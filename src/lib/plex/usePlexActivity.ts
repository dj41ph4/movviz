"use client";

import useSWR from "swr";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

export interface PlexSession {
  title: string;
  type: string;
  user: string;
  userThumb: string | null;
  state: string;
  progress: number;
  duration: number;
  bitrate: number;
  bandwidth: number;
  device: string;
  videoCodec: string | null;
  audioCodec: string | null;
  resolution: string | null;
}

export function usePlexActivity() {
  const user = useCurrentUser();
  const { data } = useSWR<{ sessions: PlexSession[] }>(
    user?.role === "admin" ? "/api/plex/activity" : null,
    { refreshInterval: 5000, dedupingInterval: 3000 }
  );
  return data?.sessions ?? [];
}
