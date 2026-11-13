"use client";

import { Suspense, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { LibrarySeriesCard } from "@/components/library/LibrarySeriesCard";
import { projectBleachLibrary, bleachPresentationKey, type BleachPart } from "@/lib/metadata/bleachPresentation";
import { SearchAndReplacePanel } from "@/components/library/SearchAndReplacePanel";
import { useT, useI18n } from "@/i18n/provider";
import { useTitleArtworkBatch, type TitleArtworkRef } from "@/components/media/useTitleArtworkBatch";
import { cn } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Film, ScanSearch, Loader2, SearchCheck, RefreshCw, Clapperboard, Heart, Grid2X2, Layers, ChevronDown, Ellipsis } from "lucide-react";
import { ANIME_GENRE_ID, TEEN_GENRE_ID, matchesAnimeByNames, matchesTeenByNames } from "@/lib/metadata/genreTaxonomy";

export const RENDER_BATCH_INITIAL = 200;
export const RENDER_BATCH_STEP = 200;

/** Les premières rangées s'affichent en priorité ; le reste du premier lot se monte ensuite, hors du chemin critique. */
const PRIORITY_ROWS = 10;
/** Fenêtre de rendu : seules les cartes proches de l'écran sont montées, les
 *  autres cases gardent leur emplacement d'attente (même taille). NEAR est la
 *  marge qui doit toujours être couverte ; FAR est la marge complétée ensuite
 *  par petits paliers (quelques rangées à la fois), pour que le défilement ne
 *  soit jamais bloqué par un gros lot de cartes. */
const WINDOW_NEAR_PX = 500;
const WINDOW_FAR_PX = 1300;
const WINDOW_GROW_ROWS = 1;
const WINDOW_GROW_DELAY_MS = 30;
/** Pendant un glissement rapide (ascenseur), la zone d'arrivée n'est montée
 *  qu'une fois le défilement posé : monter chaque zone traversée le saccadait. */
const WINDOW_SETTLE_MS = 80;
/** Les illustrations sont demandées par blocs de titres alignés, plus larges que
 *  la fenêtre : la demande ne change pas à chaque rangée montée (chaque
 *  changement relit tout le cache navigateur), et les rangées suivantes
 *  trouvent leurs images déjà résolues. */
const ARTWORK_BLOCK = 120;
/** Espace entre les cases (classe gap-4 de la grille). */
const GRID_GAP_PX = 16;
/** Dessin d'une case d'attente (même teinte et même arrondi que rounded-2xl
 *  bg-white/6), répété en fond des zones d'espacement. */
const SKELETON_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect style="width:calc(100% - ${GRID_GAP_PX}px);height:calc(100% - ${GRID_GAP_PX}px)" rx="16" fill="#fff" fill-opacity="0.06"/></svg>`
)}")`;
type RenderRange = { start: number; end: number };

/** Colonnes de la grille (mêmes seuils que les classes grid-cols-* ci-dessous). */
function gridColumns(): number {
  if (typeof window === "undefined") return 6;
  const w = window.innerWidth;
  return w >= 1536 ? 6 : w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 640 ? 3 : 2;
}
const priorityCount = () => PRIORITY_ROWS * gridColumns();

interface RescanIssue {
  kind: "missing" | "untracked" | "duplicate";
  path: string;
}

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  current: number;
  total: number;
  sourceId?: string;
}

const FILTERS: { id: "all" | LibraryStatus; key: string }[] = [
  { id: "all", key: "common.all" },
  { id: "available", key: "status.available" },
  { id: "missing", key: "status.missing" },
];
const TYPES: { id: "all" | "movie" | "series"; key: string; href: string }[] = [
  { id: "all", key: "common.all", href: "/library" },
  { id: "movie", key: "common.movies", href: "/library?type=movie" },
  { id: "series", key: "common.series", href: "/library?type=series" },
];
const SORTS: { id: "title" | "recent" | "rating"; key: string }[] = [
  { id: "title", key: "library.sortTitle" },
  { id: "recent", key: "library.sortRecent" },
  { id: "rating", key: "library.sortRating" },
];

