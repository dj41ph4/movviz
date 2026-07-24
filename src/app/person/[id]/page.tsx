"use client";

import { use as usePromise } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import type { MetaPerson } from "@/lib/metadata/tmdb";
import { Film, Tv, User } from "lucide-react";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const t = useT();
  // Cached by SWR: navigating back to a person re-renders instantly.
  const { data } = useSWR<MetaPerson>(`/api/metadata/person?id=${id}`);
  const person = data?.id ? data : null;

  if (!person) return (
    <div className="mx-auto max-w-[1200px] animate-pulse">
      <div className="mb-8 flex gap-6">
        <div className="h-56 w-40 shrink-0 rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-3 pt-12">
          <div className="h-8 w-1/3 rounded bg-white/10" />
          <div className="h-4 w-1/4 rounded bg-white/5" />
        </div>
      </div>
    </div>
  );

  const photo = person.profilePath ? `https://image.tmdb.org/t/p/w342${person.profilePath}` : null;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-8 flex gap-6">
        <div className="h-56 w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><User className="h-8 w-8 text-ink-soft/50" /></div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-end pb-2">
          <h1 className="text-3xl font-black text-ink">{person.name}</h1>
          {person.biography && (
            <p className="mt-3 max-w-2xl line-clamp-6 text-sm text-ink-soft">{person.biography}</p>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold text-ink">{t("person.filmography")}</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {person.credits.map((c) => (
          <Link key={`${c.type}:${c.tmdbId}`} href={`/title/${c.type}/${c.tmdbId}`} className="group block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/5 bg-surface">
              {c.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://image.tmdb.org/t/p/w342${c.posterPath}`} alt={c.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
                  {c.type === "movie" ? <Film className="h-6 w-6 text-ink-soft/60" /> : <Tv className="h-6 w-6 text-ink-soft/60" />}
                  <span className="line-clamp-3 text-xs font-semibold text-ink/80">{c.title}</span>
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold text-ink">{c.title}</p>
            <p className="truncate text-[11px] text-ink-dim">{c.year ?? "—"}</p>
          </Link>
        ))}
      </div>

      {person.credits.length === 0 && (
        <p className="py-16 text-center text-ink-dim">{t("person.empty")}</p>
      )}
    </div>
  );
}
