"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useT, useI18n } from "@/i18n/provider";
import { X } from "lucide-react";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { CalendarEntryChip } from "./CalendarEntryChip";
import { localIso, monthCells, parseLocalIso } from "@/lib/calendar/localDate";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX_PER_CELL = 3;

interface CalendarMonthGridProps {
  entries: CalendarEntry[];
  monthDate: Date;
  todayIso: string;
  onQuickSearch: (entry: CalendarEntry) => void;
  searchingKey: string | null;
}

export function CalendarMonthGrid({ entries, monthDate, todayIso, onQuickSearch, searchingKey }: CalendarMonthGridProps) {
  const t = useT();
  const { locale } = useI18n();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of entries) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e);
    return m;
  }, [entries]);

  const cells = useMemo(() => monthCells(monthDate), [monthDate]);

  // Escape closes the day panel (it is a modal-like overlay).
  useEffect(() => {
    if (!expandedDate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpandedDate(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedDate]);

  const expandedEntries = expandedDate ? byDate.get(expandedDate) ?? [] : [];

  return (
    <div data-cal-period={localIso(monthDate)} className="scroll-mt-48">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-ink-dim">
        {WEEKDAY_KEYS.map((k) => <div key={k}>{t(`calendar.weekday.${k}`)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="min-h-[5.5rem] rounded-2xl bg-transparent" />;
          const dayEntries = byDate.get(cell.iso) ?? [];
          const visible = dayEntries.slice(0, MAX_PER_CELL);
          const hiddenCount = dayEntries.length - visible.length;
          const isToday = cell.iso === todayIso;
          return (
            <button
              key={cell.iso}
              onClick={() => dayEntries.length > 0 && setExpandedDate(cell.iso)}
              className={cn(
                "flex min-h-[5.5rem] flex-col gap-1 rounded-2xl border p-1.5 text-left transition-colors",
                isToday ? "border-brand/40 bg-brand/8" : "border-white/8 bg-white/[0.03] hover:bg-white/[0.07]"
              )}
            >
              <span className={cn("text-xs font-bold", isToday ? "text-brand-glow" : "text-ink-dim")}>{cell.dayNum}</span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {visible.map((e, j) => <CalendarEntryChip key={`${e.date}-${j}`} entry={e} compact />)}
                {hiddenCount > 0 && (
                  <span className="truncate text-[10px] font-semibold text-ink-dim">+{hiddenCount} {t("calendar.more")}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {expandedDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setExpandedDate(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 380 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl glass-strong p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96 sm:rounded-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-ink">
                  {parseLocalIso(expandedDate).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <button onClick={() => setExpandedDate(null)} aria-label={t("common.close")} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-ink-dim hover:text-ink sm:h-9 sm:w-9">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {expandedEntries.map((e, i) => (
                  <CalendarEntryChip key={i} entry={e} onQuickSearch={onQuickSearch} searching={searchingKey === `${e.date}-${e.title}`} />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
