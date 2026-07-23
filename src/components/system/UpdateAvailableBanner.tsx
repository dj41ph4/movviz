"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { cn } from "@/lib/utils";
import { Download, Loader2 } from "lucide-react";

interface UpdateCheck {
  updateAvailable: boolean;
  latestVersion: string | null;
  platform: string;
}

/**
 * Bottom-left pill on the dashboard, admin-only, Windows-only: one click
 * downloads the latest installer and launches it silently. The server gets
 * killed mid-update (the installer stops the service), so once launched we
 * just poll until something answers again and reload.
 */
export function UpdateAvailableBanner() {
  const t = useT();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const { data } = useSWR<UpdateCheck>(isAdmin ? "/api/system/update" : null, {
    refreshInterval: 6 * 60 * 60 * 1000,
  });
  const [phase, setPhase] = useState<"idle" | "updating" | "waiting">("idle");

  if (!isAdmin || !data?.updateAvailable || data.platform !== "win32") return null;

  const start = async () => {
    setPhase("updating");
    try {
      await fetch("/api/system/update", { method: "POST" });
    } catch {
      // Expected: the response may never arrive if the update already killed the server.
    }
    setPhase("waiting");
    const deadline = Date.now() + 5 * 60_000;
    const poll = async () => {
      if (Date.now() > deadline) return;
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (r.ok) {
          window.location.reload();
          return;
        }
      } catch {
        // still down — keep polling
      }
      setTimeout(poll, 3000);
    };
    setTimeout(poll, 8000);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex flex-wrap items-center gap-3 rounded-xl glass-strong px-4 py-3 shadow-2xl lg:bottom-4 lg:left-[264px] lg:right-auto">
      {phase === "idle" ? (
        <>
          <Download className="h-4 w-4 shrink-0 text-brand-glow" />
          <span className="text-sm font-semibold text-ink">
            {t("update.available", { version: data.latestVersion ?? "" })}
          </span>
          <button onClick={start} className="shrink-0 rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white">
            {t("update.clickToUpdate")}
          </button>
        </>
      ) : (
        <>
          <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin text-brand-glow")} />
          <span className="text-sm font-semibold text-ink">{t("update.inProgress")}</span>
        </>
      )}
    </div>
  );
}
