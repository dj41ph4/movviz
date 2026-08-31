"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TitlePanel } from "./TitlePanel";

export type PanelView =
  | {
      kind: "title";
      tmdbId: number;
      type: "movie" | "series";
      /** Screen position/size of the poster that was clicked, captured at click time — lets TitlePanel morph outward from exactly that spot instead of just fading in centered. Undefined when opened some other way (e.g. programmatically, with no originating element). */
      originRect?: { top: number; left: number; width: number; height: number };
    }
  | { kind: "person"; personId: number }
  | { kind: "collection"; collectionId: number };

function viewKey(view: PanelView): string {
  return view.kind === "title"
    ? `title:${view.type}:${view.tmdbId}`
    : view.kind === "person"
      ? `person:${view.personId}`
      : `collection:${view.collectionId}`;
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
 * While the panel is open, internal navigation links (/title/, /person/,
 * /collection/) clicked INSIDE the panel also stay in the panel: the current
 * view is swapped to the clicked target instead of navigating the page.
 *
 * Mount once per page (not per tab/section) so the panel survives tab
 * switches without unmounting, and render `titlePanel` once at the end of
 * the page's JSX.
 */
export function useTitlePanel() {
  const [view, setView] = useState<PanelView | null>(null);
  const isOpen = view !== null;

  const openTitlePanel = useCallback((tmdbId: number, type: "movie" | "series", originRect?: { top: number; left: number; width: number; height: number }) => {
    setView({ kind: "title", tmdbId, type, originRect });
  }, []);

  const closeTitlePanel = useCallback(() => {
    setView(null);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;
      // DashboardPosterCard's image/play link opts out when it has its own
      // action to take (starting playback) — otherwise this handler would
      // always win the race and open the fiche instead of playing anything.
      if (link.hasAttribute("data-skip-title-panel")) return;

      // Panel open: internal links clicked anywhere (including inside the
      // panel) swap the panel's view instead of navigating. Buttons (close,
      // add-to-library…) and the backdrop stay untouched.
      if (isOpen) {
        if (href.startsWith("/title/")) {
          const parts = href.replace("/title/", "").split("/");
          if (parts.length < 2) return;
          const t = parts[0] as "movie" | "series";
          const id = Number(parts[1]);
          if (!id) return;
          e.preventDefault();
          e.stopPropagation();
          setView((v) => (v && v.kind === "title" && v.tmdbId === id && v.type === t ? v : { kind: "title", tmdbId: id, type: t }));
          return;
        }
        if (href.startsWith("/person/")) {
          const id = Number(href.replace("/person/", "").split("/")[0]);
          if (!id) return;
          e.preventDefault();
          e.stopPropagation();
          setView((v) => (v && v.kind === "person" && v.personId === id ? v : { kind: "person", personId: id }));
          return;
        }
        if (href.startsWith("/collection/")) {
          const id = Number(href.replace("/collection/", "").split("/")[0]);
          if (!id) return;
          e.preventDefault();
          e.stopPropagation();
          setView((v) => (v && v.kind === "collection" && v.collectionId === id ? v : { kind: "collection", collectionId: id }));
          return;
        }
        return;
      }

      if (target.closest("[data-title-panel]")) return;
      if (!href.startsWith("/title/")) return;
      const parts = href.replace("/title/", "").split("/");
      if (parts.length < 2) return;
      const t = parts[0] as "movie" | "series";
      const id = Number(parts[1]);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      // stopPropagation here (capture phase) means the Link's own bubble-
      // phase onClick={closeOnClick} never fires, so any DashboardPosterCard
      // hover popover mid-open would otherwise be left floating over the
      // panel that's about to cover it — confirmed live. This lets it close
      // itself in response instead of relying on an event that never comes.
      window.dispatchEvent(new Event("movviz:title-panel-opening"));
      // The poster tile itself (image + rounded frame) is usually a child of
      // the <a> rather than the link's own full clickable area (which often
      // includes title/meta text below the artwork) — preferring it here
      // means the morph grows from the artwork the eye was actually on.
      const artwork = link.querySelector("img, [data-morph-source]") as HTMLElement | null;
      const rectEl = artwork ?? link;
      const r = rectEl.getBoundingClientRect();
      openTitlePanel(id, t, { top: r.top, left: r.left, width: r.width, height: r.height });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isOpen, openTitlePanel]);

  const titlePanel = (
    <AnimatePresence>
      {view && (
        <TitlePanel key={viewKey(view)} view={view} onClose={closeTitlePanel} />
      )}
    </AnimatePresence>
  );

  return { view, openTitlePanel, closeTitlePanel, titlePanel };
}