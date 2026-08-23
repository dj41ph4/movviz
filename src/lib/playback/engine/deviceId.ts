"use client";

/**
 * Stable per-browser device id for ClientPlaybackProfile.deviceId (Phase 3
 * contract) — same localStorage-persisted-random-id pattern as the existing
 * STORAGE_KEY convention in src/i18n/config.ts, just a new key so it can't
 * collide with the locale preference.
 */
const DEVICE_ID_KEY = "movviz.deviceId";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `web-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "web-unknown";
  }
}
