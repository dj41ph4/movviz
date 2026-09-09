"use client";

import Link from "next/link";
import useSWR from "swr";
import { Sparkles, Star, Play } from "lucide-react";
import { TmdbImage } from "@/components/media/TmdbImage";
import { useT, useI18n } from "@/i18n/provider";

interface AiPick {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  year: number | null;
  rating: number;
  genres: string[];
  reason: string;
}

/**
 * "Recommandation IA du jour" (esquisse charte, section 03) — un vrai appel
 * IA côté serveur (/api/discover/ai-pick), pas un texte statique. Se masque
 * entièrement si l'IA est indisponible ou si l'utilisateur n'a encore rien
 * en bibliothèque (échoue ouvert, jamais d'état d'erreur visible ici).
 */
export function AiPickOfTheDay() {
  const t = useT();
  const { locale } = useI18n();
  const { data, isLoading } = useSWR<{ pick: AiPick | null }>(`/api/discover/ai-pick?locale=${locale}`);

  if (isLoading || !data?.pick) return null;
  const pick = data.pick;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-lg font-bold text-ink">{t("discover.aiPickTitle")}</h2>
      </div>
      <Link
        href={`/title/${pick.type}/${pick.tmdbId}`}
        className="group flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3 backdrop-blur transition-colors hover:border-brand/30 hover:bg-white/[0.06]"
      >
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {pick.posterPath && <TmdbImage path={pick.posterPath} size="w185" alt={pick.title} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-bold text-ink">{pick.title}</span>
            {pick.rating > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber">
                <Star className="h-3 w-3 fill-amber" /> {pick.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink-dim">
            {pick.genres.slice(0, 2).join(" · ")}{pick.year ? ` · ${pick.year}` : ""}
          </p>
          <p className="line-clamp-2 text-xs text-ink-soft">{pick.reason}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full brand-gradient text-white transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </span>
      </Link>
    </div>
  );
}
