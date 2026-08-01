"use client";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { useGpu, type GpuTier } from "@/lib/gpu/GpuProvider";
import { BatteryLow, Check, Gauge, Monitor, Sparkles } from "lucide-react";

const TIERS: { id: GpuTier; icon: typeof Monitor; color: string }[] = [
  { id: "ultraLow", icon: BatteryLow, color: "text-down" },
  { id: "low", icon: Gauge, color: "text-amber/80" },
  { id: "medium", icon: Monitor, color: "text-cyan" },
  { id: "high", icon: Sparkles, color: "text-amber" },
];

export function GpuSettingsPanel() {
  const t = useT();
  const gpu = useGpu();

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-ink">{t("settings.gpu.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.gpu.description")}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TIERS.map(({ id, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => gpu.setTier(id)}
            className={cn(
              "relative rounded-xl border p-4 text-left transition-colors",
              gpu.tier === id
                ? "border-brand/50 bg-brand/10"
                : "border-white/8 bg-black/20 hover:bg-white/5"
            )}
          >
            {gpu.tier === id && <Check className="absolute right-3 top-3 h-4 w-4 text-brand-glow" />}
            <Icon className={cn("mb-2 h-5 w-5", color)} />
            <p className="font-semibold text-ink">{t(`settings.gpu.${id}`)}</p>
            <p className="mt-1 text-xs text-ink-dim">{t(`settings.gpu.${id}Desc`)}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-xl glass px-4 py-3 text-sm text-ink-dim">
        {t("settings.gpu.renderer")}: {gpu.renderer}
      </div>
    </div>
  );
}
