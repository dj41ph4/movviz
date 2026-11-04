import { loadMovies, loadSeries } from "@/lib/library/store";
import { throwIfJobCancelled } from "@/lib/jobs/cancelScope";
import { yieldToUser } from "@/lib/priority/userActivity";
import { externalMarkersEnabled } from "@/lib/settings/markerSources";
import { ensureExternalMarkers, externalCoolingDown, needsExternalSync, type ExternalMarkerTarget } from "./externalSync";
import { getSourceState } from "./store";
import { loadIntroDbSyncState, saveIntroDbSyncState } from "./librarySyncState";

/**
 * Remplit le store de repères depuis TheIntroDB pour TOUTE la bibliothèque,
 * en deux modes qui partagent le même moteur :
 *
 *  - "full" (tâche de nuit) : tout titre jamais interrogé, puis les plus
 *    anciens à rafraîchir. La toute première fois est longue (des milliers
 *    de titres) : un plafond par passage évite d'épuiser le quota quotidien
 *    de l'API et le reste suit les nuits suivantes, sans rien refaire.
 *  - "new" (tâche fréquente) : uniquement les titres jamais interrogés — ceux
 *    qui viennent d'être ajoutés (Plex, téléchargement terminé, import…).
 *    N'agit qu'une fois la première passe complète terminée : avant, le
 *    reste de la bibliothèque est « nouveau » aux yeux de ce mode et il
 *    épuiserait le quota que la tâche de nuit gère déjà.
 *
 * Une requête par titre, espacées (voir externalSync) : aucune analyse de
 * fichier, rien de lourd pour le NAS.
 */
export type IntroDbSyncMode = "full" | "new";

/** Plafond de requêtes par passage de nuit (quota anonyme : 5 000 / 24 h / IP,
 *  on en garde pour la lecture à la demande et les nouveautés). */
export const FULL_PASS_LIMIT = 3_000;
/** Plafond par passage fréquent : une rafale d'ajouts reste étalée. */
export const NEW_PASS_LIMIT = 40;

export interface IntroDbSyncResult {
  mode: IntroDbSyncMode;
  candidates: number;
  attempted: number;
  /** Candidats restants (reportés aux passages suivants). */
  remaining: number;
  skipped: "disabled" | "waiting_first_pass" | "rate_limited" | null;
}

/** Titres de la bibliothèque lisibles (fichier ou Plex) et identifiables sur TMDb. */
export function libraryExternalTargets(): ExternalMarkerTarget[] {
  const targets: ExternalMarkerTarget[] = [];
  for (const movie of loadMovies()) {
    if (movie.status !== "available" || !(movie.file || movie.plexRatingKey) || !movie.tmdbId) continue;
    targets.push({ key: movie.id, api: { kind: "movie", tmdbId: movie.tmdbId } });
  }
  for (const series of loadSeries()) {
    if (!series.tmdbId) continue;
    for (const season of series.seasons) {
      for (const episode of season.episodes) {
        if (episode.status !== "available" || !(episode.file || episode.plexRatingKey)) continue;
        targets.push({
          key: `${series.id}:s${episode.seasonNumber}e${episode.episodeNumber}`,
          api: { kind: "episode", tmdbId: series.tmdbId, season: episode.seasonNumber, episode: episode.episodeNumber },
        });
      }
    }
  }
  return targets;
}

/** Jamais interrogés d'abord, puis les résultats les plus anciens. */
function byPriority(a: ExternalMarkerTarget, b: ExternalMarkerTarget): number {
  const at = getSourceState(a.key, "theintrodb")?.lastSyncedAt ?? 0;
  const bt = getSourceState(b.key, "theintrodb")?.lastSyncedAt ?? 0;
  return at - bt;
}

export async function syncIntroDbLibrary(
  mode: IntroDbSyncMode,
  opts: { targets?: ExternalMarkerTarget[]; limit?: number } = {},
): Promise<IntroDbSyncResult> {
  const result: IntroDbSyncResult = { mode, candidates: 0, attempted: 0, remaining: 0, skipped: null };
  if (!externalMarkersEnabled()) return { ...result, skipped: "disabled" };
  const state = loadIntroDbSyncState();
  if (mode === "new" && !state.firstPassDone) return { ...result, skipped: "waiting_first_pass" };

  const candidates = (opts.targets ?? libraryExternalTargets())
    .filter((target) => needsExternalSync(target.key, { onlyNew: mode === "new" }))
    .sort(byPriority);
  result.candidates = candidates.length;
  const limit = opts.limit ?? (mode === "full" ? FULL_PASS_LIMIT : NEW_PASS_LIMIT);

  for (const target of candidates.slice(0, limit)) {
    throwIfJobCancelled();
    if (externalCoolingDown()) { result.skipped = "rate_limited"; break; }
    await yieldToUser("sync TheIntroDB");
    await ensureExternalMarkers(target);
    result.attempted += 1;
  }
  result.remaining = Math.max(0, candidates.length - result.attempted);

  if (mode === "full") {
    state.lastFullAt = Date.now();
    // Plus aucun titre jamais interrogé : le mode « nouveautés » peut prendre le relais.
    if (!result.skipped && candidates.slice(0, limit).length === candidates.length) state.firstPassDone = true;
    saveIntroDbSyncState(state);
  } else {
    state.lastNewAt = Date.now();
    saveIntroDbSyncState(state);
  }
  console.log(`[TheIntroDB] ${mode}: ${result.attempted}/${result.candidates} traités, ${result.remaining} restants${result.skipped ? ` (${result.skipped})` : ""}`);
  return result;
}
