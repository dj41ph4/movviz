"use client";

import { useEffect, useState } from "react";
import { Search, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavSearch } from "@/lib/nav/useNavSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { ActivityMonitor } from "@/components/plex/ActivityMonitor";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useT } from "@/i18n/provider";
import { usePremiumAppearance } from "@/components/appearance/AppearanceProvider";
import { openCommandPalette } from "./CommandPalette";

export function Topbar() {
  const user = useCurrentUser();
  const t = useT();
  // THE search entry point — always visible here (the topbar, at the top of
  // the screen, is what "navrail" refers to, not the left Sidebar). Typing
  // pushes to /discover?q=, whose own card grid replaces the dashboard.
  const navSearch = useNavSearch();
  // Bêta desktop : la barre devient l'entrée de la palette de commandes
  // (Ctrl K), la langue et Sponsor passent dans le menu profil. Mobile et
  // tablette gardent la barre de recherche et les boutons d'aujourd'hui.
  const premium = usePremiumAppearance();

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
      data-scrolled={scrolled ? "true" : undefined}
      className={cn(
        "nx-topbar sticky top-0 z-30 flex h-15 items-center gap-2 border-b border-transparent px-4 transition-colors duration-300 sm:gap-4 sm:px-6 lg:h-14",
        scrolled ? "border-brand/15 bg-[#070d22]/88 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      {/* THE search box — always here, every screen size. Rendu mobile
          strict (PortraitTopHeader) : pill 46px, bordure électrique, fond
          #131836, icône 17px + placeholder 13px #B3B3B3 — voir
          .nx-search-pill. */}
      {premium && (
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t("nav.commandOpen")}
          aria-keyshortcuts="Control+K Meta+K"
          className="nx-command-trigger hidden h-10 min-w-0 flex-1 items-center gap-2.5 px-3.5 text-left lg:flex lg:max-w-[420px]"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[13px]">{t("nav.commandPlaceholder")}</span>
          <kbd className="nx-kbd">Ctrl K</kbd>
        </button>
      )}
      <div className={cn("group nx-search-pill flex h-[46px] min-w-0 flex-1 items-center gap-[10px] rounded-[23px] px-4 sm:max-w-md lg:max-w-[clamp(380px,30vw,650px)]", premium && "lg:hidden")}>
        <Search className="h-[17px] w-[17px] shrink-0 text-[#B3B3B3]" />
        <input
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
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-[#B3B3B3]"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <a
          href="https://github.com/sponsors/dj41ph4"
          target="_blank"
          rel="noreferrer"
          aria-label={t("settings.aboutSupportTitle")}
          className={cn("flex h-11 w-11 items-center justify-center rounded-full glass text-ink-soft transition-colors hover:border-magenta/30 hover:text-magenta", premium && "lg:hidden")}
        >
          <Heart className="h-4 w-4 animate-heartbeat fill-down text-down" />
        </a>
        {user?.role === "admin" && <ActivityMonitor />}
        <div className={cn(premium && "lg:hidden")}><LanguageSwitcher /></div>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
