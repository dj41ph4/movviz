"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CornerDownLeft, Compass, Loader2, Film, Tv } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";

interface Title {
  id: string;
  title: string;
  year: number | null;
  type: "movie" | "series";
  href: string;
}

interface TmdbHit {
  tmdbId: number;
  title: string;
  year: number | null;
  type: "movie" | "series";
  posterPath: string | null;
}

/** Debounce delay for the live catalog search as you type — short enough to
 *  feel instant, long enough that a fast typist doesn't fire a request per
 *  keystroke. */
const SEARCH_DEBOUNCE_MS = 200;

const PaletteCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(PaletteCtx);

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [titles, setTitles] = useState<Title[]>([]);
  const [tmdbHits, setTmdbHits] = useState<TmdbHit[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const t = useT();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen || titles.length > 0) return;
    Promise.all([
      fetch("/api/library/movies", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/library/series", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([m, s]) => {
      const movies: LibraryMovie[] = m.movies ?? [];
      const series: LibrarySeries[] = s.series ?? [];
      setTitles([
        ...movies.map((mv) => ({ id: mv.id, title: mv.title, year: mv.year, type: "movie" as const, href: `/title/movie/${mv.tmdbId}` })),
        ...series.map((sr) => ({ id: sr.id, title: sr.title, year: sr.year, type: "series" as const, href: `/title/series/${sr.tmdbId}` })),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActive(0);
      setTmdbHits([]);
      setSearching(false);
      debounceRef.current && clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    }
  }, [isOpen]);

  // Live catalog search as you type — no minimum character count. Debounced
  // so a fast typist doesn't fire a request per keystroke, and guarded by a
  // request id so a slow early response can never clobber a faster later one
  // (the classic search-race bug: type "a", then "ab", and "a"'s results
  // arrive last and overwrite "ab"'s).
  useEffect(() => {
    const q = query.trim();
    debounceRef.current && clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (!q) {
      setTmdbHits([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const myRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/metadata/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { results?: TmdbHit[] } | null) => {
          if (requestIdRef.current !== myRequestId) return; // a newer query already superseded this one
          setTmdbHits(d?.results?.slice(0, 6) ?? []);
          setSearching(false);
        })
        .catch(() => {
          if (requestIdRef.current !== myRequestId) return;
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      debounceRef.current && clearTimeout(debounceRef.current);
    };
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = NAV.map((n) => ({
      kind: "page" as const,
      id: n.href,
      label: t(n.labelKey),
      sub: t(n.hintKey),
      href: n.href,
    })).filter(
      (p) => !q || p.label.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q)
    );
    const matchedTitles = titles
      .filter((m) => !q || m.title.toLowerCase().includes(q))
      .slice(0, 4)
      .map((m) => ({
        kind: "media" as const,
        id: `lib-${m.id}`,
        label: m.title,
        sub: `${m.type === "movie" ? t("command.movie") : t("command.seriesOne")}${m.year ? ` · ${m.year}` : ""} · ${t("common.inLibrary")}`,
        href: m.href,
        icon: m.type,
      }));
    // Skip a TMDb hit already covered by a library match, so the same title
    // doesn't appear twice with two different destinations.
    const libraryTitles = new Set(matchedTitles.map((m) => m.label.toLowerCase()));
    const catalogHits = q
      ? tmdbHits
          .filter((h) => !libraryTitles.has(h.title.toLowerCase()))
          .map((h) => ({
            kind: "media" as const,
            id: `tmdb-${h.type}-${h.tmdbId}`,
            label: h.title,
            sub: `${h.type === "movie" ? t("command.movie") : t("command.seriesOne")}${h.year ? ` · ${h.year}` : ""}`,
            href: `/title/${h.type}/${h.tmdbId}`,
            icon: h.type,
          }))
      : [];
    const seeAll = q
      ? [{
          kind: "seeAll" as const,
          id: "see-all",
          label: t("command.seeAllResults", { query }),
          sub: t("command.seeAllResultsHint"),
          href: `/discover?q=${encodeURIComponent(query.trim())}`,
        }]
      : [];
    return [...pages, ...matchedTitles, ...catalogHits, ...seeAll];
  }, [query, t, titles, tmdbHits]);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
    setActive(0);
  };

  return (
    <PaletteCtx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl overflow-hidden rounded-2xl glass-strong shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-4">
                {searching ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-glow" />
                ) : (
                  <Search className="h-5 w-5 text-ink-dim" />
                )}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((a) => Math.min(a + 1, results.length - 1));
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((a) => Math.max(a - 1, 0));
                    }
                    if (e.key === "Enter" && results[active]) go(results[active].href);
                  }}
                  placeholder={t("command.placeholder")}
                  className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-dim"
                />
                <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-ink-dim sm:block">
                  ESC
                </kbd>
              </div>

              <div className="max-h-[46vh] overflow-y-auto p-2">
                {results.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-ink-dim">
                    {t("command.noMatch")} “{query}”
                  </div>
                )}
                {results.map((r, i) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      i === active ? "bg-brand/15" : "hover:bg-white/5"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        r.kind === "page" ? "bg-brand/15 text-brand-glow" : "bg-cyan/15 text-cyan"
                      )}
                    >
                      {r.kind === "seeAll" ? (
                        <Search className="h-4 w-4" />
                      ) : r.kind === "media" && "icon" in r && r.icon === "series" ? (
                        <Tv className="h-4 w-4" />
                      ) : r.kind === "media" ? (
                        <Film className="h-4 w-4" />
                      ) : (
                        <Compass className="h-4 w-4" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {r.label}
                      </span>
                      <span className="block text-xs text-ink-dim">{r.sub}</span>
                    </span>
                    {i === active && (
                      <CornerDownLeft className="h-4 w-4 text-ink-dim" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PaletteCtx.Provider>
  );
}
