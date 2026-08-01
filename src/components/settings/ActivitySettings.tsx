"use client";

import { useT } from "@/i18n/provider";
import { Activity } from "lucide-react";

/** Quality upgrade toggle has been moved to Settings → Quality (ReleaseRulesPanel). */
export function ActivitySettings() {
  const t = useT();

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
        <p className="text-sm text-ink-dim">{t("releaseRules.autoUpgradeHint")}</p>
      </div>
    </div>
  );
}
