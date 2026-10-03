"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { NAV, GESTION_NAV, type NavItem } from "@/lib/nav";
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
import { SidebarReleaseFooter, type SidebarUpdateInfo } from "./SidebarReleaseFooter";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

type LiveBadge = NonNullable<NavItem["liveBadge"]>;
const SIDEBAR_STORAGE_KEY = "movviz.sidebar.collapsed";

function fetcher(url: string) { return fetch(url, { cache: "no-store" }).then((r) => r.json()); }

function matchesRoute(item: NavItem, pathname: string, searchParams?: ReturnType<typeof useSearchParams>) {
  const [hrefPath, hrefQuery] = item.href.split("?");
  const hrefParams = hrefQuery ? new URLSearchParams(hrefQuery) : null;
  if (item.href === "/") return pathname === "/";
  if (item.href === "/series") return pathname.startsWith("/series") || pathname.startsWith("/library/series");
  if (hrefParams) return pathname === hrefPath && [...hrefParams.entries()].every(([key, value]) => searchParams?.get(key) === value);
  return pathname.startsWith(item.href);
}

function countFor(item: NavItem, counts: Record<LiveBadge, number>) { return item.liveBadge ? counts[item.liveBadge] : 0; }

/** A tooltip that never participates in rail geometry. */
function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const showLater = () => { place(); timeoutRef.current = setTimeout(() => setOpen(true), 220); };
  const hide = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setOpen(false); };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  return (
    <span ref={triggerRef} className="block shrink-0" onMouseEnter={showLater} onMouseLeave={hide} onFocus={() => { place(); setOpen(true); }} onBlur={hide}>
      {children}
      {open && <span role="tooltip" style={position} className="fixed z-[80] -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#11172d] px-2.5 py-1.5 text-xs font-medium text-white shadow-xl">{label}</span>}
    </span>
  );
}

function LiveBadge({ count, pulse, compact }: { count: number; pulse: boolean; compact?: boolean }) {
  if (count <= 0) return null;
  return compact
    ? <span className={cn("absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full brand-gradient px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-[#080d20]", pulse && "animate-badge-pulse")}>{count > 99 ? "99+" : count}</span>
    : <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient px-1.5 text-[10px] font-bold text-white animate-badge-pop", pulse && "animate-badge-pulse")}>{count}</span>;
}

function ActiveMarker() { return <span aria-hidden className="absolute left-0 h-6 w-0.5 rounded-r-full bg-brand-glow" />; }

function NavRow({ item, pathname, searchParams, collapsed, counts, pulseBadge, updateAvailable }: {
  item: NavItem; pathname: string; searchParams?: ReturnType<typeof useSearchParams>; collapsed: boolean;
  counts: Record<LiveBadge, number>; pulseBadge: LiveBadge | null; updateAvailable?: boolean;
}) {
  const t = useT();
  const active = matchesRoute(item, pathname, searchParams);
  const count = countFor(item, counts);
  const Icon = item.icon;
  const content = (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(
      "group relative flex h-11 w-full shrink-0 items-center rounded-lg text-[13px] font-semibold ring-focus transition-colors duration-150",
      collapsed ? "justify-center" : "gap-2.5 pl-[18px] pr-2.5",
      active ? "bg-brand/12 text-white" : "text-ink-soft hover:bg-white/[0.04] hover:text-ink",
    )}>
      {active && <ActiveMarker />}
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon className={cn("h-[19px] w-[19px]", active ? "text-brand-glow" : "text-ink-dim group-hover:text-ink-soft")} />
        <LiveBadge count={count} compact={collapsed} pulse={pulseBadge === item.liveBadge} />
      </span>
      {!collapsed && <span className="flex-1 truncate">{t(item.labelKey)}</span>}
      {/* The download count is already anchored to its icon.  Rendering it at
          the row end as well produced two identical desktop badges. */}
      {!collapsed && item.liveBadge !== "activeDownloads" && <LiveBadge count={count} pulse={pulseBadge === item.liveBadge} />}
      {!collapsed && updateAvailable && <span aria-label={t("update.available", { version: "" })} className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-glow" />}
    </Link>
  );
  return collapsed ? <SidebarTooltip label={t(item.labelKey)}>{content}</SidebarTooltip> : content;
}

