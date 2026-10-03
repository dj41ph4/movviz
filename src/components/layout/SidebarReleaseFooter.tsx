"use client";

import Link from "next/link";
import { Download, Loader2 } from "lucide-react";

export interface SidebarUpdateInfo {
  latestVersion: string | null;
  updateAvailable: boolean;
  platform: string;
  oneClickSupported?: boolean;
  releaseUrl?: string;
}

export interface SidebarReleaseFooterProps {
  version: string;
  collapsed: boolean;
  updateInfo?: SidebarUpdateInfo;
  installing: boolean;
  onInstall: () => void;
  labels: { currentVersion: string; available: string; install: string; inProgress: string; upToDate: string };
}

/** Always below the profile, independent of the continuous navigation list. */
export function SidebarReleaseFooter({ version, collapsed, updateInfo, installing, onInstall, labels }: SidebarReleaseFooterProps) {
  const available = !!updateInfo?.updateAvailable;
  const oneClick = updateInfo?.oneClickSupported ?? updateInfo?.platform === "win32";
  const actionLabel = installing ? labels.inProgress : oneClick ? labels.install : labels.available;
  const actionClass = `flex h-11 items-center justify-center rounded-lg ring-focus text-xs font-bold ${collapsed ? "w-full" : "gap-2 px-2"} ${oneClick ? "brand-gradient text-white disabled:opacity-70" : "bg-brand/10 text-brand-glow hover:bg-brand/15"}`;
  return (
    <div className="mt-2 flex shrink-0 flex-col gap-1 border-t border-white/10 pt-2">
      <Link href="/settings?tab=about" title={labels.currentVersion} aria-label={labels.currentVersion}
        className={`flex min-h-7 items-center justify-center rounded-lg ring-focus text-ink-dim hover:bg-white/5 hover:text-ink-soft ${collapsed ? "text-[9px]" : "gap-2 text-[11px]"}`}>
        {!collapsed && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok/70" />}
        {collapsed ? `v${version}` : `Movviz v${version}`}
      </Link>
      {available && (oneClick
        ? <button type="button" onClick={onInstall} disabled={installing} title={actionLabel} aria-label={actionLabel} className={actionClass}>
            {installing ? <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin" /> : <Download aria-hidden className="h-4 w-4 shrink-0" />}
            {!collapsed && <span className="min-w-0 truncate">{actionLabel}</span>}
          </button>
        : <Link href="/settings?tab=about" title={actionLabel} aria-label={actionLabel} className={actionClass}>
            <Download aria-hidden className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="min-w-0 text-center">{actionLabel}</span>}
          </Link>)}
      {!collapsed && updateInfo?.releaseUrl && !available && <span className="text-center text-[10px] font-medium text-ok">{labels.upToDate}</span>}
    </div>
  );
}
