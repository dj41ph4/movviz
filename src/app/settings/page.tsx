"use client";

import { Suspense, useEffect, useState } from "react";
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
import { PlexUnmappedPanel } from "@/components/settings/PlexUnmappedPanel";
import { PlayerSettings } from "@/components/settings/PlayerSettings";
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
import { CorruptFilesPanel } from "@/components/settings/CorruptFilesPanel";
import { DuplicateFilesPanel } from "@/components/settings/DuplicateFilesPanel";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { ChevronDown, X, Search, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { AboutPanel } from "@/components/settings/AboutPanel";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { SearchLogsPanel } from "@/components/settings/SearchLogsPanel";
import "@/components/settings/settings-premium.css";
import { SETTINGS_TABS, SETTINGS_JOURNEYS, SETTINGS_JOURNEY_BY_ID, matchesSettingsQuery, settingsContentSnippet, resolveSettingsTarget, PERSONAL_SETTINGS_VIEW, type SettingsJourney } from "@/lib/settingsNav";
import { SettingsSections } from "@/components/settings/SettingsSections";
import { SettingsHome } from "@/components/settings/SettingsHome";
import { SettingsJourneyOverview } from "@/components/settings/SettingsJourneyOverview";
import { SettingsContextHeader } from "@/components/settings/SettingsContextHeader";

const TABS = SETTINGS_TABS;
type SettingsMode = "essential" | "expert";
type SettingsSelection = (typeof TABS)[number]["id"] | "home" | `journey:${SettingsJourney}`;

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
  const requestedJourney = SETTINGS_JOURNEYS.find((journey) => journey.id === params.get("section"))?.id;
  // Les anciens liens (?tab=clients, ?tab=about…) mènent à l'onglet qui contient désormais ce panneau.
  const requestedTarget = resolveSettingsTarget(params.get("tab"));
  const requestedView = params.get("view") ?? requestedTarget?.view ?? null;
  const initialTab: SettingsSelection = (requestedTarget?.tab as SettingsSelection | undefined) ?? (requestedJourney ? `journey:${requestedJourney}` : "home");
  const [tab, setTab] = useState<SettingsSelection>(initialTab);
  const [view, setView] = useState<string | null>(requestedView);
  const [mode, setMode] = useState<SettingsMode>("essential");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const isAdmin = user?.role === "admin";
  const visibleTabs = TABS.filter((tb) => !tb.adminOnly || isAdmin);
  // "home" is deliberately not a SETTINGS_TABS entry (not a searchable
  // "setting", it's the pre-selection landing state) — null here means the
  // sidebar/mobile header show a generic fallback instead of a highlighted tab.
  const activeTab = tab === "home" || tab.startsWith("journey:") ? null : (visibleTabs.find((tb) => tb.id === tab) ?? null);
  const activeJourneyId = tab.startsWith("journey:") ? tab.slice(8) as SettingsJourney : activeTab?.journey;
  // Section affichée d'un onglet à sections : celle demandée si elle existe, sinon la première.
  const sectionView = activeTab?.sections ? (activeTab.sections.find((sec) => sec.id === view)?.id ?? activeTab.sections[0].id) : "";

  // Réglages personnels (accueil, affichage, import d'historique) : déplacés dans le profil.
  // Un non-administrateur n'a plus rien ici ; un ancien lien ?tab=dashboard suit le même chemin.
  const personalView = PERSONAL_SETTINGS_VIEW[params.get("tab") ?? ""];
  useEffect(() => {
    if (personalView) router.replace(`/profile?tab=preferences&view=${personalView}`);
    else if (user && !isAdmin) router.replace("/profile?tab=preferences");
  }, [personalView, user, isAdmin, router]);

  useEffect(() => {
    const saved = window.localStorage.getItem("movviz-settings-mode");
    if (saved === "expert" || saved === "essential") setMode(saved);
  }, []);

  // Un lien vers ?tab=… alors que la page est déjà ouverte (palette de
  // commandes, retour arrière) doit aussi changer l'onglet affiché.
  const urlTab = params.get("tab");
  const urlView = params.get("view");
  const [seenUrl, setSeenUrl] = useState(`${urlTab}|${urlView}`);
  if (`${urlTab}|${urlView}` !== seenUrl) {
    setSeenUrl(`${urlTab}|${urlView}`);
    const next = resolveSettingsTarget(urlTab);
    if (next) {
      setTab(next.tab as SettingsSelection);
      setView(urlView ?? next.view ?? null);
    }
  }

  const changeMode = (next: SettingsMode) => {
    setMode(next);
    window.localStorage.setItem("movviz-settings-mode", next);
  };

  const pushTab = (id: string) => {
    const target = id === "home" ? null : resolveSettingsTarget(id);
    if (id !== "home" && !target) return;
    setTab((target?.tab ?? "home") as SettingsSelection);
    setView(target?.view ?? null);
    const p = new URLSearchParams(params.toString());
    p.delete("section");
    p.delete("view");
    if (!target) p.delete("tab"); else p.set("tab", target.tab);
    if (target?.view) p.set("view", target.view);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  const pushView = (next: string) => {
    setView(next);
    const p = new URLSearchParams(params.toString());
    p.set("view", next);
    router.push(pathname + "?" + p.toString(), { scroll: false });
  };

  const pushJourney = (id: SettingsJourney) => {
    setTab(`journey:${id}`);
    const p = new URLSearchParams(params.toString());
    p.delete("tab");
    p.delete("view");
    p.set("section", id);
    router.push(pathname + "?" + p.toString(), { scroll: false });
  };

  // "où est l'option X" — filtre par nom, description (hintKey) ET mots-clés
  // d'intention, pas juste le libellé du bouton, pour retrouver un réglage
  // même sans en connaître le nom exact de l'onglet qui le contient.
  const q = filterQuery.trim().toLowerCase();
  const matchingTabs = q ? visibleTabs.filter((tb) => matchesSettingsQuery(tb, q, t)) : visibleTabs.filter((tb) => mode === "expert" || !tb.expertOnly);

  const groups = SETTINGS_JOURNEYS.map((j) => ({
    id: j.id,
    labelKey: j.labelKey,
    tint: j.tint,
    items: matchingTabs.filter((tb) => tb.journey === j.id),
  })).filter((g) => g.items.length > 0);

  const renderModeToggle = () => (
    <div className="grid grid-cols-2 rounded-xl border border-white/8 bg-black/15 p-1">
      {(["essential", "expert"] as SettingsMode[]).map((item) => (
        <button key={item} onClick={() => changeMode(item)} className={cn("rounded-full px-2 py-2 text-xs font-bold ring-focus transition", mode === item ? "bg-white/10 text-ink shadow-sm" : "text-ink-dim hover:text-ink-soft")}>
          {item === "essential" ? t("settings.modeEssential") : t("settings.modeExpert")}
        </button>
      ))}
    </div>
  );

  const renderJourneys = (onPick: (id: SettingsJourney) => void) => (
    <div className="flex flex-col gap-1">
      {SETTINGS_JOURNEYS.map((journey) => {
        const Icon = journey.icon;
        const active = activeJourneyId === journey.id;
        const accessible = journey.tabIds.some((id) => visibleTabs.some((tb) => tb.id === id));
        if (!accessible) return null;
        return (
          <button key={journey.id} onClick={() => onPick(journey.id)} className={cn("group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left ring-focus transition", active ? "border border-brand/25 bg-brand/12 text-ink" : "border border-transparent text-ink-soft hover:bg-white/6 hover:text-ink")}>
            <span className={cn("absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity group-hover:opacity-80", journey.accent, active && "opacity-100")} />
            <Icon className="relative h-4 w-4 shrink-0 text-brand-glow" />
            <span className="relative min-w-0">
              <span className="block break-words text-sm font-bold leading-snug">{t(journey.labelKey)}</span>
              <span className="mt-0.5 block break-words text-[10px] font-normal leading-relaxed text-ink-dim">{t(journey.hintKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderGroups = (onPick: (id: string) => void, layoutId: string) => (
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
            {g.items.map((tb) => {
              const Icon = tb.icon;
              const active = tab === tb.id;
              // Réglage qui a fait trouver l'onglet quand le titre ne suffit pas.
              const snippet = q ? settingsContentSnippet(tb, q, t) : null;
              return (
                <div key={tb.id}>
                  <button
                    onClick={() => onPick(tb.id)}
                    title={t(tb.hintKey)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ring-focus",
                      active ? "text-brand-glow" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={layoutId}
                        className="absolute inset-0 -z-10 rounded-xl border border-brand/30 bg-brand/12"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", !active && g.tint)} />
                    <span className="min-w-0">
                      <span className="block break-words leading-snug">{t(tb.labelKey)}</span>
                      {snippet && <span className="mt-0.5 block break-words text-[11px] font-normal leading-snug text-ink-dim">{snippet}</span>}
                    </span>
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
    <div data-journey={activeJourneyId ?? "experience"} className="nx-settings-page mx-auto max-w-[1280px]">
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
        {activeTab ? <activeTab.icon className="h-4 w-4 shrink-0 text-brand-glow" /> : activeJourneyId ? (() => { const JourneyIcon = SETTINGS_JOURNEY_BY_ID[activeJourneyId].icon; return <JourneyIcon className="h-4 w-4 shrink-0 text-brand-glow" />; })() : <LayoutGrid className="h-4 w-4 shrink-0 text-brand-glow" />}
        <span className="min-w-0 flex-1 break-words text-left leading-snug">{activeTab ? t(activeTab.labelKey) : activeJourneyId ? t(SETTINGS_JOURNEY_BY_ID[activeJourneyId].labelKey) : t("settings.title")}</span>
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
              <button
                onClick={() => { pushTab("home"); setMobileNavOpen(false); }}
                className="mb-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-soft ring-focus hover:text-ink"
              >
                <LayoutGrid className="h-4 w-4 shrink-0" />
                {t("settings.homeLink")}
              </button>
              <div className="mb-3">{renderModeToggle()}</div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
                <input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={t("settings.searchPlaceholder")}
                  className="w-full rounded-xl glass-strong py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
              <div className="pb-2">
                {mode === "essential" && !q
                  ? renderJourneys((id) => { pushJourney(id); setMobileNavOpen(false); })
                  : <div className="flex flex-col gap-6">{renderGroups((id) => { pushTab(id); setMobileNavOpen(false); }, "settings-tab-active-mobile")}</div>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:grid md:grid-cols-[268px_1fr] md:items-start md:gap-8">
        <nav className="nx-settings-nav hidden flex-col gap-4 md:sticky md:top-24 md:flex">
          <button
            onClick={() => pushTab("home")}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold ring-focus",
              tab === "home" ? "text-brand-glow" : "text-ink-soft hover:text-ink"
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            {t("settings.homeLink")}
          </button>
          {renderModeToggle()}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
            <input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t("settings.searchPlaceholder")}
              className="w-full rounded-xl glass py-2.5 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-dim ring-focus"
            />
          </div>
          {mode === "essential" && !q
            ? renderJourneys(pushJourney)
            : <div className="flex flex-col gap-6">{renderGroups(pushTab, "settings-tab-active")}</div>}
          {mode === "essential" && !q && (
            <button onClick={() => changeMode("expert")} className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink-dim ring-focus hover:bg-white/5 hover:text-ink">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t("settings.showAllSettings")}
            </button>
          )}
        </nav>

        <div className="nx-settings-content min-w-0">
          {tab === "home" && <SettingsHome onNavigate={pushTab} onOpenJourney={(id) => pushJourney(id as SettingsJourney)} />}

          {tab.startsWith("journey:") && (
            <SettingsJourneyOverview journeyId={tab.slice(8) as SettingsJourney} isAdmin={isAdmin} onNavigate={pushTab} />
          )}

          {activeTab && <SettingsContextHeader tab={activeTab} onBack={pushJourney} />}

          {tab === "player" && isAdmin && <PlayerSettings />}

          {tab === "library" && isAdmin && activeTab?.sections && (
            <SettingsSections sections={activeTab.sections} view={sectionView} onView={pushView} expert={mode === "expert"}>
              {sectionView === "plex" && (
                <div className="space-y-6">
                  <PlexSettings />
                  <PlexUnmappedPanel />
                </div>
              )}
              {sectionView === "metadata" && <MetadataSettings />}
              {sectionView === "imports" && (
                <div className="space-y-6">
                  <ImportListsSettings />
                  <SeerrSettings />
                </div>
              )}
              {sectionView === "anime" && <AnimeSettings />}
              {sectionView === "naming" && <NamingSettings />}
              {sectionView === "blocklist" && <BlocklistPanel />}
            </SettingsSections>
          )}

          {tab === "files" && isAdmin && activeTab?.sections && (
            <SettingsSections sections={activeTab.sections} view={sectionView} onView={pushView} expert={mode === "expert"}>
              {sectionView === "indexation" && (
                <div className="space-y-6">
                  <IndexationPanel type="movie" />
                  <IndexationPanel type="series" />
                </div>
              )}
              {sectionView === "maintenance" && (
                <div className="space-y-6">
                  <RecoverDownloadsPanel />
                  <RepairPathsPanel />
                  <CleanDirsPanel />
                  <MediaProbePanel />
                  <CorruptFilesPanel />
                  <DuplicateFilesPanel />
                  <TrashPanel />
                </div>
              )}
            </SettingsSections>
          )}

          {tab === "downloads" && isAdmin && activeTab?.sections && (
            <SettingsSections sections={activeTab.sections} view={sectionView} onView={pushView} expert={mode === "expert"}>
              {sectionView === "clients" && <DownloadClients />}
              {sectionView === "indexers" && <IndexerManager />}
              {sectionView === "qualite" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-ink">{t("settings.searchPreferencesTitle")}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.searchPreferencesHint")}</p>
                  </div>
                  <ReleaseRulesPanel />
                  <CustomFormatsPanel />
                </div>
              )}
            </SettingsSections>
          )}

          {tab === "notifications" && isAdmin && <NotificationSettings />}

          {tab === "automation" && isAdmin && <AutomationSettings />}

          {tab === "ai" && isAdmin && <AiSettingsPanel />}

          {tab === "diagnostics" && isAdmin && activeTab?.sections && (
            <SettingsSections sections={activeTab.sections} view={sectionView} onView={pushView} expert={mode === "expert"}>
              {sectionView === "health" && (
                <div className="space-y-6">
                  <DoctorPanel />
                  <HealthPanel />
                </div>
              )}
              {sectionView === "performance" && (
                <div className="space-y-6">
                  <PerfPanel />
                  <StatsPanel />
                </div>
              )}
              {sectionView === "logs" && (
                <div className="space-y-6">
                  <SearchLogsPanel />
                  <EngineLogsPanel />
                  <ResolverLogsPanel />
                  <TranscodeLogsPanel />
                </div>
              )}
            </SettingsSections>
          )}

          {tab === "cache" && isAdmin && <CachePanel />}

          {tab === "system" && isAdmin && activeTab?.sections && (
            <SettingsSections sections={activeTab.sections} view={sectionView} onView={pushView} expert={mode === "expert"}>
              {sectionView === "about" && (
                <div className="space-y-6">
                  <AboutPanel />
                  <BackupSettings />
                </div>
              )}
              {sectionView === "danger" && <DangerZonePanel />}
            </SettingsSections>
          )}
        </div>
      </div>
    </div>
  );
}
