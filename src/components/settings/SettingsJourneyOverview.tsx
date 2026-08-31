"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import {
  SETTINGS_JOURNEY_BY_ID,
  SETTINGS_TABS,
  type SettingsJourney,
  type SettingsTab,
} from "@/lib/settingsNav";

export function SettingsJourneyOverview({
  journeyId,
  isAdmin,
  onNavigate,
}: {
  journeyId: SettingsJourney;
  isAdmin: boolean;
  onNavigate: (id: string) => void;
}) {
  const t = useT();
  const journey = SETTINGS_JOURNEY_BY_ID[journeyId];
  const Icon = journey.icon;
  const tabs = journey.tabIds
    .map((id) => SETTINGS_TABS.find((tab) => tab.id === id))
    .filter((tab): tab is SettingsTab => !!tab && (!tab.adminOnly || isAdmin));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1022]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:p-8">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", journey.accent)} />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <motion.span
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-brand-glow shadow-[0_0_32px_rgba(168,85,247,.22)]"
          >
            <Icon className="h-8 w-8" />
          </motion.span>
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-glow">
              <Sparkles className="h-3.5 w-3.5" />
              {t("settings.guidedPath")}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t(journey.labelKey)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft sm:text-base">{t(journey.hintKey)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {tabs.map((tab, index) => {
          const TabIcon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.045 }}
              onClick={() => onNavigate(tab.id)}
              className="group relative min-h-36 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-5 text-left shadow-[0_14px_40px_rgba(0,0,0,.15)] ring-focus transition duration-300 hover:-translate-y-0.5 hover:border-brand/35 hover:bg-white/[0.065]"
            >
              <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-55 transition-opacity group-hover:opacity-100", journey.accent)} />
              <div className="relative flex h-full items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-brand-glow">
                  <TabIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-ink">{t(tab.labelKey)}</h3>
                    {tab.expertOnly ? (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-dim">
                        {t("settings.advanced")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full border border-ok/20 bg-ok/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ok">
                        <Check className="h-2.5 w-2.5" /> {t("settings.essential")}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-ink-dim">{t(tab.hintKey)}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-glow">
                    {t("settings.openSettings")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
