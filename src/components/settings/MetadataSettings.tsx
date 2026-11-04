"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, ExternalLink, Loader2, RotateCcw, BookOpen } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { useEnhancedTrailerSources } from "@/lib/settings/useEnhancedTrailerSources";
import { useMarkerSources } from "@/lib/settings/useMarkerSources";

export function MetadataSettings() {
  const t = useT();
  const enhancedTrailerSources = useEnhancedTrailerSources();
  const markerSources = useMarkerSources();
  const [tmdbConfigured, setTmdbConfigured] = useState(false);
  const [tmdbIsDefault, setTmdbIsDefault] = useState(true);
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tmdbSaving, setTmdbSaving] = useState(false);
  const [tmdbRestoring, setTmdbRestoring] = useState(false);
  const [tmdbTesting, setTmdbTesting] = useState(false);
  const [tmdbTestResult, setTmdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [omdbConfigured, setOmdbConfigured] = useState(false);
  const [omdbHasStoredKey, setOmdbHasStoredKey] = useState(false);
  const [omdbApiKey, setOmdbApiKey] = useState("");
  const [omdbSaving, setOmdbSaving] = useState(false);
  const [omdbTesting, setOmdbTesting] = useState(false);
  const [omdbTestResult, setOmdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [tvdbConfigured, setTvdbConfigured] = useState(false);
  const [tvdbHasStoredKey, setTvdbHasStoredKey] = useState(false);
  const [tvdbApiKey, setTvdbApiKey] = useState("");
  const [tvdbSaving, setTvdbSaving] = useState(false);

  const loadTmdb = () =>
    fetch("/api/metadata/key", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setTmdbConfigured(d.configured);
        setTmdbIsDefault(d.isDefault);
      });

  const loadOmdb = () =>
    fetch("/api/metadata/omdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOmdbConfigured(d.configured);
        setOmdbHasStoredKey(d.hasStoredKey);
      });

  const loadTvdb = () =>
    fetch("/api/metadata/tvdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTvdbConfigured(d.configured);
        setTvdbHasStoredKey(d.hasStoredKey);
      });

  useEffect(() => { loadTmdb(); loadOmdb(); loadTvdb(); }, []);

  const saveTvdb = async () => {
    if (!tvdbApiKey.trim()) return;
    setTvdbSaving(true);
    try {
      await fetch("/api/metadata/tvdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: tvdbApiKey.trim() }),
      });
      setTvdbApiKey("");
      await loadTvdb();
    } finally {
      setTvdbSaving(false);
    }
  };

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

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tmdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
            {tmdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {tmdbConfigured ? t("metadata.tmdbConfigured") : t("metadata.tmdbNotConfigured")}
          </span>
          {tmdbIsDefault && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
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
            className="flex-1 rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none"
          />
          <button
            onClick={saveTmdb}
            disabled={tmdbSaving || !tmdbApiKey.trim()}
            className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
          <button
            onClick={testTmdb}
            disabled={tmdbTesting}
            className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {tmdbTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("metadata.testKey")}
          </button>
          {!tmdbIsDefault && (
            <button
              onClick={restoreTmdb}
              disabled={tmdbRestoring}
              className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              {tmdbRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("metadata.tmdbRestoreDefault")}
            </button>
          )}
        </div>
        {tmdbTestResult && (
          <p className={cn("mt-2 text-xs font-semibold", tmdbTestResult.ok ? "text-ok" : "text-down")}>
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
            className="flex-1 rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none"
          />
          <button
            onClick={saveOmdb}
            disabled={omdbSaving || !omdbApiKey.trim()}
            className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
          <button
            onClick={testOmdb}
            disabled={omdbTesting || !omdbConfigured}
            className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {omdbTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("metadata.testKey")}
          </button>
        </div>
        {omdbTestResult && (
          <p className={cn("mt-2 text-xs font-semibold", omdbTestResult.ok ? "text-ok" : "text-down")}>
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
        <h3 className="text-sm font-bold text-ink">{t("metadata.tvdbTitle")}</h3>
        <p className="mt-1 mb-3 text-xs text-ink-dim">{t("metadata.tvdbHint")}</p>
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tvdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
            {tvdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {tvdbConfigured ? t("metadata.tvdbConfigured") : t("metadata.tvdbNotConfigured")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={tvdbApiKey}
            onChange={(e) => setTvdbApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTvdb()}
            placeholder={tvdbHasStoredKey ? "••••••••••••••••" : t("metadata.tvdbKeyPlaceholder")}
            className="flex-1 rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none"
          />
          <button
            onClick={saveTvdb}
            disabled={tvdbSaving || !tvdbApiKey.trim()}
            className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
        </div>
        <a
          href="https://thetvdb.com/api-information"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          {t("metadata.tvdbGetKey")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 border-t border-white/5 pt-5">
        <h3 className="text-sm font-bold text-ink">{t("metadata.skipSourcesTitle")}</h3>
        <p className="mt-1 mb-3 text-xs text-ink-dim">{t("metadata.skipSourcesHint")}</p>
        <div role="radiogroup" aria-label={t("metadata.skipSourcesTitle")} className="flex flex-wrap gap-2">
          {([
            { id: "all", label: t("metadata.skipSourcesAll"), disabled: !markerSources.plexLinked },
            { id: "plex-only", label: t("metadata.skipSourcesPlexOnly"), disabled: !markerSources.plexLinked },
            { id: "api-only", label: t("metadata.skipSourcesApiOnly"), disabled: false },
          ] as const).map((option) => {
            const selected = markerSources.effectiveMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={option.disabled}
                onClick={() => markerSources.setMode(option.id)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  selected ? "bg-white text-black" : "glass-strong text-ink-soft hover:text-ink"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          {!markerSources.plexLinked
            ? t("metadata.skipSourcesNoPlex")
            : markerSources.effectiveMode === "plex-only"
              ? t("metadata.skipSourcesPlexOnlyHint")
              : markerSources.effectiveMode === "api-only"
                ? t("metadata.skipSourcesApiOnlyHint")
                : t("metadata.skipSourcesAllHint")}
        </p>
        <a
          href="https://theintrodb.org"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          TheIntroDB <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-6 border-t border-white/5 pt-5">
        <h3 className="text-sm font-bold text-ink">{t("settings.experience.enhancedTrailerSourcesTitle")}</h3>
        <p className="mt-1 mb-3 text-xs text-ink-dim">{t("settings.experience.enhancedTrailerSourcesHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.enhancedTrailerSourcesEnabled")}</span>
          <Toggle on={enhancedTrailerSources.enabled} onChange={() => enhancedTrailerSources.setEnabled(!enhancedTrailerSources.enabled)} />
        </div>
      </div>
    </div>
  );
}
