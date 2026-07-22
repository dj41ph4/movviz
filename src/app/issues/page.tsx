"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { relativeTime, cn } from "@/lib/utils";
import type { Issue } from "@/lib/issues/types";
import { AlertTriangle, CheckCircle2, RotateCcw, Film, Tv, Send, MessageSquare } from "lucide-react";

const STATUS_TONE: Record<Issue["status"], string> = {
  open: "text-amber bg-amber/12 border-amber/25",
  reopened: "text-amber bg-amber/12 border-amber/25",
  resolved: "text-ok bg-ok/12 border-ok/25",
};

export default function IssuesPage() {
  const t = useT();
  const [tab, setTab] = useState<"open" | "all">("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // SWR paints the cached list instantly on remount, then keeps the same 5s
  // polling cadence in the background.
  const { data, mutate } = useSWR<{ issues: Issue[]; isAdmin: boolean }>(
    "/api/issues", { refreshInterval: 5000 }
  );
  const issues = data?.issues ?? [];
  const isAdmin = !!data?.isAdmin;
  const load = () => mutate();

  const setStatus = async (id: string, status: "resolved" | "reopened") => {
    setBusy(id);
    try {
      await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const sendComment = async (id: string) => {
    if (!comment.trim()) return;
    setBusy(id);
    try {
      await fetch(`/api/issues/${id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: comment.trim() }),
      });
      setComment("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const visible = issues.filter((i) => tab === "all" || i.status !== "resolved");
  const openCount = issues.filter((i) => i.status !== "resolved").length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow={isAdmin ? `${openCount} ${t("issues.eyebrow")}` : undefined}
        title={isAdmin ? t("issues.title") : t("issues.myIssues")}
        description={isAdmin ? t("issues.description") : t("issues.myIssuesDescription")}
      >
        {isAdmin && (
          <div className="flex gap-1.5">
            {(["open", "all"] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  tab === tb ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
                )}
              >
                {tb === "open" ? t("issues.openTab") : t("common.all")}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {visible.map((i) => {
            const poster = i.posterPath ? `https://image.tmdb.org/t/p/w200${i.posterPath}` : null;
            const isOpen = expanded === i.id;
            return (
              <motion.div
                key={i.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-2xl glass p-4"
              >
                <div className="flex gap-4">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt={i.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {i.libraryType === "movie" ? <Film className="h-5 w-5 text-ink-soft/50" /> : <Tv className="h-5 w-5 text-ink-soft/50" />}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-ink">{i.title}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-dim">
                          <span className="rounded-full bg-white/8 px-2 py-0.5 font-semibold">{t(`issues.type.${i.issueType}`)}</span>
                        </div>
                      </div>
                      <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_TONE[i.status])}>
                        <AlertTriangle className="h-3 w-3" /> {t(`issues.status.${i.status}`)}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{i.description}</p>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="text-xs text-ink-dim">
                        {isAdmin ? `${t("issues.reportedBy")} ${i.username} · ` : ""}
                        {relativeTime(new Date(i.createdAt).toISOString())}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpanded(isOpen ? null : i.id)}
                          className="flex h-8 items-center gap-1.5 rounded-xl glass px-3 text-xs font-semibold text-ink-soft hover:text-ink"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> {i.comments.length}
                        </button>
                        {isAdmin && i.status !== "resolved" && (
                          <button
                            onClick={() => setStatus(i.id, "resolved")}
                            disabled={busy === i.id}
                            className="flex h-8 items-center gap-1.5 rounded-xl brand-gradient px-3 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t("issues.resolve")}
                          </button>
                        )}
                        {i.status === "resolved" && (
                          <button
                            onClick={() => setStatus(i.id, "reopened")}
                            disabled={busy === i.id}
                            className="flex h-8 items-center gap-1.5 rounded-xl glass px-3 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> {t("issues.reopen")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
                        {i.comments.length === 0 && (
                          <p className="text-xs text-ink-dim">{t("issues.noComments")}</p>
                        )}
                        {i.comments.map((c) => (
                          <div key={c.id} className="rounded-xl bg-black/20 px-3 py-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-ink">{c.username}</span>
                              <span className="text-[10px] text-ink-dim">{relativeTime(new Date(c.createdAt).toISOString())}</span>
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">{c.message}</p>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendComment(i.id)}
                            placeholder={t("issues.addComment")}
                            className="h-10 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-brand/40"
                          />
                          <button
                            onClick={() => sendComment(i.id)}
                            disabled={busy === i.id || !comment.trim()}
                            className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient text-white disabled:opacity-40"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible.length === 0 && (
          <div className="rounded-2xl glass py-20 text-center text-ink-dim">{t("issues.empty")}</div>
        )}
      </div>
    </div>
  );
}
