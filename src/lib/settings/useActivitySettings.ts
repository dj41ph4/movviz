"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActivitySettings, ActivityVersion } from "./activity";
import { DEFAULT_ACTIVITY_SETTINGS } from "./activity";

const STORAGE_KEY = "movviz:activity:settings";

function loadSettings(): ActivitySettings {
  if (typeof window === "undefined") return DEFAULT_ACTIVITY_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        // V1 is retired — even a browser with an old "v1" preference saved
        // gets V2 from now on.
        version: "v2",
        showBetaWarning: parsed.showBetaWarning ?? true,
      };
    }
  } catch {}
  return DEFAULT_ACTIVITY_SETTINGS;
}

function saveSettings(settings: ActivitySettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useActivitySettings() {
  const [settings, setSettings] = useState<ActivitySettings>(DEFAULT_ACTIVITY_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const updateSettings = useCallback((newSettings: ActivitySettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const setVersion = useCallback((version: ActivityVersion) => {
    const newSettings = { ...settings, version };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  return { settings, loaded, updateSettings, setVersion };
}