"use client";

import useSWR from "swr";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Trash2, RotateCcw, Loader2, AlertTriangle, Film, Tv, Check, X } from "lucide-react";
import type { TrashItem } from "@/lib/library/trashStore";

function fetcher(url: string) { return fetch(url, { cache: "no-store" }).then((r) => r.json()); }

export default function TrashPage() {
  const t = useT();
  const { data, isLoading, mutate } = useSWR<{ items: TrashItem[] }>("/api/library/trash", fetcher);
  const [restoring, setRestoring] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const items = data?.items ?? [];

  const restore = async (item: TrashItem) => {
    const key = `${item.type}_${item.tmdbId}`;
    setRestoring((s) => new Set(s).add(key));
    try {
      await fetch(`/api/library/trash/${key}/restore`, { method: "POST" });
      await mutate();
    } finally {
      setRestoring((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const permanentlyDelete = async (item: TrashItem) => {
    const key = `${item.type}_${item.tmdbId}`;
    setConfirmDeleteKey(null);
    setDeleting((s) => new Set(s).add(key));
    try {
      await fetch(`/api/library/trash/${key}`, { method: "DELETE" });
      await mutate();
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  };

  const emptyTrash = async () => {
    await fetch("/api/library/trash", { method: "DELETE" });
    setConfirmClear(false);
    await mutate();
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title={t("nav.trash")}
        description={t("trash.description", { n: items.length })}
      >
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-sm text-down">{t("trash.confirmClear")}</span>
                <button onClick={emptyTrash} className="flex h-9 items-center gap-2 rounded-xl bg-down px-4 text-sm font-bold text-white">
                  {t("trash.emptyAll")}
                </button>
                <button onClick={() => setConfirmClear(false)} className="flex h-9 items-center gap-2 rounded-xl glass px-4 text-sm font-semibold text-ink-soft">
                  {t("settings.cancel")}
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="flex h-9 items-center gap-2 rounded-xl border border-down/30 px-4 text-sm font-semibold text-down hover:bg-down/10">
                <Trash2 className="h-4 w-4" />
                {t("trash.emptyAll")}
              </button>
            )}
          </div>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ink-dim" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Trash2 className="h-16 w-16 text-ink-dim/30" />
          <p className="text-lg font-semibold text-ink-dim">{t("trash.empty")}</p>
          <p className="max-w-md text-sm text-ink-soft">{t("trash.emptyHint")}</p>
        </div>
      ) : (
        <AnimatePresence mode="sync">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item) => {
              const key = `${item.type}_${item.tmdbId}`;
              const isRestoring = restoring.has(key);
              const isDeleting = deleting.has(key);
              const isConfirming = confirmDeleteKey === key;
              return (
                <motion.div
                  key={key}
                  layout
                  exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.25, ease: "easeInOut" as const } }}
                  className="group relative"
                >
                  <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
                    {item.posterPath ? (
                      <img
                        src={`/tmdb/w342${item.posterPath}`}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                        {item.type === "movie" ? <Film className="h-8 w-8 text-ink-soft/50" /> : <Tv className="h-8 w-8 text-ink-soft/50" />}
                        <span className="text-xs font-semibold text-ink/70">{item.title}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => restore(item)}
                        disabled={isRestoring}
                        title={t("trash.restore")}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-ok text-black shadow-lg transition-transform hover:scale-110"
                      >
                        {isRestoring ? <Loader2 className="h-5 w-5 animate-spin" /> : <RotateCcw className="h-5 w-5" />}
                      </button>
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => permanentlyDelete(item)}
                            disabled={isDeleting}
                            title={t("trash.deleteForeverConfirm")}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-down text-white shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
                          >
                            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteKey(null)}
                            disabled={isDeleting}
                            title={t("common.cancel")}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white shadow-lg transition-transform hover:scale-110"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteKey(key)}
                          title={t("trash.deleteForever")}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-down/80 text-white shadow-lg transition-transform hover:scale-110"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions mobiles (toujours visibles) */}
                  <div className="mt-2 flex gap-2 lg:hidden">
                    {isConfirming ? (
                      <>
                        <button
                          onClick={() => permanentlyDelete(item)}
                          disabled={isDeleting}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-down text-sm font-bold text-white transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          {t("trash.deleteForeverConfirm")}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          disabled={isDeleting}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-ink-soft transition-colors hover:bg-white/15"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => restore(item)}
                          disabled={isRestoring}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ok/20 text-sm font-bold text-ok transition-colors hover:bg-ok/30 disabled:opacity-50"
                        >
                          {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          {t("trash.restore")}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteKey(key)}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-down/20 text-sm font-bold text-down transition-colors hover:bg-down/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("trash.deleteForever")}
                        </button>
                      </>
                    )}
                  </div>

                  <p className="mt-1.5 truncate text-xs font-semibold text-ink">{item.title}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                    <span>{item.year ?? "—"}</span>
                    <span className="text-ink-dim/40">·</span>
                    <span className="flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      {new Date(item.deletedAt).toLocaleDateString()}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
