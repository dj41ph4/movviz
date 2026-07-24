"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { IndexerManager } from "@/components/settings/IndexerManager";
import { DownloadClients } from "@/components/settings/DownloadClients";
import { NamingEditor } from "@/components/settings/NamingEditor";
import { WebhookSettings } from "@/components/settings/WebhookSettings";
import { HealthPanel } from "@/components/settings/HealthPanel";
import { EngineLogsPanel } from "@/components/settings/EngineLogsPanel";
import { ResolverLogsPanel } from "@/components/settings/ResolverLogsPanel";
import { PerfPanel } from "@/components/settings/PerfPanel";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { TasksPanel } from "@/components/settings/TasksPanel";
import { CachePanel } from "@/components/settings/CachePanel";
import { StatsPanel } from "@/components/settings/StatsPanel";
import { PlexSettings } from "@/components/settings/PlexSettings";
import { MetadataSettings } from "@/components/settings/MetadataSettings";
import { BlocklistPanel } from "@/components/settings/BlocklistPanel";
import { CustomFormatsPanel } from "@/components/settings/CustomFormatsPanel";
import { ReleaseRulesPanel } from "@/components/settings/ReleaseRulesPanel";
import { DangerZonePanel } from "@/components/settings/DangerZonePanel";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ImportListsSettings } from "@/components/settings/ImportListsSettings";
import { SeerrSettings } from "@/components/settings/SeerrSettings";
import { IndexationPanel } from "@/components/settings/IndexationPanel";
import { TrashPanel } from "@/components/settings/TrashPanel";
import { RenamePanel } from "@/components/settings/RenamePanel";
import { RepairPathsPanel } from "@/components/settings/RepairPathsPanel";
import { CleanDirsPanel } from "@/components/settings/CleanDirsPanel";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Magnet, HardDrive, Gauge, Tag, Activity, DatabaseBackup, ListTodo, ListOrdered, Database, Play, BookOpen, ChevronDown, X, Info, ExternalLink, Film, RefreshCw, Wrench, BellRing, Skull } from "lucide-react";
import { ActivitySettings } from "@/components/settings/ActivitySettings";
import { AboutPanel } from "@/components/settings/AboutPanel";
import { JobQueuePanel } from "@/components/settings/JobQueuePanel";
import { SearchLogsPanel } from "@/components/settings/SearchLogsPanel";

const TABS = [
  // Téléchargement
  { id: "clients", labelKey: "settings.tabClients", icon: HardDrive, group: "download" },
  { id: "indexers", labelKey: "settings.tabIndexers", icon: Magnet, group: "download" },
  { id: "qualite", labelKey: "settings.tabQualite", icon: Gauge, group: "download", adminOnly: true },
  // Bibliothèque
  { id: "metadata", labelKey: "metadata.title", icon: BookOpen, group: "library", adminOnly: true },
  { id: "plex", labelKey: "plex.title", icon: Play, group: "library", adminOnly: true },
  { id: "naming", labelKey: "naming.tab", icon: Tag, group: "library", adminOnly: true },
  { id: "imports", labelKey: "settings.tabImports", icon: ExternalLink, group: "library", adminOnly: true },
  // Disque
  { id: "indexation", labelKey: "settings.tabIndexation", icon: Film, group: "disk", adminOnly: true, dangerous: true },
  { id: "rename", labelKey: "rename.tab", icon: RefreshCw, group: "disk", adminOnly: true, dangerous: true },
  { id: "maintenance", labelKey: "settings.tabMaintenance", icon: Wrench, group: "disk", adminOnly: true, dangerous: true },
  // Notifications
  { id: "notifications", labelKey: "settings.tabNotifications", icon: BellRing, group: "notifications", adminOnly: true },
  // Système
  { id: "health", labelKey: "health.title", icon: Activity, group: "system", adminOnly: true },
  { id: "tasks", labelKey: "tasks.title", icon: ListTodo, group: "system", adminOnly: true },
  { id: "jobs", labelKey: "jobs.title", icon: ListOrdered, group: "system", adminOnly: true },
  { id: "cache", labelKey: "cache.title", icon: Database, group: "system", adminOnly: true },
  { id: "backup", labelKey: "backup.title", icon: DatabaseBackup, group: "system", adminOnly: true },
  { id: "about", labelKey: "settings.tabAbout", icon: Info, group: "system", adminOnly: true },
  { id: "danger", labelKey: "dangerZone.title", icon: Skull, group: "system", adminOnly: true, dangerous: true },
] as const;

