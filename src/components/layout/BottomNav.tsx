"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Download, Home, ListChecks, Menu, Search, Settings, X } from "lucide-react";
import { GESTION_NAV, NAV } from "@/lib/nav";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { usePendingRequests } from "@/lib/requests/usePendingRequests";
import { usePendingUsers } from "@/lib/auth/usePendingUsers";
import { useActiveDownloads } from "@/lib/downloads/useActiveDownloads";
import { effectiveAvatar } from "@/lib/auth/types";
import { ActivityMonitor } from "@/components/plex/ActivityMonitor";
import { NotificationBell } from "./NotificationBell";

const DESTINATIONS = [
  { path: "/", href: "/", label: "nav.home", icon: Home },
  { path: "/discover", href: "/discover", label: "nav.discover", icon: Compass },
  { path: "/library", href: "/library?tab=watchlist", label: "nav.mySpace", icon: Bookmark },
  { path: "/downloads", href: "/downloads", label: "nav.downloads", icon: Download },
] as const;

export function BottomNav({ openSearch, searchOpen, menuRef, menuOpen, openMenu, closeMenu }: {
  openSearch: (trigger: HTMLButtonElement) => void;
  searchOpen: boolean;
  menuRef: React.RefObject<HTMLDialogElement | null>;
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}) {
  const pathname = usePathname();
  const t = useT();
  const user = useCurrentUser();
  const pendingRequests = usePendingRequests();
  const pendingUsers = usePendingUsers();
  const activeDownloads = useActiveDownloads();
  const dialogContent = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin";
  const avatar = user && effectiveAvatar(user);
  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
  const extraItems = [...NAV.filter(item => item.href === "/calendar" || item.href === "/settings" || item.href === "/library"),
    { href: "/library?tab=wanted", labelKey: "nav.wanted", icon: ListChecks, adminOnly: false, liveBadge: undefined },
    ...GESTION_NAV]
    .filter(item => !item.adminOnly || isAdmin);

  return (
    <>
      <nav className="touch-nav" aria-label={t("nav.mainNavigation")}>
        <Link href="/" aria-label={t("nav.home")} className="touch-nav-brand">
          <img src="/brand/m/movviz-m-128.webp" alt="" width={42} height={42} />
        </Link>
        <div className="touch-nav-links">
          {DESTINATIONS.map(({ path, href, label, icon: Icon }) => (
            <Link key={path} href={href} className="touch-nav-item ring-focus" aria-current={isActive(path) ? "page" : undefined}>
              <Icon size={22} aria-hidden="true" />
              <span>{t(label)}</span>
              {path === "/downloads" && activeDownloads > 0 && <b className="touch-nav-badge">{activeDownloads}</b>}
            </Link>
          ))}
        </div>
        <div className="touch-nav-rail-actions">
          {isAdmin && (
            <Link href="/settings" className="touch-nav-item ring-focus" aria-current={isActive("/settings") ? "page" : undefined}>
              <Settings size={22} aria-hidden="true" />
              <span>{t("nav.settings")}</span>
            </Link>
          )}
          <button type="button" className="touch-nav-item ring-focus" aria-expanded={searchOpen} aria-controls="movviz-global-search" onClick={(e) => openSearch(e.currentTarget)}>
            <Search size={22} aria-hidden="true" />
            <span>{t("nav.search")}</span>
          </button>
          <button type="button" className="touch-nav-item ring-focus" aria-haspopup="dialog" onClick={openMenu}>
            <Menu size={22} aria-hidden="true" />
            <span>{t("nav.more")}</span>
          </button>
        </div>
        {user && (
          <Link href="/profile" className="touch-nav-profile ring-focus" aria-label={t("profile.title")} aria-current={isActive("/profile") ? "page" : undefined}>
            {avatar ? <img src={avatar} alt="" /> : user.username.slice(0, 2).toUpperCase()}
          </Link>
        )}
      </nav>

      <dialog
        ref={menuRef}
        className="touch-nav-dialog"
        aria-labelledby="touch-nav-menu-title"
        onClose={closeMenu}
        onClick={(e) => {
          if (!(e.target instanceof Node) || !dialogContent.current?.contains(e.target)) e.currentTarget.close();
        }}
      >
        <div ref={dialogContent} className="touch-nav-dialog-body">
          <div className="flex items-center justify-between gap-2">
            <h2 id="touch-nav-menu-title" className="px-2 text-base font-bold text-ink">{t("nav.more")}</h2>
            <div className="flex items-center gap-1">
              {menuOpen && isAdmin && <ActivityMonitor />}
              {menuOpen && <NotificationBell />}
              <button type="button" autoFocus onClick={() => menuRef.current?.close()} aria-label={t("common.close")} className="touch-header-button ring-focus">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {extraItems.map(({ href, labelKey, icon: Icon, liveBadge }) => {
              const count = liveBadge === "pendingRequests" ? pendingRequests : liveBadge === "pendingUsers" ? pendingUsers : 0;
              return (
                <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} onClick={() => menuRef.current?.close()}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-soft ring-focus active:bg-white/8 aria-[current=page]:bg-brand/15 aria-[current=page]:text-ink">
                  <Icon size={18} aria-hidden="true" />
                  <span className="flex-1">{t(labelKey)}</span>
                  {count > 0 && <b className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{count}</b>}
                </Link>
              );
            })}
          </div>
        </div>
      </dialog>
    </>
  );
}