type CombinedItem = { kind: "movie"; movie: LibraryMovie } | { kind: "series"; series: LibrarySeries & { seriesPart?: BleachPart } };
function titleOf(c: CombinedItem): string {
  return c.kind === "movie" ? c.movie.title : c.series.title;
}
// Plex-style A-Z jump index. Deliberately the exact same "raw first
// character" the grid's own sort comparator already uses (titleOf(a)
// .localeCompare(titleOf(b)), no article-stripping) — an index that grouped
// "The Matrix"/"Le Fabuleux Destin..." under "M"/"F" instead of "T"/"L"
// would jump confidently to a letter whose actual titles, in the REAL grid
// order, are elsewhere: the index has to match the sort it's indexing, not
// how a human would alphabetize the same list by hand.
function alphabetKeyOf(title: string): string {
  const first = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
const ALPHABET_KEYS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

/** Rayon (px) dans lequel les lettres voisines du pointeur se soulèvent. */
const INDEX_WAVE_RADIUS = 58;
const INDEX_WAVE_SHIFT = 16;
const INDEX_WAVE_SCALE = 0.6;

/**
 * Index A-Z (Plex-style) avec loupe : les lettres proches du pointeur se
 * soulèvent vers la gauche en vague, et une goutte affiche en grand la lettre
 * visée. Tout passe par des transformations posées directement sur les
 * éléments (aucun rendu React pendant le mouvement, aucune mise en page).
 */
const AlphabetIndex = memo(function AlphabetIndex({ available, onJump, label }: {
  available: Set<string>;
  onJump: (letter: string) => void;
  label: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dropLetterRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useShouldReduceMotion();

  /** Lettre dont la case (position de mise en page, insensible aux
   *  transformations en cours) est la plus proche de la hauteur du pointeur. */
  const nearestTo = (clientY: number): HTMLButtonElement | null => {
    const bar = barRef.current;
    if (!bar) return null;
    const y = clientY - bar.getBoundingClientRect().top;
    let nearest: HTMLButtonElement | null = null;
    let nearestDistance = Infinity;
    bar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const distance = Math.abs(y - (button.offsetTop + button.offsetHeight / 2));
      if (distance < nearestDistance) { nearestDistance = distance; nearest = button; }
    });
    return nearest;
  };
  const reset = () => {
    const bar = barRef.current;
    if (bar) {
      delete bar.dataset.open;
      bar.querySelectorAll<HTMLElement>("button").forEach((button) => { button.style.transform = ""; delete button.dataset.active; });
    }
    if (dropRef.current) { dropRef.current.style.opacity = "0"; dropRef.current.style.scale = "0.5"; }
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    const drop = dropRef.current;
    if (!bar || !drop || event.pointerType === "touch") return;
    const target = nearestTo(event.clientY);
    const y = event.clientY - bar.getBoundingClientRect().top;
    // Zone de survol élargie jusqu'à la goutte tant que la loupe est ouverte.
    bar.dataset.open = "true";
    bar.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button === target && !button.disabled) button.dataset.active = "true";
      else delete button.dataset.active;
      if (reduceMotion) return;
      const t = Math.max(0, 1 - Math.abs(y - (button.offsetTop + button.offsetHeight / 2)) / INDEX_WAVE_RADIUS);
      const lift = t * t * (3 - 2 * t);
      button.style.transform = lift > 0.001 ? `translateX(${(-lift * INDEX_WAVE_SHIFT).toFixed(2)}px) scale(${(1 + lift * INDEX_WAVE_SCALE).toFixed(3)})` : "";
    });
    if (!target || target.disabled) {
      drop.style.opacity = "0";
      drop.style.scale = "0.5";
      return;
    }
    drop.style.top = `${target.offsetTop + target.offsetHeight / 2}px`;
    drop.style.opacity = "1";
    drop.style.scale = "1";
    if (dropLetterRef.current) dropLetterRef.current.textContent = target.dataset.letter ?? "";
  };
  // Le clic valide la lettre affichée dans la goutte, où que soit le pointeur
  // dans la zone (barre, lettre soulevée ou goutte) : les lettres se déplacent
  // sous le pointeur, viser leur dessin exact serait impossible. Les boutons ne
  // reçoivent donc pas la souris ; au clavier (detail 0), c'est le bouton actif.
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const button = event.detail === 0
      ? (event.target as HTMLElement).closest<HTMLButtonElement>("button")
      : nearestTo(event.clientY);
    const letter = button?.dataset.letter;
    if (button && !button.disabled && letter) onJump(letter);
  };

  return (
    <div
      ref={barRef}
      className="fixed right-1.5 top-1/2 z-30 hidden -translate-y-1/2 cursor-pointer flex-col items-center gap-0.5 rounded-full glass px-1 py-2 before:absolute before:-inset-y-2 before:right-0 before:hidden before:w-28 before:content-[''] data-[open=true]:before:block sm:flex"
      aria-label={label}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onClick={onClick}
    >
      {ALPHABET_KEYS.map((letter) => {
        const has = available.has(letter);
        return (
          <button
            key={letter}
            type="button"
            disabled={!has}
            data-letter={letter}
            aria-label={letter}
            className={cn(
              "pointer-events-none relative flex h-4 w-4 origin-right items-center justify-center rounded-full text-[9px] font-bold leading-none transition-[transform,color,background-color] duration-100 ease-out",
              has ? "text-ink-dim focus-visible:bg-brand/20 focus-visible:text-brand-glow data-[active=true]:bg-brand/20 data-[active=true]:text-brand-glow" : "text-ink-dim/25"
            )}
          >
            {letter}
          </button>
        );
      })}
      {/* Goutte : un carré arrondi dont le coin vif pointe vers la barre. */}
      <div
        ref={dropRef}
        aria-hidden
        className="pointer-events-none absolute right-full mr-7 h-12 w-12 origin-right transition-[opacity,scale,top] duration-150 ease-out"
        style={{ top: 0, translate: "0 -50%", opacity: 0, scale: 0.5 }}
      >
        <div className="absolute inset-0 -rotate-45 rounded-[50%_50%_0_50%] bg-gradient-to-br from-brand-2 to-brand shadow-[0_10px_28px_-6px_rgba(124,58,237,0.85)] ring-1 ring-inset ring-white/25" />
        <span ref={dropLetterRef} className="relative flex h-full w-full items-center justify-center text-xl font-black text-white drop-shadow" />
      </div>
    </div>
  );
});

/**
 * Zone d'espacement : tient la place de `rows` rangées non montées, sur toute
 * la largeur de la grille. Une grille de plusieurs milliers de cases coûtait
 * ~50 ms de mise en page à chaque case modifiée ; deux zones et les seules
 * cartes proches de l'écran la ramènent à quelques centaines d'éléments.
 * Hauteur et fond calculés en CSS depuis la largeur réelle (unités cqw) : rien
 * à mesurer, et le dessin des cases d'attente reste aligné sur la grille.
 */
