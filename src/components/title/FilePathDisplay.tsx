"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Copy } from "lucide-react";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";

/** A path shown in full (wrapped, never truncated) with a copy button — the
 *  point is to find the file on the disk, from any machine (Windows included). */
export function CopyablePath({ path }: { path: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
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
  seasons?: { seasonNumber: number; episodes: { file?: { path?: string; diskPath?: string } | null }[] }[];
}

/** Last separator of a path, whichever the convention (NAS « / » or Windows « \ »). */
function parentOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : p;
}

/** Where a series lives on the disk: its folder, then one folder per season
 *  that has files — read from the episodes' own files, nothing guessed. */
export function SeriesFolders({ seriesId }: { seriesId: string }) {
  const t = useT();
  const { data } = useSWR<{ series?: SeriesFiles } & SeriesFiles>(`/api/library/series/${seriesId}`);
  const series = data?.series ?? data;
  if (!series) return <p className="text-xs text-ink-dim">{t("common.loading")}</p>;
  const seasonDirs = new Map<number, string>();
  for (const season of series.seasons ?? []) {
    for (const ep of season.episodes) {
      const filePath = ep.file?.path;
      if (filePath && !seasonDirs.has(season.seasonNumber)) seasonDirs.set(season.seasonNumber, parentOf(filePath));
    }
  }
  if (seasonDirs.size === 0) return <p className="text-xs text-ink-dim">{t("title.edit.noFile")}</p>;
  const seriesDirs = [...new Set([...seasonDirs.values()].map(parentOf))];
  return (
    <div className="space-y-3">
      {seriesDirs.map((dir) => <CopyablePath key={dir} path={dir} />)}
      <div className="space-y-2">
        {[...seasonDirs.entries()].sort(([a], [b]) => a - b).map(([season, dir]) => (
          <div key={season}>
            <p className="mb-1 text-xs font-semibold text-ink-dim">
              {season === 0 ? t("title.edit.specials") : t("title.edit.seasonFolder", { season })}
            </p>
            <CopyablePath path={dir} />
          </div>
        ))}
      </div>
    </div>
  );
}
