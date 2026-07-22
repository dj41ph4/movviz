"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Film, Check, Clock, Loader2, Download } from "lucide-react";
import type { MetaCollectionDetail } from "@/lib/metadata/types";

export default function CollectionPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const { data, isLoading, mutate: mutateCollection } = useSWR<MetaCollectionDetail>(id ? `/api/metadata/collection?id=${id}` : null);
  const { data: libraryData, mutate: mutateLibrary } = useSWR<{ movies: { tmdbId: number; status: string; activeInfoHash: string | null }[] }>(
    "/api/library/movies"
  );

  const libStatus = new Map<number, string>();
  for (const m of libraryData?.movies ?? []) {
    libStatus.set(m.tmdbId, m.activeInfoHash ? "downloading" : m.status);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-ink-dim"><Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}</div>;
  }
  if (!data) {
    return <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("title.notInLibrary")}</div>;
  }

  const missing = data.parts.filter((p) => !libStatus.has(p.tmdbId));

  const downloadMissing = async () => {
    setDownloadingAll(true);
    try {
      for (const part of missing) {
        await fetch("/api/library/movies", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tmdbId: part.tmdbId }),
        });
      }
      await Promise.all([mutateLibrary(), mutateCollection()]);
    } finally {
      setDownloadingAll(false);
    }
  };

  const backdrop = data.backdropPath ? `https://image.tmdb.org/t/p/w1280${data.backdropPath}` : null;

  return (
    <div className="mx-auto max-w-[1280px]">
      {backdrop && (
        <div className="relative -mx-4 mb-6 h-[220px] overflow-hidden sm:-mx-5 md:-mx-8 md:h-[300px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backdrop} alt={data.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/40 to-transparent" />
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{data.name}</h1>
        {missing.length > 0 && (
          <button
            onClick={downloadMissing}
            disabled={downloadingAll}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-60"
          >
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("collections.downloadMissing", { n: missing.length })}
          </button>
        )}
      </div>
      {data.overview && <p className="mb-6 max-w-3xl text-sm text-ink-soft">{data.overview}</p>}

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {data.parts.map((part) => {
          const status = libStatus.get(part.tmdbId);
          const poster = part.posterPath ? `https://image.tmdb.org/t/p/w500${part.posterPath}` : null;
          return (
            <Link key={part.tmdbId} href={`/title/movie/${part.tmdbId}`} className="group block">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt={part.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <Film className="h-6 w-6 text-ink-soft/70" />
                    <span className="line-clamp-3 text-xs font-semibold text-ink/90">{part.title}</span>
                  </div>
                )}
                {status === "available" && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ok/90 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                {status === "downloading" && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-purple-500/90 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                )}
                {status && status !== "available" && status !== "downloading" && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                    <Clock className="h-3 w-3" />
                  </div>
                )}
              </div>
              <p className={cn("mt-2 truncate text-sm font-semibold text-ink group-hover:text-brand-glow")}>{part.title}</p>
              <p className="text-xs text-ink-dim">{part.year ?? ""}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