function GridSpacer({ rows, columns }: { rows: number; columns: number }) {
  if (rows <= 0) return null;
  const cellWidth = `((100cqw - ${(columns - 1) * GRID_GAP_PX}px) / ${columns})`;
  const rowHeight = `(${cellWidth} * 9 / 16 + ${GRID_GAP_PX}px)`;
  return (
    <div data-grid-spacer aria-hidden className="col-span-full [container-type:inline-size]">
      <div
        style={{
          height: `calc(${rows} * ${rowHeight} - ${GRID_GAP_PX}px)`,
          backgroundImage: SKELETON_TILE,
          backgroundSize: `calc(${cellWidth} + ${GRID_GAP_PX}px) calc(${rowHeight})`,
        }}
      />
    </div>
  );
}

type LibraryCellsHandle = { scrollToIndex: (index: number) => void };

/**
 * Grille fenêtrée : seules les cartes proches de l'écran sont montées ; le
 * reste est tenu par une zone d'espacement au-dessus et une au-dessous, de la
 * hauteur exacte des rangées qu'elles remplacent — la hauteur de défilement
 * est juste dès le premier affichage et la position d'un titre se calcule.
 * L'ancien rendu montait tout depuis le début jusqu'au point atteint : un saut
 * à une lettre lointaine créait des milliers de cartes avant d'arriver, et la
 * page les gardait toutes ensuite.
 */
