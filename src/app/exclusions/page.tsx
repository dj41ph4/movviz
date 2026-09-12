"use client";

import Link from "next/link";
import useSWR from "swr";
import { Loader2, RotateCcw, ThumbsDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { toast } from "@/components/ui/Toast";
import { useI18n, useT } from "@/i18n/provider";
import { formatDateTime } from "@/lib/utils";

type Exclusion = {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  reason?: string;
  at: number;
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(async (response) => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<{ exclusions: Exclusion[] }>;
});

export default function ExclusionsPage() {
  const t = useT();
  const { locale } = useI18n();
  const { data, isLoading, mutate } = useSWR<{ exclusions: Exclusion[] }>("/api/ai/feedback", fetcher);
  const exclusions = data?.exclusions ?? [];

  const restore = async (exclusion: Exclusion) => {
    try {
      const response = await fetch(`/api/ai/feedback?tmdbId=${exclusion.tmdbId}&type=${exclusion.type}`, { method: "DELETE" });
      if (!response.ok) throw new Error("restore_failed");
      await mutate((current) => current
        ? { exclusions: current.exclusions.filter((item) => item.tmdbId !== exclusion.tmdbId || item.type !== exclusion.type) }
        : current,
        { revalidate: false }
      );
    } catch {
      toast("error", t("common.error"));
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow={t("nav.management")} title={t("exclusions.title")} description={t("exclusions.description")} />
      {isLoading ? (
        <div className="flex justify-center py-20 text-ink-dim"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : exclusions.length === 0 ? (
        <div className="rounded-2xl glass py-16 text-center">
          <ThumbsDown className="mx-auto mb-3 h-8 w-8 text-ink-dim" />
          <p className="font-semibold text-ink">{t("exclusions.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("exclusions.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exclusions.map((exclusion) => (
            <div key={`${exclusion.type}:${exclusion.tmdbId}`} className="flex flex-wrap items-center gap-3 rounded-2xl glass p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-down/12 text-down"><ThumbsDown className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/title/${exclusion.type}/${exclusion.tmdbId}`} className="font-semibold text-ink hover:text-brand-glow">
                  {exclusion.title}
                </Link>
                <p className="mt-0.5 text-xs text-ink-dim">{t(exclusion.type === "movie" ? "common.movies" : "common.series")} · {t("exclusions.excludedAt", { date: formatDateTime(exclusion.at, locale) })}</p>
                {exclusion.reason && <p className="mt-1 truncate text-xs text-ink-dim">{exclusion.reason}</p>}
              </div>
              <button onClick={() => void restore(exclusion)} className="flex h-11 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft transition-colors hover:text-ok">
                <RotateCcw className="h-4 w-4" /> {t("exclusions.restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
