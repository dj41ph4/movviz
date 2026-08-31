"use client";

import useSWR from "swr";

/**
 * Single source of truth for the "auto-upgrade already-downloaded" toggle —
 * always the real server value (src/lib/settings/qualityUpgrades.ts), never
 * a browser-local guess. This used to live partly in localStorage
 * (useActivitySettings' enableUpgrades field), which meant a fresh browser,
 * a cleared cache, or simply a different device always saw the hardcoded
 * "true" default regardless of what an admin had actually set server-side —
 * the toggle looked like it "turned itself back on" after any such reset.
 */
export function useQualityUpgradesEnabled() {
  const { data, mutate } = useSWR<{ enabled: boolean }>("/api/settings/quality-upgrades");
  const enabled = data?.enabled ?? true;

  const setEnabled = async (next: boolean) => {
    mutate({ enabled: next }, { revalidate: false });
    try {
      await fetch("/api/settings/quality-upgrades", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    } finally {
      mutate();
    }
  };

  return { enabled, loaded: data !== undefined, setEnabled };
}
