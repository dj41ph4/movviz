"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Search, Play, HardDrive, BookOpen, Zap, ChevronRight, ShieldCheck, AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { SETTINGS_TABS, SETTINGS_GROUP_ORDER, SETTINGS_GROUP_LABEL_KEY, SETTINGS_JOURNEYS, matchesSettingsQuery } from "@/lib/settingsNav";

type Tone = "ok" | "amber" | "down";
function StatusLine({
  icon: Icon, title, tone, label, onClick, index,
}: { icon: React.ElementType; title: string; tone: Tone | null; label: string; onClick: () => void; index: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.18 + index * 0.16 }}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left ring-focus transition hover:border-white/8 hover:bg-white/5"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-ink-soft">
        <Icon className="h-[18px] w-[18px]" />
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.36 + index * 0.16, type: "spring", stiffness: 420 }}
          className={cn("absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#0d1022]", tone === "ok" ? "bg-ok shadow-[0_0_12px_rgba(52,211,153,.8)]" : tone === "amber" ? "bg-amber" : tone === "down" ? "bg-down" : "animate-pulse bg-white/30")}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-bold text-ink">{title}</span>
        <span className="block break-words text-xs text-ink-dim">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-ink-dim transition-transform group-hover:translate-x-1 group-hover:text-ink" />
    </motion.button>
  );
}

/** Plex connection status — same source/shape as PlexSettings.tsx (GET /api/plex/config, admin-only). */
function usePlexStatus(enabled: boolean) {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/plex/config").then((r) => (r.ok ? r.json() : { connected: false })).then((d) => { if (!cancelled) setConnected(!!d.connected); }).catch(() => { if (!cancelled) setConnected(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return connected;
}

/** Download engine reachability — same source/shape as DownloadClients.tsx (GET /api/engine/instances, admin-only). */
function useEngineStatus(enabled: boolean) {
  const [offline, setOffline] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/engine/instances").then((r) => (r.ok ? r.json() : { offline: true })).then((d) => { if (!cancelled) setOffline(!!d.offline); }).catch(() => { if (!cancelled) setOffline(true); });
    return () => { cancelled = true; };
  }, [enabled]);
  return offline;
}

/** TMDb key status — same source/shape as MetadataSettings.tsx (GET /api/metadata/key). */
function useTmdbStatus(enabled: boolean) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/metadata/key").then((r) => (r.ok ? r.json() : { configured: false })).then((d) => { if (!cancelled) setConfigured(!!d.configured); }).catch(() => { if (!cancelled) setConfigured(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return configured;
}

interface Stats { disk: { total: number; free: number } | null }

