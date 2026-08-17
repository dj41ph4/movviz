"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { Sparkles, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Brain, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiContextInsight {
  text: string;
  confidence: number;
  trend: "emergente" | "stable" | "en_baisse";
}

interface AiContextData {
  facts: string[];
  liked: { tmdbId: number; type: "movie" | "series"; title: string; reason: string | null }[];
  disliked: { tmdbId: number; type: "movie" | "series"; title: string; reason: string | null }[];
  usage: {
    watchedMovies: number;
    watchedSeries: number;
    watchedEpisodes: number;
    requestsTotal: number;
    aiAdded: number;
    aiAccepted: number;
    topSeries: { title: string; episodes: number }[];
    lastWatchedAt: number | null;
    watchesLast7Days: number;
    watchesLast30Days: number;
  };
  ratings: { tmdbId: number; type: "movie" | "series"; title: string; rating: number; source: "explicit" | "inferred"; opinion: string | null }[];
  context: { insights: AiContextInsight[]; builtAt: number } | null;
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
  const [building, setBuilding] = useState(false);
  const { data: sessionData } = useSWR<{ enabled: boolean }>("/api/ai/session");
  const { data, mutate } = useSWR<AiContextData>(open ? "/api/ai/context" : null);

  if (sessionData?.enabled !== true) return null;

  const buildContext = async () => {
    if (building) return;
    setBuilding(true);
    try {
      const r = await fetch("/api/ai/context", { method: "POST" });
      if (r.ok) {
        mutate();
        toast("success", t("profile.aiContext.buildDone"));
      } else {
        toast("error", t("profile.aiContext.buildFailed"));
      }
    } catch {
      toast("error", t("profile.aiContext.buildFailed"));
    } finally {
      setBuilding(false);
    }
  };

  const hasAnything = data && (data.facts.length > 0 || data.liked.length > 0 || data.disliked.length > 0 || data.usage.watchedMovies > 0 || data.usage.watchedSeries > 0 || data.ratings.length > 0 || !!data.context);

  const removeFeedback = async (tmdbId: number, type: "movie" | "series") => {
    try {
      const r = await fetch(`/api/ai/feedback?tmdbId=${tmdbId}&type=${type}`, { method: "DELETE" });
      if (r.ok) mutate();
      else toast("error", t("common.error"));
    } catch {
      toast("error", t("common.error"));
    }
  };

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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-dim">
              {data?.context ? t("profile.aiContext.contextBuiltAt", { date: new Date(data.context.builtAt).toLocaleDateString() }) : t("profile.aiContext.contextNeverBuilt")}
            </p>
            <button
              onClick={buildContext}
              disabled={building}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl brand-gradient px-3 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              {data?.context ? t("profile.aiContext.rebuildContext") : t("profile.aiContext.buildContext")}
            </button>
          </div>

          {data?.context && data.context.insights.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">
                <Brain className="h-3 w-3" /> {t("profile.aiContext.consolidated")}
              </p>
              <ul className="space-y-1.5">
                {data.context.insights.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-ink">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
                        i.confidence >= 0.6 ? "border-ok/30 bg-ok/12 text-ok" : "border-amber/30 bg-amber/12 text-amber"
                      )}
                      title={t(`profile.aiContext.trend.${i.trend}`)}
                    >
                      {Math.round(i.confidence * 100)}%
                    </span>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                  {data.usage.lastWatchedAt !== null && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {t("profile.aiContext.lastWatchedLine", {
                        date: new Date(data.usage.lastWatchedAt).toLocaleDateString(),
                        days7: String(data.usage.watchesLast7Days),
                        days30: String(data.usage.watchesLast30Days),
                      })}
                    </p>
                  )}
                </div>
              )}

              {data.ratings.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">
                    <Star className="h-3 w-3" /> {t("profile.aiContext.ratings")}
                  </p>
                  <ul className="space-y-1.5">
                    {data.ratings.map((r) => (
                      <li key={`${r.type}:${r.tmdbId}`} className="flex items-start gap-2 text-sm text-ink-soft">
                        <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber/25 bg-amber/12 px-2 py-0.5 text-[10px] font-bold text-amber">
                          {r.rating}<Star className="h-2.5 w-2.5 fill-amber" />
                        </span>
                        <span>
                          <span className="font-semibold text-ink">{r.title}</span>
                          {r.source === "inferred" && <span className="ml-1 text-xs text-ink-dim">({t("profile.aiContext.ratingInferred")})</span>}
                          {r.opinion ? ` — ${r.opinion}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.liked.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-dim">
                    <ThumbsUp className="h-3 w-3" /> {t("profile.aiContext.liked")}
                  </p>
                  <ul className="space-y-1">
                    {data.liked.map((f) => (
                      <li key={`${f.type}:${f.tmdbId}`} className="group flex items-start justify-between gap-2 text-sm text-ink-soft">
                        <span><span className="font-semibold text-ink">{f.title}</span>{f.reason ? ` — ${f.reason}` : ""}</span>
                        <button
                          onClick={() => removeFeedback(f.tmdbId, f.type)}
                          title={t("profile.aiContext.removeFeedback")}
                          className="shrink-0 rounded-full p-0.5 text-ink-dim opacity-0 transition-opacity hover:text-down group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
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
                    {data.disliked.map((f) => (
                      <li key={`${f.type}:${f.tmdbId}`} className="group flex items-start justify-between gap-2 text-sm text-ink-soft">
                        <span><span className="font-semibold text-ink">{f.title}</span>{f.reason ? ` — ${f.reason}` : ""}</span>
                        <button
                          onClick={() => removeFeedback(f.tmdbId, f.type)}
                          title={t("profile.aiContext.removeFeedback")}
                          className="shrink-0 rounded-full p-0.5 text-ink-dim opacity-0 transition-opacity hover:text-down group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
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
