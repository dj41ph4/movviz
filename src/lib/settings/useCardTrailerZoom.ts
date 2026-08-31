"use client";

import { useEffect } from "react";
import useSWR from "swr";

interface CardTrailerZoomData {
  offset: number;
}

/**
 * Server-wide (admin) zoom for card trailers — même valeur pour tous,
 * stockée dans card-trailer-zoom.json, lecture pour tous, écriture admin.
 */
export function useCardTrailerZoom() {
  const { data, mutate } = useSWR<CardTrailerZoomData>("/api/settings/card-trailer-zoom");

  const offset = data?.offset ?? 0;

  useEffect(() => {
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.onmessage = (event) => mutate({ offset: event.data }, { revalidate: false });
    return () => channel.close();
  }, [mutate]);

  const setOffset = async (next: number) => {
    const safe = Math.max(-100, Math.min(100, Math.round(next)));
    mutate({ offset: safe }, { revalidate: false });
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.postMessage(safe);
    channel.close();
    try {
      await fetch("/api/settings/card-trailer-zoom", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset: safe }),
      });
    } finally {
      mutate();
    }
  };

  return { offset, setOffset, loaded: data !== undefined };
}
