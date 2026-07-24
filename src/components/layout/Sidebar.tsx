"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { usePendingRequests } from "@/lib/requests/usePendingRequests";
import { usePendingUsers } from "@/lib/auth/usePendingUsers";
import { useActiveDownloads } from "@/lib/downloads/useActiveDownloads";
import { useAutoUpdate } from "@/lib/settings/useAutoUpdate";
import { Download, Loader2, X } from "lucide-react";

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
  const t = useT();
  const user = useCurrentUser();
  const pendingRequests = usePendingRequests();
  const pendingUsers = usePendingUsers();
  const activeDownloads = useActiveDownloads();
  const items = NAV.filter((item) => !item.adminOnly || user?.role === "admin");

  const { data: updateInfo, isLoading } = useSWR<UpdateInfo>(
    user?.role === "admin" ? "/api/system/update" : null,
    fetcher,
    { refreshInterval: 60 * 60 * 1000, revalidateOnFocus: false }
  );

  const [installing, setInstalling] = useState(false);
  const [showNasInfo, setShowNasInfo] = useState(false);
  const autoUpdate = useAutoUpdate();
  const autoUpdateTriggered = useRef(false);

  const triggerUpdate = async () => {
    setInstalling(true);
    try {
      const res = await fetch("/api/system/update", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(t("update.failed", { error: err.error ?? "unknown" }));
      }
    } catch {
      alert(t("update.failed", { error: "network" }));
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
      !autoUpdateTriggered.current
    ) {
      autoUpdateTriggered.current = true;
      triggerUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateInfo?.updateAvailable, autoUpdate.enabled]);

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-2 border-r border-white/5 bg-abyss/60 px-4 py-6 backdrop-blur-xl lg:flex">
      {/* Brand */}
      <Link href="/" className="group mb-6 flex items-center gap-3 px-2">
        <AnimatedLogo size="sm" />
        <div className="leading-tight">
          <div className="text-logo-flow text-lg font-black tracking-tight">Movviz</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
            {t("brand.tagline")}
          </div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const liveCount =
            item.liveBadge === "pendingRequests" ? pendingRequests
            : item.liveBadge === "pendingUsers" ? pendingUsers
            : item.liveBadge === "activeDownloads" ? activeDownloads
            : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold transition-colors ring-focus",
                active ? "text-brand-glow" : "text-ink-soft hover:text-ink"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded-xl border border-brand/30 bg-brand/12"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-brand-glow" : "text-ink-dim group-hover:text-ink-soft"
                )}
              />
              <span className="flex-1">{t(item.labelKey)}</span>
              {liveCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient px-1.5 text-[10px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Version + Update button */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
        <Link
          href="/settings?tab=about"
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-ink-dim/60 transition-colors hover:text-ink-dim"
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          Movviz v{version}
        </Link>

        {updateInfo?.updateAvailable && !isLoading && updateInfo.platform === "win32" && (
          <button
            onClick={triggerUpdate}
            disabled={installing}
            className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-70"
          >
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {installing ? t("update.inProgress") : t("update.installNow", { version: updateInfo.latestVersion ?? "..." })}
          </button>
        )}

        {updateInfo?.updateAvailable && !isLoading && updateInfo.platform !== "win32" && (
          <button
            onClick={() => setShowNasInfo(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl glass-strong px-3 py-2 text-xs font-bold text-brand-glow"
          >
            <Download className="h-4 w-4" />
            {t("update.available", { version: updateInfo.latestVersion ?? "..." })}
          </button>
        )}

        {updateInfo && !updateInfo.updateAvailable && !isLoading && (
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