"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Copy, Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { projectBleachLibrary, type BleachPart } from "@/lib/metadata/bleachPresentation";

/** A path shown in full (wrapped, never truncated) with a copy button — the
 *  point is to find the file on the disk, from any machine (Windows included). */
export function CopyablePath({ path: movvizPath }: { path: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Movviz's own path (/data/… inside its container) → the one the NAS and
  // Plex see (/volume1/…), when Movviz has learned the correspondence.
  const { data: mapped } = useSWR<{ paths?: Record<string, string> }>(`/api/library/nas-paths?p=${encodeURIComponent(movvizPath)}`);
  const path = mapped?.paths?.[movvizPath] ?? movvizPath;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // Clipboard API unavailable (plain http): old-school fallback.
      const area = document.createElement("textarea");
      area.value = path;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    toast("success", t("title.edit.pathCopied"));
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 select-all break-all rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
        {path}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={t("title.edit.copyPath")}
        title={t("title.edit.copyPath")}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass text-ink-soft transition-colors hover:text-ink"
      >
        {copied ? <Check className="h-4 w-4 text-up" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

interface SeriesFiles {
  episodeOrder?: string;
  seasons?: { seasonNumber: number; doubleEpisodesMode?: "off" | "auto" | "manual"; episodes: { episodeNumber?: number; file?: { path?: string; diskPath?: string } | null }[] }[];
}

/** Last separator of a path, whichever the convention (NAS « / » or Windows « \ »). */
function parentOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : p;
}

/** Where a series lives on the disk: its folder, then one folder per season
 *  that has files — read from the episodes' own files, nothing guessed. */
export function SeriesFolders({ seriesId, seriesPart, onChange }: { seriesId: string; seriesPart?: BleachPart; onChange?: () => void }) {
  const t = useT();
  const { data, mutate } = useSWR<{ series?: SeriesFiles } & SeriesFiles>(`/api/library/series/${seriesId}`);
  const [savingSeason, setSavingSeason] = useState<number | null>(null);
  const [seasonError, setSeasonError] = useState<{ seasonNumber: number; message: string } | null>(null);
  const series = data?.series ?? data;
  if (!series) return <p className="text-xs text-ink-dim">{t("common.loading")}</p>;
  const scoped = seriesPart ? projectBleachLibrary({ ...series, tmdbId: 30984 }, seriesPart) : series;
  const seasonDirs = new Map<number, string>();
  for (const season of scoped.seasons ?? []) {
    for (const ep of season.episodes) {
      const filePath = ep.file?.path;
      if (filePath && !seasonDirs.has(season.seasonNumber)) seasonDirs.set(season.seasonNumber, parentOf(filePath));
    }
  }
  const seriesDirs = [...new Set([...seasonDirs.values()].map(parentOf))];
  const toggleDoubleEpisodes = async (seasonNumber: number, enabled: boolean) => {
    setSavingSeason(seasonNumber);
    setSeasonError(null);
    try {
      const response = await fetch(`/api/library/series/${seriesId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ doubleEpisodesSeason: seasonNumber, doubleEpisodesEnabled: enabled }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error === "no_matching_pack" ? t("library.doubleEpisodesNoMatch") : t("library.doubleEpisodesError"));
      }
      await mutate();
      onChange?.();
    } catch (error) {
      setSeasonError({ seasonNumber, message: error instanceof Error ? error.message : t("library.doubleEpisodesError") });
    } finally {
      setSavingSeason(null);
    }
  };
  return (
    <div className="space-y-3">
      {seriesDirs.map((dir) => <CopyablePath key={dir} path={dir} />)}
      <p className="text-xs leading-relaxed text-ink-dim">{t("library.doubleEpisodesHint")}</p>
      <div className="space-y-3">
        {[...(scoped.seasons ?? [])].sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => {
          const dir = seasonDirs.get(season.seasonNumber);
          const enabled = season.doubleEpisodesMode === "manual" || season.doubleEpisodesMode === "auto";
          return <div key={season.seasonNumber} className="rounded-xl border border-white/8 bg-black/15 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-ink-dim">
                {season.seasonNumber === 0 ? t("title.edit.specials") : t("title.edit.seasonFolder", { season: season.seasonNumber })}
              </p>
              <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                <span>{t("library.doubleEpisodes")}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  disabled={!dir || season.seasonNumber < 1 || scoped.episodeOrder === "tvdb" || savingSeason != null}
                  onChange={(event) => void toggleDoubleEpisodes(season.seasonNumber, event.target.checked)}
                  className="h-4 w-4 accent-brand disabled:opacity-40"
                />
                {savingSeason === season.seasonNumber && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </label>
            </div>
            {dir ? <CopyablePath path={dir} /> : <p className="text-xs text-ink-dim">{t("title.edit.noFile")}</p>}
            {seasonError?.seasonNumber === season.seasonNumber && <p role="status" className="mt-1.5 text-xs text-down">{seasonError.message}</p>}
          </div>
        })}
      </div>
    </div>
  );
}
