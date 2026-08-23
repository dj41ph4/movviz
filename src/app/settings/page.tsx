"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { IndexerManager } from "@/components/settings/IndexerManager";
import { DownloadClients } from "@/components/settings/DownloadClients";
import { NamingSettings } from "@/components/settings/NamingSettings";
import { HealthPanel } from "@/components/settings/HealthPanel";
import { DoctorPanel } from "@/components/settings/DoctorPanel";
import { TranscodeLogsPanel } from "@/components/settings/TranscodeLogsPanel";
import { EngineLogsPanel } from "@/components/settings/EngineLogsPanel";
import { ResolverLogsPanel } from "@/components/settings/ResolverLogsPanel";
import { PerfPanel } from "@/components/settings/PerfPanel";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { AutomationSettings } from "@/components/settings/AutomationSettings";
import { CachePanel } from "@/components/settings/CachePanel";
import { StatsPanel } from "@/components/settings/StatsPanel";
import { PlexSettings } from "@/components/settings/PlexSettings";
import { MetadataSettings } from "@/components/settings/MetadataSettings";
import { AnimeSettings } from "@/components/settings/AnimeSettings";
import { BlocklistPanel } from "@/components/settings/BlocklistPanel";
import { CustomFormatsPanel } from "@/components/settings/CustomFormatsPanel";
import { ReleaseRulesPanel } from "@/components/settings/ReleaseRulesPanel";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ImportListsSettings } from "@/components/settings/ImportListsSettings";
import { SeerrSettings } from "@/components/settings/SeerrSettings";
import { IndexationPanel } from "@/components/settings/IndexationPanel";
import { TrashPanel } from "@/components/settings/TrashPanel";
import { RepairPathsPanel } from "@/components/settings/RepairPathsPanel";
import { CleanDirsPanel } from "@/components/settings/CleanDirsPanel";
import { RecoverDownloadsPanel } from "@/components/settings/RecoverDownloadsPanel";
import { MediaProbePanel } from "@/components/settings/MediaProbePanel";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { ChevronDown, X, Search } from "lucide-react";
import { AboutPanel } from "@/components/settings/AboutPanel";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { SearchLogsPanel } from "@/components/settings/SearchLogsPanel";
import { DashboardExperiencePanel } from "@/components/settings/DashboardExperiencePanel";
import { ExperiencePanel } from "@/components/settings/ExperiencePanel";
import { GpuSettingsPanel } from "@/components/settings/GpuSettingsPanel";
import { NetflixImportPanel } from "@/components/settings/NetflixImportPanel";
import { SETTINGS_TABS, SETTINGS_GROUP_ORDER, SETTINGS_GROUP_LABEL_KEY, SETTINGS_GROUP_ACCENT } from "@/lib/settingsNav";

