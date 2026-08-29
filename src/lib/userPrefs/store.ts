import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { PREFERRED_AUDIO_LANGUAGES, type PreferredAudioLanguage } from "@/lib/userPrefs/languages";
import type { GpuTier } from "@/lib/gpu/GpuProvider";
import type { ThemeMode } from "@/lib/theme/theme";
import type { Locale } from "@/i18n/config";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "user-preferences.json");

export type LibraryViewMode = "large" | "small" | "list";

/**
 * Per-user personalization that used to live in localStorage only — GPU
 * tier/animations, interface language, theme, and library view density all
 * reset to defaults on any new browser or device, since none of them were
 * ever tied to the account itself. Every field is optional: a user who never
 * touched a given setting has no entry for it here at all, and the client
 * falls back to its existing localStorage value (device default) rather than
 * a hardcoded one — this store only ever WINS once the user has actually
 * made a choice, it doesn't invent one.
 */
export interface UserPrefs {
  locale?: Locale;
  theme?: ThemeMode;
  gpuTier?: GpuTier;
  reduceAnimations?: boolean;
  libraryViewMode?: LibraryViewMode;
  /** Personal opt-in for the Beta video player — independent of (and gated
   *  by) the admin's own global "is this feature available at all" toggle in
   *  beta-player.json. Confirmed live: previously a single global flag meant
   *  one admin turning it on silently switched playback behavior for every
   *  account on the instance. Defaults to false/absent for every user
   *  regardless of the admin flag, so each person has to knowingly opt in. */
  betaPlayerEnabled?: boolean;
  /** Langue audio préférée pour le choix de piste par défaut du lecteur —
   *  distincte de la langue d'interface (`locale`) : un utilisateur peut lire
   *  Movviz en français tout en préférant l'audio anglais, par exemple.
   *  "auto" (ou absente) → le lecteur retombe sur `locale` ; c'est une
   *  valeur stockée explicite (pas juste "champ absent") pour rester dans le
   *  même schéma "merge only known fields" que le reste de ce store — pas de
   *  distinction fragile entre null/undefined/absent à travers la route API. */
  preferredAudioLanguage?: PreferredAudioLanguage;
  /** Ambient trailer video on movie/series detail pages — absent/true keeps
   *  today's behavior (video plays immediately), false falls back to the
   *  static backdrop image. Independent of the dashboard hero's own
   *  trailerAutoplay (dashboard-layout.json) — two different screens, two
   *  different toggles, same "video vs static image" idea. */
  titlePageVideoEnabled?: boolean;
  /** Per-user crop offset for YouTube previews inside dashboard cards. */
  cardTrailerZoomOffset?: number;
  /** Season-0 "specials" episodes in the completion/watched-tracking logic —
   *  absent/false (default) EXCLUDES them: a series with every real season
   *  watched counts as fully watched even if a special was never released/
   *  watched. Confirmed live: most series never showed as "fully watched"
   *  because a missing/unwatched special always blocked it. true opts back
   *  into counting specials like any other episode. */
  specialEpisodesEnabled?: boolean;
}

const VALID_TIERS: GpuTier[] = ["high", "medium", "low", "ultraLow"];
const VALID_THEMES: ThemeMode[] = ["light", "dark", "auto"];
const VALID_VIEW_MODES: LibraryViewMode[] = ["large", "small", "list"];
const VALID_LOCALES = ["fr", "en", "it", "nl", "de"] as const;

type Store = Record<string, UserPrefs>;

function read(): Store {
  return readJsonCached<Store>(FILE, {});
}

function write(data: Store) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, data);
}

/** Keeps only recognized, validly-typed fields — an unknown/stale field from
 *  a future or reverted app version is dropped rather than trusted verbatim. */
function sanitize(prefs: unknown): UserPrefs {
  const p = (prefs ?? {}) as Partial<Record<keyof UserPrefs, unknown>>;
  const clean: UserPrefs = {};
  if (typeof p.locale === "string" && (VALID_LOCALES as readonly string[]).includes(p.locale)) clean.locale = p.locale as Locale;
  if (typeof p.theme === "string" && VALID_THEMES.includes(p.theme as ThemeMode)) clean.theme = p.theme as ThemeMode;
  if (typeof p.gpuTier === "string" && VALID_TIERS.includes(p.gpuTier as GpuTier)) clean.gpuTier = p.gpuTier as GpuTier;
  if (typeof p.reduceAnimations === "boolean") clean.reduceAnimations = p.reduceAnimations;
  if (typeof p.libraryViewMode === "string" && VALID_VIEW_MODES.includes(p.libraryViewMode as LibraryViewMode)) clean.libraryViewMode = p.libraryViewMode as LibraryViewMode;
  if (typeof p.betaPlayerEnabled === "boolean") clean.betaPlayerEnabled = p.betaPlayerEnabled;
  if (typeof p.preferredAudioLanguage === "string" && (PREFERRED_AUDIO_LANGUAGES as readonly string[]).includes(p.preferredAudioLanguage)) {
    clean.preferredAudioLanguage = p.preferredAudioLanguage as PreferredAudioLanguage;
  }
  if (typeof p.titlePageVideoEnabled === "boolean") clean.titlePageVideoEnabled = p.titlePageVideoEnabled;
  if (typeof p.cardTrailerZoomOffset === "number" && Number.isInteger(p.cardTrailerZoomOffset) && p.cardTrailerZoomOffset >= -100 && p.cardTrailerZoomOffset <= 100) clean.cardTrailerZoomOffset = p.cardTrailerZoomOffset;
  if (typeof p.specialEpisodesEnabled === "boolean") clean.specialEpisodesEnabled = p.specialEpisodesEnabled;
  return clean;
}

export function loadUserPrefs(userId: string): UserPrefs {
  const data = read();
  return data[userId] ? sanitize(data[userId]) : {};
}

/** Merges — never overwrites fields the caller didn't include, since each
 *  provider (GPU, theme, i18n, library view) saves independently and only
 *  knows about its own field. */
export function saveUserPrefs(userId: string, patch: unknown): UserPrefs {
  const cleanPatch = sanitize(patch);
  const data = read();
  data[userId] = { ...(data[userId] ?? {}), ...cleanPatch };
  write(data);
  return data[userId];
}
