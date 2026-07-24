"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2, Trash2, RotateCcw, ShieldAlert } from "lucide-react";

interface DangerAction {
  action: string;
  titleKey: string;
  hintKey: string;
}

const ACTIONS: DangerAction[] = [
  { action: "clearMovies", titleKey: "dangerZone.clearMovies", hintKey: "dangerZone.clearMoviesHint" },
  { action: "clearSeries", titleKey: "dangerZone.clearSeries", hintKey: "dangerZone.clearSeriesHint" },
  { action: "clearActivity", titleKey: "dangerZone.clearActivity", hintKey: "dangerZone.clearActivityHint" },
  { action: "clearNotifications", titleKey: "dangerZone.clearNotifications", hintKey: "dangerZone.clearNotificationsHint" },
  { action: "clearRequests", titleKey: "dangerZone.clearRequests", hintKey: "dangerZone.clearRequestsHint" },
  { action: "clearIssues", titleKey: "dangerZone.clearIssues", hintKey: "dangerZone.clearIssuesHint" },
  { action: "resetPlexSyncState", titleKey: "dangerZone.resetPlexSyncState", hintKey: "dangerZone.resetPlexSyncStateHint" },
];

export function DangerZonePanel() {
  const t = useT();
  const CONFIRM_WORD = t("dangerZone.confirmWord");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async (action: string) => {
    setBusy(action);
    try {
      const res = await fetch("/api/danger-zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setDone(action);
        setTimeout(() => setDone((d) => (d === action ? null : d)), 3000);
      } else {
        setFailed(action);
        setTimeout(() => setFailed((f) => (f === action ? null : f)), 3000);
      }
    } catch {
      setFailed(action);
      setTimeout(() => setFailed((f) => (f === action ? null : f)), 3000);
    } finally {
      setBusy(null);
      setConfirming(null);
      setInput("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-down/12 text-down">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("dangerZone.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("dangerZone.warningHint")}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-down/25 bg-down/8 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-down" />
        <div>
          <p className="text-sm font-bold text-down">{t("dangerZone.warningTitle")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("dangerZone.warningHint")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((a) => (
          <div key={a.action} className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{t(a.titleKey)}</p>
                <p className="mt-0.5 text-xs text-ink-dim">{t(a.hintKey)}</p>
              </div>
              {confirming !== a.action && (
                <button
                  onClick={() => { setConfirming(a.action); setInput(""); }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-down/30 bg-down/10 px-3 text-xs font-bold text-down hover:bg-down/20"
                >
                  {done === a.action || failed === a.action ? null : a.action === "resetPlexSyncState" ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {done === a.action ? t("dangerZone.done") : failed === a.action ? t("dangerZone.failed") : t("dangerZone.trigger")}
                </button>
              )}
            </div>
            {confirming === a.action && (
              <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                <input
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("dangerZone.confirmPlaceholder", { word: CONFIRM_WORD })}
                  className="h-9 flex-1 rounded-lg border border-down/30 bg-black/30 px-3 text-xs text-ink outline-none focus:border-down/60"
                />
                <button
                  onClick={() => run(a.action)}
                  disabled={input !== CONFIRM_WORD || busy === a.action}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-40",
                    "bg-down"
                  )}
                >
                  {busy === a.action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {t("dangerZone.confirmButton")}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="h-9 shrink-0 rounded-lg px-3 text-xs font-semibold text-ink-dim hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
