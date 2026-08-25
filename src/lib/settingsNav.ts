import {
  LayoutGrid,
  HardDrive,
  Magnet,
  Gauge,
  BookOpen,
  Play,
  Tag,
  ExternalLink,
  Film,
  Wrench,
  BellRing,
  Activity,
  Zap,
  ScrollText,
  ListOrdered,
  Database,
  Info,
  Skull,
  Sparkles,
  Ban,
  Bot,
  Wand2,
  Clapperboard,
  Library,
  Download,
  ServerCog,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for every Settings tab — shared by the Settings
 * page itself (sidebar + mobile sheet) and the global command palette
 * (Cmd/Ctrl+K), so "where do I find X" has exactly one place to search:
 * type it anywhere in the app, not just once already inside Settings.
 *
 * `hintKey` mirrors NAV's shape (src/lib/nav.ts) — a one-line "what's in
 * here" description, used both as the palette's secondary line and (later)
 * anywhere else a quick description is useful.
 */
export type SettingsGroup = "personal" | "download" | "library" | "disk" | "notifications" | "system";
export type SettingsJourney = "experience" | "playback" | "library" | "downloads" | "system";

export interface SettingsTab {
  id: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  group: SettingsGroup;
  journey: SettingsJourney;
  adminOnly?: boolean;
  expertOnly?: boolean;
  dangerous?: boolean;
  /** Intent-based synonyms a user might actually type ("film absent", not
   *  "Indexation") — matched alongside label/hint, never displayed directly. */
  keywords?: string[];
}

export const SETTINGS_TABS: SettingsTab[] = [
  // Personnel
  { id: "dashboard", labelKey: "settings.tabDashboard", hintKey: "settings.tabDashboardHint", icon: LayoutGrid, group: "personal", journey: "experience" },
  { id: "experience", labelKey: "settings.tabExperience", hintKey: "settings.tabExperienceHint", icon: Wand2, group: "personal", journey: "experience", keywords: ["lecteur", "sous-titres", "lenteur lecture", "transcodage"] },
  { id: "gpu", labelKey: "settings.tabGpu", hintKey: "settings.tabGpuHint", icon: Zap, group: "personal", journey: "experience", expertOnly: true, keywords: ["lenteur", "animations", "performance"] },
  { id: "netflix", labelKey: "settings.tabNetflix", hintKey: "settings.tabNetflixHint", icon: Clapperboard, group: "personal", journey: "library" },
  // Téléchargement
  { id: "clients", labelKey: "settings.tabClients", hintKey: "settings.tabClientsHint", icon: HardDrive, group: "download", journey: "downloads", keywords: ["film absent", "nouveau titre", "téléchargement bloqué"] },
  { id: "indexers", labelKey: "settings.tabIndexers", hintKey: "settings.tabIndexersHint", icon: Magnet, group: "download", journey: "downloads", keywords: ["film absent", "nouveau titre", "aucune release"] },
  { id: "qualite", labelKey: "settings.tabQualite", hintKey: "settings.tabQualiteHint", icon: Gauge, group: "download", journey: "downloads", adminOnly: true, keywords: ["renommage", "format de fichier", "mise à niveau"] },
  // Bibliothèque
  { id: "metadata", labelKey: "settings.tabMetadata", hintKey: "settings.tabMetadataHint", icon: BookOpen, group: "library", journey: "library", adminOnly: true },
  { id: "anime", labelKey: "settings.tabAnime", hintKey: "settings.tabAnimeHint", icon: Sparkles, group: "library", journey: "library", adminOnly: true, expertOnly: true },
  { id: "plex", labelKey: "settings.tabPlex", hintKey: "settings.tabPlexHint", icon: Play, group: "library", journey: "library", adminOnly: true, keywords: ["connexion", "serveur", "bibliothèque Plex", "lecture", "transcodage", "audio"] },
  { id: "naming", labelKey: "settings.tabNaming", hintKey: "settings.tabNamingHint", icon: Tag, group: "library", journey: "library", adminOnly: true, expertOnly: true, keywords: ["renommage", "format de fichier"] },
  { id: "imports", labelKey: "settings.tabImports", hintKey: "settings.tabImportsHint", icon: ExternalLink, group: "library", journey: "library", adminOnly: true },
  { id: "blocklist", labelKey: "settings.tabBlocklist", hintKey: "settings.tabBlocklistHint", icon: Ban, group: "library", journey: "library", adminOnly: true, expertOnly: true },
  // Disque
  { id: "indexation", labelKey: "settings.tabIndexation", hintKey: "settings.tabIndexationHint", icon: Film, group: "disk", journey: "library", adminOnly: true, expertOnly: true },
  { id: "maintenance", labelKey: "settings.tabMaintenance", hintKey: "settings.tabMaintenanceHint", icon: Wrench, group: "disk", journey: "library", adminOnly: true, expertOnly: true },
  // Notifications
  { id: "notifications", labelKey: "settings.tabNotifications", hintKey: "settings.tabNotificationsHint", icon: BellRing, group: "notifications", journey: "system", adminOnly: true },
  // Système — l'ancien onglet "health" à 7 panneaux est scindé en 3 pour rester lisible.
  { id: "diagnostics", labelKey: "settings.tabDiagnostics", hintKey: "settings.tabDiagnosticsHint", icon: Activity, group: "system", journey: "system", adminOnly: true },
  { id: "performance", labelKey: "settings.tabPerformance", hintKey: "settings.tabPerformanceHint", icon: Zap, group: "system", journey: "system", adminOnly: true, expertOnly: true },
  { id: "logs", labelKey: "settings.tabLogs", hintKey: "settings.tabLogsHint", icon: ScrollText, group: "system", journey: "system", adminOnly: true, expertOnly: true },
  { id: "automation", labelKey: "settings.tabAutomation", hintKey: "settings.tabAutomationHint", icon: ListOrdered, group: "system", journey: "system", adminOnly: true },
  { id: "ai", labelKey: "settings.tabAi", hintKey: "settings.tabAiHint", icon: Bot, group: "system", journey: "system", adminOnly: true },
  { id: "cache", labelKey: "settings.tabCache", hintKey: "settings.tabCacheHint", icon: Database, group: "system", journey: "system", adminOnly: true, expertOnly: true, keywords: ["logo", "lenteur images", "vider le cache", "affiches manquantes"] },
  { id: "about", labelKey: "settings.tabAbout", hintKey: "settings.tabAboutHint", icon: Info, group: "system", journey: "system", adminOnly: true },
  { id: "danger", labelKey: "settings.tabDanger", hintKey: "settings.tabDangerHint", icon: Skull, group: "system", journey: "system", adminOnly: true, dangerous: true, expertOnly: true },
];

export interface SettingsJourneyDefinition {
  id: SettingsJourney;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  accent: string;
  tabIds: string[];
}

/** Five user goals replace the 25-entry wall in Essential mode. */
export const SETTINGS_JOURNEYS: SettingsJourneyDefinition[] = [
  { id: "experience", labelKey: "settings.journeyExperience", hintKey: "settings.journeyExperienceHint", icon: Wand2, accent: "from-fuchsia-500/24 via-purple-500/10 to-transparent", tabIds: ["dashboard", "experience", "gpu"] },
  { id: "playback", labelKey: "settings.journeyPlayback", hintKey: "settings.journeyPlaybackHint", icon: Play, accent: "from-cyan-500/24 via-sky-500/10 to-transparent", tabIds: ["plex", "experience", "performance"] },
  { id: "library", labelKey: "settings.journeyLibrary", hintKey: "settings.journeyLibraryHint", icon: Library, accent: "from-amber-500/24 via-orange-500/10 to-transparent", tabIds: ["plex", "metadata", "netflix", "imports", "naming", "anime", "blocklist", "indexation", "maintenance"] },
  { id: "downloads", labelKey: "settings.journeyDownloads", hintKey: "settings.journeyDownloadsHint", icon: Download, accent: "from-emerald-500/24 via-cyan-500/10 to-transparent", tabIds: ["clients", "indexers", "qualite"] },
  { id: "system", labelKey: "settings.journeySystem", hintKey: "settings.journeySystemHint", icon: ServerCog, accent: "from-violet-500/24 via-indigo-500/10 to-transparent", tabIds: ["notifications", "diagnostics", "automation", "ai", "about", "performance", "logs", "cache", "danger"] },
];

export const SETTINGS_JOURNEY_BY_ID = Object.fromEntries(
  SETTINGS_JOURNEYS.map((journey) => [journey.id, journey]),
) as Record<SettingsJourney, SettingsJourneyDefinition>;

export const SETTINGS_GROUP_ORDER: SettingsGroup[] = ["personal", "download", "library", "disk", "notifications", "system"];
export const SETTINGS_GROUP_LABEL_KEY: Record<SettingsGroup, string> = {
  personal: "settings.groupPersonal",
  download: "settings.groupDownload",
  library: "settings.groupLibrary",
  disk: "settings.groupDisk",
  notifications: "settings.groupNotifications",
  system: "settings.groupSystem",
};

/**
 * The one place "does this tab match this search query" is decided —
 * previously duplicated (label+hint only, no keywords) between the Settings
 * page's own sidebar filter and CommandPalette.tsx's settings-matching
 * block. Checks label, hint AND keywords, so intent-based terms ("film
 * absent", "lenteur") surface a tab even when its own name/description
 * never uses that wording.
 */
export function matchesSettingsQuery(tab: SettingsTab, query: string, t: (key: string) => string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (t(tab.labelKey).toLowerCase().includes(q)) return true;
  if (t(tab.hintKey).toLowerCase().includes(q)) return true;
  return (tab.keywords ?? []).some((k) => k.toLowerCase().includes(q));
}

/** Tasteful per-group accent so the sidebar reads as organized sections at a glance, not one long undifferentiated list. */
export const SETTINGS_GROUP_ACCENT: Record<SettingsGroup, string> = {
  personal: "text-brand-glow",
  download: "text-cyan",
  library: "text-amber",
  disk: "text-purple-400",
  notifications: "text-ok",
  system: "text-ink-dim",
};
