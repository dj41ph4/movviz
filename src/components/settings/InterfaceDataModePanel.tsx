"use client";

import { useState } from "react";
import { Check, DatabaseZap, Loader2, ShieldCheck } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { InterfaceDataMode } from "@/lib/settings/interfaceDataMode";
import { useInterfaceDataMode } from "@/lib/settings/useInterfaceDataMode";
import { toast } from "@/components/ui/Toast";

const MODES: Array<{ mode: InterfaceDataMode; icon: typeof DatabaseZap }> = [
  { mode: "optimized", icon: DatabaseZap },
  { mode: "compatibility", icon: ShieldCheck },
];

export function InterfaceDataModePanel() {
  const t = useT();
  const { mode, isLoading, mutate } = useInterfaceDataMode();
  const [saving, setSaving] = useState<InterfaceDataMode | null>(null);

  const selectMode = async (nextMode: InterfaceDataMode) => {
    if (nextMode === mode || saving) return;
    setSaving(nextMode);
    try {
      const response = await fetch("/api/settings/interface-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!response.ok) throw new Error(`interface_data_${response.status}`);
      const data = (await response.json()) as { mode: InterfaceDataMode };
      await mutate(data, { revalidate: false });
      toast("success", t("settings.interfaceData.saved"));
    } catch {
      toast("error", t("settings.interfaceData.error"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <DatabaseZap className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-bold text-ink">{t("settings.interfaceData.title")}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{t("settings.interfaceData.hint")}</p>
          <p className="mt-1 text-[11px] font-medium text-brand-glow">{t("settings.interfaceData.global")}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MODES.map(({ mode: candidate, icon: Icon }) => {
          const selected = mode === candidate;
          const pending = saving === candidate;
          return (
            <button
              key={candidate}
              type="button"
              disabled={isLoading || saving !== null}
              onClick={() => selectMode(candidate)}
              className={cn(
                "min-h-32 rounded-2xl border p-4 text-left transition-colors disabled:cursor-wait disabled:opacity-70",
                selected
                  ? "border-brand/55 bg-brand/10 shadow-[0_0_28px_rgba(168,85,247,0.12)]"
                  : "border-white/8 bg-black/20 hover:border-white/18 hover:bg-white/[0.035]",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", selected ? "bg-brand/20 text-brand-glow" : "bg-white/5 text-ink-soft")}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="font-bold text-ink">{t(`settings.interfaceData.${candidate}.title`)}</span>
                {selected && <Check className="ml-auto h-4 w-4 text-ok" />}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-dim">{t(`settings.interfaceData.${candidate}.description`)}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
