import {
  HardDrive,
  BookOpen,
  Play,
  Wrench,
  BellRing,
  Activity,
  ListOrdered,
  Database,
  Info,
  Bot,
  Library,
  Download,
  ServerCog,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import { SETTINGS_SEARCH_KEYS } from "@/lib/settingsSearchIndex.generated";

/**
 * Single source of truth for every Settings tab — shared by the Settings
 * page itself (sidebar + mobile sheet), its home overview and its context
 * header. There is deliberately no global command palette (no Ctrl/Cmd+K).
 *
 * Une seule organisation : cinq parcours (SETTINGS_JOURNEYS) contiennent les onglets.
 * Un onglet peut regrouper plusieurs sections (boutons en haut du contenu) ; les
 * anciens identifiants d'onglet restent des liens valables (voir resolveSettingsTarget).
 *
 * `hintKey` mirrors NAV's shape (src/lib/nav.ts) — a one-line "what's in
 * here" description, used wherever a quick description is useful.
 */
export type SettingsJourney = "playback" | "library" | "downloads" | "system";

export interface SettingsSection {
  id: string;
  labelKey: string;
  expertOnly?: boolean;
  dangerous?: boolean;
}

export interface SettingsTab {
  id: string;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  journey: SettingsJourney;
  adminOnly?: boolean;
  expertOnly?: boolean;
  /** Plusieurs panneaux regroupés derrière des boutons ; le premier est affiché par défaut. */
  sections?: SettingsSection[];
  /** Intent-based synonyms a user might actually type ("film absent", not
   *  "Indexation") — matched alongside label/hint, never displayed directly. */
  keywords?: string[];
}

export const SETTINGS_TABS: SettingsTab[] = [
  // Lecture
  { id: "player", labelKey: "settings.tabPlayer", hintKey: "settings.tabPlayerHint", icon: MonitorPlay, journey: "playback", adminOnly: true, keywords: ["lecteur", "lecture", "transcodage", "audio", "codec", "ffmpeg", "benchmark", "buffer", "hdr", "sous-titres"] },
  // Bibliothèque
  {
    id: "library", labelKey: "settings.tabLibrary", hintKey: "settings.tabLibraryHint", icon: BookOpen, journey: "library", adminOnly: true,
    keywords: ["connexion", "serveur", "bibliothèque Plex", "synchronisation", "profils Plex", "renommage", "format de fichier"],
    sections: [
      { id: "plex", labelKey: "settings.sectionPlex" },
      { id: "metadata", labelKey: "settings.sectionMetadata" },
      { id: "imports", labelKey: "settings.sectionImports" },
      { id: "anime", labelKey: "settings.sectionAnime", expertOnly: true },
      { id: "naming", labelKey: "settings.sectionNaming", expertOnly: true },
      { id: "blocklist", labelKey: "settings.sectionBlocklist", expertOnly: true },
    ],
  },
  {
    id: "files", labelKey: "settings.tabFiles", hintKey: "settings.tabFilesHint", icon: Wrench, journey: "library", adminOnly: true, expertOnly: true,
    keywords: ["film absent", "fichier introuvable", "chemin cassé", "dossier vide", "corbeille"],
    sections: [
      { id: "indexation", labelKey: "settings.sectionIndexation" },
      { id: "maintenance", labelKey: "settings.sectionMaintenance" },
    ],
  },
  // Téléchargements
  {
    id: "downloads", labelKey: "settings.tabDownloads", hintKey: "settings.tabDownloadsHint", icon: HardDrive, journey: "downloads", adminOnly: true,
    keywords: ["film absent", "nouveau titre", "téléchargement bloqué", "aucune release", "renommage", "format de fichier", "mise à niveau"],
    sections: [
      { id: "clients", labelKey: "settings.sectionClients" },
      { id: "indexers", labelKey: "settings.sectionIndexers" },
      { id: "qualite", labelKey: "settings.sectionQualite" },
    ],
  },
  // Serveur et données
  { id: "notifications", labelKey: "settings.tabNotifications", hintKey: "settings.tabNotificationsHint", icon: BellRing, journey: "system", adminOnly: true },
  { id: "automation", labelKey: "settings.tabAutomation", hintKey: "settings.tabAutomationHint", icon: ListOrdered, journey: "system", adminOnly: true },
  { id: "ai", labelKey: "settings.tabAi", hintKey: "settings.tabAiHint", icon: Bot, journey: "system", adminOnly: true },
  {
    id: "diagnostics", labelKey: "settings.tabDiagnostics", hintKey: "settings.tabDiagnosticsHint", icon: Activity, journey: "system", adminOnly: true,
    sections: [
      { id: "health", labelKey: "settings.sectionHealth" },
      { id: "performance", labelKey: "settings.sectionPerformance", expertOnly: true },
      { id: "logs", labelKey: "settings.sectionLogs", expertOnly: true },
    ],
  },
  { id: "cache", labelKey: "settings.tabCache", hintKey: "settings.tabCacheHint", icon: Database, journey: "system", adminOnly: true, expertOnly: true, keywords: ["logo", "lenteur images", "vider le cache", "affiches manquantes"] },
  {
    id: "system", labelKey: "settings.tabSystem", hintKey: "settings.tabSystemHint", icon: Info, journey: "system", adminOnly: true,
    sections: [
      { id: "about", labelKey: "settings.sectionAbout" },
      { id: "danger", labelKey: "settings.sectionDanger", expertOnly: true, dangerous: true },
    ],
  },
];

/** Anciens onglets personnels : ils vivent maintenant dans Profil > Préférences (section indiquée). */
export const PERSONAL_SETTINGS_VIEW: Record<string, string> = { dashboard: "home", experience: "display", netflix: "history" };

/** Où mène un lien `?tab=…` : l'onglet réel et, s'il y a lieu, la section à ouvrir. */
export function resolveSettingsTarget(id: string | null | undefined): { tab: string; view?: string } | null {
  if (!id) return null;
  const direct = SETTINGS_TABS.find((tb) => tb.id === id);
  if (direct) return { tab: direct.id };
  // Anciens onglets devenus sections (clients, plex, logs, about…) et l'ancien « health ».
  for (const tb of SETTINGS_TABS) if (tb.sections?.some((sec) => sec.id === id)) return { tab: tb.id, view: id };
  return null;
}

export interface SettingsJourneyDefinition {
  id: SettingsJourney;
  labelKey: string;
  hintKey: string;
  icon: LucideIcon;
  accent: string;
  /** Couleur de l'icône dans la liste complète du menu. */
  tint: string;
  tabIds: string[];
}

/** Five user goals: the only grouping, in the card view (Essential) as in the full list (Expert). */
export const SETTINGS_JOURNEYS: SettingsJourneyDefinition[] = [
  { id: "playback", labelKey: "settings.journeyPlayback", hintKey: "settings.journeyPlaybackHint", icon: Play, accent: "from-cyan-500/24 via-sky-500/10 to-transparent", tint: "text-cyan", tabIds: ["player"] },
  { id: "library", labelKey: "settings.journeyLibrary", hintKey: "settings.journeyLibraryHint", icon: Library, accent: "from-amber-500/24 via-orange-500/10 to-transparent", tint: "text-amber", tabIds: ["library", "files"] },
  { id: "downloads", labelKey: "settings.journeyDownloads", hintKey: "settings.journeyDownloadsHint", icon: Download, accent: "from-emerald-500/24 via-cyan-500/10 to-transparent", tint: "text-ok", tabIds: ["downloads"] },
  { id: "system", labelKey: "settings.journeySystem", hintKey: "settings.journeySystemHint", icon: ServerCog, accent: "from-violet-500/24 via-indigo-500/10 to-transparent", tint: "text-ink-dim", tabIds: ["notifications", "automation", "ai", "diagnostics", "cache", "system"] },
];

export const SETTINGS_JOURNEY_BY_ID = Object.fromEntries(
  SETTINGS_JOURNEYS.map((journey) => [journey.id, journey]),
) as Record<SettingsJourney, SettingsJourneyDefinition>;

/**
 * Recherche normalisée : sans accents ni majuscules, mot par mot. « Relance manquants »
 * trouve un onglet dont le contenu parle de relance ET de manquants, où que ce soit.
 */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Mots de la requête ; un mot d'une seule lettre est ignoré quand il y en a d'autres (bruit). */
export function searchWords(query: string): string[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const long = words.filter((w) => w.length > 1);
  return long.length > 0 ? long : words;
}

/** Textes affichés dans les panneaux de l'onglet (libellés, descriptions, boutons), dans la langue courante. */
export function settingsContentTexts(tab: SettingsTab, t: (key: string) => string): string[] {
  const texts: string[] = [];
  for (const key of SETTINGS_SEARCH_KEYS[tab.id] ?? []) {
    const text = t(key);
    if (text && text !== key) texts.push(text);
  }
  return texts;
}

function tabHeadText(tab: SettingsTab, t: (key: string) => string): string {
  return normalizeSearch([t(tab.labelKey), t(tab.hintKey), ...(tab.sections ?? []).map((sec) => t(sec.labelKey)), ...(tab.keywords ?? [])].join("\n"));
}

/**
 * The one place "does this tab match this search query" is decided — used
 * by the Settings page's sidebar filter and the home search. Every word of the
 * query must be found somewhere in the tab: its label, hint, intent keywords
 * (so "film absent", "lenteur" surface a tab whose name never uses that wording)
 * AND the content of its panels — the individual settings, not just the title.
 */
export function matchesSettingsQuery(tab: SettingsTab, query: string, t: (key: string) => string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const head = tabHeadText(tab, t);
  const missing = words.filter((w) => !head.includes(w));
  if (missing.length === 0) return true;
  const content = normalizeSearch(settingsContentTexts(tab, t).join("\n"));
  return missing.every((w) => content.includes(w));
}

/**
 * Le réglage qui a fait trouver l'onglet, quand le titre/la description ne suffisent pas
 * (« Relance des films manquants » sous « Automatisation ») ; null si le titre explique déjà le résultat.
 */
export function settingsContentSnippet(tab: SettingsTab, query: string, t: (key: string) => string): string | null {
  const words = searchWords(query);
  if (words.length === 0) return null;
  const head = tabHeadText(tab, t);
  const missing = words.filter((w) => !head.includes(w));
  if (missing.length === 0) return null;
  let best: { text: string; hits: number } | null = null;
  for (const text of settingsContentTexts(tab, t)) {
    const norm = normalizeSearch(text);
    const hits = missing.filter((w) => norm.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits || (hits === best.hits && text.length < best.text.length))) best = { text, hits };
  }
  if (!best) return null;
  return best.text.length > 90 ? `${best.text.slice(0, 87)}…` : best.text;
}

