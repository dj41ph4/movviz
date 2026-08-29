"use client";

import { useEffect } from "react";
import useSWR from "swr";

interface PreferencesData { prefs?: { cardTrailerZoomOffset?: number; cardTrailerZoomV2?: boolean } }

export function useCardTrailerZoom() {
  const { data, mutate } = useSWR<PreferencesData>("/api/settings/preferences");
  // v1.22.35's +100 becomes the new centered 0. Existing saved values are
  // translated once when the user next moves the slider.
  const offset = (data?.prefs?.cardTrailerZoomOffset ?? 0) - (data?.prefs?.cardTrailerZoomV2 ? 0 : 100);
  useEffect(() => {
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.onmessage = (event) => mutate((current) => ({ prefs: { ...current?.prefs, cardTrailerZoomOffset: event.data, cardTrailerZoomV2: true } }), { revalidate: false });
    return () => channel.close();
  }, [mutate]);
  const setOffset = async (next: number) => {
    const safe = Math.max(-100, Math.min(100, Math.round(next)));
    mutate({ prefs: { ...data?.prefs, cardTrailerZoomOffset: safe, cardTrailerZoomV2: true } }, { revalidate: false });
    const channel = new BroadcastChannel("movviz-card-trailer-zoom");
    channel.postMessage(safe);
    channel.close();
    try { await fetch("/api/settings/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardTrailerZoomOffset: safe, cardTrailerZoomV2: true }) }); }
    finally { mutate(); }
  };
  return { offset, setOffset, loaded: data !== undefined };
}
