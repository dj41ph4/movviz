"use client";

import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredThemeMode, setStoredThemeMode, type ThemeMode } from "./theme";

/** Reads/writes the persisted theme choice and keeps <html data-theme> in sync, including live OS changes while on "auto". */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    setMode(getStoredThemeMode());
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
  }, []);

  return { mode, setThemeMode };
}
