import { getWatchStatus } from "@/lib/plex/watchStore";
import { getUserWatchHistory } from "@/lib/userContext/history";

/**
 * « Vu », une seule définition pour les suggestions et « À revoir » : les
 * titres marqués vus (watchStore) UNION tout ce qui figure dans l'historique
 * de lecture. Constaté en prod (compte test) : le moteur ne connaissait que 5
 * films terminés alors que l'historique en listait une quinzaine — des films
 * déjà lancés revenaient en suggestion et ne servaient jamais de point de
 * départ pour comprendre les goûts.
 *
 * Renvoie tmdbId → date du dernier visionnage connu (0 si inconnue).
 */
export function getWatchedTitles(userId: string, type: "movie" | "series"): Map<number, number> {
  const watched = new Map<number, number>();
  const bump = (tmdbId: number, at: number | null | undefined) => {
    const prev = watched.get(tmdbId) ?? 0;
    watched.set(tmdbId, Math.max(prev, at ?? 0));
  };

  const status = getWatchStatus(userId);
  if (type === "movie") {
    for (const tmdbId of status?.movies ?? []) bump(tmdbId, status?.movieWatchedAt?.[String(tmdbId)]);
  } else {
    for (const ep of status?.episodes ?? []) bump(ep.tmdbId, ep.at);
  }

  // L'historique est une base à part (moteur de contexte) : indisponible ou
  // en erreur, on garde simplement les titres marqués vus.
  try {
    for (const item of getUserWatchHistory({ userId, mediaType: type, limit: 200 })) bump(item.tmdbId, item.watchedAt);
  } catch {
    /* historique indisponible */
  }
  return watched;
}
