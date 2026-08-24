"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Search, Play, HardDrive, BookOpen, Zap, Check, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { SETTINGS_TABS, SETTINGS_GROUP_ORDER, SETTINGS_GROUP_LABEL_KEY, matchesSettingsQuery, type SettingsTab } from "@/lib/settingsNav";

type Tone = "ok" | "amber" | "down";
const TONE_CLASS: Record<Tone, string> = {
  ok: "border-ok/25 bg-ok/12 text-ok",
  amber: "border-amber/25 bg-amber/12 text-amber",
  down: "border-down/25 bg-down/12 text-down",
};

function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", TONE_CLASS[tone])}>
      {tone === "ok" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {children}
    </span>
  );
}

function StatusCard({
  icon: Icon, title, tone, label, onClick,
}: { icon: React.ElementType; title: string; tone: Tone | null; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl glass p-5 text-left transition-colors hover:bg-white/8">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold text-ink">{title}</h3>
        <div className="mt-1.5">{tone ? <StatusPill tone={tone}>{label}</StatusPill> : <span className="text-xs text-ink-dim">{label}</span>}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim" />
    </button>
  );
}

/** Plex connection status — same source/shape as PlexSettings.tsx (GET /api/plex/config, admin-only). */
function usePlexStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/plex/config").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setConnected(!!d.connected); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return connected;
}

/** Download engine reachability — same source/shape as DownloadClients.tsx (GET /api/engine/instances, admin-only). */
function useEngineStatus() {
  const [offline, setOffline] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/engine/instances").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setOffline(!!d.offline); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return offline;
}

/** TMDb key status — same source/shape as MetadataSettings.tsx (GET /api/metadata/key). */
function useTmdbStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/metadata/key").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setConfigured(!!d.configured); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return configured;
}

interface Stats { disk: { total: number; free: number } | null }

export function SettingsHome({ onNavigate }: { onNavigate: (id: string) => void }) {
  const t = useT();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const plexConnected = usePlexStatus();
  const engineOffline = useEngineStatus();
  const tmdbConfigured = useTmdbStatus();
  // Same SWR key as StatsPanel.tsx — shares its cache, no duplicate request
  // if that panel has already loaded this session.
  const { data: stats } = useSWR<Stats>(isAdmin ? "/api/stats" : null);

  const visibleTabs = SETTINGS_TABS.filter((tb) => !tb.adminOnly || isAdmin);
  const results = q ? visibleTabs.filter((tb) => matchesSettingsQuery(tb, q, t)) : [];
  const groupedResults = SETTINGS_GROUP_ORDER.map((g) => ({
    id: g,
    labelKey: SETTINGS_GROUP_LABEL_KEY[g],
    items: results.filter((tb) => tb.group === g),
  })).filter((g) => g.items.length > 0);

  const shortcutIds = ["plex", "clients", "qualite", "experience"];
  const shortcuts = shortcutIds.map((id) => visibleTabs.find((tb) => tb.id === id)).filter((tb): tb is SettingsTab => !!tb);

  const diskTone: Tone | null = stats?.disk ? (stats.disk.free / stats.disk.total < 0.1 ? "down" : stats.disk.free / stats.disk.total < 0.2 ? "amber" : "ok") : null;
  const diskPercent = stats?.disk ? Math.round((stats.disk.free / stats.disk.total) * 100) : null;

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
                      <span className="flex-1 truncate">{t(tb.labelKey)}</span>
                      <span className="truncate text-xs font-normal text-ink-dim">{t(tb.hintKey)}</span>
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
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim">{t("settings.homeStatusTitle")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatusCard
                  icon={Play}
                  title={t("plex.title")}
                  tone={plexConnected === null ? null : plexConnected ? "ok" : "amber"}
                  label={plexConnected === null ? t("settings.homeChecking") : plexConnected ? t("plex.connected") : t("plex.notLinked")}
                  onClick={() => onNavigate("plex")}
                />
                <StatusCard
                  icon={HardDrive}
                  title={t("settings.tabClients")}
                  tone={engineOffline === null ? null : engineOffline ? "down" : "ok"}
                  label={engineOffline === null ? t("settings.homeChecking") : engineOffline ? t("downloads.engineOffline") : t("common.active")}
                  onClick={() => onNavigate("clients")}
                />
                <StatusCard
                  icon={BookOpen}
                  title={t("metadata.title")}
                  tone={tmdbConfigured === null ? null : tmdbConfigured ? "ok" : "amber"}
                  label={tmdbConfigured === null ? t("settings.homeChecking") : tmdbConfigured ? t("metadata.tmdbConfigured") : t("metadata.tmdbNotConfigured")}
                  onClick={() => onNavigate("metadata")}
                />
                <StatusCard
                  icon={Zap}
                  title={t("settings.homeCardStorage")}
                  tone={diskTone}
                  label={diskTone === null ? t("settings.homeChecking") : diskPercent !== null ? t("settings.homeStorageFree", { percent: diskPercent }) : t("settings.homeChecking")}
                  onClick={() => onNavigate("performance")}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim">{t("settings.homeShortcutsTitle")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {shortcuts.map((tb) => {
                const Icon = tb.icon;
                return (
                  <button
                    key={tb.id}
                    onClick={() => onNavigate(tb.id)}
                    className="flex items-center gap-3 rounded-2xl glass p-5 text-left transition-colors hover:bg-white/8"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-ink">{t(tb.labelKey)}</h3>
                      <p className="mt-0.5 truncate text-xs text-ink-dim">{t(tb.hintKey)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
