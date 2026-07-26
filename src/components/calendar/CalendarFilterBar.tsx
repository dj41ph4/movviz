"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { LibraryStatus } from "@/lib/library/types";
import { Grid3x3, Rows3, CalendarClock } from "lucide-react";

export type CalendarKindFilter = "all" | "movie" | "series" | "episode";
export type CalendarView = "month" | "week";

const KINDS: { id: CalendarKindFilter; key: string }[] = [
  { id: "all", key: "common.all" },
  { id: "movie", key: "common.movies" },
  { id: "series", key: "common.series" },
  { id: "episode", key: "calendar.episodes" },
];

// Priority order: what's already in motion first, then what's actionable,
// then what's merely informational, "available" last since it's opt-in
// (already downloaded — not urgent, shown only if explicitly requested).
const STATUS_TOGGLES: LibraryStatus[] = ["searching", "downloading", "missing", "upcoming", "available"];

interface CalendarFilterBarProps {
  kind: CalendarKindFilter;
  onKindChange: (k: CalendarKindFilter) => void;
  hiddenStatuses: Set<LibraryStatus>;
  onToggleStatus: (s: LibraryStatus) => void;
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  onToday: () => void;
}

export function CalendarFilterBar({
  kind, onKindChange, hiddenStatuses, onToggleStatus, view, onViewChange, onToday,
}: CalendarFilterBarProps) {
  const t = useT();
  return (
    <div className="mb-5 space-y-3 rounded-2xl glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => onKindChange(k.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                kind === k.id ? "brand-gradient text-white shadow-lg" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {t(k.key)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToday}
            className="flex items-center gap-1.5 rounded-lg glass-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {t("calendar.today")}
          </button>
          <div className="flex items-center gap-1 rounded-xl glass-strong p-1">
            <button
              onClick={() => onViewChange("month")}
              title={t("calendar.viewMonth")}
              className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", view === "month" ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink")}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewChange("week")}
              title={t("calendar.viewWeek")}
              className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", view === "week" ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink")}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
        {STATUS_TOGGLES.map((s) => {
          const hidden = hiddenStatuses.has(s);
          return (
            <button
              key={s}
              onClick={() => onToggleStatus(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                hidden ? "glass-strong text-ink-dim opacity-50 hover:opacity-80" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {t(`status.${s}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
