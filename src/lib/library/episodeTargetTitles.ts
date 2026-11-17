import { decodeLibraryRef } from "@/lib/library/types";
import { getSeries } from "@/lib/library/store";
import { isFankaiId } from "@/lib/metadata/fankaiWikitext";

/**
 * Ajoute le titre de chaque épisode visé à la liste de cibles envoyée au moteur.
 *
 * Les packs « 002 Le Chat et La Souris (2e partie).mkv » n'ont ni saison ni épisode dans leurs
 * noms et leur numérotation ne suit pas celle de TMDb : le moteur les apparie par titre
 * (engine/src/episodeTitleMatch.mjs). Sans titre, il retombe sur l'ancien appariement par numéro.
 * Un titre générique (« Épisode 12 ») ne dit rien et est omis.
 *
 * Les cibles d'une version fan Fan-Kai sont marquées `fanVersion` : ses packs rangent les films
 * par saga (« Saison 2/… Bleach Yabaï - 05 - … ») avec une numérotation continue, que le moteur
 * lit alors comme le n° de film (engine/src/fankaiNames.mjs). Aucune autre fiche n'est marquée.
 */
export function withEpisodeTitles<T extends { season: number; episode: number }>(
  libraryRef: string | null | undefined,
  targets: T[] | undefined,
): (T & { title?: string; fanVersion?: true })[] | undefined {
  if (!targets?.length || !libraryRef) return targets;
  const ref = decodeLibraryRef(libraryRef);
  if (!ref || ref.kind === "movie") return targets;
  const series = getSeries(ref.seriesId);
  if (!series) return targets;
  const titles = new Map<string, string>();
  for (const season of series.seasons) {
    for (const episode of season.episodes) {
      const title = episode.title?.trim();
      if (title && !/^(?:[ée]pisode|episode|folge|aflevering|episodio)\s*\d+$/i.test(title)) {
        titles.set(`${season.seasonNumber}:${episode.episodeNumber}`, title);
      }
    }
  }
  const fanVersion = isFankaiId(series.tmdbId);
  return targets.map((target) => {
    const title = titles.get(`${target.season}:${target.episode}`);
    return title || fanVersion ? { ...target, ...(title ? { title } : {}), ...(fanVersion ? { fanVersion: true as const } : {}) } : target;
  });
}
