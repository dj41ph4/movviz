"use client";

import { useT } from "@/i18n/provider";
import { useQualityUpgradesEnabled } from "@/lib/settings/useQualityUpgradesEnabled";
import { cn } from "@/lib/utils";
import { ArrowUp, Activity } from "lucide-react";

/** V1 is retired — this panel only exposes the one setting still worth surfacing. */
export function ActivitySettings() {
  const t = useT();
  const { enabled, setEnabled } = useQualityUpgradesEnabled();

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("activity.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("activity.intro")}</p>
        </div>
      </div>
      <div className="rounded-2xl glass p-6">
        <div className="flex items-center justify-between gap-4 rounded-xl glass p-4">
          <div className="flex items-center gap-3">
            <ArrowUp className="h-5 w-5 text-ink-dim" />
            <div>
              <h4 className="font-semibold text-ink">{t("activity.upgrades.title")}</h4>
              <p className="text-sm text-ink-dim">{t("activity.upgrades.desc")}</p>
            </div>
          </div>
          <Toggle on={enabled} onChange={() => setEnabled(!enabled)} />
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "brand-gradient" : "bg-white/10")}>
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}
