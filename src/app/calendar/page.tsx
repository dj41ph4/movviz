"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { decodeLibraryRef, type LibraryStatus } from "@/lib/library/types";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { CalendarFilterBar, TODO_HIDDEN, type CalendarKindFilter, type CalendarView } from "@/components/calendar/CalendarFilterBar";
import { CalendarMonthGrid } from "@/components/calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/components/calendar/CalendarWeekGrid";
import { Loader2, CalendarX, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { localIso, parseLocalIso, weekDays } from "@/lib/calendar/localDate";
import { cn } from "@/lib/utils";

const PREFS_KEY = "movviz.calendar.prefs";
const ALL_STATUSES: LibraryStatus[] = ["upcoming", "missing", "searching", "downloading", "available"];
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

interface CalendarPrefs {
  view: CalendarView;
  kind: CalendarKindFilter;
  hidden: LibraryStatus[];
}

function readPrefs(): Partial<CalendarPrefs> | null {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CalendarPrefs>;
    return {
      view: p.view === "month" || p.view === "week" ? p.view : undefined,
      kind: p.kind === "all" || p.kind === "movie" || p.kind === "series" || p.kind === "episode" ? p.kind : undefined,
      hidden: Array.isArray(p.hidden) ? p.hidden.filter((x): x is LibraryStatus => ALL_STATUSES.includes(x as LibraryStatus)) : undefined,
    };
  } catch {
    return null;
  }
}

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
  const { data, error, isLoading } = useSWR<{ entries: CalendarEntry[] }>("/api/calendar", {
    revalidateOnFocus: false,
    errorRetryCount: 3,
    dedupingInterval: 10_000,
    revalidateIfStale: false,
  });
  const entries = useMemo(() => data?.entries ?? [], [data]);

  // Week is the primary view everywhere (desktop and mobile alike) — a 7-col
  // month grid with posters is unreadable at phone width, and week reads as
  // more actionable ("what's coming up this week") than a full month.
  const [view, setView] = useState<CalendarView>("week");

  const [anchor, setAnchor] = useState(() => new Date());
  const [periodCount, setPeriodCount] = useState(4);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "auto" });
  const resetCount = (v: CalendarView) => setPeriodCount(v === "month" ? 1 : 4);

  const shift = (delta: number) => {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return next;
    });
    resetCount(view);
    scrollTop();
  };

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

  // Filters + view survive reloads: the daily check should not start from zero.
  const prefsLoaded = useRef(false);
  // One-shot hydration from localStorage (not readable during SSR).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = readPrefs();
    if (p?.view) { setView(p.view); resetCount(p.view); }
    if (p?.kind) setKind(p.kind);
    if (p?.hidden) setHiddenStatuses(new Set(p.hidden));
    prefsLoaded.current = true;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!prefsLoaded.current) return;
    try {
      const prefs: CalendarPrefs = { view, kind, hidden: [...hiddenStatuses] };
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch { /* private mode / quota: preferences are a convenience only */ }
  }, [view, kind, hiddenStatuses]);

  const [searchTarget, setSearchTarget] = useState<CalendarEntry | null>(null);
  const searchingKey = searchTarget ? `${searchTarget.date}-${searchTarget.title}` : null;

  useEffect(() => {
    if (!searchTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchTarget(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchTarget]);

  const todayIso = localIso(new Date());

  const counts = useMemo(() => {
    const c: Record<LibraryStatus, number> = { upcoming: 0, missing: 0, searching: 0, downloading: 0, available: 0 };
    for (const e of entries) if (kind === "all" || e.kind === kind) c[e.status]++;
    return c;
  }, [entries, kind]);

  const filtered = useMemo(
    () => entries.filter((e) => (kind === "all" || e.kind === kind) && !hiddenStatuses.has(e.status)),
    [entries, kind, hiddenStatuses]
  );
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return m;
  }, [filtered]);

  // The period currently under the sticky bar drives the label and the day rail.
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  useEffect(() => {
    if (isLoading || error) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-cal-period]"));
    if (nodes.length === 0) return;
    const pick = () => {
      let current = nodes[0].dataset.calPeriod ?? null;
      for (const n of nodes) {
        if (n.getBoundingClientRect().top <= 220) current = n.dataset.calPeriod ?? current;
      }
      setActivePeriod(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, [view, periodCount, anchor, filtered.length, isLoading, error]);

  const activeDate = useMemo(
    () => parseLocalIso(activePeriod ?? localIso(periods[0])),
    [activePeriod, periods]
  );
  const periodLabel = view === "month"
    ? activeDate.toLocaleDateString(locale, { month: "long", year: "numeric" })
    : (() => {
        const start = startOfWeek(activeDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
      })();
  const railDays = useMemo(() => (view === "week" ? weekDays(startOfWeek(activeDate)) : []), [view, activeDate]);

  const jumpToDay = (iso: string) => {
    const el = document.getElementById(`cal-day-${iso}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title={t("calendar.title")} compact />

      <CalendarFilterBar
        kind={kind}
        onKindChange={setKind}
        hiddenStatuses={hiddenStatuses}
        onToggleStatus={toggleStatus}
        onTodoPreset={() => setHiddenStatuses(new Set(TODO_HIDDEN))}
        counts={counts}
        view={view}
        onViewChange={(v) => { setView(v); resetCount(v); }}
      />

      <div className="sticky top-[3.75rem] z-20 pb-2 pt-1 lg:top-14">
        <div className="rounded-3xl border border-white/10 bg-[#0b1024]/80 p-1.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,.6)] backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shift(-1)}
              aria-label={t("calendar.previous")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-white/8 hover:text-ink sm:h-10 sm:w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize text-ink">{periodLabel}</p>
            <button
              onClick={() => { setAnchor(new Date()); resetCount(view); scrollTop(); }}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-xs font-semibold text-ink-soft hover:text-ink sm:min-h-10"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {t("calendar.today")}
            </button>
            <button
              onClick={() => shift(1)}
              aria-label={t("calendar.next")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-white/8 hover:text-ink sm:h-10 sm:w-10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {railDays.length > 0 && (
            <div className="mt-1 grid grid-cols-7 gap-1">
              {railDays.map(({ iso, date }, i) => {
                const n = countByDate.get(iso) ?? 0;
                const isToday = iso === todayIso;
                return (
                  <button
                    key={iso}
                    onClick={() => jumpToDay(iso)}
                    className={cn(
                      "relative flex min-h-11 flex-col items-center justify-center rounded-2xl text-[11px] leading-tight transition-colors",
                      isToday ? "bg-brand/20 text-brand-glow" : "text-ink-soft hover:bg-white/8 hover:text-ink",
                      n === 0 && !isToday && "opacity-50"
                    )}
                  >
                    <span className="font-semibold uppercase">{t(`calendar.weekday.${WEEKDAY_KEYS[i]}`)}</span>
                    <span className="text-sm font-bold tabular-nums">{date.getDate()}</span>
                    {n > 0 && (
                      <span className="absolute right-1 top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[9px] font-bold text-white">{n}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
          {periods.map((periodDate) => (
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
