"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TitlePanel } from "./TitlePanel";

export interface SelectedTitle {
  tmdbId: number;
  type: "movie" | "series";
}

/**
 * Shared "sidepanel instead of full navigation" behavior for any page that
 * lists movies/series as plain `<Link href="/title/{type}/{tmdbId}">` cards
 * (LibraryMovieCard, LibrarySeriesCard, collection parts, calendar entries…).
 * Intercepts clicks on those links in the capture phase — before Next's own
 * Link handler navigates — and opens TitlePanel instead. Card components
 * need zero changes: their existing <Link> markup just gets caught by
 * whichever page has this hook mounted higher up the tree.
 *
 * Mount once per page (not per tab/section) so the panel survives tab
 * switches without unmounting, and render `titlePanel` once at the end of
 * the page's JSX.
 */
export function useTitlePanel() {
  const [selectedTitle, setSelectedTitle] = useState<SelectedTitle | null>(null);

  const openTitlePanel = useCallback((tmdbId: number, type: "movie" | "series") => {
    setSelectedTitle({ tmdbId, type });
  }, []);

  const closeTitlePanel = useCallback(() => {
    setSelectedTitle(null);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-title-panel]") || target.closest("button")) return;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href?.startsWith("/title/")) return;
      const parts = href.replace("/title/", "").split("/");
      if (parts.length < 2) return;
      const t = parts[0] as "movie" | "series";
      const id = Number(parts[1]);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      openTitlePanel(id, t);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [openTitlePanel]);

  const titlePanel = (
    <AnimatePresence>
      {selectedTitle && (
        <TitlePanel
          tmdbId={selectedTitle.tmdbId}
          type={selectedTitle.type}
          onClose={closeTitlePanel}
        />
      )}
    </AnimatePresence>
  );

  return { selectedTitle, openTitlePanel, closeTitlePanel, titlePanel };
}
