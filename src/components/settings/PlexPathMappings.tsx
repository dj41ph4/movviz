"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import { Check, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

interface SectionInfo {
  key: string;
  type: "movie" | "show";
  title: string;
  locations: string[];
}

interface MappingInfo {
  plexPrefix: string;
  movvizPrefix: string;
  learnedAt: number;
}

interface SuggestionInfo {
  plexPrefix: string;
  movvizPrefix: string;
  sectionTitle: string;
  kind: "movie" | "series";
}

interface State {
  supported: boolean;
  engineRoots: { movies: string[]; series: string[] };
  sections: SectionInfo[];
  mappings: MappingInfo[];
  suggestions: SuggestionInfo[];
}

/**
 * Correspondance chemins Plex ↔ Movviz (Docker/Linux uniquement — sur
 * Windows le backend répond supported:false et cette section ne s'affiche
 * pas du tout). Compare les dossiers bibliothèque du torrent (completedPath
 * engine) avec les emplacements réels des sections Plex : une suggestion
 * n'est JAMAIS appliquée seule, l'admin la valide ou saisit le mapping à
 * la main. Ex: Plex /volume1/docker/plex/film ↔ Movviz /data/film.
 */
export function PlexPathMappings() {
  const t = useT();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [plexPrefix, setPlexPrefix] = useState("");
  const [movvizPrefix, setMovvizPrefix] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/plex/path-mappings", { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch {
      /* panneau optionnel — on reste silencieux */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (plex: string, movviz: string) => {
    if (!plex.trim() || !movviz.trim()) {
      toast("error", t("plex.pathMappingsError"));
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/plex/path-mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plexPrefix: plex.trim(), movvizPrefix: movviz.trim() }),
      });
      if (!r.ok) {
        toast("error", t("plex.pathMappingsError"));
        return;
      }
      setPlexPrefix("");
      setMovvizPrefix("");
      toast("success", t("plex.pathMappingsAdded"));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plex: string, movviz: string) => {
    const key = `${plex}→${movviz}`;
    setDeleting(key);
    try {
      await fetch("/api/plex/path-mappings", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plexPrefix: plex, movvizPrefix: movviz }),
      });
      toast("success", t("plex.pathMappingsDeleted"));
      await load();
    } finally {
      setDeleting(null);
    }
  };

  if (loading || !state || !state.supported) return null;

  const mono = "break-all font-mono text-[11px] text-ink-soft";

  return (
    <div className="mt-5 border-t border-white/8 pt-5">
      <p className="text-sm font-semibold text-ink">{t("plex.pathMappingsTitle")}</p>
      <p className="mt-0.5 text-xs text-ink-dim">{t("plex.pathMappingsIntro")}</p>

      {/* Dossiers bibliothèque côté torrent (completedPath engine) */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl glass px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">{t("plex.pathMappingsEngineMovies")}</p>
          {state.engineRoots.movies.length === 0 && <p className="mt-1 text-xs text-ink-dim">—</p>}
          {state.engineRoots.movies.map((p) => (
            <p key={p} className={cn(mono, "mt-1")}>{p}</p>
          ))}
        </div>
        <div className="rounded-xl glass px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-dim">{t("plex.pathMappingsEngineSeries")}</p>
          {state.engineRoots.series.length === 0 && <p className="mt-1 text-xs text-ink-dim">—</p>}
          {state.engineRoots.series.map((p) => (
            <p key={p} className={cn(mono, "mt-1")}>{p}</p>
          ))}
        </div>
      </div>

      {/* Emplacements réels des sections Plex */}
      <div className="mt-2 space-y-2">
        {state.sections.map((s) => (
          <div key={`${s.type}:${s.key}`} className="rounded-xl glass px-3 py-2">
            <p className="text-xs font-semibold text-ink">{s.title} <span className="font-normal text-ink-dim">({s.type === "movie" ? t("common.movies") : t("common.series")})</span></p>
            {s.locations.length === 0 && <p className="mt-1 text-xs text-ink-dim">{t("plex.pathMappingsNoLocation")}</p>}
            {s.locations.map((loc) => (
              <p key={loc} className={cn(mono, "mt-1")}>{loc}</p>
            ))}
          </div>
        ))}
      </div>

      {/* Suggestions à valider humainement */}
      {state.suggestions.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">{t("plex.pathMappingsSuggested")}</p>
          <div className="space-y-2">
            {state.suggestions.map((s) => {
              const key = `${s.plexPrefix}→${s.movvizPrefix}`;
              return (
                <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber/25 bg-amber/8 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className={mono}>{s.plexPrefix}</p>
                    <p className="my-0.5 text-[11px] text-ink-dim">↔ {s.sectionTitle}</p>
                    <p className={mono}>{s.movvizPrefix}</p>
                  </div>
                  <button
                    onClick={async () => { setValidating(key); try { await add(s.plexPrefix, s.movvizPrefix); } finally { setValidating(null); } }}
                    disabled={validating === key || saving}
                    className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {validating === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t("plex.pathMappingsValidate")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mappings actifs */}
      <div className="mt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">{t("plex.pathMappingsExisting")}</p>
        {state.mappings.length === 0 && <p className="text-xs text-ink-dim">{t("plex.pathMappingsNone")}</p>}
        <div className="space-y-2">
          {state.mappings.map((m) => {
            const key = `${m.plexPrefix}→${m.movvizPrefix}`;
            return (
              <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl glass px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className={mono}>{m.plexPrefix} <span className="text-ink-dim">↔</span> {m.movvizPrefix}</p>
                </div>
                <button
                  onClick={() => remove(m.plexPrefix, m.movvizPrefix)}
                  disabled={deleting === key}
                  aria-label={t("plex.pathMappingsDelete")}
                  className="flex h-11 w-11 items-center justify-center rounded-xl glass-strong text-ink-soft disabled:opacity-50"
                >
                  {deleting === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saisie manuelle */}
      <div className="mt-3 rounded-xl glass p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-dim">{t("plex.pathMappingsManualTitle")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">{t("plex.pathMappingsPlexPrefix")}</label>
            <input
              value={plexPrefix}
              onChange={(e) => setPlexPrefix(e.target.value)}
              placeholder="/volume1/docker/plex/film"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 font-mono text-xs text-ink outline-none placeholder:text-ink-dim focus:border-brand/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-ink-soft">{t("plex.pathMappingsMovvizPrefix")}</label>
            <input
              value={movvizPrefix}
              onChange={(e) => setMovvizPrefix(e.target.value)}
              placeholder="/data/film"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 font-mono text-xs text-ink outline-none placeholder:text-ink-dim focus:border-brand/40"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => add(plexPrefix, movvizPrefix)}
            disabled={saving || !plexPrefix.trim() || !movvizPrefix.trim()}
            className="flex h-11 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("plex.pathMappingsAdd")}
          </button>
          <button
            onClick={load}
            className="flex h-11 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft"
          >
            <RefreshCw className="h-4 w-4" />
            {t("plex.pathMappingsRefresh")}
          </button>
        </div>
      </div>
    </div>
  );
}
