"use client";

import Link from "next/link";
import useSWR from "swr";
import { Bot, Star, Play } from "lucide-react";
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
 * IA côté serveur (/api/discover/ai-pick), pas un texte statique. Panneau
 * dédié (avatar + titre + mini-fiche), pas une simple ligne, pour matcher
 * la maquette. Se masque entièrement si l'IA est indisponible ou si
 * l'utilisateur n'a encore rien en bibliothèque (échoue ouvert, jamais
 * d'état d'erreur visible ici).
 */
export function AiPickOfTheDay() {
  const t = useT();
  const { locale } = useI18n();
  const { data, isLoading } = useSWR<{ pick: AiPick | null }>(`/api/discover/ai-pick?locale=${locale}`);

  if (isLoading || !data?.pick) return null;
  const pick = data.pick;

  return (
    <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="glow-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full brand-gradient text-white">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">{t("discover.aiPickTitle")}</h2>
          <p className="truncate text-xs text-ink-dim">{t("discover.aiPickSubtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-black/20 p-2.5">
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
      </div>

      <Link
        href={`/title/${pick.type}/${pick.tmdbId}`}
        className="flex h-10 items-center justify-center gap-2 rounded-full brand-gradient text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
      >
        <Play className="h-4 w-4 fill-current" /> {t("discover.aiPickWatchNow")}
      </Link>
    </div>
  );
}
