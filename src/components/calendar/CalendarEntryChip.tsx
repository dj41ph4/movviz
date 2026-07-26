"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { Film, Tv, Search, Loader2 } from "lucide-react";
import type { CalendarEntry } from "@/app/api/calendar/route";
import type { LibraryStatus } from "@/lib/library/types";

/** Same status vocabulary/colors as TitleContent.tsx's STATUS_TONE — one
 *  visual language for "what state is this title in" across the whole app. */
export const CALENDAR_STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
  upcoming: "text-ink-dim bg-white/6 border-white/10",
};

interface CalendarEntryChipProps {
  entry: CalendarEntry;
  onQuickSearch?: (entry: CalendarEntry) => void;
  searching?: boolean;
  /** Compact = small chip for a month-grid day cell; false = full row for week view / day expansion. */
  compact?: boolean;
}

export function CalendarEntryChip({ entry, onQuickSearch, searching, compact }: CalendarEntryChipProps) {
  const t = useT();
  const poster = entry.posterPath ? `https://image.tmdb.org/t/p/w92${entry.posterPath}` : null;
  // Anime-VF-launch rows (kind "series") are informational — there's no
  // single grabbable file behind "the dub launched", so no quick action.
  const canQuickSearch = entry.libraryRef && entry.kind !== "series";

  if (compact) {
    return (
      <Link
        href={entry.href}
        title={entry.title}
        className={cn(
          "flex items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-white/10",
          CALENDAR_STATUS_TONE[entry.status]
        )}
      >
        {entry.kind === "movie" ? <Film className="h-2.5 w-2.5 shrink-0" /> : <Tv className="h-2.5 w-2.5 shrink-0" />}
        <span className="truncate">{entry.title}</span>
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl glass px-3 py-2.5 transition-colors hover:bg-white/5")}>
      <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-surface">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={entry.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {entry.kind === "movie" ? <Film className="h-4 w-4 text-ink-soft/50" /> : <Tv className="h-4 w-4 text-ink-soft/50" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", CALENDAR_STATUS_TONE[entry.status])}>
              {t(`status.${entry.status}`)}
            </span>
            {entry.badges?.map((badge) => (
              <span
                key={badge}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  badge === "VF" ? "border-brand/30 bg-brand/12 text-brand-glow" : "border-white/10 bg-white/5 text-ink-dim"
                )}
              >
                {badge === "VF" ? t("calendar.vf") : t("calendar.vo")}
              </span>
            ))}
          </div>
        </div>
      </Link>
      {canQuickSearch && onQuickSearch && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickSearch(entry);
          }}
          disabled={searching}
          title={t("calendar.quickSearch")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-brand-glow disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
