"use client";

import useSWR from "swr";
import Link from "next/link";
import { Play } from "lucide-react";
import { TmdbImage } from "@/components/media/TmdbImage";
import { useT } from "@/i18n/provider";
import type { OnDeckEntry } from "@/app/api/plex/on-deck/route";

/** The dedicated right-hand resume rail of the fixed NX home composition. */
export function DashboardContinuePanel() {
  const t = useT();
  const { data } = useSWR<{ items: OnDeckEntry[] }>("/api/plex/on-deck", { revalidateOnFocus: false, refreshInterval: 30_000 });
  const items = data?.items.slice(0, 3) ?? [];

  return (
    <section className="nx-continue-panel rounded-xl border border-brand/35 bg-[#0a1430]/92 p-3 shadow-[0_16px_38px_-28px_rgba(52,226,255,0.8)]">
      <h2 className="mb-3 text-sm font-black tracking-tight text-ink">{t("dashboard.continueWatching")}</h2>
      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-ink-dim">{t("dashboard.continueWatchingSub")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link key={`${item.type}:${item.plexRatingKey}`} href={`/title/${item.type === "movie" ? "movie" : "series"}/${item.tmdbId}`} className="group block rounded-lg border border-white/8 bg-white/[0.025] p-2 transition-colors hover:border-cyan/40 hover:bg-brand/10">
              <div className="flex gap-2.5">
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface">
                  <TmdbImage path={item.posterPath} size="w342" alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100"><Play className="h-3.5 w-3.5 fill-white text-white" /></span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{item.title}</p>
                  {item.type === "episode" && <p className="mt-0.5 truncate text-[11px] text-ink-dim">S{item.seasonNumber} · E{item.episodeNumber}</p>}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full brand-gradient" style={{ width: `${Math.round(item.progressPercent ?? 0)}%` }} /></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
