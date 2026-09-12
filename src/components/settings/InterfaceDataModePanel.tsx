"use client";

import { Check, DatabaseZap } from "lucide-react";
import { useT } from "@/i18n/provider";

export function InterfaceDataModePanel() {
  const t = useT();

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

      <div className="min-h-32 rounded-2xl border border-brand/55 bg-brand/10 p-4 shadow-[0_0_28px_rgba(168,85,247,0.12)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-glow">
            <DatabaseZap className="h-4 w-4" />
          </span>
          <span className="font-bold text-ink">{t("settings.interfaceData.optimized.title")}</span>
          <Check className="ml-auto h-4 w-4 text-ok" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">{t("settings.interfaceData.optimized.description")}</p>
      </div>
    </section>
  );
}
