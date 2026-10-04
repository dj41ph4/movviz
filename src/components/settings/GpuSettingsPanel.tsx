"use client";

import { useT } from "@/i18n/provider";
import { useGpu } from "@/lib/gpu/GpuProvider";
import { Toggle } from "@/components/ui/Toggle";

export function GpuSettingsPanel() {
  const t = useT();
  const gpu = useGpu();

  return (
    <div>
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.dashboardExperience.animationsTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.dashboardExperience.animationsHint")}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">{t("settings.dashboardExperience.animationsEnabled")}</span>
          <Toggle
            on={!gpu.reduceAnimations}
            onChange={() => gpu.setReduceAnimations(!gpu.reduceAnimations)}
          />
        </div>
      </div>
    </div>
  );
}
