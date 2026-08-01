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
  RefreshCw,
  Wrench,
  BellRing,
  Activity,
  Zap,
  ScrollText,
  ListTodo,
  ListOrdered,
  Database,
  DatabaseBackup,
  Info,
  Skull,
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
}

export const SETTINGS_TABS: SettingsTab[] = [
  // Personnel
  { id: "dashboard", labelKey: "settings.tabDashboard", hintKey: "settings.tabDashboardHint", icon: LayoutGrid, group: "personal" },
  { id: "gpu", labelKey: "settings.tabGpu", hintKey: "settings.tabGpuHint", icon: Zap, group: "personal" },
  // Téléchargement
  { id: "clients", labelKey: "settings.tabClients", hintKey: "settings.tabClientsHint", icon: HardDrive, group: "download" },
  { id: "indexers", labelKey: "settings.tabIndexers", hintKey: "settings.tabIndexersHint", icon: Magnet, group: "download" },
  { id: "qualite", labelKey: "settings.tabQualite", hintKey: "settings.tabQualiteHint", icon: Gauge, group: "download", adminOnly: true },
  // Bibliothèque
  { id: "metadata", labelKey: "metadata.title", hintKey: "settings.tabMetadataHint", icon: BookOpen, group: "library", adminOnly: true },
  { id: "plex", labelKey: "plex.title", hintKey: "settings.tabPlexHint", icon: Play, group: "library", adminOnly: true },
  { id: "naming", labelKey: "naming.tab", hintKey: "settings.tabNamingHint", icon: Tag, group: "library", adminOnly: true },
  { id: "imports", labelKey: "settings.tabImports", hintKey: "settings.tabImportsHint", icon: ExternalLink, group: "library", adminOnly: true },
  // Disque
  { id: "indexation", labelKey: "settings.tabIndexation", hintKey: "settings.tabIndexationHint", icon: Film, group: "disk", adminOnly: true },
  { id: "rename", labelKey: "rename.tab", hintKey: "settings.tabRenameHint", icon: RefreshCw, group: "disk", adminOnly: true },
  { id: "maintenance", labelKey: "settings.tabMaintenance", hintKey: "settings.tabMaintenanceHint", icon: Wrench, group: "disk", adminOnly: true },
  // Notifications
  { id: "notifications", labelKey: "settings.tabNotifications", hintKey: "settings.tabNotificationsHint", icon: BellRing, group: "notifications", adminOnly: true },
  // Système — l'ancien onglet "health" à 7 panneaux est scindé en 3 pour rester lisible.
  { id: "diagnostics", labelKey: "settings.tabDiagnostics", hintKey: "settings.tabDiagnosticsHint", icon: Activity, group: "system", adminOnly: true },
  { id: "performance", labelKey: "settings.tabPerformance", hintKey: "settings.tabPerformanceHint", icon: Zap, group: "system", adminOnly: true },
  { id: "logs", labelKey: "settings.tabLogs", hintKey: "settings.tabLogsHint", icon: ScrollText, group: "system", adminOnly: true },
  { id: "tasks", labelKey: "tasks.title", hintKey: "settings.tabTasksHint", icon: ListTodo, group: "system", adminOnly: true },
  { id: "jobs", labelKey: "jobs.title", hintKey: "settings.tabJobsHint", icon: ListOrdered, group: "system", adminOnly: true },
  { id: "cache", labelKey: "cache.title", hintKey: "settings.tabCacheHint", icon: Database, group: "system", adminOnly: true },
  { id: "backup", labelKey: "backup.title", hintKey: "settings.tabBackupHint", icon: DatabaseBackup, group: "system", adminOnly: true },
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

/** Tasteful per-group accent so the sidebar reads as organized sections at a glance, not one long undifferentiated list. */
export const SETTINGS_GROUP_ACCENT: Record<SettingsGroup, string> = {
  personal: "text-brand-glow",
  download: "text-cyan",
  library: "text-amber",
  disk: "text-purple-400",
  notifications: "text-ok",
  system: "text-ink-dim",
};
