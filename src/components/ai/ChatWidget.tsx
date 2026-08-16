"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getPageTitleContext } from "@/lib/ai/pageContext";
import type { AiActionOutcome, AiChatMessage, AiMemoryEntry, AiRecommendation } from "@/lib/ai/types";
import {
  Bot, Send, Sparkles, X, Trash2, Plus, Check, Film, Loader2,
} from "lucide-react";

interface MemoryView {
  added: AiMemoryEntry[];
  accepted: AiMemoryEntry[];
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

const STATUS_STYLES: Record<AiActionOutcome["status"], string> = {
  added: "bg-ok/12 text-ok",
  requested: "bg-cyan/12 text-cyan",
  already: "bg-white/6 text-ink-soft",
  not_found: "bg-amber/12 text-amber",
  blocked: "bg-red/12 text-red",
  error: "bg-red/12 text-red",
};

function ActionList({ actions, t }: { actions: AiActionOutcome[]; t: (k: string) => string }) {
  return (
    <div className="mt-2 space-y-1">
      {actions.map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-bold", STATUS_STYLES[a.status])}>
            {t(`ai.status.${a.status}`)}
          </span>
          <span className="min-w-0 flex-1 text-ink-soft">{a.title}{a.year ? ` (${a.year})` : ""}</span>
        </div>
      ))}
    </div>
  );
}

