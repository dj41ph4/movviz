"use client";

import useSWR from "swr";
import type { EngineConfig } from "@/lib/playback/types";

interface BetaPlayerData {
  enabled: boolean;
  streamCacheTtl: number;
  playbackEngine: EngineConfig;
  debug: boolean;
}

export function useBetaPlayer() {
  const { data, mutate } = useSWR<BetaPlayerData>("/api/settings/beta-player");
  const enabled = data?.enabled ?? false;
  const streamCacheTtl = data?.streamCacheTtl ?? 300;
  const playbackEngine: EngineConfig = data?.playbackEngine ?? "auto";
  const debug = data?.debug ?? false;

  const patch = async (body: Record<string, unknown>) => {
    mutate({ enabled, streamCacheTtl, playbackEngine, debug, ...body }, { revalidate: false });
    try {
      await fetch("/api/settings/beta-player", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      mutate();
    }
  };

  const setEnabled = (next: boolean) => patch({ enabled: next });
  const setStreamCacheTtl = (ttl: number) => patch({ streamCacheTtl: ttl });
  const setPlaybackEngine = (engine: EngineConfig) => patch({ playbackEngine: engine });
  const setDebug = (next: boolean) => patch({ debug: next });

  return {
    enabled,
    streamCacheTtl,
    playbackEngine,
    debug,
    loaded: data !== undefined,
    setEnabled,
    setStreamCacheTtl,
    setPlaybackEngine,
    setDebug,
  };
}
