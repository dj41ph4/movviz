"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { NamingEditor } from "@/components/settings/NamingEditor";
import { RenamePanel } from "@/components/settings/RenamePanel";

type View = "models" | "bulk";

/**
 * "Nommage" (templates) and "Renommage" (bulk-apply those templates against
 * the whole library) used to be two separate tabs split across two nav
 * groups for one coherent task. Merged here behind a segmented pill so
 * editing a template and re-applying it in bulk stay one context switch
 * apart instead of a full nav round-trip — kept as a visible toggle rather
 * than stacking both vertically since "Appliquer en masse" is a bulk
 * file-rewrite action that shouldn't sit passively under a template editor.
 */
export function NamingSettings() {
  const t = useT();
  const [view, setView] = useState<View>("models");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl glass p-0.5">
        {(["models", "bulk"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              view === v ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
            )}
          >
            {v === "models" ? t("naming.pillModels") : t("naming.pillBulkApply")}
          </button>
        ))}
      </div>

      {view === "models" ? <NamingEditor /> : <RenamePanel />}
    </div>
  );
}
