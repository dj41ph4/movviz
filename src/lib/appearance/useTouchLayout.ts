"use client";

import { useSyncExternalStore } from "react";
import { TOUCH_LAYOUT_QUERY, TOUCH_PORTRAIT_QUERY } from "./touchLayout";

function mediaStore(query: string) {
  let media: MediaQueryList | undefined;
  const getMedia = () => media ??= window.matchMedia(query);
  return {
    subscribe(change: () => void) {
      const list = getMedia();
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    snapshot: () => getMedia().matches,
  };
}

const layout = mediaStore(TOUCH_LAYOUT_QUERY);
const portrait = mediaStore(TOUCH_PORTRAIT_QUERY);
const desktopOnServer = () => false;

export function useTouchLayout() {
  return useSyncExternalStore(layout.subscribe, layout.snapshot, desktopOnServer);
}

export function useTouchPortrait() {
  return useSyncExternalStore(portrait.subscribe, portrait.snapshot, desktopOnServer);
}
