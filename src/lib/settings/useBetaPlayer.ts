"use client";

import useSWR from "swr";

interface BetaPlayerData {
  enabled: boolean;
  streamCacheTtl: number;
}

export function useBetaPlayer() {
  const { data, mutate } = useSWR<BetaPlayerData>("/api/settings/beta-player");
  const enabled = data?.enabled ?? false;
  const streamCacheTtl = data?.streamCacheTtl ?? 300;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next, streamCacheTtl }, { revalidate: false });
    try {
      await fetch("/api/settings/beta-player", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  const setStreamCacheTtl = async (ttl: number) => {
    mutate({ enabled, streamCacheTtl: ttl }, { revalidate: false });
    try {
      await fetch("/api/settings/beta-player", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ streamCacheTtl: ttl }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, streamCacheTtl, loaded: data !== undefined, setEnabled, setStreamCacheTtl };
}
