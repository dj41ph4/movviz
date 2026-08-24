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

export interface SettingsTab {
  id: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  group: SettingsGroup;
  adminOnly?: boolean;
  dangerous?: boolean;
  /** Intent-based synonyms a user might actually type ("film absent", not
   *  "Indexation") — matched alongside label/hint, never displayed directly. */
  keywords?: string[];
}

export const SETTINGS_TABS: SettingsTab[] = [
  // Personnel
  { id: "dashboard", labelKey: "settings.tabDashboard", hintKey: "settings.tabDashboardHint", icon: LayoutGrid, group: "personal" },
  { id: "experience", labelKey: "settings.tabExperience", hintKey: "settings.tabExperienceHint", icon: Wand2, group: "personal", keywords: ["lecteur", "sous-titres", "lenteur lecture", "transcodage"] },
  { id: "gpu", labelKey: "settings.tabGpu", hintKey: "settings.tabGpuHint", icon: Zap, group: "personal", keywords: ["lenteur", "animations", "performance"] },
  { id: "netflix", labelKey: "settings.tabNetflix", hintKey: "settings.tabNetflixHint", icon: Clapperboard, group: "personal" },
  // Téléchargement
  { id: "clients", labelKey: "settings.tabClients", hintKey: "settings.tabClientsHint", icon: HardDrive, group: "download", keywords: ["film absent", "nouveau titre", "téléchargement bloqué"] },
  { id: "indexers", labelKey: "settings.tabIndexers", hintKey: "settings.tabIndexersHint", icon: Magnet, group: "download", keywords: ["film absent", "nouveau titre", "aucune release"] },
  { id: "qualite", labelKey: "settings.tabQualite", hintKey: "settings.tabQualiteHint", icon: Gauge, group: "download", adminOnly: true, keywords: ["renommage", "format de fichier", "mise à niveau"] },
  // Bibliothèque
  { id: "metadata", labelKey: "metadata.title", hintKey: "settings.tabMetadataHint", icon: BookOpen, group: "library", adminOnly: true },
  { id: "anime", labelKey: "anime.title", hintKey: "settings.tabAnimeHint", icon: Sparkles, group: "library", adminOnly: true },
  { id: "plex", labelKey: "plex.title", hintKey: "settings.tabPlexHint", icon: Play, group: "library", adminOnly: true, keywords: ["connexion", "serveur", "bibliothèque Plex"] },
  { id: "naming", labelKey: "naming.tab", hintKey: "settings.tabNamingHint", icon: Tag, group: "library", adminOnly: true, keywords: ["renommage", "format de fichier"] },
  { id: "imports", labelKey: "settings.tabImports", hintKey: "settings.tabImportsHint", icon: ExternalLink, group: "library", adminOnly: true },
  { id: "blocklist", labelKey: "blocklist.title", hintKey: "settings.tabBlocklistHint", icon: Ban, group: "library", adminOnly: true },
  // Disque
  { id: "indexation", labelKey: "settings.tabIndexation", hintKey: "settings.tabIndexationHint", icon: Film, group: "disk", adminOnly: true },
  { id: "maintenance", labelKey: "settings.tabMaintenance", hintKey: "settings.tabMaintenanceHint", icon: Wrench, group: "disk", adminOnly: true },
  // Notifications
  { id: "notifications", labelKey: "settings.tabNotifications", hintKey: "settings.tabNotificationsHint", icon: BellRing, group: "notifications", adminOnly: true },
  // Système — l'ancien onglet "health" à 7 panneaux est scindé en 3 pour rester lisible.
  { id: "diagnostics", labelKey: "settings.tabDiagnostics", hintKey: "settings.tabDiagnosticsHint", icon: Activity, group: "system", adminOnly: true },
  { id: "performance", labelKey: "settings.tabPerformance", hintKey: "settings.tabPerformanceHint", icon: Zap, group: "system", adminOnly: true },
  { id: "logs", labelKey: "settings.tabLogs", hintKey: "settings.tabLogsHint", icon: ScrollText, group: "system", adminOnly: true },
  { id: "automation", labelKey: "settings.tabAutomation", hintKey: "settings.tabAutomationHint", icon: ListOrdered, group: "system", adminOnly: true },
  { id: "ai", labelKey: "settings.tabAi", hintKey: "settings.tabAiHint", icon: Bot, group: "system", adminOnly: true },
  { id: "cache", labelKey: "cache.title", hintKey: "settings.tabCacheHint", icon: Database, group: "system", adminOnly: true, keywords: ["logo", "lenteur images", "vider le cache", "affiches manquantes"] },
  { id: "about", labelKey: "settings.tabAbout", hintKey: "settings.tabAboutHint", icon: Info, group: "system", adminOnly: true },
  { id: "danger", labelKey: "dangerZone.title", hintKey: "settings.tabDangerHint", icon: Skull, group: "system", adminOnly: true, dangerous: true },
];

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