const GROUP_ORDER = ["download", "library", "disk", "notifications", "system"] as const;
const GROUP_LABEL_KEY: Record<(typeof GROUP_ORDER)[number], string | null> = {
  download: "settings.groupDownload",
  library: "settings.groupLibrary",
  disk: "settings.groupDisk",
  notifications: "settings.groupNotifications",
  system: "settings.groupSystem",
};

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
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const activeTab = visibleTabs.find((tb) => tb.id === tab) ?? visibleTabs[0];

  const pushTab = (id: (typeof TABS)[number]["id"]) => {
    setTab(id);
    const p = new URLSearchParams(params.toString());
    if (id === "clients") p.delete("tab");
    else p.set("tab", id);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };



  const groups = GROUP_ORDER.map((g) => ({
    id: g,
    labelKey: GROUP_LABEL_KEY[g],
    items: visibleTabs.filter((tb) => tb.group === g),
  })).filter((g) => g.items.length > 0);

  const renderGroups = (onPick: (id: (typeof TABS)[number]["id"]) => void, layoutId: string) => (
    <>
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
                    <Icon className="h-4 w-4 shrink-0" />
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
            className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm md:hidden"
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
              <div className="flex flex-col gap-6 pb-2">
                {renderGroups((id) => { pushTab(id); setMobileNavOpen(false); }, "settings-tab-active-mobile")}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:grid md:grid-cols-[224px_1fr] md:items-start md:gap-8">
        <nav className="hidden flex-col gap-6 md:sticky md:top-24 md:flex">
          {renderGroups(pushTab, "settings-tab-active")}
        </nav>

        <div className="min-w-0">
          {tab === "clients" && <DownloadClients />}

          {tab === "indexers" && <IndexerManager />}

          {tab === "qualite" && user?.role === "admin" && (
            <div className="space-y-6">
              <ReleaseRulesPanel />
              <CustomFormatsPanel />
            </div>
          )}

          {tab === "metadata" && user?.role === "admin" && <MetadataSettings />}

          {tab === "plex" && user?.role === "admin" && <PlexSettings />}

          {tab === "naming" && user?.role === "admin" && <NamingEditor />}

          {tab === "imports" && user?.role === "admin" && (
            <div className="space-y-6">
              <ImportListsSettings />
              <SeerrSettings />
              <BlocklistPanel />
            </div>
          )}

          {tab === "indexation" && user?.role === "admin" && (
            <div className="space-y-6">
              <IndexationPanel type="movie" />
              <IndexationPanel type="series" />
            </div>
          )}

          {tab === "rename" && user?.role === "admin" && <RenamePanel />}

          {tab === "maintenance" && user?.role === "admin" && (
            <div className="space-y-6">
              <RepairPathsPanel />
              <CleanDirsPanel />
              <TrashPanel />
            </div>
          )}

          {tab === "notifications" && user?.role === "admin" && (
            <div className="space-y-6">
              <NotificationSettings />
              <WebhookSettings />
              <ActivitySettings />
            </div>
          )}

          {tab === "health" && user?.role === "admin" && (
            <div className="space-y-6">
              <HealthPanel />
              <StatsPanel />
              <PerfPanel />
              <SearchLogsPanel />
              <EngineLogsPanel />
              <ResolverLogsPanel />
            </div>
          )}

          {tab === "tasks" && user?.role === "admin" && <TasksPanel />}

          {tab === "jobs" && user?.role === "admin" && <JobQueuePanel />}

          {tab === "cache" && user?.role === "admin" && <CachePanel />}

          {tab === "backup" && user?.role === "admin" && <BackupSettings />}

          {tab === "about" && user?.role === "admin" && <AboutPanel />}

          {tab === "danger" && user?.role === "admin" && <DangerZonePanel />}
        </div>
      </div>
    </div>
  );
}