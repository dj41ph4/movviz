"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { LibraryStatus } from "@/lib/library/types";
import { Grid3x3, Rows3, ListChecks } from "lucide-react";
import { CALENDAR_STATUS_TONE } from "./CalendarEntryChip";

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

/** Statuses that ask for something from the user (or are being handled). */
export const TODO_STATUSES: LibraryStatus[] = ["missing", "searching", "downloading"];

/** The "À traiter" preset = hide everything that is not in TODO_STATUSES. */
export const TODO_HIDDEN: LibraryStatus[] = STATUS_TOGGLES.filter((s) => !TODO_STATUSES.includes(s));

export function isTodoPreset(hidden: Set<LibraryStatus>): boolean {
  return hidden.size === TODO_HIDDEN.length && TODO_HIDDEN.every((s) => hidden.has(s));
}

interface CalendarFilterBarProps {
  kind: CalendarKindFilter;
  onKindChange: (k: CalendarKindFilter) => void;
  hiddenStatuses: Set<LibraryStatus>;
  onToggleStatus: (s: LibraryStatus) => void;
  onTodoPreset: () => void;
  counts: Record<LibraryStatus, number>;
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
}

// Touch targets are 44px on phones (WCAG 2.5.5) and tighten from `sm` up.
const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 min-h-11 sm:min-h-9 text-xs font-semibold whitespace-nowrap transition-colors";

export function CalendarFilterBar({
  kind, onKindChange, hiddenStatuses, onToggleStatus, onTodoPreset, counts, view, onViewChange,
}: CalendarFilterBarProps) {
  const t = useT();
  const todoActive = isTodoPreset(hiddenStatuses);
  const todoCount = TODO_STATUSES.reduce((n, s) => n + counts[s], 0);
  return (
    <div className="nx-cal-filters mb-3 space-y-2 rounded-3xl border border-white/8 bg-white/[0.035] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl sm:mb-4 sm:p-3">
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]"
        >
          {KINDS.map((k) => (
            <button
              key={k.id}
              role="tab"
              aria-selected={kind === k.id}
              onClick={() => onKindChange(k.id)}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors sm:min-h-8",
                kind === k.id ? "brand-gradient text-white shadow-lg" : "text-ink-soft hover:text-ink"
              )}
            >
              {t(k.key)}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]">
          {([["month", Grid3x3, "calendar.viewMonth"], ["week", Rows3, "calendar.viewWeek"]] as const).map(([id, Icon, key]) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              title={t(key)}
              aria-label={t(key)}
              aria-pressed={view === id}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-8",
                view === id ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar -mb-0.5 flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          onClick={onTodoPreset}
          aria-pressed={todoActive}
          className={cn(
            CHIP,
            todoActive
              ? "border-transparent brand-gradient text-white shadow-lg"
              : "border-white/10 bg-white/[0.05] text-ink hover:bg-white/10"
          )}
        >
          <ListChecks className="h-3.5 w-3.5" />
          {t("calendar.todo")}
          <span className="tabular-nums opacity-80">{todoCount}</span>
        </button>
        <span aria-hidden className="mx-0.5 my-2 w-px shrink-0 bg-white/10" />
        {STATUS_TOGGLES.map((s) => {
          const hidden = hiddenStatuses.has(s);
          return (
            <button
              key={s}
              onClick={() => onToggleStatus(s)}
              aria-pressed={!hidden}
              className={cn(
                CHIP,
                hidden
                  ? "border-white/8 bg-transparent text-ink-dim opacity-60 hover:opacity-90"
                  : CALENDAR_STATUS_TONE[s]
              )}
            >
              {t(`status.${s}`)}
              <span className="tabular-nums opacity-80">{counts[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
