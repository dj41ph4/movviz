"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavSearch } from "@/lib/nav/useNavSearch";
import { SearchSuggestPanel } from "./SearchSuggestPanel";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { ActivityMonitor } from "@/components/plex/ActivityMonitor";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useT } from "@/i18n/provider";
import "./topbar-premium.css";

export function Topbar({ inputRef, touchSearchOpen, openTouchSearch, closeTouchSearch, openTouchMenu }: {
  inputRef: RefObject<HTMLInputElement | null>;
  touchSearchOpen: boolean;
  openTouchSearch: (trigger: HTMLButtonElement) => void;
  closeTouchSearch: (restoreFocus?: boolean) => void;
  openTouchMenu: () => void;
}) {
  const user = useCurrentUser();
  const t = useT();
  const navSearch = useNavSearch();
  const boxRef = useRef<HTMLDivElement>(null);
  // Focus anywhere inside the box (input OR the suggestion panel) keeps the
  // panel open, so Tab/arrows can walk into it without it vanishing.
  const [panelFocus, setPanelFocus] = useState(false);
  const showPanel = panelFocus && !navSearch.value.trim();
  const focusables = () => [...(boxRef.current?.querySelectorAll<HTMLElement>("[data-search-panel] button, [data-search-panel] a[href]") ?? [])];

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (touchSearchOpen) {
        closeTouchSearch();
        return;
      }
      // First Escape clears the query, the second leaves the box.
      if (navSearch.value) navSearch.onChange("");
      else inputRef.current?.blur();
    } else if (touchSearchOpen && e.key === "Enter" && navSearch.value.trim()) {
      navSearch.submit(navSearch.value);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      const target = showPanel
        ? focusables()[0]
        : document.querySelector<HTMLElement>("[data-search-results] a[href]");
      if (target) { e.preventDefault(); target.focus(); }
    }
  };
  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target === inputRef.current) return;
    const items = focusables();
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" && i >= 0) { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === "ArrowUp" && i >= 0) { e.preventDefault(); (i === 0 ? inputRef.current : items[i - 1])?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); inputRef.current?.focus(); }
  };
  // Bêta desktop : la langue et Sponsor passent dans le menu profil. La
  // recherche reste la barre Stable partout (Seb, 2026-10-06 : pas de
  // palette Ctrl K).

  // Transparent at the very top of the page (reads seamlessly over a hero
  // banner on pages that have one, and blends into the page's own dark
  // background everywhere else) — becomes the usual glass surface as soon
  // as there's anything to scroll past, so it never sits ambiguously
  // translucent over unrelated scrolled content.
  //
  // Driven by IntersectionObserver against a zero-height sentinel placed
  // right before this header in AppShell, not a raw `window.scrollY`
  // listener — confirmed live that the scrollY approach was unreliable
  // in production (it correctly flipped to "scrolled" on the way down,
  // but never reverted back to transparent on the way back up to the
  // top, a one-directional bug never seen in local testing). Observing
  // the sentinel's own visibility sidesteps scroll-event listening
  // entirely and is the standard, battle-tested pattern for exactly
  // this "am I at the top of the page" question.
  const [scrolled, setScrolled] = useState(false);
  // Sticky bars below the topbar (calendar, library, dashboard) read its real height.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--nx-topbar-h", `${el.getBoundingClientRect().height}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const sentinel = document.getElementById("topbar-scroll-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled ? "true" : undefined}
      data-touch-search={touchSearchOpen ? "" : undefined}
      className={cn(
        "nx-topbar sticky top-0 z-30 flex h-15 items-center gap-2 border-b border-transparent px-4 transition-colors duration-300 sm:gap-4 sm:px-6 lg:h-14",
        scrolled ? "border-brand/15 bg-[#070d22]/88 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div
        id="movviz-global-search"
        ref={boxRef}
        onFocus={() => setPanelFocus(true)}
        onBlur={(e) => { if (!boxRef.current?.contains(e.relatedTarget as Node | null)) setPanelFocus(false); }}
        onKeyDown={onPanelKeyDown}
        className="group nx-search-pill relative flex h-[46px] min-w-0 flex-1 items-center gap-[10px] rounded-[23px] px-4 sm:max-w-md lg:max-w-[clamp(380px,30vw,650px)]"
      >
        <Search className="h-[17px] w-[17px] shrink-0 text-[#B3B3B3]" />
        <input
          ref={inputRef}
          onKeyDown={onSearchKeyDown}
          value={navSearch.value}
          onChange={(e) => navSearch.onChange(e.target.value)}
          onFocus={navSearch.onFocus}
          onBlur={navSearch.onBlur}
          placeholder={t("discover.searchPlaceholder")}
          aria-label={t("common.searchEverything")}
          // type="search" + autoComplete="off" — the ONLY visible text input
          // on every logged-in page (persistent header, never unmounts) was
          // getting silently autofilled with the browser's saved Movviz
          // login username on page load/focus (confirmed live: happened
          // even on a hard navigation straight to /profile, which rules out
          // any client-side React state race — this is the browser's own
          // autofill heuristic, not app code). Neither attribute is airtight
          // on its own in every browser, but type="search" already opts a
          // field out of the login-autofill heuristic in Chromium, and
          // autoComplete="off" is the standard second layer.
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-[#B3B3B3]"
        />
        {showPanel && (
          <SearchSuggestPanel
            onPick={(q) => { navSearch.submit(q); inputRef.current?.focus(); }}
            onNavigate={() => {
              setPanelFocus(false);
              inputRef.current?.blur();
              if (touchSearchOpen) closeTouchSearch(false);
            }}
          />
        )}
      </div>

      <Link href="/" className="touch-header-brand ring-focus" onClick={() => closeTouchSearch(false)}>
        <img src="/brand/m/movviz-m-128.webp" alt="" width={28} height={28} />
        <span>Movviz</span>
      </Link>
      <button type="button" className="touch-header-button touch-header-search ring-focus" aria-label={t("common.searchEverything")} aria-expanded={touchSearchOpen} aria-controls="movviz-global-search" onClick={(e) => openTouchSearch(e.currentTarget)}>
        <Search size={20} aria-hidden="true" />
      </button>
      <button type="button" className="touch-header-button touch-header-close ring-focus" aria-label={t("common.close")} onClick={() => closeTouchSearch()}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className="nx-topbar-tools ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        {user?.role === "admin" && <ActivityMonitor />}
        <NotificationBell />
        <UserMenu openTouchMenu={openTouchMenu} />
      </div>
    </header>
  );
}