function GestionNavItem({ pathname, searchParams, counts, pulseBadge, isAdmin, collapsed }: {
  pathname: string; searchParams: ReturnType<typeof useSearchParams>; counts: Record<LiveBadge, number>;
  pulseBadge: LiveBadge | null; isAdmin: boolean; collapsed: boolean;
}) {
  const t = useT();
  const subs = GESTION_NAV.filter((item) => !item.adminOnly || isAdmin);
  const onGestion = subs.some((item) => matchesRoute(item, pathname, searchParams));
  const [expandedGroupOpen, setExpandedGroupOpen] = useState(onGestion);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const aggregateCount = counts.pendingRequests + counts.pendingUsers;
  useEffect(() => setExpandedGroupOpen(onGestion), [onGestion]);
  useEffect(() => { setFlyoutOpen(false); }, [collapsed, pathname]);
  useEffect(() => {
    if (!collapsed) return;
    const closeOutside = (event: MouseEvent) => { if (!groupRef.current?.contains(event.target as Node) && !flyoutRef.current?.contains(event.target as Node)) setFlyoutOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && flyoutOpen) { setFlyoutOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", closeOutside); document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [collapsed, flyoutOpen]);
  const toggle = () => {
    if (collapsed) {
      if (!flyoutOpen && triggerRef.current) setFlyoutTop(triggerRef.current.getBoundingClientRect().top);
      setFlyoutOpen((value) => !value);
    } else setExpandedGroupOpen((value) => !value);
  };
  const trapFlyoutTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const nodes = flyoutRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    if (!nodes?.length) return;
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const rows = (flyout = false) => subs.map((item) => {
    const active = matchesRoute(item, pathname, searchParams);
    const count = countFor(item, counts);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setFlyoutOpen(false)} className={cn(
      "group relative flex h-11 items-center gap-2 rounded-lg text-[13px] font-semibold ring-focus transition-colors duration-150",
      flyout ? "px-3" : "pl-[46px] pr-2.5",
      active ? "bg-brand/12 text-white" : "text-ink-soft hover:bg-white/[0.04] hover:text-ink",
    )}>
      {active && <ActiveMarker />}
      {flyout && <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-glow" : "text-ink-dim")} />}
      <span className="flex-1 truncate">{t(item.labelKey)}</span><LiveBadge count={count} pulse={pulseBadge === item.liveBadge} />
    </Link>;
  });
  const parent = <button ref={triggerRef} type="button" onClick={toggle} aria-label={t("nav.management")} aria-expanded={collapsed ? flyoutOpen : expandedGroupOpen} className={cn(
    "group relative flex h-11 w-full items-center rounded-lg text-[13px] font-semibold ring-focus transition-colors duration-150",
    collapsed ? "justify-center" : "gap-2.5 pl-[18px] pr-1.5",
    onGestion ? "bg-white/[0.04] text-white" : "text-ink-soft hover:bg-white/[0.04] hover:text-ink",
  )}>
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center"><ClipboardList className={cn("h-[19px] w-[19px]", onGestion ? "text-brand-glow" : "text-ink-dim group-hover:text-ink-soft")} /><LiveBadge count={aggregateCount} compact={collapsed} pulse={pulseBadge === "pendingRequests" || pulseBadge === "pendingUsers"} /></span>
    {!collapsed && <span className="flex-1 text-left">{t("nav.management")}</span>}
    {!collapsed && <LiveBadge count={aggregateCount} pulse={pulseBadge === "pendingRequests" || pulseBadge === "pendingUsers"} />}
    {!collapsed && <ChevronDown className={cn("h-4 w-4 text-ink-dim transition-transform duration-200", expandedGroupOpen && "rotate-180")} />}
  </button>;
  return <div ref={groupRef} className="relative shrink-0">
    {collapsed ? <SidebarTooltip label={t("nav.management")}>{parent}</SidebarTooltip> : parent}
    {collapsed ? <AnimatePresence>{flyoutOpen && <motion.div ref={flyoutRef} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} transition={{ duration: 0.16 }} onKeyDown={trapFlyoutTab} style={{ top: flyoutTop, left: 84 }} className="fixed z-[70] w-60 rounded-xl border border-brand/20 bg-[#11172d] p-1.5 shadow-2xl"><div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-dim">{t("nav.management")}</div>{rows(true)}</motion.div>}</AnimatePresence>
      : <AnimatePresence initial={false}>{expandedGroupOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden"><div className="flex flex-col gap-1 pt-1">{rows()}</div></motion.div>}</AnimatePresence>}
  </div>;
}

export function Sidebar({ version }: { version: string }) {
  const pathname = usePathname(); const searchParams = useSearchParams(); const t = useT(); const user = useCurrentUser();
  const pendingRequests = usePendingRequests(); const pendingUsers = usePendingUsers(); const activeDownloads = useActiveDownloads();
  const [collapsed, setCollapsed] = useState(false); const [transitionEnabled, setTransitionEnabled] = useState(false);
  const preferenceRef = useRef(false); const previousCounts = useRef({ pendingRequests, pendingUsers, activeDownloads }); const [pulseBadge, setPulseBadge] = useState<LiveBadge | null>(null);
  const counts = { pendingRequests, pendingUsers, activeDownloads };
  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY); preferenceRef.current = saved !== null;
    const applyViewportDefault = () => setCollapsed(window.innerWidth < 1400);
    if (saved === "true" || saved === "false") setCollapsed(saved === "true"); else applyViewportDefault();
    const frame = window.requestAnimationFrame(() => setTransitionEnabled(true));
    const onResize = () => { if (!preferenceRef.current) applyViewportDefault(); };
    window.addEventListener("resize", onResize);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); };
  }, []);
  useEffect(() => {
    const next = { pendingRequests, pendingUsers, activeDownloads };
    const increased = (Object.keys(next) as LiveBadge[]).find((key) => next[key] > previousCounts.current[key] && next[key] > 0);
    if (increased) setPulseBadge(increased); previousCounts.current = next;
  }, [pendingRequests, pendingUsers, activeDownloads]);
  useEffect(() => { if (!pulseBadge) return; const timeout = window.setTimeout(() => setPulseBadge(null), 2000); return () => window.clearTimeout(timeout); }, [pulseBadge]);
  const { data: updateInfo } = useSWR<SidebarUpdateInfo>(user?.role === "admin" ? "/api/system/update" : null, fetcher, { refreshInterval: 60 * 60 * 1000, revalidateOnFocus: false });
  const [installing, setInstalling] = useState(false);
  const installingRef = useRef(false);
  const autoUpdate = useAutoUpdate(); const globalState = globalThis as typeof globalThis & { __movvizAutoUpdateTriggered?: boolean };
  if (globalState.__movvizAutoUpdateTriggered === undefined) globalState.__movvizAutoUpdateTriggered = false;
  const triggerUpdate = async () => {
    if (installingRef.current) return;
    installingRef.current = true;
    setInstalling(true);
    try {
      const response = await fetch("/api/system/update", { method: "POST" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        toast("error", t("update.failed", { error: error.error ?? "unknown" }));
      }
    } catch { toast("error", t("update.failed", { error: "network" })); }
    finally { installingRef.current = false; setInstalling(false); }
  };
  useEffect(() => {
    if (updateInfo?.updateAvailable && updateInfo.platform === "win32" && autoUpdate.enabled && !globalState.__movvizAutoUpdateTriggered) { globalState.__movvizAutoUpdateTriggered = true; const timeout = window.setTimeout(() => void triggerUpdate(), 2000); return () => window.clearTimeout(timeout); }
  // triggerUpdate deliberately stays out: it is recreated every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateInfo?.updateAvailable, updateInfo?.platform, autoUpdate.enabled]);
  const toggleCollapsed = () => { const next = !collapsed; preferenceRef.current = true; window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); setCollapsed(next); };
  const visibleNav = NAV.filter((item) => !item.adminOnly || user?.role === "admin");
  const settingsItem = visibleNav.find((item) => item.href === "/settings");
  return <aside className={cn("nx-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-[#080d20] py-3 lg:flex", transitionEnabled && "transition-[width] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]", collapsed ? "w-[76px] px-2.5" : "w-[240px] px-2.5")}>
    <header className="mb-3 flex h-[84px] shrink-0 flex-col">
      <div className="flex h-10 shrink-0 items-center"><Link href="/" aria-label="Movviz" className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg ring-focus"><AnimatedLogo size="sm" /></Link>{!collapsed && <span className="min-w-0 flex-1 truncate text-base font-black tracking-tight text-ink">Movviz</span>}{!collapsed && <button type="button" onClick={toggleCollapsed} aria-expanded aria-label={t("sidebar.collapse")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-dim ring-focus transition-colors duration-150 hover:bg-white/5 hover:text-ink"><ChevronLeft className="h-4 w-4" /></button>}</div>
      <div className="flex h-8 shrink-0 items-center justify-center">{collapsed && <button type="button" onClick={toggleCollapsed} aria-expanded={false} aria-label={t("sidebar.expand")} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim ring-focus transition-colors duration-150 hover:bg-white/5 hover:text-ink"><ChevronRight className="h-4 w-4" /></button>}</div>
    </header>
    <nav aria-label="Navigation principale" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
      {visibleNav.filter((item) => item.href !== "/settings").map((item) => <NavRow key={item.href} item={item} pathname={pathname} searchParams={searchParams} collapsed={collapsed} counts={counts} pulseBadge={pulseBadge} />)}
      <GestionNavItem pathname={pathname} searchParams={searchParams} counts={counts} pulseBadge={pulseBadge} isAdmin={user?.role === "admin"} collapsed={collapsed} />
      {settingsItem && <NavRow item={settingsItem} pathname={pathname} searchParams={searchParams} collapsed={collapsed} counts={counts} pulseBadge={pulseBadge} updateAvailable={!!updateInfo?.updateAvailable} />}
    </nav>
    <footer className="mt-2 shrink-0">
      {user && <div className="mt-2 border-t border-white/10 pt-2"><Link href="/profile" aria-label={user.username} className={cn("group flex h-11 items-center rounded-lg ring-focus transition-colors duration-150 hover:bg-white/[0.04]", collapsed ? "justify-center" : "gap-2.5 px-2")}><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full brand-gradient text-xs font-black text-white">{effectiveAvatar(user) ? <img src={effectiveAvatar(user)!} alt="" className="h-full w-full object-cover" /> : user.username.slice(0, 2).toUpperCase()}</span>{!collapsed && <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold text-ink">{user.username}</span><span className="block truncate text-[11px] font-medium text-ink-dim">{user.role === "admin" ? t("auth.admin") : t("auth.user")}</span></span>}</Link></div>}
      <SidebarReleaseFooter version={version} collapsed={collapsed} updateInfo={user?.role === "admin" ? updateInfo : undefined} installing={installing} onInstall={() => void triggerUpdate()} labels={{
        currentVersion: t("update.currentVersion", { version }),
        available: t("update.available", { version: updateInfo?.latestVersion ?? "..." }),
        install: t("update.installNow", { version: updateInfo?.latestVersion ?? "..." }),
        inProgress: t("update.inProgress"), upToDate: t("update.upToDate"),
      }} />
    </footer>
  </aside>;
}
