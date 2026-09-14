"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "movviz:sidebar:collapsed";

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Purely cosmetic, per-device preference (which desk/monitor someone is
 * using right now) — never worth a server round-trip or syncing across
 * devices, unlike the real dashboard/account settings elsewhere in
 * src/lib/settings. Defaults to expanded (false) on the very first paint
 * (and on the server) so there is no layout flash before localStorage is
 * read on mount.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setCollapsed(loadCollapsed()), []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch { /* private browsing / storage disabled — state still flips for this session */ }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
