"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

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
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ overflowing: false, atStart: true, atEnd: true, progress: 0 });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    setScrollState({
      overflowing: max > 4,
      atStart: scrollLeft <= 4,
      atEnd: scrollLeft >= max - 4,
      progress: max > 4 ? scrollLeft / max : 0,
    });
  }, []);

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

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className="group/row space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
        {onSeeAll && (
          <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold text-brand-glow hover:text-brand-2 transition-colors">
            {t("discover.seeAll")} <ChevronRight className="h-4 w-4" />
          </button>
        )}
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
        <div ref={scrollRef} onScroll={measure} className={cn("flex gap-4 overflow-x-auto pb-2")}>
          {children}
        </div>
      </div>
    </section>
  );
}
