"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useT, useI18n } from "@/i18n/provider";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { CalendarEntryChip } from "./CalendarEntryChip";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface CalendarWeekGridProps {
  entries: CalendarEntry[];
  weekStart: Date; // a Monday
  todayIso: string;
  onQuickSearch: (entry: CalendarEntry) => void;
  searchingKey: string | null;
}

export function CalendarWeekGrid({ entries, weekStart, todayIso, onQuickSearch, searchingKey }: CalendarWeekGridProps) {
  const t = useT();
  const { locale } = useI18n();

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of entries) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e);
    return m;
  }, [entries]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return { iso: d.toISOString().slice(0, 10), date: d };
    }),
    [weekStart]
  );

  return (
    <div className="space-y-3">
      {days.map(({ iso, date }, i) => {
        const dayEntries = byDate.get(iso) ?? [];
        const isToday = iso === todayIso;
        return (
          <div key={iso} className={cn("rounded-2xl border p-3", isToday ? "border-brand/40 bg-brand/8" : "border-white/5 glass")}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className={cn("text-sm font-bold", isToday ? "text-brand-glow" : "text-ink")}>
                {t(`calendar.weekday.${WEEKDAY_KEYS[i]}`)}
              </span>
              <span className="text-xs text-ink-dim">{date.toLocaleDateString(locale, { day: "numeric", month: "long" })}</span>
            </div>
            {dayEntries.length === 0 ? (
              <p className="text-xs text-ink-dim">{t("calendar.nothingThisDay")}</p>
            ) : (
              <div className="space-y-1.5">
                {dayEntries.map((e, j) => (
                  <CalendarEntryChip key={j} entry={e} onQuickSearch={onQuickSearch} searching={searchingKey === `${e.date}-${e.title}`} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
