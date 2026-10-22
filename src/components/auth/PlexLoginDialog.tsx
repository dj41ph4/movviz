"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, QrCode, RefreshCw, X } from "lucide-react";
import qrcode from "qrcode-generator";
import { useT } from "@/i18n/provider";

interface Props {
  onAuthenticated: () => Promise<void>;
  onClose: () => void;
  onUseBrowser: () => void;
}

interface Pin { id: number; code: string }

/** The QR uses the TV short-code flow; the browser action retains the original login. */
export function PlexLoginDialog({ onAuthenticated, onClose, onUseBrowser }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [pin, setPin] = useState<Pin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const qr = useMemo(() => {
    if (!pin) return null;
    const code = qrcode(0, "M");
    code.addData(`https://plex.tv/link/?pin=${encodeURIComponent(pin.code)}`);
    code.make();
    // Four white modules around the code keep it readable by phone cameras.
    const size = code.getModuleCount();
    let path = "";
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (code.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
      }
    }
    return { path, size: size + 8 };
  }, [pin]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Stop requests as well as the UI when the code expires or the dialog closes.
    const expiry = setTimeout(() => {
      controller.abort();
      clearTimeout(timer);
      setPin(null);
      setError(t("auth.plexTimeout"));
    }, 120_000);

    const fail = (message: string) => {
      clearTimeout(expiry);
      setConnecting(false);
      setPin(null);
      setError(message);
    };

    const poll = async (id: number) => {
      try {
        const res = await fetch("/api/auth/plex/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
          signal,
        });
        const data = await res.json();
        if (signal.aborted) return;
        if (!res.ok) {
          fail(t(res.status === 403 ? "auth.plexNoAccess" : "auth.plexUnreachable"));
          return;
        }
        if (data.done === true && data.user) {
          clearTimeout(expiry);
          setConnecting(true);
          await onAuthenticated();
          return;
        }
        timer = setTimeout(() => { void poll(id); }, 2000);
      } catch {
        if (!signal.aborted) fail(t("auth.plexUnreachable"));
      }
    };

    const start = async () => {
      try {
        const res = await fetch("/api/auth/plex/tv-pin", { method: "POST", signal });
        const data = await res.json();
        if (signal.aborted) return;
        if (!res.ok || !Number.isInteger(data.id) || typeof data.code !== "string" || !/^[a-z0-9]{4}$/i.test(data.code)) {
          fail(t("auth.plexUnreachable"));
          return;
        }
        setPin({ id: data.id, code: data.code });
        timer = setTimeout(() => { void poll(data.id); }, 2000);
      } catch {
        if (!signal.aborted) fail(t("auth.plexUnreachable"));
      }
    };
    void start();
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [attempt, onAuthenticated, t]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="plex-login-title"
      aria-describedby="plex-login-hint"
      onCancel={onClose}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101225] p-6 text-ink shadow-2xl backdrop:bg-black/80 sm:p-8"
    >
      <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-ink-dim hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-amber">
        <X className="h-5 w-5" />
      </button>
      <h2 id="plex-login-title" className="pr-8 text-xl font-bold">{t("tizen.plexConnection")}</h2>
      <p id="plex-login-hint" className="mt-2 text-sm leading-relaxed text-ink-soft">{t("auth.plexQrHint")}</p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="flex flex-col items-center rounded-2xl border border-white/8 bg-black/20 p-5">
          <span className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber"><QrCode className="h-4 w-4" />{t("auth.plexQrLabel")}</span>
          <div className="flex h-48 w-48 max-w-full items-center justify-center rounded-xl bg-white p-2">
            {qr && !connecting ? (
              <svg role="img" aria-label={t("auth.plexQrLabel")} viewBox={`0 0 ${qr.size} ${qr.size}`} className="h-full w-full" shapeRendering="crispEdges">
                <path fill="#000" d={qr.path} />
              </svg>
            ) : error ? <QrCode aria-hidden="true" className="h-10 w-10 text-slate-400" /> : <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-slate-500 motion-reduce:animate-none" />}
          </div>
          {pin && !connecting && (
            <div className="mt-4 text-center">
              <p className="text-xs text-ink-dim">{t("tizen.connectionCode")}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-white">{pin.code}</p>
              <a href="https://plex.tv/link" target="_blank" rel="noopener noreferrer" className="mt-1 inline-block rounded text-sm font-semibold text-amber underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-amber">plex.tv/link</a>
            </div>
          )}
          <div className="mt-4 text-center text-xs leading-relaxed" role={error ? "alert" : "status"}>
            {error ? (
              <>
                <p className="text-down">{error}</p>
                <button type="button" onClick={() => { setError(null); setPin(null); setConnecting(false); setAttempt((value) => value + 1); }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-semibold text-amber hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-amber"><RefreshCw className="h-4 w-4" />{t("auth.plexQrRetry")}</button>
              </>
            ) : <p className="text-ink-soft">{connecting ? t("auth.plexQrConnecting") : pin ? t("auth.plexQrWaiting") : t("common.loading")}</p>}
          </div>
        </div>

        <div className="flex flex-col justify-center border-t border-white/8 pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <h3 className="text-base font-semibold">{t("auth.plexBrowserTitle")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">{t("auth.plexBrowserHint")}</p>
          <button type="button" onClick={onUseBrowser} disabled={connecting} className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber/25 bg-amber/8 px-4 py-3 text-sm font-bold text-amber transition-transform active:scale-[0.97] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-amber"><ExternalLink className="h-4 w-4 shrink-0" />{t("auth.plexBrowserAction")}</button>
          <button type="button" onClick={onClose} className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold text-ink-dim hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-amber">{t("common.cancel")}</button>
        </div>
      </div>
    </dialog>
  );
}
