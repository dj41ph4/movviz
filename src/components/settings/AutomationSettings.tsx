"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { ShieldAlert } from "lucide-react";
import { TasksPanel } from "@/components/settings/TasksPanel";
import { JobQueuePanel } from "@/components/settings/JobQueuePanel";

type View = "schedule" | "queue";

/** Server-wide admin kill switch (explicit request) for the 3 scheduled
 *  tasks that search and grab MISSING content unattended (scan RSS, relance
 *  manquants, sorties du jour) — never per-user, it's a decision about the
 *  whole instance's behavior. A title's own "suivi" toggle and the manual
 *  "Rechercher" buttons keep working exactly as before either way; this
 *  only stops the background passes from acting on their own. */
function AutoSearchKillSwitch() {
  const t = useT();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/automation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEnabled(d.autoSearchMissingEnabled));
  }, []);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await fetch("/api/settings/automation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoSearchMissingEnabled: next }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/12 text-amber">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("automation.killSwitchTitle")}</h3>
            <p className="mt-0.5 max-w-xl text-xs text-ink-dim">{t("automation.killSwitchHint")}</p>
          </div>
        </div>
        <Toggle on={enabled === true} disabled={enabled === null || saving} onChange={toggle} />
      </div>
    </div>
  );
}

/**
 * "Tâches" (scheduled intervals) and "File d'attente" (live queue +
 * priorities) both describe the same underlying background-job system from
 * two angles — merged behind a segmented pill instead of two separate nav
 * entries. Unlike Nommage/Renommage, stacking both vertically here isn't an
 * option: Tâches alone is a 20+ row table and File d'attente alone already
 * has its own list plus a dozen priority sliders — combined that's a huge
 * scroll, so the pill is load-bearing here, not just a nicety.
 */
export function AutomationSettings() {
  const t = useT();
  const [view, setView] = useState<View>("schedule");

  return (
    <div className="space-y-4">
      <AutoSearchKillSwitch />
      <div className="flex gap-1 rounded-xl glass p-0.5">
        {(["schedule", "queue"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === v ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
            )}
          >
            {v === "schedule" ? t("automation.pillSchedule") : t("automation.pillQueue")}
          </button>
        ))}
      </div>

      {view === "schedule" ? <TasksPanel /> : <JobQueuePanel />}
    </div>
  );
}
