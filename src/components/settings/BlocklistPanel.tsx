"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Ban, Trash2, Loader2, Search, Plus, X, Film, Tv, ShieldAlert } from "lucide-react";

interface BlockedTitle {
  id: string;
  type: "movie" | "series";
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  reason: string;
  blockedBy: string;
  blockedAt: number;
}

interface SearchResult {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  year: number | null;
  posterPath: string | null;
}

export function BlocklistPanel() {
  const t = useT();
  const [list, setList] = useState<BlockedTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = () =>
    fetch("/api/blocklist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setList(d.blocklist ?? []))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    setRemoving(id);
    const prev = list;
    setList((current) => current.filter((b) => b.id !== id));
    try {
      await fetch(`/api/blocklist/${id}`, { method: "DELETE" });
    } catch {
      setList(prev);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("blocklist.title") || "Blocklist"}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("blocklist.intro")}</p>
        </div>
      </div>

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> {t("blocklist.add")}
        </button>
      )}

      {showAdd && (
        <AddBlockForm
          onCancel={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load(); }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl glass py-12 text-center">
          <Ban className="mx-auto mb-2 h-6 w-6 text-ink-dim" />
          <p className="font-semibold text-ink">{t("blocklist.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("blocklist.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl glass p-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", b.type === "movie" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                {b.type === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{b.title} <span className="font-normal text-ink-dim">{b.year ?? ""}</span></p>
                <p className="truncate text-xs text-ink-dim">
                  {b.reason ? b.reason : t("blocklist.noReason")} · {t("blocklist.blockedBy", { user: b.blockedBy })}
                </p>
              </div>
              <button
                onClick={() => remove(b.id)}
                disabled={removing === b.id}
                className="flex h-9 items-center gap-1.5 rounded-xl glass-strong px-3 text-xs font-semibold text-down disabled:opacity-50"
              >
                {removing === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t("blocklist.unblock")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBlockForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/metadata/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []));
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await fetch("/api/blocklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: picked.type, tmdbId: picked.tmdbId, reason: reason.trim() }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl glass-strong p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-ink">{t("blocklist.add")}</h3>
        <button onClick={onCancel} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
      </div>

      {!picked ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/30 px-3">
            <Search className="h-4 w-4 text-ink-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("discover.searchPlaceholder")}
              className="h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={`${r.type}:${r.tmdbId}`}
                  onClick={() => setPicked(r)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.type === "movie" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                    {r.type === "movie" ? <Film className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-sm font-semibold text-ink">{r.title} <span className="font-normal text-ink-dim">{r.year ?? ""}</span></span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2">
            <span className="text-sm font-semibold text-ink">{picked.title} <span className="font-normal text-ink-dim">{picked.year ?? ""}</span></span>
            <button onClick={() => setPicked(null)} className="text-xs text-ink-dim hover:text-ink">{t("blocklist.changeTitle")}</button>
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("blocklist.reasonPlaceholder")}
            className="w-full rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim"
          />
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm whitespace-nowrap">{t("common.cancel")}</button>
            <button onClick={save} disabled={saving} className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} {t("blocklist.confirmBlock")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
