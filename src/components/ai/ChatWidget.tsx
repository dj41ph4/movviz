"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getPageTitleContext } from "@/lib/ai/pageContext";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import type { AiActionOutcome, AiChatMessage, AiRecommendation } from "@/lib/ai/types";
import {
  Bot, Send, Sparkles, X, Trash2, Plus, Check, Film, Loader2, ThumbsUp, ThumbsDown,
} from "lucide-react";

const STATUS_STYLES: Record<AiActionOutcome["status"], string> = {
  added: "bg-ok/12 text-ok",
  requested: "bg-cyan/12 text-cyan",
  already: "bg-white/6 text-ink-soft",
  not_found: "bg-amber/12 text-amber",
  blocked: "bg-red/12 text-red",
  error: "bg-red/12 text-red",
};

// Recommendation distance tiers (recommendationScore.ts) — same pill trio
// as everywhere else in Movviz (border + bg/12 + text on a semantic color).
const DISTANCE_STYLES: Record<NonNullable<AiRecommendation["distance"]>, string> = {
  very_close: "border-brand-glow/30 bg-brand-glow/12 text-brand-glow",
  close: "border-ok/30 bg-ok/12 text-ok",
  mood_match: "border-cyan/30 bg-cyan/12 text-cyan",
  conceptual_match: "border-purple/30 bg-purple/12 text-purple",
  discovery: "border-amber/30 bg-amber/12 text-amber",
};