function LibraryCells({ ref, items, locale, progressFor, watchedMovies, onChange }: {
  ref?: Ref<LibraryCellsHandle>;
  items: CombinedItem[];
  locale: string;
  progressFor: (movie: LibraryMovie) => EngineTorrent | null | undefined;
  watchedMovies: Set<number>;
  onChange: () => void;
}) {
  const total = items.length;
  const gridRef = useRef<HTMLDivElement>(null);
  const [initialRange] = useState<RenderRange>(() => ({ start: 0, end: priorityCount() }));
  const [range, setRange] = useState(initialRange);
  const [columns, setColumns] = useState(gridColumns);
  const rangeRef = useRef(initialRange);
  const totalRef = useRef(total);
  const syncRef = useRef<(immediate: boolean) => void>(() => {});
  const scrollToRef = useRef<(index: number) => void>(() => {});

  // Tout le pilotage de la fenêtre vit dans cet effet : il ne lit que des refs
  // et la mise en page réelle, et ne provoque un rendu que quand la fenêtre change.
  useEffect(() => {
    let growTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let currentColumns = gridColumns();

    function measure() {
      const grid = gridRef.current;
      if (!grid) return null;
      // Géométrie déduite de la grille elle-même, avec la même formule que les
      // zones d'espacement : une carte en cours d'animation (échelle, survol)
      // fausserait la mesure, et l'écart se multiplierait par des centaines de rangées.
      const rect = grid.getBoundingClientRect();
      const columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
      const cellWidth = (rect.width - (columns - 1) * GRID_GAP_PX) / columns;
      if (cellWidth <= 0) return null;
      return { rowHeight: (cellWidth * 9) / 16 + GRID_GAP_PX, columns, top: rect.top };
    }
    type Metrics = NonNullable<ReturnType<typeof measure>>;
    /** Rangées entières couvrant l'écran plus `margin` px au-dessus et au-dessous. */
    function rangeAround(m: Metrics, margin: number): RenderRange {
      const firstRow = Math.max(0, Math.floor((-m.top - margin) / m.rowHeight));
      const lastRow = Math.max(firstRow, Math.floor((window.innerHeight - m.top + margin) / m.rowHeight));
      const count = totalRef.current;
      return { start: Math.min(count, firstRow * m.columns), end: Math.min(count, (lastRow + 1) * m.columns) };
    }
    function apply(next: RenderRange) {
      const current = rangeRef.current;
      if (next.start === current.start && next.end === current.end) return false;
      rangeRef.current = next;
      setRange(next);
      return true;
    }
    function scheduleGrow() {
      if (growTimer === undefined) growTimer = setTimeout(growStep, WINDOW_GROW_DELAY_MS);
    }
    /** Complète la fenêtre jusqu'à la marge FAR, quelques rangées à la fois, et
     *  démonte ce qui en est sorti. */
    function growStep() {
      growTimer = undefined;
      const m = measure();
      if (!m) return;
      const far = rangeAround(m, WINDOW_FAR_PX);
      const step = m.columns * WINDOW_GROW_ROWS;
      const current = rangeRef.current;
      // L'écran a quitté la zone montée (défilement très rapide) : rien à
      // compléter ici, la zone d'arrivée sera montée quand le défilement se pose.
      if (far.start >= current.end || far.end <= current.start) return;
      const start = current.start > far.start
        ? Math.max(far.start, current.start - step)
        : current.start < far.start - 4 * step ? far.start : current.start;
      const end = current.end < far.end
        ? Math.min(far.end, current.end + step)
        : current.end > far.end + 4 * step ? far.end : current.end;
      if (apply({ start, end })) scheduleGrow();
    }
    /** Recale la fenêtre sur l'écran. `immediate` : monter la zone d'arrivée tout
     *  de suite (saut A-Z, premier affichage) ; sinon attendre que le défilement
     *  se pose si l'écran est sorti de la zone montée. */
    function syncRange(immediate: boolean) {
      const m = measure();
      if (!m) return;
      const near = rangeAround(m, WINDOW_NEAR_PX);
      if (m.columns !== currentColumns) {
        // Nouveau nombre de colonnes : les rangées ne tombent plus aux mêmes
        // titres, on repart de la zone visible.
        currentColumns = m.columns;
        setColumns(m.columns);
        apply(near);
        scheduleGrow();
        return;
      }
      const current = rangeRef.current;
      if (near.start < current.start || near.end > current.end) {
        if (!immediate) {
          if (settleTimer !== undefined) clearTimeout(settleTimer);
          settleTimer = setTimeout(() => { settleTimer = undefined; syncRange(true); }, WINDOW_SETTLE_MS);
          return;
        }
        // Fenêtres disjointes (saut lointain) : on repart de la zone d'arrivée seule.
        const disjoint = near.start >= current.end || near.end <= current.start;
        apply(disjoint ? near : { start: Math.min(near.start, current.start), end: Math.max(near.end, current.end) });
      }
      scheduleGrow();
    }
    function scrollToIndex(index: number) {
      // La position du titre se calcule (rangée × hauteur de rangée) : on y va
      // directement, puis la fenêtre monte les cartes de la zone d'arrivée.
      // Défilement animé seulement si la cible est déjà montée ; un trajet animé
      // à travers des milliers de rangées monterait chaque zone traversée.
      const m = measure();
      if (!m) return;
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const top = window.scrollY + m.top + Math.floor(index / m.columns) * m.rowHeight - padding;
      const mounted = index >= rangeRef.current.start && index < rangeRef.current.end;
      window.scrollTo({ top, behavior: mounted ? "smooth" : "auto" });
      syncRange(true);
    }
    const onMove = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; syncRange(false); });
    };

    syncRef.current = syncRange;
    scrollToRef.current = scrollToIndex;
    // capture : le défilement peut venir de la page comme d'un conteneur parent.
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
    return () => {
      syncRef.current = () => {};
      scrollToRef.current = () => {};
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      if (frame) cancelAnimationFrame(frame);
      if (growTimer !== undefined) clearTimeout(growTimer);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
    };
  }, []);

  // Premier affichage, ou liste de longueur différente (rafraîchissement, filtre
  // de genre…) : caler la fenêtre sur la position de défilement réelle.
  useEffect(() => {
    totalRef.current = total;
    const frame = requestAnimationFrame(() => syncRef.current(true));
    return () => cancelAnimationFrame(frame);
  }, [total]);

  useImperativeHandle(ref, () => ({ scrollToIndex: (index: number) => scrollToRef.current(index) }), []);

  // Toujours des rangées entières, sinon les zones d'espacement décaleraient les cartes.
  const rangeStart = Math.min(total, Math.floor(range.start / columns) * columns);
  const rangeEnd = Math.min(total, Math.ceil(range.end / columns) * columns);

  // One batch call for every card currently rendered — never per-card (see
  // useTitleArtworkBatch's own docs) — same 16:9 backdrop + logo resolution
  // Découverte/Tableau de bord use, so library cards share their exact look.
  const artworkStart = Math.floor(rangeStart / ARTWORK_BLOCK) * ARTWORK_BLOCK;
  const artworkEnd = Math.min(total, Math.ceil(rangeEnd / ARTWORK_BLOCK) * ARTWORK_BLOCK);
  const artworkRefs = useMemo<TitleArtworkRef[]>(
    () => items.slice(artworkStart, artworkEnd).map((entry) => entry.kind === "movie"
      ? { type: "movie" as const, tmdbId: entry.movie.tmdbId }
      : { type: "series" as const, tmdbId: entry.series.tmdbId, seriesPart: entry.series.seriesPart }),
    [items, artworkStart, artworkEnd]
  );
  const artworkByKey = useTitleArtworkBatch(artworkRefs, locale);

  const cells: React.ReactNode[] = [];
  for (let i = rangeStart; i < rangeEnd; i++) {
    const entry = items[i];
    const art = entry.kind === "movie" ? artworkByKey[`movie:${entry.movie.tmdbId}`] : artworkByKey[bleachPresentationKey({ tmdbId: entry.series.tmdbId, seriesPart: entry.series.seriesPart })];
    cells.push(entry.kind === "movie" ? (
      <LibraryMovieCard
        key={entry.movie.id}
        index={i}
        movie={entry.movie}
        torrent={progressFor(entry.movie)}
        watched={watchedMovies.has(entry.movie.tmdbId)}
        onChange={onChange}
        backdropPath={art?.backdropPath}
        logoPath={art?.logoPath}
        titleEmbedded={art?.titleEmbedded}
      />
    ) : (
      <LibrarySeriesCard
        key={bleachPresentationKey(entry.series)}
        index={i}
        series={entry.series}
        onChange={onChange}
        backdropPath={art?.backdropPath}
        logoPath={art?.logoPath}
        titleEmbedded={art?.titleEmbedded}
      />
    ));
  }

  return (
    <div ref={gridRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      <GridSpacer rows={rangeStart / columns} columns={columns} />
      {cells}
      <GridSpacer rows={Math.ceil(total / columns) - Math.ceil(rangeEnd / columns)} columns={columns} />
    </div>
  );
}