function RecommendationCards({
  cards, adding, onAdd, t,
}: {
  cards: AiRecommendation[];
  adding: Record<string, "adding" | "added">;
  onAdd: (card: AiRecommendation) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="mt-3 space-y-2">
      {cards.map((card) => {
        const key = `${card.type}-${card.tmdbId}`;
        const state = adding[key];
        return (
          <div key={key} className="flex gap-3 rounded-xl glass p-3">
            {card.posterPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://image.tmdb.org/t/p/w92${card.posterPath}`}
                alt={card.title}
                className="h-[72px] w-12 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-[72px] w-12 shrink-0 items-center justify-center rounded-lg bg-white/6 text-ink-dim">
                <Film className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="truncate text-sm font-bold text-ink">{card.title}</span>
                {card.year ? <span className="text-xs text-ink-soft">{card.year}</span> : null}
                {card.rating > 0 ? (
                  <span className="text-xs font-bold text-brand-glow">{card.rating.toFixed(1)}</span>
                ) : null}
              </div>
              {card.reason ? (
                <p className="mt-1 text-xs italic leading-snug text-ink-soft">« {card.reason} »</p>
              ) : null}
              <div className="mt-1.5">
                {card.inLibrary ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/6 px-2 py-1 text-[11px] font-bold text-ink-soft">
                    <Check className="h-3 w-3" /> {t("ai.inLibrary")}
                  </span>
                ) : state === "added" ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-ok/12 px-2 py-1 text-[11px] font-bold text-ok">
                    <Check className="h-3 w-3" /> {t("ai.added")}
                  </span>
                ) : (
                  <button
                    onClick={() => onAdd(card)}
                    disabled={state === "adding"}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[11px] font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                  >
                    {state === "adding" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {t("ai.add")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatWidget() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, "adding" | "added">>({});
  const [memory, setMemory] = useState<MemoryView | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshMemory = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/memory", { cache: "no-store" });
      if (r.ok) setMemory(await r.json());
    } catch { /* panel stays hidden */ }
  }, []);

  // SWR (not a one-off fetch) so the button appears/disappears the moment an
  // admin flips the toggle in Settings — AiSettingsPanel calls the shared
  // `mutate("/api/ai/session")` after a successful save, which revalidates
  // this same key here without needing a page reload.
  const { data: sessionData, mutate: mutateSession } = useSWR<{ messages: AiChatMessage[]; enabled: boolean }>("/api/ai/session");
  const enabled = sessionData?.enabled ?? null;
  const seededRef = useRef(false);

  useEffect(() => {
    if (!sessionData || seededRef.current) return;
    seededRef.current = true;
    setMessages(sessionData.messages ?? []);
    if (sessionData.enabled) refreshMemory();
  }, [sessionData, refreshMemory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, pageContext: getPageTitleContext() }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        if (data?.error === "ai_disabled") mutateSession();
        const detail = data?.detail && typeof data.detail === "string" ? ` — ${data.detail}` : "";
        setMessages((m) => [...m, { role: "assistant", content: `${t("ai.error")}${detail}` }]);
      } else if (data?.message) {
        setMessages((m) => [...m, data.message]);
        setProvider(data.provider ?? null);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("ai.error") }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, t, mutateSession]);

  const clear = useCallback(async () => {
    setMessages([]);
    setProvider(null);
    try {
      await fetch("/api/ai/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
    } catch { /* local reset is enough */ }
  }, []);

  const addCard = useCallback(async (card: AiRecommendation) => {
    const key = `${card.type}-${card.tmdbId}`;
    if (adding[key]) return;
    setAdding((p) => ({ ...p, [key]: "adding" }));
    try {
      const r = await fetch(`/api/library/${card.type === "movie" ? "movies" : "series"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: card.tmdbId }),
      });
      if (r.ok) {
        setAdding((p) => ({ ...p, [key]: "added" }));
        toast("success", t("ai.added"));
        refreshMemory();
        fetch("/api/ai/memory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tmdbId: card.tmdbId, title: card.title, type: card.type }),
        }).catch(() => {});
      } else {
        toast("error", t("ai.addFailed"));
        setAdding((p) => { const n = { ...p }; delete n[key]; return n; });
      }
    } catch {
      toast("error", t("ai.addFailed"));
      setAdding((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  }, [adding, t]);

  const memoryLines = memory
    ? (() => {
        const lines: string[] = [];
        if (memory.usage.aiAdded > 0) lines.push(t("ai.memory.added", { n: String(memory.usage.aiAdded) }));
        if (memory.usage.aiAccepted > 0) lines.push(t("ai.memory.accepted", { n: String(memory.usage.aiAccepted) }));
        if (memory.usage.watchedEpisodes > 0) {
          lines.push(t("ai.memory.watched", { movies: String(memory.usage.watchedMovies), episodes: String(memory.usage.watchedEpisodes) }));
        }
        if (memory.usage.topSeries.length) {
          const top = memory.usage.topSeries[0];
          lines.push(t("ai.memory.topSeries", { title: top.title, episodes: String(top.episodes) }));
        }
        return lines;
      })()
    : [];

  if (enabled === false || enabled === null) return null;

  return (
    <div className="fixed right-4 bottom-20 z-[90] flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {open && (
        <div className="flex h-[min(560px,70vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl glass-strong shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/15 text-brand-glow">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-black tracking-tight text-ink">{t("ai.title")}</p>
                <p className="text-[10px] text-ink-soft">
                  {provider ? t("ai.viaProvider", { provider: t(`ai.provider.${provider}`) }) : t("ai.busyHint")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clear}
                title={t("ai.clear")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-white/8 hover:text-ink"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                title={t("ai.close")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-white/8 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {memoryLines.length > 0 ? (
              <div className="rounded-xl glass px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-brand-glow uppercase">
                  <Sparkles className="h-3 w-3" /> {t("ai.memory.title")}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{memoryLines.join(" · ")}</p>
              </div>
            ) : null}
            {messages.length === 0 && !busy ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Sparkles className="h-6 w-6 text-brand-glow" />
                <p className="max-w-[240px] text-sm text-ink-soft">{t("ai.empty")}</p>
              </div>
            ) : null}
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm whitespace-pre-wrap text-white">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm text-ink">
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.actions && msg.actions.length ? <ActionList actions={msg.actions} t={t} /> : null}
                    {msg.recommendations && msg.recommendations.length ? (
                      <RecommendationCards cards={msg.recommendations} adding={adding} onAdd={addCard} t={t} />
                    ) : null}
                  </div>
                </div>
              )
            )}
            {busy ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-sm text-ink-soft">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("ai.busy")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-end gap-2 border-t border-white/10 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("ai.placeholder")}
              rows={1}
              className="max-h-24 min-h-[44px] flex-1 resize-none rounded-xl glass px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? t("ai.close") : t("ai.open")}
        className="flex h-12 w-12 items-center justify-center rounded-full glass-strong text-brand-glow shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </div>
  );
}