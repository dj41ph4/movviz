"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { cn, relativeTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { Stethoscope, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle } from "lucide-react";

interface DoctorRecommendation {
  severity: "info" | "warning" | "critical";
  message: string;
}

interface DecisionEntry {
  t: number;
  refTitle: string;
  releaseTitle: string;
  decision: "accepted" | "rejected";
  reasons: { type: string; message: string }[];
}

interface DoctorReport {
  ranAt: number;
  recommendations: DoctorRecommendation[];
  config: {
    tmdbConfigured: boolean;
    indexers: { name: string; ok: boolean }[];
    blockedWordsCount: number;
    codecScores: { x264: number; x265: number; av1: number };
    qualityProfiles: { name: string; minScore: number; allowedResolutions: string[] }[];
  };
  recentDecisions: DecisionEntry[];
}

const SEVERITY_STYLE: Record<DoctorRecommendation["severity"], { icon: typeof Info; cls: string }> = {
  critical: { icon: AlertCircle, cls: "border-down/25 bg-down/10 text-down" },
  warning: { icon: AlertTriangle, cls: "border-amber/25 bg-amber/10 text-amber" },
  info: { icon: Info, cls: "border-white/8 bg-black/20 text-ink-soft" },
};

/** "Doctor Movviz" (LOT4.4) — on-demand analysis + recent-decisions transparency, reusing only data collected elsewhere. Never polls automatically. */
export function DoctorPanel() {
  const t = useT();
  const { locale } = useI18n();
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor", { cache: "no-store" });
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-ink">{t("doctor.title")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("doctor.hint")}</p>
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          {t("doctor.analyze")}
        </button>
      </div>

      {report && (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-bold text-ink">{t("doctor.recommendations")}</h4>
            <div className="space-y-1.5">
              {report.recommendations.map((r, i) => {
                const { icon: Icon, cls } = SEVERITY_STYLE[r.severity];
                return (
                  <div key={i} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm", cls)}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{r.message}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-bold text-ink">{t("doctor.currentConfig")}</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm">
                <span className="text-ink-dim">{t("doctor.tmdb")}</span>{" "}
                {report.config.tmdbConfigured ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-ok"><CheckCircle2 className="h-3.5 w-3.5" /> {t("doctor.configured")}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber"><XCircle className="h-3.5 w-3.5" /> {t("doctor.notConfigured")}</span>
                )}
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm">
                <span className="text-ink-dim">{t("doctor.blockedWords")}</span>{" "}
                <span className="font-semibold text-ink">{report.config.blockedWordsCount}</span>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm sm:col-span-2">
                <span className="text-ink-dim">{t("doctor.indexers")}</span>{" "}
                {report.config.indexers.length === 0 ? (
                  <span className="text-ink-dim">—</span>
                ) : (
                  <span className="inline-flex flex-wrap gap-1.5">
                    {report.config.indexers.map((ix) => (
                      <span key={ix.name} className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ix.ok ? "bg-ok/12 text-ok" : "bg-down/12 text-down")}>
                        {ix.name}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm sm:col-span-2">
                <span className="text-ink-dim">{t("doctor.codecScores")}</span>{" "}
                <span className="font-mono font-semibold text-ink">x264 {report.config.codecScores.x264} · x265 {report.config.codecScores.x265} · AV1 {report.config.codecScores.av1}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-bold text-ink">{t("doctor.recentDecisions")}</h4>
            {report.recentDecisions.length === 0 ? (
              <p className="text-sm text-ink-dim">{t("doctor.noDecisions")}</p>
            ) : (
              <div className="space-y-1.5">
                {report.recentDecisions.map((d, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", d.decision === "accepted" ? "bg-ok/12 text-ok" : "bg-down/12 text-down")}>
                        {d.decision === "accepted" ? t("doctor.accepted") : t("doctor.rejected")}
                      </span>
                      <span className="break-words text-sm font-semibold text-ink">{d.refTitle}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-ink-dim">{relativeTime(new Date(d.t).toISOString(), locale)}</span>
                    </div>
                    <p className="mt-1 break-words text-xs text-ink-dim">{d.releaseTitle}</p>
                    <p className="mt-1 text-xs text-ink-soft">{d.reasons.map((r) => r.message).join(" · ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
