"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Film, Tv, Layers, ListChecks, Loader2, ExternalLink } from "lucide-react";
import { useT } from "@/i18n/provider";
import { encodeLibraryRef } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";

interface LibraryTitle {
  id: string;
  tmdbId: number;
  title: string;
  year: number | null;
  type: "movie" | "series";
}

interface TmdbHit {
  tmdbId: number;
  title: string;
  year: number | null;
  type: "movie" | "series";
  overview: string;
  posterPath: string | null;
}

interface PickerProps {
  onPick: (libraryRef: string, label: string) => void;
  initialQuery?: string;
}

export function TitleTargetPicker({ onPick, initialQuery }: PickerProps) {
  const t = useT();
  const [libraryTitles, setLibraryTitles] = useState<LibraryTitle[]>([]);
  const [tmdbResults, setTmdbResults] = useState<TmdbHit[]>([]);
  const [query, setQuery] = useState(() => {
    if (!initialQuery) return "";
    const parsed = parseRelease(initialQuery);
    return parsed.title || initialQuery;
  });
  const [series, setSeries] = useState<LibraryTitle | null>(null);
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [seasonStep, setSeasonStep] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/library/movies", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library/series", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([m, s]) => {
      setLibraryTitles([
        ...(m.movies ?? []).map((mv: { id: string; tmdbId: number; title: string; year: number | null }) => ({
          id: mv.id, tmdbId: mv.tmdbId, title: mv.title, year: mv.year, type: "movie" as const,
        })),
        ...(s.series ?? []).map((sr: { id: string; tmdbId: number; title: string; year: number | null }) => ({
          id: sr.id, tmdbId: sr.tmdbId, title: sr.title, year: sr.year, type: "series" as const,
        })),
      ]);
    });
  }, []);

  // Debounced TMDb search
  useEffect(() => {
    const q = query.trim();
    if (!q) { setTmdbResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/metadata/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setTmdbResults((data.results ?? []).map((r: { tmdbId: number; title: string; year: number | null; mediaType?: string; type?: string; overview: string; posterPath: string | null }) => ({
            tmdbId: r.tmdbId,
            title: r.title,
            year: r.year,
            type: r.mediaType === "tv" ? "series" as const : r.type === "series" ? "series" as const : "movie" as const,
            overview: r.overview,
            posterPath: r.posterPath,
          })));
        })
        .catch(() => setTmdbResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const libraryIds = useMemo(() => new Set(libraryTitles.map((lt) => `${lt.type}-${lt.tmdbId}`)), [libraryTitles]);

  // Library matches for the current query
  const libraryMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return libraryTitles.filter((lt) => lt.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query, libraryTitles]);

  // TMDb results not already in library
  const externalResults = useMemo(() => {
    return tmdbResults.filter((tr) => !libraryIds.has(`${tr.type}-${tr.tmdbId}`)).slice(0, 6);
  }, [tmdbResults, libraryIds]);

  const addAndPick = useCallback(async (hit: TmdbHit) => {
    setAdding(`${hit.type}-${hit.tmdbId}`);
    setAddError(null);
    try {
      const res = await fetch(`/api/library/${hit.type === "series" ? "series" : "movies"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // skipSearch: this add exists only so there's a library id to attach
        // the file the user is about to pick to — the normal add flow's own
        // auto-search would otherwise grab a SECOND, different release for
        // the same title right alongside the one being linked here.
        body: JSON.stringify({ tmdbId: hit.tmdbId, skipSearch: true }),
      });
      const data = await res.json();
      // /api/library/movies|series has three distinct success shapes: the
      // added item spread at the top level ({id, ...}), `alreadyInLibrary:
      // true` (a bare flag, not the item — a race where it got added between
      // this list rendering and the click), or — for a non-admin/non-auto-
      // approve user — a pendingRequest with no library id at all yet
      // (nothing to link to until an admin approves it). There is no
      // libraryRef that can stand in for a request that doesn't exist yet,
      // so that case is reported as an error instead of a broken ref.
      if (data.pendingRequest) {
        setAddError(t("activity.linkAddPending"));
        return;
      }
      const added: { id: string } | undefined = data.alreadyInLibrary
        ? libraryTitles.find((lt) => lt.type === hit.type && lt.tmdbId === hit.tmdbId)
        : data.id
          ? data
          : undefined;
      if (!added?.id) {
        setAddError(t("activity.linkAddFailed"));
        return;
      }
      const libTitle: LibraryTitle = { id: added.id, tmdbId: hit.tmdbId, title: hit.title, year: hit.year, type: hit.type };
      if (hit.type === "movie") {
        onPick(encodeLibraryRef({ kind: "movie", movieId: libTitle.id }), libTitle.title);
      } else {
        setSeries(libTitle);
      }
    } catch {
      setAddError(t("activity.linkAddFailed"));
    } finally {
      setAdding(null);
    }
  }, [onPick, t]);

  const pickTitle = (title: LibraryTitle) => {
    if (title.type === "movie") {
      onPick(encodeLibraryRef({ kind: "movie", movieId: title.id }), title.title);
      return;
    }
    setSeries(title);
  };

  if (series && !seasonStep) {
    return (
      <div className="space-y-3">
        <TargetHeader title={series.title} type="series" onChange={() => setSeries(null)} t={t} />
        <button
          onClick={() => onPick(encodeLibraryRef({ kind: "series", seriesId: series.id }), `${series.title} — ${t("activity.scopeWholeSeries")}`)}
          className="flex w-full items-center gap-2.5 rounded-xl glass px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-white/5"
        >
          <ListChecks className="h-4 w-4 shrink-0 text-brand-glow" />
          {t("activity.scopeWholeSeries")}
        </button>
        <button
          onClick={() => setSeasonStep(true)}
          className="flex w-full items-center gap-2.5 rounded-xl glass px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-white/5"
        >
          <Layers className="h-4 w-4 shrink-0 text-cyan" />
          {t("activity.scopeOneSeason")}
        </button>
      </div>
    );
  }

  if (series && seasonStep) {
    return (
      <div className="space-y-4">
        <TargetHeader title={series.title} type="series" onChange={() => { setSeries(null); setSeasonStep(false); }} t={t} />
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          {t("title.season")}
          <input
            type="number"
            min={0}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="h-9 w-24 rounded-lg glass px-2.5 text-sm text-ink outline-none ring-focus"
          />
        </label>
        <button
          onClick={() => onPick(
            encodeLibraryRef({ kind: "season", seriesId: series.id, season: Number(season) }),
            `${series.title} — ${t("title.season")} ${season}`
          )}
          className="flex w-full items-center gap-2.5 rounded-xl glass px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-white/5"
        >
          <Layers className="h-4 w-4 shrink-0 text-brand-glow" />
          {t("activity.scopeWholeSeason")}
        </button>
        <div className="flex items-end gap-2">
          <label className="flex flex-1 items-center gap-2 text-xs text-ink-dim">
            {t("title.episode")}
            <input
              type="number"
              min={1}
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              className="h-9 w-full rounded-lg glass px-2.5 text-sm text-ink outline-none ring-focus"
            />
          </label>
          <button
            onClick={() => onPick(
              encodeLibraryRef({ kind: "episode", seriesId: series.id, season: Number(season), episode: Number(episode) }),
              `${series.title} — ${season}x${String(Number(episode)).padStart(2, "0")}`
            )}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl brand-gradient px-3.5 text-xs font-bold text-white"
          >
            {t("activity.scopeOneEpisode")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("activity.linkSearchPlaceholder")}
        className="mb-3 h-10 w-full rounded-xl glass px-3.5 text-sm text-ink outline-none ring-focus"
      />
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {libraryMatches.map((title) => (
          <button
            key={`lib-${title.type}-${title.id}`}
            onClick={() => pickTitle(title)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-white/5 hover:text-ink"
          >
            {title.type === "movie" ? <Film className="h-4 w-4 shrink-0 text-brand-glow" /> : <Tv className="h-4 w-4 shrink-0 text-cyan" />}
            <span className="min-w-0 flex-1 truncate">{title.title}</span>
            {title.year && <span className="shrink-0 text-xs text-ink-dim">{title.year}</span>}
          </button>
        ))}

        {externalResults.map((hit) => (
          <button
            key={`ext-${hit.type}-${hit.tmdbId}`}
            onClick={() => addAndPick(hit)}
            disabled={adding === `${hit.type}-${hit.tmdbId}`}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-white/5 hover:text-ink disabled:opacity-50"
          >
            {adding === `${hit.type}-${hit.tmdbId}` ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-glow" />
            ) : hit.type === "movie" ? (
              <ExternalLink className="h-4 w-4 shrink-0 text-brand-glow" />
            ) : (
              <ExternalLink className="h-4 w-4 shrink-0 text-cyan" />
            )}
            <span className="min-w-0 flex-1 truncate">{hit.title}</span>
            {hit.year && <span className="shrink-0 text-xs text-ink-dim">{hit.year}</span>}
          </button>
        ))}

        {query.trim() && libraryMatches.length === 0 && externalResults.length === 0 && (
          <p className="px-3 py-2 text-sm text-ink-dim">{t("common.noResults")}</p>
        )}
      </div>
      {addError && <p className="mt-2 text-xs font-semibold text-down">{addError}</p>}
    </>
  );
}

function TargetHeader({ title, type, onChange, t }: { title: string; type: "movie" | "series"; onChange: () => void; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg glass px-3.5 py-2.5 text-sm">
      {type === "movie" ? <Film className="h-4 w-4 shrink-0 text-brand-glow" /> : <Tv className="h-4 w-4 shrink-0 text-cyan" />}
      <span className="min-w-0 flex-1 truncate text-ink">{title}</span>
      <button onClick={onChange} className="shrink-0 text-xs font-semibold text-ink-dim hover:text-ink">
        {t("common.change")}
      </button>
    </div>
  );
}
