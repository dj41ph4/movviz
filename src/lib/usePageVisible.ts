"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function snapshot() {
  return document.visibilityState === "visible";
}

export function usePageVisible() {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
