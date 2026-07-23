"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, ExternalLink, Loader2, RotateCcw, RefreshCw, BookOpen } from "lucide-react";

export function MetadataSettings() {
  const t = useT();
  const [tvdbConfigured, setTvdbConfigured] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [useForAnime, setUseForAnime] = useState(false);
  const [tvdbApiKey, setTvdbApiKey] = useState("");
  const [tvdbSaving, setTvdbSaving] = useState(false);
  const [tvdbTesting, setTvdbTesting] = useState(false);
  const [tvdbTestResult, setTvdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [tvdbSyncing, setTvdbSyncing] = useState(false);
  const [tvdbSyncResult, setTvdbSyncResult] = useState<{ total: number; animeFound: number; synced: number; skipped: number } | null>(null);
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [tmdbIsDefault, setTmdbIsDefault] = useState(true);
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tmdbSaving, setTmdbSaving] = useState(false);
  const [tmdbRestoring, setTmdbRestoring] = useState(false);
  const [tmdbTesting, setTmdbTesting] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [discoverLayout, setDiscoverLayout] = useState<"movviz" | "allocine">("movviz");
  const [savingLayout, setSavingLayout] = useState(false);
  const [omdbConfigured, setOmdbConfigured] = useState(false);
  const [omdbHasStoredKey, setOmdbHasStoredKey] = useState(false);
  const [omdbApiKey, setOmdbApiKey] = useState("");
  const [omdbSaving, setOmdbSaving] = useState(false);
  const [omdbTesting, setOmdbTesting] = useState(false);
  const [omdbTestResult, setOmdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const loadTvdb = () =>
    fetch("/api/metadata/tvdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTvdbConfigured(d.configured);
        setHasStoredKey(d.hasStoredKey);
        setUseForAnime(d.useForAnime);
      });

  const loadTmdb = () =>
    fetch("/api/metadata/key", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setTmdbConfigured(d.configured);
        setTmdbIsDefault(d.isDefault);
      });

  const loadLayout = () =>
    fetch("/api/metadata/discover-layout", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDiscoverLayout(d.layout ?? "movviz"));

  const loadOmdb = () =>
    fetch("/api/metadata/omdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOmdbConfigured(d.configured);
        setOmdbHasStoredKey(d.hasStoredKey);
      });

  useEffect(() => { loadTvdb(); loadTmdb(); loadLayout(); loadOmdb(); }, []);

  const saveOmdb = async () => {
    if (!omdbApiKey.trim()) return;
    setOmdbSaving(true);
    try {
      await fetch("/api/metadata/omdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: omdbApiKey.trim() }),
      });
      setOmdbApiKey("");
      setOmdbTestResult(null);
      await loadOmdb();
    } finally {
      setOmdbSaving(false);
    }
  };

  const testOmdb = async () => {
    setOmdbTesting(true);
    setOmdbTestResult(null);
    try {
      const r = await fetch("/api/metadata/omdb/test", { cache: "no-store" });
      const d = await r.json();
      setOmdbTestResult(d);
    } catch {
      setOmdbTestResult({ ok: false, error: "network" });
    } finally {
      setOmdbTesting(false);
    }
  };

  const saveLayout = async (layout: "movviz" | "allocine") => {
    setSavingLayout(true);
    try {
      await fetch("/api/metadata/discover-layout", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      setDiscoverLayout(layout);
    } finally {
      setSavingLayout(false);
    }
  };

  const saveTvdb = async (patch: Record<string, unknown>) => {
    setTvdbSaving(true);
    try {
      await fetch("/api/metadata/tvdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadTvdb();
    } finally {
      setTvdbSaving(false);
    }
  };

  const testTvdb = async () => {
    setTvdbTesting(true);
    setTvdbTestResult(null);
    try {
      const r = await fetch("/api/metadata/tvdb", { cache: "no-store" });
      const d = await r.json();
      setTvdbTestResult({ ok: d.configured, error: d.configured ? undefined : "no_key" });
    } catch {
      setTvdbTestResult({ ok: false, error: "network" });
    } finally {
      setTvdbTesting(false);
    }
  };

  const saveTmdb = async () => {
    if (!tmdbApiKey.trim()) return;
    setTmdbSaving(true);
    try {
      await fetch("/api/metadata/key", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: tmdbApiKey.trim() }),
      });
      setTmdbApiKey("");
      await loadTmdb();
    } finally {
      setTmdbSaving(false);
    }
  };

  const restoreTmdb = async () => {
    setTmdbRestoring(true);
    try {
      await fetch("/api/metadata/key", { method: "DELETE" });
      setTmdbApiKey("");
      setTmdbTestResult(null);
      await loadTmdb();
    } finally {
      setTmdbRestoring(false);
    }
  };

  const testTmdb = async () => {
    setTmdbTesting(true);
    setTmdbTestResult(null);
    try {
      const r = await fetch("/api/metadata/key/test", { cache: "no-store" });
      const d = await r.json();
      setTmdbTestResult(d);
      if (d.ok) setTmdbConfigured(true);
    } catch {
      setTmdbTestResult({ ok: false, error: "network" });
    } finally {
      setTmdbTesting(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("metadata.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("metadata.intro")}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tvdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
          {tvdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {tvdbConfigured ? t("metadata.tvdbConfigured") : t("metadata.tvdbNotConfigured")}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          value={tvdbApiKey}
          onChange={(e) => setTvdbApiKey(e.target.value)}
          placeholder={hasStoredKey ? "••••••••••••••••" : t("metadata.tvdbKeyPlaceholder")}
          className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <button
          onClick={() => { saveTvdb({ apiKey: tvdbApiKey }); setTvdbApiKey(""); }}
          disabled={tvdbSaving || !tvdbApiKey.trim()}
          className="flex h-11 items-center rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {t("discover.saveKey")}
        </button>
      </div>
      {tvdbTestResult && (
        <p className={cn("mt-2 text-xs font-semibold", tvdbTestResult.ok ? "text-ok" : "text-red")}>
          {tvdbTestResult.ok ? t("metadata.keyValid") : t("metadata.keyInvalid")}
        </p>
      )}

      <label className="mt-4 flex items-center gap-3">
        <button
          onClick={() => saveTvdb({ useForAnime: !useForAnime })}
          className={cn("relative h-6 w-11 rounded-full transition-colors", useForAnime ? "brand-gradient" : "bg-white/10")}
        >
          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", useForAnime && "translate-x-5")} />
        </button>
        <span className="text-sm font-semibold text-ink">{t("metadata.useTvdbForAnime")}</span>
      </label>
      <p className="mt-1 text-xs text-ink-dim">{t("metadata.useTvdbForAnimeHint")}</p>

      <button
        onClick={async () => {
          setTvdbSyncing(true);
          setTvdbSyncResult(null);
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 120000);
            const r = await fetch("/api/metadata/tvdb/sync-all", { method: "POST", signal: controller.signal });
            clearTimeout(id);
            if (r.ok) setTvdbSyncResult(await r.json());
          } catch {
            setTvdbSyncResult(null);
          } finally {
            setTvdbSyncing(false);
          }
        }}
        disabled={tvdbSyncing || !tvdbConfigured}
        className="mt-3 flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
      >
        {tvdbSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {t("metadata.syncAllAnime")}
      </button>
      {tvdbSyncResult && (
        <p className="mt-1.5 text-xs text-ink-dim">
          {tvdbSyncResult.synced}/{tvdbSyncResult.animeFound} anime synchronisé{tvdbSyncResult.synced > 1 ? "s" : ""}
          {tvdbSyncResult.skipped > 0 && ` · ${tvdbSyncResult.skipped} ignoré${tvdbSyncResult.skipped > 1 ? "s" : ""}`}
        </p>
      )}

      <div className="mt-6 border-t border-white/5 pt-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tmdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
            {tmdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {tmdbConfigured ? t("metadata.tmdbConfigured") : t("metadata.tmdbNotConfigured")}
          </span>
          {tmdbIsDefault && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-dim">
              {t("metadata.tmdbDefaultKey")}
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-ink-dim">{t("metadata.tmdbDefaultKeyHint")}</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={tmdbApiKey}
            onChange={(e) => setTmdbApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTmdb()}
            placeholder={t("metadata.tmdbKeyPlaceholder")}
            className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <button
            onClick={saveTmdb}
            disabled={tmdbSaving || !tmdbApiKey.trim()}
            className="flex h-11 items-center rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
          <button
            onClick={testTmdb}
            disabled={tmdbTesting}
            className="flex h-11 items-center rounded-xl glass px-4 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
          >
            {tmdbTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("metadata.testKey")}
          </button>
          {!tmdbIsDefault && (
            <button
              onClick={restoreTmdb}
              disabled={tmdbRestoring}
              className="flex h-11 items-center gap-1.5 rounded-xl glass px-4 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
            >
              {tmdbRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("metadata.tmdbRestoreDefault")}
            </button>
          )}
        </div>
        {tmdbTestResult && (
          <p className={cn("mt-2 text-xs font-semibold", tmdbTestResult.ok ? "text-ok" : "text-red")}>
            {tmdbTestResult.ok
              ? t("metadata.keyValid")
              : tmdbTestResult.error === "invalid_key"
                ? t("metadata.keyInvalid")
                : t("metadata.testNetworkError")}
          </p>
        )}
        <a
          href="https://www.themoviedb.org/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          {t("setup.tmdbGetKey")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 border-t border-white/5 pt-5">
        <h3 className="text-sm font-bold text-ink">{t("metadata.omdbTitle")}</h3>
        <p className="mt-1 mb-3 text-xs text-ink-dim">{t("metadata.omdbHint")}</p>
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", omdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
            {omdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {omdbConfigured ? t("metadata.omdbConfigured") : t("metadata.omdbNotConfigured")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={omdbApiKey}
            onChange={(e) => setOmdbApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveOmdb()}
            placeholder={omdbHasStoredKey ? "••••••••••••••••" : t("metadata.omdbKeyPlaceholder")}
            className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <button
            onClick={saveOmdb}
            disabled={omdbSaving || !omdbApiKey.trim()}
            className="flex h-11 items-center rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
          <button
            onClick={testOmdb}
            disabled={omdbTesting || !omdbConfigured}
            className="flex h-11 items-center rounded-xl glass px-4 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
          >
            {omdbTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("metadata.testKey")}
          </button>
        </div>
        {omdbTestResult && (
          <p className={cn("mt-2 text-xs font-semibold", omdbTestResult.ok ? "text-ok" : "text-red")}>
            {omdbTestResult.ok ? t("metadata.keyValid") : t("metadata.keyInvalid")}
          </p>
        )}
        <a
          href="https://www.omdbapi.com/apikey.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          {t("metadata.omdbGetKey")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 border-t border-white/5 pt-5">
        <h3 className="text-sm font-bold text-ink">{t("metadata.discoverLayout")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("metadata.discoverLayoutHint")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["movviz", "allocine"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => saveLayout(opt)}
              disabled={savingLayout}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60",
                discoverLayout === opt ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
              )}
            >
              {opt === "movviz" ? t("metadata.discoverLayoutMovviz") : t("metadata.discoverLayoutAllocine")}
              <p className="mt-0.5 text-xs font-normal text-ink-dim">
                {opt === "movviz" ? t("metadata.discoverLayoutMovvizHint") : t("metadata.discoverLayoutAllocineHint")}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
