"use client";

import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredThemeMode, setStoredThemeMode, type ThemeMode } from "./theme";

/** Reads/writes the persisted theme choice and keeps <html data-theme> in sync, including live OS changes while on "auto". */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    setMode(getStoredThemeMode());

    // Account-level preference wins over the localStorage value used for
    // the pre-hydration flash-prevention script above, once it loads —
    // confirmed live: theme was device-only, resetting on every new
    // browser/device. Also writes back to localStorage so the NEXT reload's
    // inline script (which can't wait on a fetch) already has it too.
    // Silently ignored when logged out or offline.
    fetch("/api/settings/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const theme = d?.prefs?.theme;
        if (theme) {
          setStoredThemeMode(theme);
          setMode(theme);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setThemeMode = useCallback((next: ThemeMode) => {
    setStoredThemeMode(next);
    setMode(next);
    fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }, []);

  return { mode, setThemeMode };
}
