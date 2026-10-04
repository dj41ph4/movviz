"use client";

import useSWR from "swr";
import type { EngineConfig } from "@/lib/playback/types";
import { isMovvizPlayerEnabled } from "./playerPreference";

interface BetaPlayerData {
  enabled: boolean;
  streamCacheTtl: number;
  hdrDvToSdrEnabled: boolean;
  playbackEngine: EngineConfig;
  debug: boolean;
}

interface PreferencesData {
  prefs?: { betaPlayerEnabled?: boolean };
}

/** Movviz player defaults to enabled; retain legacy storage/API names so
 * existing explicit opt-outs and independent profile preferences survive. */
export function useBetaPlayer() {
  const { data, mutate } = useSWR<BetaPlayerData>("/api/settings/beta-player");
  const { data: prefsData, mutate: mutatePrefs } = useSWR<PreferencesData>("/api/settings/preferences");

  const adminEnabled = data?.enabled ?? false;
  const streamCacheTtl = data?.streamCacheTtl ?? 300;
  const hdrDvToSdrEnabled = data?.hdrDvToSdrEnabled ?? true;
  const playbackEngine: EngineConfig = data?.playbackEngine ?? "auto";
  const debug = data?.debug ?? false;
  const userEnabled = prefsData?.prefs?.betaPlayerEnabled ?? true;
  const enabled = isMovvizPlayerEnabled(adminEnabled, userEnabled);

  const patch = async (body: Record<string, unknown>) => {
    mutate({ enabled: adminEnabled, streamCacheTtl, hdrDvToSdrEnabled, playbackEngine, debug, ...body }, { revalidate: false });
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

  const setAdminEnabled = (next: boolean) => patch({ enabled: next });
  const setStreamCacheTtl = (ttl: number) => patch({ streamCacheTtl: ttl });
  const setHdrDvToSdrEnabled = (next: boolean) => patch({ hdrDvToSdrEnabled: next });
  const setDebug = (next: boolean) => patch({ debug: next });

  const setUserEnabled = async (next: boolean) => {
    mutatePrefs({ prefs: { ...prefsData?.prefs, betaPlayerEnabled: next } }, { revalidate: false });
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ betaPlayerEnabled: next }),
      });
    } finally {
      mutatePrefs();
    }
  };

  return {
    enabled,
    adminEnabled,
    userEnabled,
    streamCacheTtl,
    hdrDvToSdrEnabled,
    playbackEngine,
    debug,
    loaded: data !== undefined && prefsData !== undefined,
    setAdminEnabled,
    setUserEnabled,
    setStreamCacheTtl,
    setHdrDvToSdrEnabled,
    setDebug,
  };
}