/** Pastille de sélection native (genre, tri) : même rendu que les segments de la capsule. */
function PillSelect({
  value, onChange, label, className, children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-full border border-white/10 bg-white/[.05] pl-3.5 pr-9 text-sm font-semibold text-ink outline-none transition-colors hover:bg-white/10 focus:border-brand/60 focus:ring-2 focus:ring-brand/20 lg:h-9 [&>option]:bg-[#14141c]"
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim" />
    </div>
  );
}

/**
 * The existing library grid: /library filters movies/series in place via
 * its type URL param. A caller can still constrain it with fixedType.
 */
export function LibraryGrid({ fixedType }: { fixedType: "all" | "movie" | "series" }) {
  return (
    <Suspense fallback={null}>
      <LibraryGridInner fixedType={fixedType} />
    </Suspense>
  );
}

function LibraryGridInner({ fixedType }: { fixedType: "all" | "movie" | "series" }) {
  const t = useT();
  const { locale } = useI18n();
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(
    () => (FILTERS.find((f) => f.id === searchParams.get("filter"))?.id ?? "all") as (typeof FILTERS)[number]["id"]
  );
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>(
    () => (SORTS.find((s) => s.id === searchParams.get("sort"))?.id ?? "title") as (typeof SORTS)[number]["id"]
  );
  const [genreFilter, setGenreFilter] = useState(() => searchParams.get("genre") ?? "");
  const [technicalFilter, setTechnicalFilter] = useState<"all" | "4k" | "hdr" | "watched">(() => {
    const value = searchParams.get("technical");
    return value === "4k" || value === "hdr" || value === "watched" ? value : "all";
  });
  const [rescanning, setRescanning] = useState(false);
  const [issues, setIssues] = useState<RescanIssue[] | null>(null);
  const [searchAndReplaceOpen, setSearchAndReplaceOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const typeParam = searchParams.get("type");
  const type = fixedType === "all" && (typeParam === "movie" || typeParam === "series") ? typeParam : fixedType;

  // Sync library filters to URL for back-button support.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (filter !== "all") p.set("filter", filter); else p.delete("filter");
    if (sort !== "title") p.set("sort", sort); else p.delete("sort");
    if (genreFilter) p.set("genre", genreFilter); else p.delete("genre");
    if (technicalFilter !== "all") p.set("technical", technicalFilter); else p.delete("technical");
    const qs = p.toString();
    if (qs !== searchParams.toString()) {
      router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
    }
  }, [filter, sort, genreFilter, technicalFilter, searchParams, router, pathname]);

  // Poll the job queue for any admin visit to this page (not just while
  // *this* component instance triggered a run) so a "search all missing"
  // job started before a navigation away and back is still shown as
  // in-progress on return, instead of the button forgetting it and
  // looking idle. Only admins can see/trigger the button, so only admins
  // need to poll this.
  const { data: jobsData } = useSWR<{ jobs: Job[] }>(user?.role === "admin" ? "/api/jobs" : null, { refreshInterval: 2000 });
  const searchMissingJob = jobsData?.jobs.find(
    (j) => j.sourceId === "search-all-missing" && (j.status === "queued" || j.status === "running")
  );
  const searchingMissing = starting || !!searchMissingJob;
  const wasSearchingRef = useRef(false);
  useEffect(() => {
    if (wasSearchingRef.current && !searchMissingJob) {
      setStarting(false);
      refresh();
    } else if (searchMissingJob) {
      setStarting(false);
    }
    wasSearchingRef.current = !!searchMissingJob;
  }, [searchMissingJob]);

  const searchMissing = async () => {
    setStarting(true);
    try {
      await fetch(`/api/library/search-missing?scope=${type}`, { method: "POST" });
      setTimeout(() => setStarting(false), 8000);
    } catch {
      setStarting(false);
    }
  };
  const searchMissingLabel = type === "movie"
    ? t("library.searchMissingMovies")
    : type === "series"
      ? t("library.searchMissingEpisodes")
      : t("library.searchMissing");

  // SWR serves whatever was last cached for these URLs instantly on
  // remount (even if it was another page, e.g. Découverte, that populated
  // it) instead of the grid going blank on every visit, then revalidates
  // in the background on the same 3s cadence the old polling used.
  const { data: moviesData, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    "/api/library/movies"
  );
  const { data: seriesData, mutate: mutateSeries } = useSWR<{ series: LibrarySeries[] }>(
    "/api/library/series"
  );
  const { data: torrentsData } = useSWR<{ torrents: EngineTorrent[] }>(
    "/api/engine/torrents"
  );
  const movies = moviesData?.movies ?? [];
  const series = useMemo(() => (seriesData?.series ?? []).flatMap(s => s.tmdbId === 30984 ? (["original", "tybw"] as const).map(part => projectBleachLibrary(s, part)) : [s]), [seriesData]);
  const torrents = torrentsData?.torrents ?? [];
  const loading = !moviesData || !seriesData;
  const refresh = () => { mutateMovies(); mutateSeries(); };

  // Union of real genres actually present in this library, sorted — plus
  // the two synthetic genres (genreTaxonomy.ts) ALWAYS offered, even with
  // zero matching titles yet, so the taxonomy reads the same on Films/
  // Séries as it does on Découverte (same ids, same two extra entries).
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const m of movies) for (const g of m.genres) set.add(g);
    for (const s of series) for (const g of s.genres) set.add(g);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [movies, series]);

  const rescan = async () => {
    setRescanning(true);
    setIssues(null);
    try {
      const res = await fetch("/api/library/rescan", { cache: "no-store" });
      if (res.ok) setIssues((await res.json()).issues ?? []);
      refresh();
    } finally {
      setRescanning(false);
    }
  };

  // Shared SWR key with the series detail page — fetched once per session.
  const { data: watchData } = useSWR<{ movies: number[] }>("/api/watch-status");
  const watchedMovies = useMemo(() => new Set<number>(watchData?.movies ?? []), [watchData]);
  const { data: watchlistData } = useSWR<{ items: { tmdbId: number; type: "movie" | "series" }[] }>("/api/watchlist");
  const watchlistKeys = useMemo(() => new Set((watchlistData?.items ?? []).map((item) => `${item.type}:${item.tmdbId}`)), [watchlistData]);

  const movieMatchesGenre = (m: LibraryMovie) => {
    if (!genreFilter) return true;
    if (genreFilter === ANIME_GENRE_ID) return matchesAnimeByNames(m.genres, m.isAnime);
    if (genreFilter === TEEN_GENRE_ID) return matchesTeenByNames("movie", m.genres);
    return m.genres.includes(genreFilter);
  };
  const movieMatchesTechnical = (m: LibraryMovie) => technicalFilter === "all"
    || (technicalFilter === "watched" && watchlistKeys.has(`movie:${m.tmdbId}`))
    || (technicalFilter === "4k" && /2160|4k/i.test(m.file?.resolution ?? ""))
    || (technicalFilter === "hdr" && !!m.file?.hdr);
  // Filet anti-doublons d'affichage : la base ne devrait jamais contenir 2x le
  // même tmdbId (voir reconcile.ts), mais un doublon peut exister suite à 2
  // sync Plex concurrents sur une fresh install. On n'affiche qu'une tuile par
  // tmdbId — même règle de "meilleure entrée" que reconcile (available >
  // downloading > searching > missing > upcoming, puis avec fichier, puis plus
  // ancien). Pure lecture : ne supprime rien en base, no-op sur une
  // bibliothèque saine.
  const STATUS_RANK: Record<LibraryStatus, number> = { available: 4, downloading: 3, searching: 2, missing: 1, upcoming: 0 };
  const dedupedMovies = useMemo(() => {
    const byTmdbId = new Map<number, LibraryMovie>();
    for (const m of movies) {
      const prev = byTmdbId.get(m.tmdbId);
      if (!prev) { byTmdbId.set(m.tmdbId, m); continue; }
      const rank = (x: LibraryMovie) => STATUS_RANK[x.status] * 10 + (x.file ? 1 : 0);
      const best = rank(m) !== rank(prev) ? (rank(m) > rank(prev) ? m : prev) : (m.addedAt <= prev.addedAt ? m : prev);
      byTmdbId.set(m.tmdbId, best);
    }
    return [...byTmdbId.values()];
  }, [movies]);
  const countAvailableEpisodes = (s: LibrarySeries) =>
    s.seasons.reduce((sum, season) => sum + season.episodes.filter((e) => e.status === "available").length, 0);
  const dedupedSeries = useMemo(() => {
    const byTmdbId = new Map<number, LibrarySeries>();
    for (const s of series) {
      const prev = byTmdbId.get(s.tmdbId);
      if (!prev) { byTmdbId.set(s.tmdbId, s); continue; }
      const a = countAvailableEpisodes(s);
      const b = countAvailableEpisodes(prev);
      const best = a !== b ? (a > b ? s : prev) : (s.addedAt <= prev.addedAt ? s : prev);
      byTmdbId.set(s.tmdbId, best);
    }
    return [...byTmdbId.values()];
  }, [series]);
  const movieItems = useMemo(
    () => (type === "series" ? [] : dedupedMovies.filter((m) => (filter === "all" || m.status === filter) && movieMatchesGenre(m) && movieMatchesTechnical(m))),
    [dedupedMovies, filter, type, genreFilter, technicalFilter, watchlistKeys]
  );
  const seriesStatus = (s: LibrarySeries): LibraryStatus => {
    const monitored = s.seasons.flatMap((se) => se.episodes).filter((e) => e.monitored);
    if (monitored.length > 0 && monitored.every((e) => e.status === "upcoming")) return "upcoming";
    if (monitored.some((e) => e.status === "downloading")) return "downloading";
    if (monitored.some((e) => e.status === "searching")) return "searching";
    // "Complete" when everything left is only scheduled (TBA/future dates).
    if (monitored.length > 0 && monitored.every((e) => e.status === "available" || e.status === "upcoming")) return "available";
    return "missing";
  };
  const seriesMatchesGenre = (s: LibrarySeries) => {
    if (!genreFilter) return true;
    if (genreFilter === ANIME_GENRE_ID) return matchesAnimeByNames(s.genres, s.isAnime);
    if (genreFilter === TEEN_GENRE_ID) return matchesTeenByNames("series", s.genres);
    return s.genres.includes(genreFilter);
  };
  const seriesMatchesTechnical = (s: LibrarySeries) => {
    if (technicalFilter === "all") return true;
    const episodes = s.seasons.flatMap((season) => season.episodes);
    if (technicalFilter === "watched") return watchlistKeys.has(`series:${s.tmdbId}`);
    return episodes.some((episode) => technicalFilter === "4k" ? /2160|4k/i.test(episode.file?.resolution ?? "") : !!episode.file?.hdr);
  };
  const seriesItems = useMemo(
    () => (type === "movie" ? [] : dedupedSeries.filter((s) => (filter === "all" || seriesStatus(s) === filter) && seriesMatchesGenre(s) && seriesMatchesTechnical(s))),
    [dedupedSeries, filter, type, genreFilter, technicalFilter, watchlistKeys]
  );

  // When "Tout" mixes movies and series, they must be sorted TOGETHER — every
  // sort mode, not just alphabetical — instead of each type being sorted on
  // its own and simply concatenated (which always put every movie before
  // every series, alphabetical order or not; sorting separately then
  // stitching the two lists together can never interleave them).
  const combinedItems = useMemo(() => {
    const combined: CombinedItem[] = [
      ...movieItems.map((movie): CombinedItem => ({ kind: "movie", movie })),
      ...seriesItems.map((series): CombinedItem => ({ kind: "series", series })),
    ];
    const addedAtOf = (c: CombinedItem) => {
      if (c.kind === "movie") return c.movie.file?.addedAt ?? c.movie.addedAt;
      let latest = 0;
      for (const season of c.series.seasons) {
        for (const episode of season.episodes) {
          if (episode.status === "available" && episode.file) latest = Math.max(latest, episode.file.addedAt);
        }
      }
      return latest || c.series.addedAt;
    };
    const recentTimes = sort === "recent" ? new Map(combined.map((item) => [item, addedAtOf(item)])) : null;
    const ratingOf = (c: CombinedItem) => (c.kind === "movie" ? c.movie.rating : c.series.rating);
    return sort === "recent"
      ? combined.sort((a, b) => (recentTimes?.get(b) ?? 0) - (recentTimes?.get(a) ?? 0))
      : sort === "rating"
        ? combined.sort((a, b) => ratingOf(b) - ratingOf(a))
        : combined.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  }, [movieItems, seriesItems, sort]);

  const total = combinedItems.length;

  // A-Z jump index (Plex-style) — only meaningful in alphabetical sort;
  // "recent"/"rating" order doesn't group titles by letter at all.
  const cellsRef = useRef<LibraryCellsHandle>(null);
  const availableLetters = useMemo(() => {
    if (sort !== "title") return new Set<string>();
    return new Set(combinedItems.map((c) => alphabetKeyOf(titleOf(c))));
  }, [combinedItems, sort]);
  const jumpToLetter = useCallback((letter: string) => {
    const index = combinedItems.findIndex((c) => alphabetKeyOf(titleOf(c)) === letter);
    if (index >= 0) cellsRef.current?.scrollToIndex(index);
  }, [combinedItems]);

  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((t) => t.infoHash === movie.activeInfoHash) : null;

  // --- Barre de contrôles : une capsule collante sur desktop, trois rangées
  // compactes (cibles de 44 px) sur mobile. Mêmes éléments, deux mises en page.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-lib-menu]")) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const segWrap = "no-scrollbar flex min-w-0 shrink-0 gap-0.5 overflow-x-auto rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]";
  const segBtn = (active: boolean) => cn(
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors lg:min-h-8",
    active ? "brand-gradient text-white shadow-lg" : "text-ink-soft hover:text-ink"
  );
  const chipBtn = (active: boolean) => cn(
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition-colors lg:min-h-8",
    active ? "border-brand/60 bg-brand/25 text-white" : "border-white/10 bg-white/[.05] text-ink-soft hover:bg-white/10 hover:text-ink"
  );

  const typesSeg = fixedType === "all" ? (
    <div className={segWrap}>
      {TYPES.map((item) => (
        <Link key={item.id} href={item.href} className={segBtn(item.id === type)}>
          {item.id === "movie" ? <Film className="h-3.5 w-3.5" /> : item.id === "series" ? <Clapperboard className="h-3.5 w-3.5" /> : <Grid2X2 className="h-3.5 w-3.5" />}
          {t(item.key)}
        </Link>
      ))}
      <Link href="/library?tab=collection" className={segBtn(false)}>
        <Layers className="h-3.5 w-3.5" />{t("nav.collections")}
      </Link>
    </div>
  ) : null;
  const statusSeg = (
    <div className={segWrap}>
      {FILTERS.map((f) => (
        <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={segBtn(filter === f.id)}>
          {t(f.key)}
        </button>
      ))}
    </div>
  );
  const sortSeg = (
    <div className={segWrap}>
      {SORTS.map((s) => (
        <button key={s.id} type="button" onClick={() => setSort(s.id)} aria-pressed={sort === s.id} className={segBtn(sort === s.id)}>
          {t(s.key)}
        </button>
      ))}
    </div>
  );
  const techChips = (
    <>
      <button type="button" onClick={() => setTechnicalFilter((v) => v === "4k" ? "all" : "4k")} aria-pressed={technicalFilter === "4k"} className={chipBtn(technicalFilter === "4k")}>4K</button>
      <button type="button" onClick={() => setTechnicalFilter((v) => v === "hdr" ? "all" : "hdr")} aria-pressed={technicalFilter === "hdr"} className={chipBtn(technicalFilter === "hdr")}>HDR</button>
      <button type="button" onClick={() => setTechnicalFilter((v) => v === "watched" ? "all" : "watched")} aria-pressed={technicalFilter === "watched"} className={chipBtn(technicalFilter === "watched")}>
        <Heart className="h-3.5 w-3.5" />{t("watchlist.added")}
      </button>
    </>
  );
  const genreOptions = (
    <>
      <option value="">{t("discover.genres")} · {t("common.all")}</option>
      <option value={ANIME_GENRE_ID}>{t("discover.genreAnime")}</option>
      <option value={TEEN_GENRE_ID}>{t("discover.genreTeen")}</option>
      {allGenres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
    </>
  );
  const countLabel = (
    <span className="shrink-0 whitespace-nowrap px-1.5 text-sm font-semibold text-ink-dim">
      <b className="text-ink">{total}</b> {t("common.titles")}
    </span>
  );

  const menuItem = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-white/8 disabled:opacity-50";
  const busyMenu = searchingMissing || rescanning;
  const actionsMenu = user?.role === "admin" ? (
    <div data-lib-menu className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={t("library.moreActions")}
        title={t("library.moreActions")}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[.05] text-ink-soft transition-colors hover:bg-white/10 hover:text-ink lg:h-9 lg:w-9"
      >
        {busyMenu ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ellipsis className="h-4 w-4" />}
        {searchingMissing && searchMissingJob && searchMissingJob.total > 1 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[9px] font-bold text-white">
            {searchMissingJob.current}/{searchMissingJob.total}
          </span>
        )}
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-2xl border border-white/12 bg-[#12121c]/95 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            role="menuitem"
            disabled={searchingMissing}
            onClick={() => { setMenuOpen(false); searchMissing(); }}
            title={
              searchMissingJob?.status === "queued"
                ? t("library.searchMissingWaiting")
                : searchingMissing && searchMissingJob && searchMissingJob.total > 1
                  ? `${searchMissingLabel} — ${searchMissingJob.current} / ${searchMissingJob.total}`
                  : searchMissingLabel
            }
            className={menuItem}
          >
            {searchingMissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4 text-ink-dim" />}
            {searchMissingLabel}
          </button>
          <button type="button" role="menuitem" disabled={rescanning} onClick={() => { setMenuOpen(false); rescan(); }} className={menuItem}>
            {rescanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4 text-ink-dim" />}
            {t("library.rescan")}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setSearchAndReplaceOpen(true); }} className={menuItem}>
            <RefreshCw className="h-4 w-4 text-ink-dim" />
            {t("library.searchAndReplace")}
          </button>
        </div>
      )}
    </div>
  ) : null;

  const issuesPanel = issues && (
    <div className="mb-4 rounded-2xl border border-white/8 bg-black/20 p-3.5">
      {issues.length === 0 ? (
        <p className="text-sm text-ok">{t("library.rescanClean")}</p>
      ) : (
        <div className="space-y-1.5">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-ink-soft">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-semibold", issue.kind === "missing" ? "bg-down/12 text-down" : issue.kind === "duplicate" ? "bg-cyan/12 text-cyan" : "bg-amber/12 text-amber")}>
                {issue.kind === "missing" ? t("library.fileMissing") : issue.kind === "duplicate" ? t("library.duplicateMerged") : t("library.untrackedFile")}
              </span>
              <span className="truncate font-mono">{issue.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="nx-library-grid">
      <div className="nx-library-main min-w-0">
      {/* Desktop : une capsule collante unique (type, filtres, statut, genre, tri, actions). */}
      <div className="nx-lib-bar sticky top-[calc(var(--nx-topbar-h,3.5rem)+0.5rem)] z-20 mb-4 hidden flex-wrap items-center gap-2.5 rounded-[26px] border border-white/10 bg-gradient-to-b from-white/[.07] to-white/[.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_16px_34px_-14px_rgba(0,0,0,.65)]! backdrop-blur-xl lg:flex">
        {typesSeg}
        <div className="flex items-center gap-1.5">{techChips}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {countLabel}
          {statusSeg}
          <PillSelect value={genreFilter} onChange={setGenreFilter} label={t("discover.genres")} className="max-w-44">{genreOptions}</PillSelect>
          <PillSelect value={sort} onChange={(v) => setSort(v as (typeof SORTS)[number]["id"])} label={t("library.sortTitle")}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{t(s.key)}</option>)}
          </PillSelect>
          {actionsMenu}
        </div>
      </div>

      {/* Mobile / tablette : trois rangées compactes, cibles de 44 px. */}
      <div className="mb-4 space-y-2 rounded-3xl border border-white/10 bg-white/[.035] p-2.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          {countLabel}
          <PillSelect value={genreFilter} onChange={setGenreFilter} label={t("discover.genres")} className="min-w-0 flex-1">{genreOptions}</PillSelect>
          {actionsMenu}
        </div>
        <div className="no-scrollbar -mx-0.5 flex gap-2 overflow-x-auto px-0.5">
          {typesSeg}
          {statusSeg}
        </div>
        <div className="no-scrollbar -mx-0.5 flex items-center gap-2 overflow-x-auto px-0.5">
          {sortSeg}
          {techChips}
        </div>
      </div>
      {issuesPanel}

      {sort === "title" && total > RENDER_BATCH_INITIAL && (
        <AlphabetIndex available={availableLetters} onJump={jumpToLetter} label={t("library.jumpToLetter")} />
      )}

        <LibraryCells
          ref={cellsRef}
          items={combinedItems}
          // Nouveau filtre ou tri : grille remontée, la fenêtre repart des rangées prioritaires.
          key={`${filter}|${type}|${sort}`}
          locale={locale}
          progressFor={progressFor}
          watchedMovies={watchedMovies}
          onChange={refresh}
        />

      {loading && total === 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div key={i}>
              <div className="aspect-video animate-pulse rounded-2xl bg-white/6" />
            </div>
          ))}
        </div>
      )}
      {!loading && total === 0 && (
        <p className="col-span-full py-16 text-center text-ink-dim">{t("library.empty")}</p>
      )}

      <SearchAndReplacePanel open={searchAndReplaceOpen} onClose={() => setSearchAndReplaceOpen(false)} />
      </div>
    </div>
  );
}
