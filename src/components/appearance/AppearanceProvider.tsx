"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { designModeOrDefault, type DesignMode } from "@/lib/appearance/designMode";
import type { UserPrefs } from "@/lib/userPrefs/store";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import "./premium.css";
import "./salle-obscure.css";
import "./design-beta.css";
import "./design-classic.css";

type PreferencesResponse = { prefs?: UserPrefs };
type DesignContextValue = { mode: DesignMode; loaded: boolean; saving: boolean; setMode: (mode: DesignMode) => Promise<void> };
const DesignContext = createContext<DesignContextValue | null>(null);

export function useDesignMode() {
  const context = useContext(DesignContext);
  if (!context) throw new Error("useDesignMode requires AppearanceProvider");
  return context;
}

/** The existing Salle obscure interface is Stable. New polish has its own
 * opt-in attribute so switching back restores that interface exactly. */
export function AppearanceProvider({ children, initialDesignMode = "beta" }: { children: ReactNode; initialDesignMode?: DesignMode }) {
  const t = useT();
  const { data, mutate } = useSWR<PreferencesResponse>("/api/settings/preferences");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // The server-rendered choice remains authoritative while preferences
  // load, including partial optimistic updates from another settings hook.
  const mode = data?.prefs?.designMode === undefined ? initialDesignMode : designModeOrDefault(data.prefs.designMode);

  useEffect(() => {
    document.documentElement.dataset.movvizDesign = mode;
  }, [mode]);

  async function setMode(next: DesignMode) {
    if (savingRef.current || !data?.prefs || next === mode) return;
    savingRef.current = true;
    setSaving(true);
    const updateMode = (value: DesignMode) => mutate((current) => ({ ...current, prefs: { ...current?.prefs, designMode: value } }), { revalidate: false });
    try {
      await updateMode(next);
      const response = await fetch("/api/settings/preferences", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ designMode: next }),
      });
      if (!response.ok) throw new Error("save_failed");
      const confirmed: PreferencesResponse = await response.json();
      if (confirmed.prefs?.designMode !== next) throw new Error("save_not_confirmed");
      await updateMode(next);
    } catch {
      // Roll back this field only: another settings panel may have saved
      // unrelated preferences while this request was in flight.
      await updateMode(mode);
      toast("error", t("settings.experience.designSaveError"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Neither design tilts the cards: Stable now carries the 19 October morning Beta look, which had none.

  return <DesignContext.Provider value={{ mode, loaded: !!data?.prefs, saving, setMode }}>{children}</DesignContext.Provider>;
}