const TABS = SETTINGS_TABS;
const GROUP_ORDER = SETTINGS_GROUP_ORDER;
const GROUP_LABEL_KEY = SETTINGS_GROUP_LABEL_KEY;

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const t = useT();
  const user = useCurrentUser();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialTab = TABS.find((tb) => tb.id === params.get("tab"))?.id ?? "clients";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const activeTab = visibleTabs.find((tb) => tb.id === tab) ?? visibleTabs[0];

  const pushTab = (id: (typeof TABS)[number]["id"]) => {
    setTab(id);
    const p = new URLSearchParams(params.toString());
    if (id === "clients") p.delete("tab");
    else p.set("tab", id);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  // "où est l'option X" — filtre par nom ET par description (hintKey), pas
  // juste le libellé du bouton, pour retrouver un réglage même sans en
  // connaître le nom exact de l'onglet qui le contient.
  const q = filterQuery.trim().toLowerCase();
  const matchingTabs = q
    ? visibleTabs.filter((tb) => t(tb.labelKey).toLowerCase().includes(q) || t(tb.hintKey).toLowerCase().includes(q))
    : visibleTabs;

  const groups = GROUP_ORDER.map((g) => ({
    id: g,
    labelKey: GROUP_LABEL_KEY[g],
    items: matchingTabs.filter((tb) => tb.group === g),
  })).filter((g) => g.items.length > 0);

  const renderGroups = (onPick: (id: (typeof TABS)[number]["id"]) => void, layoutId: string) => (
    <>
      {groups.length === 0 && (
        <p className="px-3 text-sm text-ink-dim">{t("settings.searchNoResults", { query: filterQuery })}</p>
      )}
      {groups.map((g) => (
        <div key={g.id}>
          {g.labelKey && (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim">
              {t(g.labelKey)}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {g.items.map((tb, idx) => {
              const Icon = tb.icon;
              const active = tab === tb.id;
              const dangerous = "dangerous" in tb && tb.dangerous === true;
              return (
                <div key={tb.id}>
                  {dangerous && idx > 0 && <div className="mb-1.5 border-t border-white/8 pt-3" />}
                  <button
                    onClick={() => onPick(tb.id)}
                    title={t(tb.hintKey)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ring-focus",
                      active
                        ? dangerous ? "text-down" : "text-brand-glow"
                        : dangerous ? "text-down/70 hover:text-down" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={layoutId}
                        className={cn(
                          "absolute inset-0 -z-10 rounded-xl",
                          dangerous ? "border border-down/30 bg-down/12" : "border border-brand/30 bg-brand/12"
                        )}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", !active && !dangerous && SETTINGS_GROUP_ACCENT[g.id])} />
                    <span className="truncate">{t(tb.labelKey)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      {/* Mobile: compact "current section" trigger instead of the full list, so content isn't pushed below a long scroll. */}
      <button
        onClick={() => setMobileNavOpen(true)}
        className="mb-5 flex w-full items-center gap-2.5 rounded-xl glass px-4 py-3 text-sm font-semibold text-ink md:hidden"
      >
        {activeTab && <activeTab.icon className="h-4 w-4 shrink-0 text-brand-glow" />}
        <span className="flex-1 truncate text-left">{activeTab ? t(activeTab.labelKey) : ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-dim" />
      </button>

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl glass-strong px-4 pb-2 pt-3 shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-bold text-ink">{t("settings.title")}</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim ring-focus hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
                <input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={t("settings.searchPlaceholder")}
                  className="w-full rounded-xl glass-strong py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
              <div className="flex flex-col gap-6 pb-2">
                {renderGroups((id) => { pushTab(id); setMobileNavOpen(false); }, "settings-tab-active-mobile")}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:grid md:grid-cols-[224px_1fr] md:items-start md:gap-8">
        <nav className="hidden flex-col gap-4 md:sticky md:top-24 md:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t("settings.searchPlaceholder")}
              className="w-full rounded-xl glass py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-dim ring-focus"
            />
          </div>
          <div className="flex flex-col gap-6">
            {renderGroups(pushTab, "settings-tab-active")}
          </div>
        </nav>

        <div className="min-w-0">
          {tab === "dashboard" && <DashboardExperiencePanel />}
          {tab === "experience" && <ExperiencePanel />}
          {tab === "gpu" && <GpuSettingsPanel />}
          {tab === "netflix" && <NetflixImportPanel />}

          {tab === "clients" && <DownloadClients />}

          {tab === "indexers" && <IndexerManager />}

          {tab === "qualite" && user?.role === "admin" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-ink">{t("settings.searchPreferencesTitle")}</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.searchPreferencesHint")}</p>
              </div>
              <ReleaseRulesPanel />
              <CustomFormatsPanel />
            </div>
          )}

          {tab === "metadata" && user?.role === "admin" && <MetadataSettings />}

          {tab === "anime" && user?.role === "admin" && <AnimeSettings />}

          {tab === "plex" && user?.role === "admin" && <PlexSettings />}

          {tab === "naming" && user?.role === "admin" && <NamingSettings />}

          {tab === "imports" && user?.role === "admin" && (
            <div className="space-y-6">
              <ImportListsSettings />
              <SeerrSettings />
            </div>
          )}

          {tab === "blocklist" && user?.role === "admin" && <BlocklistPanel />}

          {tab === "indexation" && user?.role === "admin" && (
            <div className="space-y-6">
              <IndexationPanel type="movie" />
              <IndexationPanel type="series" />
            </div>
          )}

          {tab === "maintenance" && user?.role === "admin" && (
            <div className="space-y-6">
              <RecoverDownloadsPanel />
              <RepairPathsPanel />
              <CleanDirsPanel />
              <MediaProbePanel />
              <TrashPanel />
            </div>
          )}

          {tab === "notifications" && user?.role === "admin" && <NotificationSettings />}

          {tab === "diagnostics" && user?.role === "admin" && (
            <div className="space-y-6">
              <DoctorPanel />
              <HealthPanel />
            </div>
          )}

          {tab === "performance" && user?.role === "admin" && (
            <div className="space-y-6">
              <PerfPanel />
              <StatsPanel />
            </div>
          )}

          {tab === "logs" && user?.role === "admin" && (
            <div className="space-y-6">
              <SearchLogsPanel />
              <EngineLogsPanel />
              <ResolverLogsPanel />
              <TranscodeLogsPanel />
            </div>
          )}

          {tab === "automation" && user?.role === "admin" && <AutomationSettings />}

          {tab === "cache" && user?.role === "admin" && <CachePanel />}

          {tab === "about" && user?.role === "admin" && (
            <div className="space-y-6">
              <AboutPanel />
              <BackupSettings />
            </div>
          )}

          {tab === "danger" && user?.role === "admin" && <DangerZonePanel />}

          {tab === "ai" && user?.role === "admin" && <AiSettingsPanel />}
        </div>
      </div>
    </div>
  );
}