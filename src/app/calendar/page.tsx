"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { decodeLibraryRef, type LibraryStatus } from "@/lib/library/types";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { CalendarFilterBar, type CalendarKindFilter, type CalendarView } from "@/components/calendar/CalendarFilterBar";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/calendar/CalendarWeekGrid";
import { Loader2, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/provider";

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday-first
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Builds the same "Title SxxEyy" search-query convention used elsewhere
 *  (QueueTab's replace flow, TitleContent's season/episode search) — the
 *  calendar's composite display title ("Series — 2x05") isn't itself a good
 *  indexer query, so this reconstructs the plain series title + season/episode
 *  from the entry's own libraryRef instead of re-parsing the display string. */
function searchQueryFor(entry: CalendarEntry): string {
  if (entry.kind !== "episode" || !entry.libraryRef) return entry.title;
  const ref = decodeLibraryRef(entry.libraryRef);
  if (ref?.kind !== "episode") return entry.title;
  const seriesTitle = entry.title.split(" — ")[0];
  return `${seriesTitle} S${pad(ref.season)}E${pad(ref.episode)}`;
}

function refTitleFor(entry: CalendarEntry): string {
  return entry.kind === "episode" ? entry.title.split(" — ")[0] : entry.title;
}

export default function CalendarPage() {
  const t = useT();
  const { locale } = useI18n();
  const { titlePanel } = useTitlePanel();
  const { data, error, isLoading } = useSWR<{ entries: CalendarEntry[] }>("/api/calendar");
  const entries = data?.entries ?? [];

  const [view, setView] = useState<CalendarView>("month");
  useEffect(() => {
    // Default to week on mobile — a 7-col month grid with posters is
    // unreadable at phone width. Only applied once on mount so a manual
    // toggle afterward isn't fought by a resize.
    if (window.innerWidth < 768) setView("week");
  }, []);

  const [anchor, setAnchor] = useState(() => new Date());
  const shift = (deltaMonthsOrWeeks: number) => {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + deltaMonthsOrWeeks);
      else next.setDate(next.getDate() + deltaMonthsOrWeeks * 7);
      return next;
    });
  };
  const periodLabel = view === "month"
    ? anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
    : (() => {
        const start = startOfWeek(anchor);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
      })();
  const [kind, setKind] = useState<CalendarKindFilter>("all");
  // "available" hidden by default — already-downloaded titles are noise on a
  // calendar meant to answer "what's coming up / what needs action".
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<LibraryStatus>>(() => new Set(["available"]));
  const toggleStatus = (s: LibraryStatus) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const [searchTarget, setSearchTarget] = useState<CalendarEntry | null>(null);
  const searchingKey: string | null = null;

  const todayIso = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(
    () => entries.filter((e) => (kind === "all" || e.kind === kind) && !hiddenStatuses.has(e.status)),
    [entries, kind, hiddenStatuses]
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow={t("calendar.eyebrow")} title={t("calendar.title")} description={t("calendar.description")} />

      <CalendarFilterBar
        kind={kind}
        onKindChange={setKind}
        hiddenStatuses={hiddenStatuses}
        onToggleStatus={toggleStatus}
        view={view}
        onViewChange={setView}
        onToday={() => setAnchor(new Date())}
      />

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          aria-label={t("calendar.previous")}
          className="flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold capitalize text-ink">{periodLabel}</p>
        <button
          onClick={() => shift(1)}
          aria-label={t("calendar.next")}
          className="flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft hover:text-ink"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-24 text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {error && (
        <div className="rounded-2xl glass py-16 text-center text-sm text-down">{t("activity.loadError")}</div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <CalendarX className="h-8 w-8 text-ink-dim" />
          <p className="font-semibold text-ink">{t("calendar.empty")}</p>
        </div>
      )}
      {!isLoading && !error && filtered.length > 0 && (
        view === "month" ? (
          <CalendarMonthGrid
            entries={filtered}
            monthDate={anchor}
            todayIso={todayIso}
            onQuickSearch={setSearchTarget}
            searchingKey={searchingKey}
          />
        ) : (
          <CalendarWeekGrid
            entries={filtered}
            weekStart={startOfWeek(anchor)}
            todayIso={todayIso}
            onQuickSearch={setSearchTarget}
            searchingKey={searchingKey}
          />
        )
      )}

      {searchTarget && searchTarget.libraryRef && (
        <ManualSearchModal
          open={!!searchTarget}
          onClose={() => setSearchTarget(null)}
          libraryRef={searchTarget.libraryRef}
          query={searchQueryFor(searchTarget)}
          category={searchTarget.kind === "movie" ? "movie" : "series"}
          refTitle={refTitleFor(searchTarget)}
          year={searchTarget.year ? String(searchTarget.year) : undefined}
          title={searchTarget.title}
          tmdbId={searchTarget.tmdbId}
        />
      )}

      {titlePanel}
    </div>
  );
}
