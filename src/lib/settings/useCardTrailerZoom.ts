"use client";

import { useEffect } from "react";
import useSWR from "swr";

interface PreferencesData { prefs?: { cardTrailerZoomOffset?: number } }

export function useCardTrailerZoom() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");
  const offset = data?.prefs?.cardTrailerZoomOffset ?? 0;
  useEffect(() => {
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.onmessage = (event) => mutate((current) => ({ prefs: { ...current?.prefs, cardTrailerZoomOffset: event.data } }), { revalidate: false });
    return () => channel.close();
  }, [mutate]);
  const setOffset = async (next: number) => {
    const safe = Math.max(-100, Math.min(100, Math.round(next)));
    mutate({ prefs: { ...data?.prefs, cardTrailerZoomOffset: safe } }, { revalidate: false });
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.postMessage(safe);
    channel.close();
    try { await fetch("/api/settings/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardTrailerZoomOffset: safe }) }); }
    finally { mutate(); }
  };
  return { offset, setOffset, loaded: data !== undefined };
}
