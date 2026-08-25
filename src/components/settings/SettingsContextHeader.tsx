"use client";

import { ChevronLeft, Sparkles } from "lucide-react";
import { useT } from "@/i18n/provider";
import { SETTINGS_JOURNEY_BY_ID, type SettingsJourney, type SettingsTab } from "@/lib/settingsNav";

export function SettingsContextHeader({ tab, onBack }: { tab: SettingsTab; onBack: (id: SettingsJourney) => void }) {
  const t = useT();
  const journey = SETTINGS_JOURNEY_BY_ID[tab.journey];
  const Icon = tab.icon;

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:p-5">
      <button onClick={() => onBack(tab.journey)} className="flex min-w-0 items-center gap-3 rounded-xl text-left ring-focus group">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-glow">
            <ChevronLeft className="h-3 w-3" /> {t(journey.labelKey)}
          </span>
          <span className="block break-words text-base font-extrabold text-ink">{t(tab.labelKey)}</span>
        </span>
      </button>
      <div className="sm:ml-auto sm:max-w-md">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-dim">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-glow" />
          {t(tab.hintKey)}
        </p>
      </div>
    </div>
  );
}
