"use client";

import { useEffect, useState } from "react";
import { Search, Command, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "./CommandPalette";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { ActivityMonitor } from "@/components/plex/ActivityMonitor";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useT } from "@/i18n/provider";

export function Topbar() {
  const { open } = useCommandPalette();
  const user = useCurrentUser();
  const t = useT();

  // Transparent at the very top of the page (reads seamlessly over a hero
  // banner on pages that have one, and blends into the page's own dark
  // background everywhere else) — becomes the usual glass surface as soon
  // as there's anything to scroll past, so it never sits ambiguously
  // translucent over unrelated scrolled content.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-2 px-4 transition-colors duration-300 sm:gap-4 sm:px-6",
        scrolled ? "border-b border-white/5 bg-void/60 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      )}
    >
      {/* Unified search trigger */}
      <button
        onClick={open}
        aria-label={t("common.searchEverything")}
        className="group flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-surface/50 px-3 text-left text-sm text-ink-dim transition-all hover:border-brand/30 hover:text-ink-soft hover:bg-surface focus-visible:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/30 sm:px-4 md:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 truncate sm:block">{t("common.searchEverything")}</span>
        <span className="hidden items-center gap-1 rounded-md border border-white/12 px-1.5 py-0.5 text-[10px] font-semibold sm:flex">
          <Command className="h-3 w-3" /> K
        </span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <a
          href="https://github.com/sponsors/dj41ph4"
          target="_blank"
          rel="noreferrer"
          aria-label={t("settings.aboutSupportTitle")}
          className="flex h-11 w-11 items-center justify-center rounded-xl glass text-ink-soft transition-colors hover:border-magenta/30 hover:text-magenta"
        >
          <Heart className="h-4 w-4 animate-heartbeat fill-down text-down" />
        </a>
        {user?.role === "admin" && <ActivityMonitor />}
        <ThemeSwitcher />
        <LanguageSwitcher />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
