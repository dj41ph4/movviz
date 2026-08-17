"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import useSWR from "swr";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import type { TitleRating } from "@/lib/ai/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StarRatingProps {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  className?: string;
}

/** Widget 1-5 étoiles réutilisable — même source de vérité que le chatbot
 *  (setRating côté serveur), une note posée ici est toujours "explicite"
 *  et prime sur toute déduction conversationnelle. */
export function StarRating({ tmdbId, type, title, className }: StarRatingProps) {
  const { t } = useI18n();
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);
  const { data, mutate } = useSWR<{ rating: TitleRating | null }>(
    tmdbId ? `/api/ai/ratings?tmdbId=${tmdbId}&type=${type}` : null,
    fetcher
  );
  const current = data?.rating?.rating ?? 0;

  const rate = async (value: number) => {
    if (saving || !title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, type, title, rating: value }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      await mutate(body, { revalidate: false });
    } catch {
      toast("error", t("title.ratingError"));
    } finally {
      setSaving(false);
    }
  };

  const display = hover || current;

  return (
    <div className={cn("flex items-center gap-1", className)} title={t("title.rateThisTitle")}>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />}
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={saving}
          onClick={() => rate(value)}
          onMouseEnter={() => setHover(value)}
          onMouseLeave={() => setHover(0)}
          aria-label={t("title.rateStars", { n: value })}
          className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              value <= display ? "fill-amber text-amber" : "fill-transparent text-white/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}
