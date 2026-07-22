"use client";

import { Search, Command, Heart } from "lucide-react";
import { useCommandPalette } from "./CommandPalette";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import { useT } from "@/i18n/provider";

export function Topbar() {
  const { open } = useCommandPalette();
  const t = useT();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/5 bg-void/60 px-4 backdrop-blur-xl sm:gap-4 sm:px-6">
      {/* Unified search trigger */}
      <button
        onClick={open}
        className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-surface/50 px-3 text-left text-sm text-ink-dim transition-colors hover:border-brand/30 hover:text-ink-soft sm:px-4 md:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 truncate sm:block">{t("common.searchEverything")}</span>
        <span className="hidden items-center gap-1 rounded border border-white/12 px-1.5 py-0.5 text-[10px] font-semibold sm:flex">
          <Command className="h-3 w-3" /> K
        </span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <a
          href="https://github.com/sponsors/dj41ph4"
          target="_blank"
          rel="noreferrer"
          aria-label={t("settings.aboutSupportTitle")}
          className="flex h-10 w-10 items-center justify-center rounded-xl glass text-ink-soft transition-colors hover:border-magenta/30 hover:text-magenta"
        >
          <Heart className="h-4 w-4" />
        </a>
        <ThemeSwitcher />
        <LanguageSwitcher />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