export function SettingsHome({ onNavigate, onOpenJourney }: { onNavigate: (id: string) => void; onOpenJourney: (id: string) => void }) {
  const t = useT();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const plexConnected = usePlexStatus(isAdmin);
  const engineOffline = useEngineStatus(isAdmin);
  const tmdbConfigured = useTmdbStatus(isAdmin);
  // Same SWR key as StatsPanel.tsx — shares its cache, no duplicate request
  // if that panel has already loaded this session.
  const { data: stats, error: statsError } = useSWR<Stats>(isAdmin ? "/api/stats" : null);

  const visibleTabs = SETTINGS_TABS.filter((tb) => !tb.adminOnly || isAdmin);
  const results = q ? visibleTabs.filter((tb) => matchesSettingsQuery(tb, q, t)) : [];
  const groupedResults = SETTINGS_GROUP_ORDER.map((g) => ({
    id: g,
    labelKey: SETTINGS_GROUP_LABEL_KEY[g],
    items: results.filter((tb) => tb.group === g),
  })).filter((g) => g.items.length > 0);

  const diskTone: Tone | null = stats?.disk ? (stats.disk.free / stats.disk.total < 0.1 ? "down" : stats.disk.free / stats.disk.total < 0.2 ? "amber" : "ok") : stats || statsError ? "down" : null;
  const diskPercent = stats?.disk ? Math.round((stats.disk.free / stats.disk.total) * 100) : null;
  const checks = [
    { icon: Play, title: t("plex.title"), tone: plexConnected === null ? null : plexConnected ? "ok" as const : "amber" as const, label: plexConnected === null ? t("settings.homeChecking") : plexConnected ? t("plex.connected") : t("plex.notLinked"), tab: "plex" },
    { icon: HardDrive, title: t("settings.tabClients"), tone: engineOffline === null ? null : engineOffline ? "down" as const : "ok" as const, label: engineOffline === null ? t("settings.homeChecking") : engineOffline ? t("downloads.engineOffline") : t("common.active"), tab: "clients" },
    { icon: BookOpen, title: t("metadata.title"), tone: tmdbConfigured === null ? null : tmdbConfigured ? "ok" as const : "amber" as const, label: tmdbConfigured === null ? t("settings.homeChecking") : tmdbConfigured ? t("metadata.tmdbConfigured") : t("metadata.tmdbNotConfigured"), tab: "metadata" },
    { icon: Zap, title: t("settings.homeCardStorage"), tone: diskTone, label: diskTone === null ? t("settings.homeChecking") : diskPercent !== null ? t("settings.homeStorageFree", { percent: diskPercent }) : t("settings.homeUnavailable"), tab: "performance" },
  ];
  const loadedChecks = checks.filter((check) => check.tone !== null);
  const readyCount = loadedChecks.filter((check) => check.tone === "ok").length;
  const hasAttention = loadedChecks.some((check) => check.tone === "down" || check.tone === "amber");
  const allLoaded = loadedChecks.length === checks.length;

  return (
    <div className="space-y-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings.homeSearchPlaceholder")}
          className="w-full rounded-xl glass py-3.5 pl-12 pr-4 text-base text-ink outline-none placeholder:text-ink-dim ring-focus"
        />
      </div>

      {q ? (
        <div className="space-y-6">
          {groupedResults.length === 0 && <p className="text-sm text-ink-dim">{t("settings.searchNoResults", { query })}</p>}
          {groupedResults.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim">{t(g.labelKey)}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((tb) => {
                  const Icon = tb.icon;
                  return (
                    <button
                      key={tb.id}
                      onClick={() => onNavigate(tb.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-soft ring-focus hover:bg-white/8 hover:text-ink"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 break-words">{t(tb.labelKey)}</span>
                      <span className="max-w-[55%] break-words text-right text-xs font-normal leading-relaxed text-ink-dim">{t(tb.hintKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {isAdmin && (
            <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#0d1022]/95 shadow-[0_30px_100px_rgba(0,0,0,.32)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(168,85,247,.19),transparent_34%),radial-gradient(circle_at_88%_80%,rgba(34,211,238,.10),transparent_32%)]" />
              <div className="relative grid lg:grid-cols-[1.05fr_.95fr]">
                <div className="flex min-h-72 flex-col justify-between border-b border-white/8 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                  <div>
                    <div className="mb-6 flex items-center gap-3">
                      <motion.span animate={{ boxShadow: allLoaded && !hasAttention ? ["0 0 0 rgba(52,211,153,0)", "0 0 38px rgba(52,211,153,.32)", "0 0 0 rgba(52,211,153,0)"] : undefined }} transition={{ duration: 2.4, repeat: Infinity }} className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border", allLoaded && !hasAttention ? "border-ok/30 bg-ok/12 text-ok" : "border-brand/30 bg-brand/12 text-brand-glow")}>
                        {allLoaded && !hasAttention ? <ShieldCheck className="h-7 w-7" /> : hasAttention ? <AlertTriangle className="h-7 w-7 text-amber" /> : <Sparkles className="h-7 w-7" />}
                      </motion.span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-glow">{t("settings.controlCenter")}</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">{t("settings.readinessTitle")}</h2>
                      </div>
                    </div>
                    <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
                      {!allLoaded ? t("settings.readinessChecking") : hasAttention ? t("settings.readinessNeedsAttention") : t("settings.readinessAllGood")}
                    </p>
                  </div>
                  <div className="mt-8">
                    <div className="mb-2 flex items-end justify-between">
                      <span className="text-xs font-semibold text-ink-dim">{t("settings.readinessReadyCount", { count: readyCount, total: checks.length })}</span>
                      <span className="text-xl font-black text-ink">{allLoaded ? Math.round((readyCount / checks.length) * 100) : "…"}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/7">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(readyCount / checks.length) * 100}%` }} transition={{ duration: .7, ease: "easeOut" }} className={cn("h-full rounded-full", hasAttention ? "bg-gradient-to-r from-amber to-brand" : "bg-gradient-to-r from-ok to-cyan shadow-[0_0_14px_rgba(52,211,153,.55)]")} />
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-dim">{t("settings.liveChecks")}</p>
                  {checks.map((check, index) => <StatusLine key={check.tab} {...check} index={index} onClick={() => onNavigate(check.tab)} />)}
                </div>
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-glow">{t("settings.guidedPaths")}</p>
                <h2 className="mt-1 text-xl font-black text-ink">{t("settings.chooseYourGoal")}</h2>
              </div>
              <span className="hidden text-xs text-ink-dim sm:block">{t("settings.chooseYourGoalHint")}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SETTINGS_JOURNEYS.map((journey, index) => {
                const Icon = journey.icon;
                const accessible = journey.tabIds.some((id) => visibleTabs.some((tab) => tab.id === id));
                if (!accessible) return null;
                return (
                  <motion.button key={journey.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .055 }} onClick={() => onOpenJourney(journey.id)} className="group relative min-h-44 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-5 text-left ring-focus transition duration-300 hover:-translate-y-1 hover:border-brand/35 hover:bg-white/[0.065] hover:shadow-[0_22px_55px_rgba(0,0,0,.24)]">
                    <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-65 transition-opacity group-hover:opacity-100", journey.accent)} />
                    <div className="relative flex h-full flex-col">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-brand-glow"><Icon className="h-5 w-5" /></span>
                      <h3 className="mt-4 text-base font-extrabold text-ink">{t(journey.labelKey)}</h3>
                      <p className="mt-1 break-words text-xs leading-relaxed text-ink-dim">{t(journey.hintKey)}</p>
                      <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-bold text-brand-glow">{t("settings.explore")} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
