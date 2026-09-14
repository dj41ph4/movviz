"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { NAV, GESTION_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { toast } from "@/components/ui/Toast";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { effectiveAvatar } from "@/lib/auth/types";
import { usePendingRequests } from "@/lib/requests/usePendingRequests";
import { usePendingUsers } from "@/lib/auth/usePendingUsers";
import { useActiveDownloads } from "@/lib/downloads/useActiveDownloads";
import { useAutoUpdate } from "@/lib/settings/useAutoUpdate";
import { useSidebarCollapsed } from "@/lib/settings/useSidebarCollapsed";
import { ChevronDown, ClipboardList, Download, Loader2, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from "lucide-react";

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  platform: string;
  releaseNotes: string | null;
  downloadUrl: string | null;
  releaseUrl: string;
}

function fetcher(url: string) {
  return fetch(url, { cache: "no-store" }).then((r) => r.json());
}

export function Sidebar({ version }: { version: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();
  const user = useCurrentUser();
  const pendingRequests = usePendingRequests();
  const pendingUsers = usePendingUsers();
  const activeDownloads = useActiveDownloads();

  const prevCounts = useRef({ pendingRequests, pendingUsers, activeDownloads });
  const [pulseBadge, setPulseBadge] = useState<string | null>(null);

  useEffect(() => {
    if (activeDownloads > prevCounts.current.activeDownloads && activeDownloads > 0) {
      setPulseBadge("activeDownloads");
    }
    prevCounts.current = { pendingRequests, pendingUsers, activeDownloads };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDownloads]);

  useEffect(() => {
    if (!pulseBadge) return;
    const t = setTimeout(() => setPulseBadge(null), 2000);
    return () => clearTimeout(t);
  }, [pulseBadge]);

  const items = NAV.filter((item) => !item.adminOnly || user?.role === "admin");
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();

  const { data: updateInfo, isLoading } = useSWR<UpdateInfo>(
    user?.role === "admin" ? "/api/system/update" : null,
    fetcher,
    { refreshInterval: 60 * 60 * 1000, revalidateOnFocus: false }
  );

  const [installing, setInstalling] = useState(false);
  const [showNasInfo, setShowNasInfo] = useState(false);
  const autoUpdate = useAutoUpdate();
  // Anchor on globalThis so remounting the sidebar (page navigation) doesn't
  // re-trigger an update that was already applied.
  const g = globalThis as typeof globalThis & { __movvizAutoUpdateTriggered?: boolean };
  if (g.__movvizAutoUpdateTriggered === undefined) g.__movvizAutoUpdateTriggered = false;

  const triggerUpdate = async () => {
    setInstalling(true);
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast("error", t("update.failed", { error: err.error ?? "unknown" }));
      }
    } catch {
      toast("error", t("update.failed", { error: "network" }));
    } finally {
      setInstalling(false);
    }
  };

  // Auto-update: trigger silently when update is detected and auto-update is enabled
  useEffect(() => {
    if (
      updateInfo?.updateAvailable &&
      updateInfo.platform === "win32" &&
      autoUpdate.enabled &&
      !g.__movvizAutoUpdateTriggered
    ) {
      g.__movvizAutoUpdateTriggered = true;
      // Small delay so any pending background JSON writes (300ms debounce)
      // can flush to disk before the installer kills this process.
      setTimeout(() => triggerUpdate(), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateInfo?.updateAvailable, autoUpdate.enabled]);

  return (
    <aside
      className={cn(
        "nx-sidebar sticky top-0 hidden h-screen shrink-0 flex-col gap-1 border-r border-white/10 bg-[#080d20] py-4 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[84px] px-2" : "w-[235px] px-2.5",
      )}
    >
      {/* Brand — logo alone when collapsed, no button crammed next to it;
          the collapse toggle lives in the footer instead (see below), so
          this stays exactly "just the logo" as asked. */}
      <div className={cn("mb-4 flex items-center", collapsed ? "justify-center px-0" : "gap-2.5 px-2")}>
        <Link href="/" className="group flex items-center gap-2.5">
          <AnimatedLogo size="sm" />
          {!collapsed && <span className="text-lg font-black tracking-tight text-ink">Movviz</span>}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.filter((item) => item.href !== "/settings").map((item) => (
          <NavRow
            key={item.href}
            item={item}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={collapsed}
            liveCount={
              item.liveBadge === "pendingRequests" ? pendingRequests
              : item.liveBadge === "pendingUsers" ? pendingUsers
              : item.liveBadge === "activeDownloads" ? activeDownloads
              : 0
            }
            pulseBadge={pulseBadge}
          />
        ))}
        <GestionNavItem
          pathname={pathname}
          pendingRequests={pendingRequests}
          pendingUsers={pendingUsers}
          activeDownloads={activeDownloads}
          pulseBadge={pulseBadge}
          isAdmin={user?.role === "admin"}
          collapsed={collapsed}
          onExpandSidebar={toggleCollapsed}
        />
        {items.filter((item) => item.href === "/settings").map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} collapsed={collapsed} liveCount={0} pulseBadge={pulseBadge} />
        ))}
      </nav>

      {/* Compte utilisateur — avatar + nom + rôle, comme dans la charte.
          Pas de notion d'abonnement "Premium" ici : Movviz est gratuit et
          auto-hébergé (voir README), le rôle (Admin/Utilisateur) est
          l'équivalent honnête de ce badge. Replié : juste l'avatar,
          centré, comme demandé (logo + icônes seuls). */}
      {user && (
        <Link
          href="/profile"
          title={collapsed ? user.username : undefined}
          className={cn(
            "group flex items-center gap-2.5 rounded-lg py-2 transition-colors hover:bg-white/5",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full brand-gradient text-xs font-black text-white">
            {effectiveAvatar(user) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={effectiveAvatar(user)!} alt="" className="h-full w-full object-cover" />
            ) : (
              user.username.slice(0, 2).toUpperCase()
            )}
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-ink">{user.username}</div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-ink-dim">
                <ShieldCheck className="h-3 w-3 text-brand-glow" />
                {user.role === "admin" ? t("auth.admin") : t("auth.user")}
              </div>
            </div>
          )}
        </Link>
      )}

      {/* Version + Update button — collapsed down to just the status dot
          (still a real link to the version page) so the retracted sidebar
          stays logo + icons only, per the request. The collapse toggle
          itself lives here too (not up by the logo) so the header stays a
          clean, single, uncluttered logo. */}
      <div className={cn("flex flex-col gap-2 pt-2 border-t border-white/5", collapsed && "items-center")}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className={cn(
            "flex items-center rounded-lg text-ink-dim ring-focus transition-colors hover:bg-white/8 hover:text-ink",
            collapsed ? "h-9 w-9 justify-center" : "h-8 w-full justify-start gap-2.5 px-2.5 text-[13px] font-semibold",
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <><PanelLeftClose className="h-4 w-4" /> {t("nav.collapseSidebar")}</>}
        </button>
        <Link
          href="/settings?tab=about"
          title={collapsed ? `Movviz v${version}` : undefined}
          className={cn(
            "group flex items-center justify-center gap-2 rounded-xl text-[11px] font-semibold text-ink-dim/80 transition-all hover:text-ink-soft hover:bg-white/5",
            collapsed ? "h-7 w-7 px-0" : "px-3 py-2",
          )}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-ok/70 group-hover:bg-ok transition-colors" />
          {!collapsed && <>Movviz v{version}</>}
        </Link>

        {!collapsed && updateInfo?.updateAvailable && !isLoading && updateInfo.platform === "win32" && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={triggerUpdate}
            disabled={installing}
            className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-70 animate-pulse-glow"
          >
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {installing ? t("update.inProgress") : t("update.installNow", { version: updateInfo.latestVersion ?? "..." })}
          </motion.button>
        )}

        {!collapsed && updateInfo?.updateAvailable && !isLoading && updateInfo.platform !== "win32" && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => setShowNasInfo(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl glass-strong px-3 py-2 text-xs font-bold text-brand-glow hover:border-brand/30"
          >
            <Download className="h-4 w-4" />
            {t("update.available", { version: updateInfo.latestVersion ?? "..." })}
          </motion.button>
        )}

        {!collapsed && updateInfo && !updateInfo.updateAvailable && !isLoading && (
          <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-medium text-ok">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            {t("update.upToDate")}
          </div>
        )}
      </div>

      {showNasInfo && updateInfo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowNasInfo(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl glass-strong p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-ink">
                {t("update.available", { version: updateInfo.latestVersion ?? "..." })}
              </h2>
              <button
                onClick={() => setShowNasInfo(false)}
                aria-label={t("common.close")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-dim ring-focus hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">{t("settings.aboutUpdateNotWindows")}</p>
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-10 items-center justify-center rounded-xl glass px-4 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              {t("update.clickToUpdate")}
            </a>
            <button
              onClick={() => setShowNasInfo(false)}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white"
            >
              {t("update.whatsNewClose")}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

/** A single flat sidebar row — extracted so both the main list and the
 *  trailing Réglages row (rendered after the Gestion group) share it. */
function NavRow({ item, pathname, searchParams, liveCount, pulseBadge, collapsed = false }: { item: (typeof NAV)[number]; pathname: string; searchParams?: ReturnType<typeof useSearchParams>; liveCount: number; pulseBadge: string | null; collapsed?: boolean }) {
  const t = useT();
  // The series detail page lives at /library/series/[id] (season/episode
  // routes nested under it), not /series/[id] — without this, opening a
  // series' fiche left the sidebar showing nothing as active. Collections'
  // href points straight at /library?tab=collection (see nav.ts) — pathname
  // alone always reads "/library" there, so the query param must be checked
  // too, or this row never lit up as active.
  const [hrefPath, hrefQuery] = item.href.split("?");
  const hrefParams = hrefQuery ? new URLSearchParams(hrefQuery) : null;
  const active = item.href === "/"
    ? pathname === "/"
    : item.href === "/series"
      ? pathname.startsWith("/series") || pathname.startsWith("/library/series")
      : hrefParams
        ? pathname === hrefPath && [...hrefParams.entries()].every(([k, v]) => searchParams?.get(k) === v)
        : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? t(item.labelKey) : undefined}
      className={cn(
        "group relative flex items-center rounded-[8px] text-[13px] font-semibold transition-colors ring-focus",
        collapsed ? "h-12 justify-center px-0" : "h-9 gap-2.5 px-2.5",
        active ? "text-white" : "text-ink-soft hover:text-ink"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 -z-10 rounded-[8px] border border-[#8b6dff]/70 bg-[linear-gradient(100deg,rgba(123,76,255,.96),rgba(94,62,231,.92))] shadow-[0_0_18px_-8px_rgba(133,99,255,.95)]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span
        className={cn(
          "relative shrink-0 transition-colors",
          collapsed && !active && "flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] group-hover:bg-white/8",
        )}
      >
        <Icon
          className={cn(
            "transition-colors",
            collapsed ? "h-9 w-9" : "h-[17px] w-[17px]",
            active ? "text-white" : "text-ink-dim group-hover:text-ink-soft"
          )}
        />
        {/* Collapsed: no room for a numeric badge next to the label (there
            is no label) — a small dot keeps "something needs attention"
            visible without the sidebar growing back out. */}
        {collapsed && liveCount > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full brand-gradient ring-2 ring-[#080d20]",
              pulseBadge === item.liveBadge && "animate-badge-pulse"
            )}
          />
        )}
      </span>
      {!collapsed && <span className="flex-1">{t(item.labelKey)}</span>}
      {!collapsed && liveCount > 0 && (
        <span
          key={`${item.liveBadge}-${liveCount}`}
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient px-1.5 text-[10px] font-bold text-white animate-badge-pop",
            pulseBadge === item.liveBadge && "animate-badge-pulse"
          )}
        >
          {liveCount}
        </span>
      )}
    </Link>
  );
}

