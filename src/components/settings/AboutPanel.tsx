"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { toast } from "@/components/ui/Toast";
import { RefreshCcw, Download, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useVersion } from "@/lib/version/VersionContext";
import { useAutoUpdate } from "@/lib/settings/useAutoUpdate";

interface UpdateCheck {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  platform: string;
  downloadUrl: string | null;
  releaseNotes: string | null;
  releaseUrl: string;
}

function fetcher(url: string) {
  return fetch(url, { cache: "no-store" }).then((r) => r.json());
}

export function AboutPanel() {
  const t = useT();
  const version = useVersion();
  const { data, mutate, isLoading } = useSWR<UpdateCheck>("/api/system/update", fetcher);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const autoUpdate = useAutoUpdate();

  const checkNow = async () => {
    setChecking(true);
    try {
      await mutate();
    } finally {
      setChecking(false);
    }
  };

  const installNow = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl glass p-8 text-center">
        <AnimatedLogo size="lg" />
        <div>
          <h2 className="text-logo-flow text-2xl font-black tracking-tight">Movviz</h2>
          <p className="mt-1 text-sm text-ink-dim">
            {t("settings.aboutVersion", { version })}
          </p>
        </div>
        <p className="max-w-md text-sm text-ink-soft">{t("settings.aboutCredit")}</p>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink">{t("settings.aboutLicenseTitle")}</h3>
        <p className="mb-3 text-sm text-ink-dim">{t("settings.aboutLicenseHint")}</p>
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-glow hover:underline"
        >
          GNU General Public License v3.0 <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
          <svg className="h-4 w-4 text-magenta" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          {t("settings.aboutSupportTitle")}
        </h3>
        <p className="mb-3 text-sm text-ink-dim">{t("settings.aboutSupportHint")}</p>
        <a
          href="https://github.com/sponsors/dj41ph4"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-glow hover:underline"
        >
          GitHub Sponsors <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink">{t("settings.aboutUpdateTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">
          {!data || data.platform === "win32" ? t("settings.aboutUpdateHint") : t("settings.aboutUpdateNotWindows")}
        </p>

        <label className="mb-4 flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-ink-soft">{t("settings.autoUpdateLabel")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoUpdate.enabled}
            onClick={() => autoUpdate.setEnabled(!autoUpdate.enabled)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
              autoUpdate.enabled ? "bg-brand" : "bg-white/15"
            )}
          >
            <motion.span
              className="inline-block h-5 w-5 rounded-full bg-white shadow-sm"
              animate={{ x: autoUpdate.enabled ? 22 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={checkNow}
            disabled={checking || isLoading}
            className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-50 hover:text-ink transition-colors"
          >
            {checking || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {t("settings.aboutCheckUpdate")}
          </button>

          {data && !data.updateAvailable && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-ok">
              <CheckCircle2 className="h-4 w-4" /> {t("settings.aboutUpToDate")}
            </span>
          )}

          <AnimatePresence>
            {data?.updateAvailable && data.platform === "win32" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={installNow}
                disabled={installing}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white",
                  "disabled:opacity-70",
                  "animate-pulse-glow"
                )}
              >
                {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {installing ? t("update.inProgress") : t("update.installNow", { version: data.latestVersion ?? "" })}
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {data?.updateAvailable && data.platform !== "win32" && (
              <motion.a
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                href={data.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="h-4 w-4" />
                {t("update.available", { version: data.latestVersion ?? "" })}
              </motion.a>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}