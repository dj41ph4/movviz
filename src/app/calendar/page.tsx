"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
  const { data, error, isLoading, isValidating } = useSWR<{ entries: CalendarEntry[] }>("/api/calendar", {
    revalidateOnFocus: false,
    errorRetryCount: 3,
    dedupingInterval: 10_000,
    revalidateIfStale: false,
  });
  const entries = data?.entries ?? [];

  // Week is the primary view everywhere (desktop and mobile alike) — a 7-col
  // month grid with posters is unreadable at phone width, and week reads as
  // more actionable ("what's coming up this week") than a full month.
  const [view, setView] = useState<CalendarView>("week");

  const [anchor, setAnchor] = useState(() => new Date());
  const [periodCount, setPeriodCount] = useState(view === "month" ? 1 : 4);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset period count when view or kind changes
  const resetPeriods = useCallback((v: CalendarView) => {
    setPeriodCount(v === "month" ? 1 : 4);
  }, []);

  // Infinite scroll: add more periods when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPeriodCount((c) => Math.min(c + (view === "month" ? 1 : 4), view === "month" ? 12 : 52));
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [view, periodCount]);

  const periods = useMemo(() => {
    const out: Date[] = [];
    const cursor = view === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      : startOfWeek(anchor);
    for (let i = 0; i < periodCount; i++) {
      out.push(new Date(cursor));
      if (view === "month") cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 7);
    }
    return out;
  }, [anchor, view, periodCount]);

  const shift = (delta: number) => {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return next;
    });
    setPeriodCount(view === "month" ? 1 : 4);
  };
  const periodLabel = view === "month"
    ? periods.length > 1
      ? `${periods[0].toLocaleDateString(locale, { month: "long", year: "numeric" })} – ${periods[periods.length - 1].toLocaleDateString(locale, { month: "long", year: "numeric" })}`
      : anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
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
  const searchingKey = searchTarget ? `${searchTarget.date}-${searchTarget.title}` : null;

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
        onViewChange={(v) => { setView(v); setPeriodCount(v === "month" ? 1 : 4); }}
        onToday={() => { setAnchor(new Date()); setPeriodCount(view === "month" ? 1 : 4); }}
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
        <div className="space-y-6">
          {periods.map((periodDate, i) => (
            view === "month" ? (
              <CalendarMonthGrid
                key={periodDate.toISOString()}
                entries={filtered}
                monthDate={periodDate}
                todayIso={todayIso}
                onQuickSearch={setSearchTarget}
                searchingKey={searchingKey}
              />
            ) : (
              <CalendarWeekGrid
                key={periodDate.toISOString()}
                entries={filtered}
                weekStart={periodDate}
                todayIso={todayIso}
                onQuickSearch={setSearchTarget}
                searchingKey={searchingKey}
              />
            )
          ))}
          <div ref={sentinelRef} className="flex items-center justify-center py-6">
            {periodCount < (view === "month" ? 12 : 52) && (
              <Loader2 className="h-4 w-4 animate-spin text-ink-dim" />
            )}
          </div>
        </div>
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
