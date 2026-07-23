"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, Download, ExternalLink } from "lucide-react";

interface SeerrConfig {
  baseUrl: string;
  configured: boolean;
}

interface ImportSummary {
  seerrUsers: number;
  seerrRequests: number;
  importedApproved: number;
  importedPending: number;
  alreadyInLibrary: number;
  alreadyRequested: number;
  skippedDeclined: number;
  skippedBlocked: number;
  failed: number;
  unmatchedUsers: string[];
}

export function SeerrSettings() {
  const t = useT();
  const [cfg, setCfg] = useState<SeerrConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const load = () =>
    fetch("/api/seerr/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setCfg(d);
        setBaseUrl(d.baseUrl);
      });

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/seerr/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      setApiKey("");
      setTestResult(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/seerr/test", { method: "POST" });
      const d = await res.json();
      setTestResult(!!d.ok);
    } finally {
      setTesting(false);
    }
  };

  const importNow = async () => {
    setImporting(true);
    setSummary(null);
    try {
      const res = await fetch("/api/seerr/import", { method: "POST" });
      if (res.ok) setSummary(await res.json());
    } finally {
      setImporting(false);
    }
  };

  if (!cfg) return null;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ExternalLink className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.tabImports")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("seerr.intro")}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            cfg.configured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber"
          )}
        >
          {cfg.configured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {cfg.configured ? t("seerr.configured") : t("seerr.notConfigured")}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={t("seerr.baseUrl")}
          className="h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder={t("seerr.apiKey")}
          className="h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !baseUrl}
          className="flex h-9 items-center gap-2 rounded-xl brand-gradient px-3.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("settings.save")}
        </button>
        <button
          onClick={test}
          disabled={testing || !cfg.configured}
          className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("indexerMgr.test")}
        </button>
        {testResult != null && (
          <span className={cn("text-xs font-semibold", testResult ? "text-ok" : "text-down")}>
            {testResult ? t("indexerMgr.testOk") : t("indexerMgr.testFail")}
          </span>
        )}
      </div>

      {cfg.configured && (
        <div className="mt-5 border-t border-white/8 pt-5">
          <p className="mb-1 text-sm font-semibold text-ink">{t("seerr.importTitle")}</p>
          <p className="mb-3 text-xs text-ink-dim">{t("seerr.importHint")}</p>
          <button
            onClick={importNow}
            disabled={importing}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {t("seerr.importNow")}
          </button>

          {summary && (
            <div className="mt-4 space-y-1.5 rounded-xl bg-black/25 p-4 text-xs text-ink-soft">
              <p>{t("seerr.summaryScanned", { users: summary.seerrUsers, requests: summary.seerrRequests })}</p>
              <p className="text-ok">{t("seerr.summaryImported", { approved: summary.importedApproved, pending: summary.importedPending })}</p>
              <p>{t("seerr.summarySkipped", {
                library: summary.alreadyInLibrary,
                requested: summary.alreadyRequested,
                declined: summary.skippedDeclined,
                blocked: summary.skippedBlocked,
              })}</p>
              {summary.failed > 0 && <p className="text-down">{t("seerr.summaryFailed", { n: summary.failed })}</p>}
              {summary.unmatchedUsers.length > 0 && (
                <p className="text-amber">{t("seerr.summaryUnmatched", { names: summary.unmatchedUsers.join(", ") })}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
