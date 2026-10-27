"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Loader2, ListPlus, RefreshCw } from "lucide-react";

interface UnmappedShow {
  showKey: string;
  title: string;
  tmdbId: number | null;
  episodeCount: number;
  episodes: { season: number; episode: number; title: string }[];
  status: "absent" | "linkable" | "unmatched";
  dismissed: boolean;
}

type Action = "add" | "link" | "dismiss" | "restore";

const STATUS_KEY: Record<UnmappedShow["status"], string> = {
  absent: "plexUnmapped.statusAbsent",
  linkable: "plexUnmapped.statusLinkable",
  unmatched: "plexUnmapped.statusUnmatched",
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Épisodes vus dans Plex mais sans fiche Movviz, par série. Ajout MANUEL : on coche les séries voulues
 * puis « Ajouter » — rien ne revient tout seul, une série supprimée exprès peut rester ignorée.
 */
export function PlexUnmappedPanel() {
  const t = useT();
  const [shows, setShows] = useState<UnmappedShow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const apply = useCallback((list: UnmappedShow[]) => {
    setShows(list);
    // On ne garde cochées que les séries encore listées.
    setSelected((prev) => new Set([...prev].filter((key) => list.some((s) => s.showKey === key))));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/plex/unmapped", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json() as { shows: UnmappedShow[] };
    apply(data.shows);
  }, [apply]);

  // Premier chargement : le résultat arrive de façon asynchrone, hors du corps de l’effet.
  useEffect(() => {
    let alive = true;
    fetch("/api/plex/unmapped", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { shows: UnmappedShow[] } | null) => { if (alive && d) apply(d.shows); })
      .catch(() => void 0);
    return () => { alive = false; };
  }, [apply]);

  const visible = (shows ?? []).filter((s) => s.dismissed === showDismissed);
  const dismissedCount = (shows ?? []).filter((s) => s.dismissed).length;
  const chosen = visible.filter((s) => selected.has(s.showKey));
  const toAdd = chosen.filter((s) => s.status === "absent");
  const toLink = chosen.filter((s) => s.status === "linkable");

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (!next.delete(key)) next.add(key);
    return next;
  });

  const run = async (action: Action, keys: string[]) => {
    if (keys.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/plex/unmapped", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, showKeys: keys }),
      });
      const data = await res.json().catch(() => null) as { results?: { ok: boolean }[] } | null;
      if (!res.ok) setMessage(t("plexUnmapped.failed", { count: String(keys.length) }));
      else if (data?.results) {
        const ok = data.results.filter((r) => r.ok).length;
        const failed = data.results.length - ok;
        setMessage(failed > 0 ? t("plexUnmapped.doneWithFailures", { ok: String(ok), failed: String(failed) }) : t("plexUnmapped.done", { count: String(ok) }));
      }
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  };

  const button = "rounded-xl glass-strong px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-brand-glow disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ListPlus className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-ink">{t("plexUnmapped.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("plexUnmapped.hint")}</p>
        </div>
        <button onClick={() => void load()} aria-label={t("plexUnmapped.refresh")} title={t("plexUnmapped.refresh")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {shows === null ? (
        <div className="flex items-center gap-2 text-sm text-ink-dim"><Loader2 className="h-4 w-4 animate-spin" /> {t("plexUnmapped.loading")}</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button className={button} disabled={busy || toAdd.length === 0} onClick={() => void run("add", toAdd.map((s) => s.showKey))}>
              {t("plexUnmapped.add", { count: String(toAdd.length) })}
            </button>
            <button className={button} disabled={busy || toLink.length === 0} onClick={() => void run("link", toLink.map((s) => s.showKey))}>
              {t("plexUnmapped.link", { count: String(toLink.length) })}
            </button>
            <button className={button} disabled={busy || chosen.length === 0} onClick={() => void run(showDismissed ? "restore" : "dismiss", chosen.map((s) => s.showKey))}>
              {t(showDismissed ? "plexUnmapped.restore" : "plexUnmapped.dismiss", { count: String(chosen.length) })}
            </button>
            {(dismissedCount > 0 || showDismissed) && (
              <button className="ml-auto text-xs text-ink-dim underline-offset-2 hover:underline" onClick={() => { setShowDismissed((v) => !v); setSelected(new Set()); }}>
                {showDismissed ? t("plexUnmapped.hideDismissed") : t("plexUnmapped.showDismissed", { count: String(dismissedCount) })}
              </button>
            )}
          </div>
          {message && <p className="mb-3 text-xs text-ink-soft">{message}</p>}

          {visible.length === 0 ? (
            <p className="text-sm text-ink-dim">{t("plexUnmapped.empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((show) => (
                <li key={show.showKey}>
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5", selected.has(show.showKey) && "bg-white/8")}>
                    <input type="checkbox" className="mt-1" checked={selected.has(show.showKey)} onChange={() => toggle(show.showKey)} disabled={busy} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-ink">{show.title || `#${show.showKey}`}</span>
                      <span className="block text-xs text-ink-dim">
                        {t("plexUnmapped.episodesSeen", { count: String(show.episodeCount) })}
                        {" · "}
                        {show.episodes.map((e) => `S${pad(e.season)}E${pad(e.episode)}`).join(", ")}{show.episodeCount > show.episodes.length ? "…" : ""}
                      </span>
                      <span className={cn("mt-0.5 block text-xs", show.status === "unmatched" ? "text-warn" : "text-ink-dim")}>{t(STATUS_KEY[show.status])}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink-dim">{t("plexUnmapped.note")}</p>
        </>
      )}
    </div>
  );
}
