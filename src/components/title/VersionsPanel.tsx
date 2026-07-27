"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { MediaBadges } from "@/components/library/MediaBadges";
import { X, Star, Trash2, Loader2, Plus, AlertTriangle, Columns2 } from "lucide-react";
import type { LibraryFileVersion } from "@/lib/library/types";
import type { VersionCandidate } from "@/lib/library/addVersionSearch";

function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

/**
 * "Gestion des versions" (LOT6.5) — view/compare/set-primary/remove existing
 * versions, plus the "Ajouter une version" search-and-confirm flow (LOT6.2/
 * 6.10). One modal instead of two: the add-flow naturally belongs right
 * next to the list it appends to.
 */
export function VersionsPanel({
  movieId,
  title,
  versions,
  onClose,
  onChange,
}: {
  movieId: string;
  title: string;
  versions: LibraryFileVersion[];
  onClose: () => void;
  onChange: () => void;
}) {
  const t = useT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());

  // Add-version sub-flow
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<VersionCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<VersionCandidate | null>(null);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [grabbing, setGrabbing] = useState(false);
  const [grabbed, setGrabbed] = useState(false);

  const startAdd = async () => {
    setAdding(true);
    setSearching(true);
    setSearchError(null);
    setCandidates(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/library/movies/${movieId}/add-version`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setCandidates(data.candidates);
      else setSearchError(data.error ?? "no_candidates");
    } finally {
      setSearching(false);
    }
  };

  const confirmGrab = async () => {
    if (!chosen) return;
    setGrabbing(true);
    try {
      const res = await fetch(`/api/library/movies/${movieId}/add-version`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidate: chosen, mode }),
      });
      const data = await res.json();
      if (data.ok) {
        setGrabbed(true);
        onChange();
      } else {
        setSearchError(data.error ?? "grab_failed");
      }
    } finally {
      setGrabbing(false);
    }
  };

  const setPrimary = async (versionId: string) => {
    setBusyId(versionId);
    try {
      await fetch(`/api/library/movies/${movieId}/versions/${versionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "setPrimary" }),
      });
      onChange();
    } finally {
      setBusyId(null);
    }
  };

  const removeOne = async (versionId: string) => {
    setBusyId(versionId);
    try {
      await fetch(`/api/library/movies/${movieId}/versions/${versionId}`, { method: "DELETE" });
      onChange();
    } finally {
      setBusyId(null);
    }
  };

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!compareMode) setSelectedForCompare(new Set());
  }, [compareMode]);

  const compareList = versions.filter((v) => selectedForCompare.has(v.id));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{t("title.versions.title", { count: versions.length })} — {title}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!adding && (
            <>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setCompareMode((v) => !v)}
                  disabled={versions.length < 2}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
                    compareMode ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
                  )}
                >
                  <Columns2 className="h-3.5 w-3.5" /> {t("title.versions.compare")}
                </button>
              </div>

              {compareMode && compareList.length > 0 && (
                <div className="grid gap-3 rounded-xl border border-white/8 bg-black/20 p-4" style={{ gridTemplateColumns: `repeat(${compareList.length}, minmax(0, 1fr))` }}>
                  {compareList.map((v) => (
                    <div key={v.id} className="space-y-2 text-center">
                      <p className="truncate text-xs font-semibold text-ink">{v.quality || v.resolution || "—"}</p>
                      <MediaBadges file={v} variant="surface" className="justify-center" />
                      <p className="text-xs text-ink-dim">{formatSize(v.size)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                      v.primary ? "border-brand/40 bg-brand/8" : "border-white/8 bg-black/20"
                    )}
                  >
                    {compareMode ? (
                      <input
                        type="checkbox"
                        checked={selectedForCompare.has(v.id)}
                        onChange={() => toggleCompare(v.id)}
                        className="h-4 w-4 accent-brand"
                      />
                    ) : v.primary ? (
                      <Star className="h-4 w-4 shrink-0 fill-amber text-amber" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <MediaBadges file={v} variant="surface" />
                      <p className="mt-1 text-xs text-ink-dim">
                        {formatSize(v.size)} · {v.versionSource === "plex" ? "Plex" : v.versionSource} · {v.reason}
                      </p>
                    </div>

                    {!compareMode && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!v.primary && (
                          <button
                            onClick={() => setPrimary(v.id)}
                            disabled={busyId === v.id}
                            className="rounded-lg glass px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
                          >
                            {busyId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("title.versions.setPrimary")}
                          </button>
                        )}
                        {versions.length > 1 && (
                          <button
                            onClick={() => removeOne(v.id)}
                            disabled={busyId === v.id}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-down/12 text-down hover:bg-down/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={startAdd}
                className="flex w-full items-center justify-center gap-2 rounded-xl glass px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink"
              >
                <Plus className="h-4 w-4" /> {t("title.versions.addVersion")}
              </button>
            </>
          )}

          {adding && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-amber/25 bg-amber/10 px-4 py-3 text-sm text-amber">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t("title.addVersion.warning")}</span>
              </div>

              {searching ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brand-glow" /></div>
              ) : grabbed ? (
                <p className="py-6 text-center text-sm font-semibold text-ok">{t("title.versions.grabbed")}</p>
              ) : searchError ? (
                <p className="py-6 text-center text-sm text-ink-dim">{t("title.versions.noCandidates")}</p>
              ) : candidates && candidates.length > 0 ? (
                <>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {candidates.map((c) => (
                      <button
                        key={c.release.guid}
                        onClick={() => setChosen(c)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          chosen?.release.guid === c.release.guid ? "border-brand/50 bg-brand/10" : "border-white/8 bg-black/20 hover:bg-white/5"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-ink">{c.release.title}</span>
                        <span className="shrink-0 text-xs text-ink-dim">{formatSize(c.release.size)}</span>
                      </button>
                    ))}
                  </div>

                  {chosen && (
                    <div className="space-y-3 rounded-xl border border-white/8 bg-black/20 p-4">
                      <p className="text-sm font-semibold text-ink">{t("title.versions.newVersionDetected")}</p>
                      <label className="flex items-center gap-2 text-sm text-ink-soft">
                        <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} className="accent-brand" />
                        {t("title.versions.replaceCurrent")}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-ink-soft">
                        <input type="radio" checked={mode === "add"} onChange={() => setMode("add")} className="accent-brand" />
                        {t("title.versions.addAsAdditional")}
                      </label>
                      <button
                        onClick={confirmGrab}
                        disabled={grabbing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {grabbing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("title.versions.confirm")}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-6 text-center text-sm text-ink-dim">{t("title.versions.noCandidates")}</p>
              )}

              <button onClick={() => setAdding(false)} className="w-full rounded-xl glass px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">
                {t("title.versions.back")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
