/**
 * Preferred audio language — pure constants + types, deliberately free of
 * ANY server-side import (node:fs, fsJsonCache, worker pool...).
 *
 * WHY: `PlexSettings` (client component on the setup page) renders the
 * language dropdown from this list. When the list lived in
 * `@/lib/userPrefs/store` — a server module importing `node:fs` and the
 * worker_threads JSON write pool — Turbopack pulled the WHOLE module graph
 * into the client bundle: `IndexerManager` chunk failed with
 * "chunking context does not support external modules (node:worker_threads)".
 * Keeping the shared constants in a leaf module with zero imports keeps the
 * client bundle clean.
 */
export const PREFERRED_AUDIO_LANGUAGES = ["auto", "fr", "en", "es", "de", "it", "nl"] as const;
export type PreferredAudioLanguage = (typeof PREFERRED_AUDIO_LANGUAGES)[number];