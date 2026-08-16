"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { Sparkles, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react";

interface AiContextData {
  facts: string[];
  liked: { title: string; reason: string | null }[];
  disliked: { title: string; reason: string | null }[];
  usage: {
    watchedMovies: number;
    watchedSeries: number;
    watchedEpisodes: number;
    requestsTotal: number;
    aiAdded: number;
    aiAccepted: number;
    topSeries: { title: string; episodes: number }[];
  };
}

/**
 * Transparency panel — "vu qu'il construit un contexte par utilisateur,
 * j'aimerais pouvoir voir le contexte qu'il a construit". Readable
 * reformulation (not raw JSON) of exactly what the chat's system prompt
 * assembles for this user each message, via /api/ai/context — same data
 * functions, so this can never drift from what the assistant actually
 * sees. Only rendered when Movviz AI is enabled at all (mirrors
 * ChatWidget's own visibility gate — nothing to show otherwise).
 */
export function AiContextPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data: sessionData } = useSWR<{ enabled: boolean }>("/api/ai/session");
  const { data } = useSWR<AiContextData>(open ? "/api/ai/context" : null);

  if (sessionData?.enabled !== true) return null;

  const hasAnything = data && (data.facts.length > 0 || data.liked.length > 0 || data.disliked.length > 0 || data.usage.watchedMovies > 0 || data.usage.watchedSeries > 0);

  return (
    <div className="mb-6 rounded-2xl glass p-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-glow" />
          <h3 className="text-sm font-bold text-ink-soft">{t("profile.aiContext.title")}</h3>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-ink-dim" /> : <ChevronDown className="h-4 w-4 text-ink-dim" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
          {!data ? (
            <p className="text-sm text-ink-dim">{t("common.loading")}</p>
          ) : !hasAnything ? (
            <p className="text-sm text-ink-dim">{t("profile.aiContext.empty")}</p>
          ) : (
            <>
              {data.facts.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">{t("profile.aiContext.facts")}</p>
                  <ul className="space-y-1">
                    {data.facts.map((f, i) => (
                      <li key={i} className="text-sm text-ink">{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(data.usage.watchedMovies > 0 || data.usage.watchedSeries > 0) && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">{t("profile.aiContext.usage")}</p>
                  <p className="text-sm text-ink-soft">
                    {t("profile.aiContext.usageLine", {
                      movies: String(data.usage.watchedMovies),
                      series: String(data.usage.watchedSeries),
                      episodes: String(data.usage.watchedEpisodes),
                    })}
                  </p>
                  {data.usage.topSeries.length > 0 && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {t("profile.aiContext.topSeries", { title: data.usage.topSeries[0].title, episodes: String(data.usage.topSeries[0].episodes) })}
                    </p>
                  )}
                </div>
              )}

              {data.liked.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">
                    <ThumbsUp className="h-3 w-3" /> {t("profile.aiContext.liked")}
                  </p>
                  <ul className="space-y-1">
                    {data.liked.map((f, i) => (
                      <li key={i} className="text-sm text-ink-soft">
                        <span className="font-semibold text-ink">{f.title}</span>{f.reason ? ` — ${f.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.disliked.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">
                    <ThumbsDown className="h-3 w-3" /> {t("profile.aiContext.disliked")}
                  </p>
                  <ul className="space-y-1">
                    {data.disliked.map((f, i) => (
                      <li key={i} className="text-sm text-ink-soft">
                        <span className="font-semibold text-ink">{f.title}</span>{f.reason ? ` — ${f.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