function ActionList({
  actions, isAdmin, deleteState, onRequestDelete, onConfirmDelete, onCancelDelete, t,
}: {
  actions: AiActionOutcome[];
  isAdmin: boolean;
  deleteState: Record<string, "confirm" | "deleting" | "done">;
  onRequestDelete: (outcome: AiActionOutcome) => void;
  onConfirmDelete: (outcome: AiActionOutcome) => void;
  onCancelDelete: (outcome: AiActionOutcome) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="mt-2 space-y-1">
      {actions.map((a, i) => {
        // Only "already in library" outcomes can be wrong (the AI resolved
        // to an existing entry that doesn't match what the user meant) —
        // delete requires admin, same gate as the trash icon everywhere
        // else in Movviz. The assistant never deletes anything itself: this
        // is the human clicking a button, identical in spirit to any other
        // delete control in the app.
        const canDelete = isAdmin && a.status === "already" && a.libraryId;
        const dKey = a.libraryId ? `${a.type}-${a.libraryId}` : "";
        const dState = deleteState[dKey];
        return (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-bold", STATUS_STYLES[a.status])}>
              {t(`ai.status.${a.status}`)}
            </span>
            <span className="min-w-0 flex-1 text-ink-soft">{a.title}{a.year ? ` (${a.year})` : ""}</span>
            {canDelete && dState !== "done" ? (
              dState === "confirm" ? (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onConfirmDelete(a)}
                    title={t("ai.deleteConfirm")}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-red/15 text-red hover:bg-red/25"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onCancelDelete(a)}
                    title={t("common.cancel")}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim hover:bg-white/8 hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => onRequestDelete(a)}
                  disabled={dState === "deleting"}
                  title={t("ai.deleteEntry")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-dim hover:bg-red/12 hover:text-red disabled:opacity-40"
                >
                  {dState === "deleting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RecommendationCards({
  cards, adding, onAdd, votes, onVote, t,
}: {
  cards: AiRecommendation[];
  adding: Record<string, "adding" | "added">;
  onAdd: (card: AiRecommendation) => void;
  votes: Record<string, "like" | "dislike">;
  onVote: (card: AiRecommendation, liked: boolean) => void;
  t: (k: string) => string;
}) {
  return (
    <div className="mt-3 space-y-2">
      {cards.map((card, i) => {
        const key = `${card.type}-${card.tmdbId}`;
        const state = adding[key];
        const vote = votes[key];
        return (
          <div key={key}>
            {/* A connector line before each card instead of a silent wall
                of cards — cycles through varied phrasing (i18n, not
                LLM-generated: reliable and consistent regardless of what
                the model did with its own text this time) so it reads as
                a real back-and-forth rather than a dumped list. */}
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">
              {t(`ai.recoIntro${(i % 5) + 1}`)}
            </p>
            <div className="flex gap-3 rounded-xl glass p-3">
            {/* Real /title/{type}/{tmdbId} link — pages that mount
                useTitlePanel() (Discover, Library, Calendar…) intercept
                this exact href pattern and open it as the sliding
                contextual panel instead of a full navigation; pages
                without that hook mounted just navigate there normally.
                Either way the poster/title are never a dead end. */}
            <Link href={`/title/${card.type}/${card.tmdbId}`} className="shrink-0">
              {card.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://image.tmdb.org/t/p/w92${card.posterPath}`}
                  alt={card.title}
                  className="h-[72px] w-12 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[72px] w-12 items-center justify-center rounded-lg bg-white/6 text-ink-dim">
                  <Film className="h-5 w-5" />
                </div>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link href={`/title/${card.type}/${card.tmdbId}`} className="truncate text-sm font-bold text-ink hover:underline">
                  {card.title}
                </Link>
                {card.year ? <span className="text-xs text-ink-soft">{card.year}</span> : null}
                {card.rating > 0 ? (
                  <span className="text-xs font-bold text-brand-glow">{card.rating.toFixed(1)}</span>
                ) : null}
                {card.distance ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      DISTANCE_STYLES[card.distance]
                    )}
                  >
                    {t(`ai.distance.${card.distance}`)}
                  </span>
                ) : null}
              </div>
              {card.reason ? (
                <p className="mt-1 text-xs italic leading-snug text-ink-soft">« {card.reason} »</p>
              ) : null}
              <div className="mt-1.5 flex items-center gap-1.5">
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
                <button
                  onClick={() => onVote(card, true)}
                  title={t("ai.feedbackLike")}
                  aria-label={t("ai.feedbackLike")}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    vote === "like" ? "bg-ok/15 text-ok" : "text-ink-dim hover:bg-white/8 hover:text-ink-soft"
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onVote(card, false)}
                  title={t("ai.feedbackDislike")}
                  aria-label={t("ai.feedbackDislike")}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    vote === "dislike" ? "bg-red/15 text-red" : "text-ink-dim hover:bg-white/8 hover:text-ink-soft"
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </div>
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
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, "adding" | "added">>({});
  const [votes, setVotes] = useState<Record<string, "like" | "dislike">>({});
  const [deleteState, setDeleteState] = useState<Record<string, "confirm" | "deleting" | "done">>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // SWR (not a one-off fetch) so the button appears/disappears the moment an
  // admin flips the toggle in Settings — AiSettingsPanel calls the shared
  // `mutate("/api/ai/session")` after a successful save, which revalidates
  // this same key here without needing a page reload.
  const { data: sessionData, mutate: mutateSession } = useSWR<{ messages: AiChatMessage[]; enabled: boolean; proactive?: boolean }>("/api/ai/session");
  const enabled = sessionData?.enabled ?? null;
  const seededRef = useRef(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!sessionData || seededRef.current) return;
    seededRef.current = true;
    setMessages(sessionData.messages ?? []);
  }, [sessionData]);

  // Proactive nudge (demande explicite user — "quand l'utilisateur revient
  // sur Movviz après un moment, le chat pop en clignotant et pose une
  // question"). GET /api/ai/session revalidates on window focus (global
  // SWRConfig), which is exactly "the user came back" — the server decides
  // whether a real nudge fired (presence.ts, its own cooldown), this just
  // reacts when it did. Authoritative replace, not append: this can only
  // land while the widget is idle (no in-flight send racing it).
  useEffect(() => {
    if (!sessionData?.proactive || !seededRef.current) return;
    setMessages(sessionData.messages ?? []);
    setOpen(true);
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 2600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.proactive]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const sendText = useCallback(async (text: string) => {
    if (!text || busy) return;
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
  }, [busy, t, mutateSession]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendText(text);
  }, [input, busy, sendText]);

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
        fetch("/api/ai/memory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tmdbId: card.tmdbId, title: card.title, type: card.type }),
        }).catch(() => {});
        // Clicking "Ajouter" on a card used to be a dead end conversation-
        // wise — a toast, then silence. Feeding it back in as a normal chat
        // turn lets the assistant react naturally (personality/anecdote
        // rules already in the system prompt apply here exactly as they
        // would to anything the user typed themselves).
        sendText(t("ai.addedTrigger", { title: card.title }));
      } else {
        toast("error", t("ai.addFailed"));
        setAdding((p) => { const n = { ...p }; delete n[key]; return n; });
      }
    } catch {
      toast("error", t("ai.addFailed"));
      setAdding((p) => { const n = { ...p }; delete n[key]; return n; });
    }
  }, [adding, t, sendText]);

  const voteCard = useCallback((card: AiRecommendation, liked: boolean) => {
    const key = `${card.type}-${card.tmdbId}`;
    setVotes((p) => ({ ...p, [key]: liked ? "like" : "dislike" }));
    fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: card.tmdbId, title: card.title, type: card.type, liked, reason: card.reason }),
    }).catch(() => {});
  }, []);

  // Deleting a wrong "already in library" entry — the human clicks Trash
  // then confirms, exactly like any other delete control in Movviz; the
  // assistant itself never triggers this. Default (trash if configured,
  // matches the app's normal delete behavior elsewhere).
  const requestDeleteEntry = useCallback((outcome: AiActionOutcome) => {
    if (!outcome.libraryId) return;
    setDeleteState((p) => ({ ...p, [`${outcome.type}-${outcome.libraryId}`]: "confirm" }));
  }, []);
  const cancelDeleteEntry = useCallback((outcome: AiActionOutcome) => {
    if (!outcome.libraryId) return;
    setDeleteState((p) => { const n = { ...p }; delete n[`${outcome.type}-${outcome.libraryId}`]; return n; });
  }, []);
  const confirmDeleteEntry = useCallback(async (outcome: AiActionOutcome) => {
    if (!outcome.libraryId) return;
    const key = `${outcome.type}-${outcome.libraryId}`;
    setDeleteState((p) => ({ ...p, [key]: "deleting" }));
    try {
      const r = await fetch(`/api/library/${outcome.type === "movie" ? "movies" : "series"}/${outcome.libraryId}`, { method: "DELETE" });
      if (r.ok) {
        setDeleteState((p) => ({ ...p, [key]: "done" }));
        toast("success", t("ai.deleteEntryDone"));
      } else {
        setDeleteState((p) => { const n = { ...p }; delete n[key]; return n; });
        toast("error", t("ai.deleteEntryFailed"));
      }
    } catch {
      setDeleteState((p) => { const n = { ...p }; delete n[key]; return n; });
      toast("error", t("ai.deleteEntryFailed"));
    }
  }, [t]);

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
                    {msg.actions && msg.actions.length ? (
                      <ActionList
                        actions={msg.actions}
                        isAdmin={user?.role === "admin"}
                        deleteState={deleteState}
                        onRequestDelete={requestDeleteEntry}
                        onConfirmDelete={confirmDeleteEntry}
                        onCancelDelete={cancelDeleteEntry}
                        t={t}
                      />
                    ) : null}
                    {msg.recommendations && msg.recommendations.length ? (
                      <RecommendationCards cards={msg.recommendations} adding={adding} onAdd={addCard} votes={votes} onVote={voteCard} t={t} />
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
              // The placeholder text wraps onto two lines at this panel's
              // width in every locale — a 44px (1-line) box was clipping
              // the second line at the bottom edge instead of wrapping it
              // visibly. Sized for two full lines instead of shortening
              // the text.
              rows={2}
              className="max-h-24 min-h-[60px] flex-1 resize-none rounded-xl glass px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim placeholder:leading-snug"
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
        onClick={() => { setOpen((o) => !o); setPulse(false); }}
        title={open ? t("ai.close") : t("ai.open")}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full glass-strong text-brand-glow shadow-xl transition-transform hover:scale-105",
          pulse && "animate-badge-pulse"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </div>
  );
}