/** "Gestion" — collapsible group (Demandes / Activité / Historique /
 *  Corbeille / Problèmes / Utilisateurs), same open/close-follows-URL
 *  pattern the old Bibliothèque submenu used. Live badge counts are kept
 *  on their sub-row (not just summed on the parent) so an admin still sees
 *  at a glance which one has something waiting. */
function GestionNavItem({ pathname, pendingRequests, pendingUsers, activeDownloads, pulseBadge, isAdmin, collapsed = false, onExpandSidebar }: {
  pathname: string;
  pendingRequests: number;
  pendingUsers: number;
  activeDownloads: number;
  pulseBadge: string | null;
  isAdmin: boolean;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}) {
  const t = useT();
  const subs = GESTION_NAV.filter((s) => !s.adminOnly || isAdmin);
  const onGestion = subs.some((s) => pathname.startsWith(s.href));
  const [open, setOpen] = useState(onGestion);
  const anyLiveTotal = pendingRequests + pendingUsers + activeDownloads;

  useEffect(() => {
    setOpen(onGestion);
  }, [onGestion]);

  const liveCountFor = (item: (typeof GESTION_NAV)[number]) =>
    item.liveBadge === "pendingRequests" ? pendingRequests
    : item.liveBadge === "pendingUsers" ? pendingUsers
    : item.liveBadge === "activeDownloads" ? activeDownloads
    : 0;

  // Collapsed: no room for an inline flyout of sub-items, so the icon just
  // opens the sidebar back up (and the group, so the sub-items are right
  // there) instead of being a dead end.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); onExpandSidebar?.(); }}
        title={t("nav.management")}
        className={cn(
          "group relative flex h-12 items-center justify-center rounded-[8px] ring-focus",
          onGestion ? "text-white" : "text-ink-soft hover:text-ink"
        )}
      >
        {onGestion && (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 -z-10 rounded-[8px] border border-[#8b6dff]/70 bg-[linear-gradient(100deg,rgba(123,76,255,.96),rgba(94,62,231,.92))] shadow-[0_0_18px_-8px_rgba(133,99,255,.95)]"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <span className={cn("relative shrink-0", !onGestion && "flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] group-hover:bg-white/8")}>
          <ClipboardList className={cn("h-9 w-9 transition-colors", onGestion ? "text-white" : "text-ink-dim group-hover:text-ink-soft")} />
          {anyLiveTotal > 0 && (
            <span className={cn("absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full brand-gradient ring-2 ring-[#080d20]", pulseBadge && "animate-badge-pulse")} />
          )}
        </span>
      </button>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "group relative flex h-9 items-center rounded-[8px] ring-focus",
          onGestion ? "text-white" : "text-ink-soft hover:text-ink"
        )}
      >
        {onGestion && (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 -z-10 rounded-[8px] border border-[#8b6dff]/70 bg-[linear-gradient(100deg,rgba(123,76,255,.96),rgba(94,62,231,.92))] shadow-[0_0_18px_-8px_rgba(133,99,255,.95)]"
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-full flex-1 items-center gap-2.5 px-2.5 text-[13px] font-semibold ring-focus"
        >
          <ClipboardList
            className={cn(
              "h-[17px] w-[17px] transition-colors",
              onGestion ? "text-white" : "text-ink-dim group-hover:text-ink-soft"
            )}
          />
          <span className="flex-1 text-left">{t("nav.management")}</span>
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={t("nav.management")}
          aria-expanded={open}
          className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-dim ring-focus transition-colors hover:text-ink"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pb-1 pt-0.5">
              {subs.map((s) => {
                const active = pathname.startsWith(s.href);
                const liveCount = liveCountFor(s);
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={cn(
                      "ml-2.5 mr-1.5 flex items-center gap-2 rounded-lg px-3 py-2 pl-8 text-sm font-semibold transition-colors ring-focus",
                      active ? "bg-brand/12 text-brand-glow" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-brand-glow" : "bg-ink-dim/40")} />
                    <span className="flex-1">{t(s.labelKey)}</span>
                    {liveCount > 0 && (
                      <span
                        key={`${s.liveBadge}-${liveCount}`}
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient px-1.5 text-[10px] font-bold text-white animate-badge-pop",
                          pulseBadge === s.liveBadge && "animate-badge-pulse"
                        )}
                      >
                        {liveCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
