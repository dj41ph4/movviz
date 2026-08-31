"use client";

import { cn, formatBytes, relativeTime } from "@/lib/utils";
import { useT, useI18n } from "@/i18n/provider";
import { parseRelease } from "@/lib/naming/parser";
import { buildMediaBadgeItems, TextPill } from "@/components/library/MediaBadges";
import type { IndexerRelease } from "@/lib/indexers/types";
import { Magnet, Server, Download, Loader2, Check } from "lucide-react";

export function ManualSearchReleaseRow({
  release,
  category,
  grabbing,
  grabbed,
  onGrab,
}: {
  release: IndexerRelease;
  category: "movie" | "series";
  grabbing: boolean;
  grabbed: boolean;
  onGrab: (release: IndexerRelease) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const r = release;
  const parsed = parseRelease(r.title);

  let episodeLabel: string | null = null;
  if (category === "series") {
    if (parsed.episode != null) {
      const season = String(parsed.season ?? 0).padStart(2, "0");
      const ep = String(parsed.episode).padStart(2, "0");
      episodeLabel = parsed.episodeEnd != null
        ? `S${season}E${ep}-E${String(parsed.episodeEnd).padStart(2, "0")}`
        : `S${season}E${ep}`;
    } else if (parsed.season != null) {
      episodeLabel = t("search.seasonComplete", { n: String(parsed.season) });
    } else if (parsed.isCompletePack) {
      episodeLabel = t("search.fullPack");
    }
  }

  const badgeItems = buildMediaBadgeItems(
    { resolution: parsed.resolution, videoCodec: parsed.videoCodec, audioCodec: parsed.audioCodec, hdr: parsed.hdr, source: parsed.source, language: parsed.language },
    "surface",
  );

  // Score explanation tooltip — never the raw torrent filename. Falls back to
  // just the total when a release wasn't rescored against a query (recent-list
  // browse path) and has no breakdown attached.
  const scoreTooltip = r.scoreBreakdown?.length
    ? `Score : ${r.score} = ${r.scoreBreakdown.map((b) => `${b.delta >= 0 ? "+" : ""}${b.delta} ${b.label}`).join(", ")}`
    : `Score : ${r.score}`;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center"
      title={scoreTooltip}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.protocol === "torrent" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
          {r.protocol === "torrent" ? <Magnet className="h-4 w-4" /> : <Server className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          {/* Ligne 1 — titre */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="truncate font-semibold text-ink">{parsed.title}</p>
            {parsed.year && <span className="text-xs text-ink-dim">{parsed.year}</span>}
            {episodeLabel && <TextPill text={episodeLabel} cls="border border-white/8 bg-black/20 text-ink-soft" />}
          </div>

          {/* Ligne 2 — indexeur, taille, qualité */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <TextPill text={r.indexer} cls="border border-white/8 bg-black/20 text-ink-soft" />
            <TextPill text={formatBytes(r.size)} cls="border border-white/8 bg-black/20 text-ink-soft" />
            {badgeItems}
          </div>

          {/* Ligne 3 — méta secondaire */}
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-dim">
            <span>{r.publishDate ? relativeTime(r.publishDate, locale) : "—"}</span>
            {r.seeders != null && (
              <span className={cn("font-semibold", r.seeders <= 1 ? "text-down" : r.seeders <= 5 ? "text-amber" : "text-ok")}>
                {r.seeders} ↑
              </span>
            )}
            <span className={cn("font-bold", r.score >= 90 ? "text-ok" : r.score >= 75 ? "text-amber" : "text-ink-soft")}>
              {r.score}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onGrab(r)}
        disabled={grabbing || grabbed}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-transform hover:scale-105 disabled:opacity-60 sm:h-9 sm:w-auto",
          grabbed ? "bg-ok/15 text-ok" : "brand-gradient text-white"
        )}
      >
        {grabbing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : grabbed ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        {grabbed ? t("search.grabbed") : t("common.grab")}
      </button>
    </div>
  );
}
