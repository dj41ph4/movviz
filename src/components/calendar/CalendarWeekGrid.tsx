"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useT, useI18n } from "@/i18n/provider";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { CalendarEntryChip } from "./CalendarEntryChip";
import { weekDays } from "@/lib/calendar/localDate";

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

  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  return (
    <div className="space-y-2" data-cal-period={days[0].iso}>
      {days.map(({ iso, date }, i) => {
        const dayEntries = byDate.get(iso) ?? [];
        const isToday = iso === todayIso;
        const dayLabel = date.toLocaleDateString(locale, { day: "numeric", month: "long" });
        if (dayEntries.length === 0) {
          // Empty days collapse to one slim line: a week is ~3 screens shorter.
          return (
            <div
              key={iso}
              id={`cal-day-${iso}`}
              className={cn(
                "flex scroll-mt-56 items-baseline gap-2 rounded-2xl border px-4 py-2",
                isToday ? "border-brand/40 bg-brand/8" : "border-white/5 bg-white/[0.02]"
              )}
            >
              <span className={cn("text-sm font-bold", isToday ? "text-brand-glow" : "text-ink-soft")}>
                {t(`calendar.weekday.${WEEKDAY_KEYS[i]}`)}
              </span>
              <span className="text-xs text-ink-dim">{dayLabel}</span>
              <span className="ml-auto text-xs text-ink-dim/70">{t("calendar.nothingThisDay")}</span>
            </div>
          );
        }
        return (
          <section
            key={iso}
            id={`cal-day-${iso}`}
            className={cn(
              "scroll-mt-56 rounded-3xl border p-3 sm:p-4",
              isToday ? "border-brand/40 bg-brand/8 shadow-[0_0_0_1px_rgba(139,123,255,.15),0_18px_40px_-20px_rgba(124,92,255,.5)]" : "border-white/8 bg-white/[0.03]"
            )}
          >
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className={cn("text-base font-bold", isToday ? "text-brand-glow" : "text-ink")}>
                {t(`calendar.weekday.${WEEKDAY_KEYS[i]}`)}
              </span>
              <span className="text-xs text-ink-dim">{dayLabel}</span>
              <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-soft">
                {dayEntries.length}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {dayEntries.map((e, j) => (
                <CalendarEntryChip key={j} entry={e} onQuickSearch={onQuickSearch} searching={searchingKey === `${e.date}-${e.title}`} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
