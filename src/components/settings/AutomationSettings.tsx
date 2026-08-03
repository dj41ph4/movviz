"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { TasksPanel } from "@/components/settings/TasksPanel";
import { JobQueuePanel } from "@/components/settings/JobQueuePanel";

type View = "schedule" | "queue";

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
