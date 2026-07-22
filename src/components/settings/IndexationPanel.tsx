"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Search, Check, X, FolderOpen, Film, Tv } from "lucide-react";

interface IndexMatch {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  existing: boolean;
}

interface IndexCandidate {
  id: string;
  folderPath: string;
  folderName: string;
  match: IndexMatch | null;
  fileCount: number;
}

interface SearchHit {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
}

/**
 * Shared by the two "Indexation" settings tabs (films/séries) — scans the
 * library's own root folder(s) for files never linked to a library entry
 * (manually placed, migrated from another tool, or predating Movviz), lets
 * the user confirm/correct the guessed TMDb match per folder, then links
 * them in without going through indexer search — the files are already on
 * disk. See src/lib/library/indexScan.ts / indexImport.ts.
 */
export function IndexationPanel({ type }: { type: "movie" | "series" }) {
  const t = useT();
  const [candidates, setCandidates] = useState<IndexCandidate[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, IndexMatch>>(new Map());
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monitored, setMonitored] = useState(true);

  const loadStatus = async () => {
    const res = await fetch(`/api/library/index-scan?type=${type}`, { cache: "no-store" });
    const data = await res.json();
    setCandidates(data.candidates ?? []);
    return data.running as boolean;
  };

  const pollScan = async () => {
    for (;;) {
      const running = await loadStatus();
      if (!running) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    setScanning(false);
  };

  const startScan = async () => {
    setScanning(true);
    setSelected(new Set());
    setOverrides(new Map());
    await fetch("/api/library/index-scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    pollScan();
  };

  useEffect(() => {
    loadStatus().then((running) => { if (running) pollScan(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // A folder with a guessed match is pre-selected — one without one needs a manual pick first.
  useEffect(() => {
    if (!candidates) return;
    setSelected(new Set(candidates.filter((c) => c.match).map((c) => c.id)));
  }, [candidates]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const matchFor = (c: IndexCandidate) => overrides.get(c.id) ?? c.match;

  const runImport = async () => {
    if (!candidates) return;
    const items = candidates
      .filter((c) => selected.has(c.id) && matchFor(c))
      .map((c) => ({ candidateId: c.id, tmdbId: matchFor(c)!.tmdbId }));
    if (items.length === 0) return;
    setImporting(true);
    try {
      await fetch("/api/library/index-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, items, monitored }),
      });
      for (;;) {
        const res = await fetch(`/api/library/index-import?type=${type}`, { cache: "no-store" });
        const data = await res.json();
        if (!data.running) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      await startScan();
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = candidates?.filter((c) => selected.has(c.id) && matchFor(c)).length ?? 0;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-ink-soft">
          {type === "movie" ? t("indexation.movieIntro") : t("indexation.seriesIntro")}
        </p>
        <button
          onClick={startScan}
          disabled={scanning}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-bold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {scanning ? t("indexation.scanning") : t("indexation.scan")}
        </button>
      </div>

      {candidates === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl glass py-12 text-center">
          <FolderOpen className="mx-auto mb-2 h-6 w-6 text-ink-dim" />
          <p className="font-semibold text-ink">{t("indexation.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("indexation.emptyHint")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {candidates.map((c) => {
              const match = matchFor(c);
              return (
                <div key={c.id} className="rounded-xl glass p-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={!match}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 shrink-0 accent-brand-glow disabled:opacity-30"
                    />
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-black/30">
                      {match?.posterPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://image.tmdb.org/t/p/w92${match.posterPath}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-dim">
                          {type === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-ink-dim" title={c.folderPath}>{c.folderName}</p>
                      {match ? (
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                          {match.title} {match.year ? <span className="font-normal text-ink-dim">({match.year})</span> : null}
                          {match.existing && (
                            <span className="shrink-0 rounded-full border border-amber/30 bg-amber/12 px-1.5 py-0.5 text-[10px] font-bold text-amber">
                              {t("indexation.existing")}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-down">{t("indexation.noMatch")}</p>
                      )}
                      <p className="text-[11px] text-ink-dim">{c.fileCount} {t("indexation.files")}</p>
                    </div>
                    <button
                      onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg glass-strong px-2.5 text-xs font-semibold text-ink-soft hover:text-ink"
                    >
                      <Search className="h-3.5 w-3.5" /> {t("indexation.fixMatch")}
                    </button>
                  </div>

                  {editingId === c.id && (
                    <MatchPicker
                      type={type}
                      initialQuery={match?.title ?? c.folderName}
                      onPick={(hit) => {
                        setOverrides((m) => new Map(m).set(c.id, { tmdbId: hit.tmdbId, title: hit.title, year: hit.year, posterPath: hit.posterPath, existing: false }));
                        setSelected((s) => new Set(s).add(c.id));
                        setEditingId(null);
                      }}
                      onClose={() => setEditingId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-4 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-strong p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={monitored} onChange={(e) => setMonitored(e.target.checked)} className="h-4 w-4 accent-brand-glow" />
              {t("indexation.monitor")}
            </label>
            <button
              onClick={runImport}
              disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("indexation.importCount", { count: selectedCount })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MatchPicker({
  type, initialQuery, onPick, onClose,
}: {
  type: "movie" | "series";
  initialQuery: string;
  onPick: (hit: SearchHit) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/metadata/search?q=${encodeURIComponent(q)}&type=${type}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q, type]);

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/30 px-3">
        <Search className="h-4 w-4 shrink-0 text-ink-dim" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("indexation.searchPlaceholder")}
          className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-dim" />}
        <button onClick={onClose} className="shrink-0 text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.tmdbId}
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="text-sm font-semibold text-ink">{r.title}</span>
              <span className="text-xs text-ink-dim">{r.year ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
