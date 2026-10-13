"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import { Loader2, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/provider";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";

const CONFIRM_WORD = "EFFACER";

type PlexState = "running" | "done" | "partial" | "skipped" | "failed";
interface ResetStatus { resetAt: number; running?: boolean; plex?: { state: PlexState; reason?: string } }

/** « Effacer la lecture » du profil connecté : 1er avertissement (dialogue),
 *  puis 2e étape où il faut retaper le mot, revérifié par le serveur. */
export function WatchResetPanel() {
  const t = useT();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ResetStatus | null>(null);

  // Suit l'effacement Plex, lancé en arrière-plan par le serveur.
  const plexRunning = status?.plex?.state === "running";
  useEffect(() => {
    if (!plexRunning) return;
    const timer = window.setInterval(async () => {
      const res = await fetch("/api/profile/watch-reset", { cache: "no-store" }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { reset: ResetStatus | null }) : null;
      if (!data?.reset || data.reset.plex?.state === "running") return;
      setStatus(data.reset);
      refreshViews();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [plexRunning]);

  function refreshViews() {
    void mutate("/api/profile/media");
    void mutate("/api/watch-status");
    void mutate((key) => typeof key === "string" && (key.startsWith("/api/plex/on-deck") || key.startsWith("/api/interface/dashboard")));
  }

  async function start() {
    const ok = await confirmDialog(t("profile.watchReset.confirm1"), { confirmLabel: t("profile.watchReset.confirm1Button") });
    if (!ok) return;
    setTyped("");
    setStep("confirm");
  }

  async function run() {
    if (typed.trim().toUpperCase() !== CONFIRM_WORD || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/watch-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", t(data.error === "already_running" ? "profile.watchReset.alreadyRunning" : "profile.watchReset.error"));
        return;
      }
      setStatus({ resetAt: data.resetAt, plex: data.plex });
      setStep("idle");
      toast("success", t("profile.watchReset.done"));
      refreshViews();
    } catch {
      toast("error", t("profile.watchReset.error"));
    } finally {
      setBusy(false);
    }
  }

  const plex = status?.plex;
  const plexMessage = !plex ? null
    : plex.state === "running" ? t("profile.watchReset.plexRunning")
    : plex.state === "done" ? t("profile.watchReset.plexDone")
    : plex.state === "partial" ? t("profile.watchReset.plexPartial", { reason: plex.reason ?? "" })
    : plex.state === "skipped" ? t("profile.watchReset.plexSkipped", { reason: plex.reason ?? "" })
    : t("profile.watchReset.plexFailed", { reason: plex.reason ?? "" });

  return (
    <section className="mb-6 rounded-2xl glass p-5" aria-labelledby="watch-reset-heading">
      <h3 id="watch-reset-heading" className="mb-1 text-sm font-bold text-ink-soft">{t("profile.watchReset.title")}</h3>
      <p className="mb-4 text-xs text-ink-dim">{t("profile.watchReset.hint")}</p>
      {step === "idle" ? (
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy || plexRunning}
          className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-down disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {t("profile.watchReset.button")}
        </button>
      ) : (
        <div className="rounded-xl border border-down/40 bg-down/10 p-4" role="alertdialog" aria-labelledby="watch-reset-confirm">
          <p id="watch-reset-confirm" className="text-sm font-bold text-down">{t("profile.watchReset.confirm2Title")}</p>
          <p className="mt-1 text-xs text-ink-soft">{t("profile.watchReset.confirm2Hint", { word: CONFIRM_WORD })}</p>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void run(); if (e.key === "Escape") setStep("idle"); }}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            spellCheck={false}
            className="mt-3 h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-down/60 sm:w-60"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
              className="flex h-10 items-center gap-2 rounded-xl bg-down px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? t("profile.watchReset.running") : t("profile.watchReset.confirm2Button")}
            </button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              disabled={busy}
              className="flex h-10 items-center rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-50"
            >
              {t("profile.watchReset.cancel")}
            </button>
          </div>
        </div>
      )}
      {plexMessage && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-dim">
          {plexRunning && <Loader2 className="h-3 w-3 animate-spin" />}
          {plexMessage}
        </p>
      )}
    </section>
  );
}
