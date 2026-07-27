"use client";

import { ChevronRight } from "lucide-react";
import { useT } from "@/i18n/provider";

/**
 * Shared "title + horizontal scroll + See all" shell — extracted from
 * Discover's own `PosterRow` (which becomes a thin wrapper around this) so
 * the Dashboard's carousels use the exact same scroll/heading behavior
 * instead of a second implementation. Card rendering stays owned by each
 * caller (Discover's `DiscoverCard` keeps its add-to-library affordance;
 * the dashboard's lighter poster card just opens the sidepanel) — this
 * component only owns the row scaffolding.
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
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
        {onSeeAll && (
          <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold text-brand-glow hover:text-brand-2 transition-colors">
            {t("discover.seeAll")} <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {children}
      </div>
    </section>
  );
}
