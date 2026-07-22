"use client";

import { useT } from "@/i18n/provider";
import { useQualityUpgradesEnabled } from "@/lib/settings/useQualityUpgradesEnabled";
import { ArrowUp } from "lucide-react";

/** V1 is retired — this panel only exposes the one setting still worth surfacing. */
export function ActivitySettings() {
  const t = useT();
  const { enabled, setEnabled } = useQualityUpgradesEnabled();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-6">
        <div className="flex items-center justify-between gap-4 rounded-xl glass p-4">
          <div className="flex items-center gap-3">
            <ArrowUp className="h-5 w-5 text-ink-dim" />
            <div>
              <h4 className="font-semibold text-ink">{t("activity.upgrades.title")}</h4>
              <p className="text-sm text-ink-dim">{t("activity.upgrades.desc")}</p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => setEnabled(!enabled)}
              className="peer sr-only"
            />
            <div className="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-glow peer-checked:after:translate-x-full" />
          </label>
        </div>
      </div>
    </div>
  );
}
