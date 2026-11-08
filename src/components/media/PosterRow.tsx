"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { createRowImagePreloader } from "./rowImagePreloader";
import { CarouselImageContext } from "./CarouselImageContext";
import { usePlaybackActive } from "@/lib/player/PlayerProvider";

/**
 * Shared "title + horizontal scroll + See all" shell — extracted from
 * Discover's own `PosterRow` (which becomes a thin wrapper around this) so
 * the Dashboard's carousels use the exact same scroll/heading behavior
 * instead of a second implementation. Card rendering stays owned by each
 * caller (Discover's `DiscoverCard` keeps its add-to-library affordance;
 * the dashboard's lighter poster card just opens the sidepanel) — this
 * component only owns the row scaffolding.
 *
 * Scroll affordances (position indicator, edge arrows, paged scroll) are
 * pointer-only enhancements: touch devices already scroll rows fine by
 * swiping, so the arrows only ever render on `sm:` and up, and the
 * indicator/arrows never appear at all when a row's content doesn't
 * overflow its width in the first place.
 */
export function PosterRow({
  title,
  onSeeAll,
  onNearEnd,
  expandable,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  onNearEnd?: () => void;
  /** Adds a "show all" toggle that lays the row out as a wrapping grid (up to 160 cards, full rows only) instead of a swipe strip. */
  expandable?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const playbackActive = usePlaybackActive();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [scrollState, setScrollState] = useState({ overflowing: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    if (onNearEnd && max - scrollLeft <= clientWidth * 1.5) onNearEnd();
    const next = {
      overflowing: max > 4,
      atStart: scrollLeft <= 4,
      atEnd: scrollLeft >= max - 4,
    };
    setScrollState((previous) => previous.overflowing === next.overflowing
      && previous.atStart === next.atStart && previous.atEnd === next.atEnd
      ? previous : next);
  }, [onNearEnd]);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    // Re-measure on row resize (window resize, sidebar collapse, etc.) in
    // addition to scroll — content width can change without a scroll event.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  // Grille dépliée : jusqu'à 160 cartes, tronquées à des lignes complètes pour ne jamais
  // laisser une dernière ligne à moitié vide (le nombre de colonnes dépend de la largeur).
  useEffect(() => {
    const row = scrollRef.current;
    if (!expanded || !row) return;
    const trim = () => {
      const cards = Array.from(row.children) as HTMLElement[];
      cards.forEach((card) => { card.style.display = ""; });
      if (cards.length === 0) return;
      const top = cards[0].offsetTop;
      const columns = Math.max(1, cards.filter((card) => card.offsetTop === top).length);
      const shown = Math.min(cards.length, 160);
      const keep = shown >= columns ? Math.floor(shown / columns) * columns : shown;
      cards.forEach((card, index) => { if (index >= keep) card.style.display = "none"; });
    };
    trim();
    const ro = new ResizeObserver(trim);
    ro.observe(row);
    return () => {
      ro.disconnect();
      Array.from(row.children).forEach((card) => { (card as HTMLElement).style.display = ""; });
    };
  }, [expanded, children]);

  useEffect(() => {
    const row = scrollRef.current;
    if (row) return createRowImagePreloader(row, { playbackActive });
  }, [playbackActive]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className="nx-poster-row group/row space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
        <div className="flex items-center gap-3">
          {expandable && (expanded || scrollState.overflowing) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              title={expanded ? t("dashboard.collapseRow") : t("dashboard.expandRow")}
              className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[.05] px-3 text-xs font-semibold text-ink-soft transition-colors hover:bg-brand/25 hover:text-white sm:h-8"
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{expanded ? t("dashboard.collapseRow") : t("dashboard.expandRow")}</span>
            </button>
          )}
          {onSeeAll && (
            <button onClick={onSeeAll} className="flex h-11 items-center gap-1 text-sm font-semibold text-brand-glow hover:text-brand-2 transition-colors sm:h-auto">
              {t("discover.seeAll")} <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        {scrollState.overflowing && !scrollState.atStart && (
          <button
            onClick={() => scrollByPage(-1)}
            aria-label={t("common.previous")}
            className="absolute left-0 top-0 bottom-2 z-10 hidden w-10 items-center justify-center bg-gradient-to-r from-void/90 to-transparent text-ink opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-brand-glow sm:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {scrollState.overflowing && !scrollState.atEnd && (
          <button
            onClick={() => scrollByPage(1)}
            aria-label={t("common.next")}
            className="absolute right-0 top-0 bottom-2 z-10 hidden w-10 items-center justify-center bg-gradient-to-l from-void/90 to-transparent text-ink opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-brand-glow sm:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
        <div ref={scrollRef} onScroll={measure} className={cn("flex gap-4 pb-2", expanded ? "flex-wrap justify-between" : "overflow-x-auto overflow-y-hidden")}>
          <CarouselImageContext.Provider value={true}>{children}</CarouselImageContext.Provider>
        </div>
      </div>
    </section>
  );
}
