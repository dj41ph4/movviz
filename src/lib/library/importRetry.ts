import fsp from "node:fs/promises";
import { getSeries } from "@/lib/library/store";
import type { ImportedFile } from "@/lib/library/applyImportedFiles";

/** Le moteur peut rejouer un callback dont la réponse HTTP a été perdue.
 *  Après remplacement, le chemin entrant n'existe plus : seul le même
 *  infoHash, une entrée disponible et le fichier final de bonne taille
 *  permettent d'acquitter ce rejeu. */
export async function alreadyAppliedEpisodeImport(
  seriesId: string, seasonNumber: number, episodeNumber: number,
  infoHash: string | undefined, file: ImportedFile | undefined,
): Promise<boolean> {
  if (!infoHash || !file) return false;
  const ep = getSeries(seriesId)?.seasons.find((s) => s.seasonNumber === seasonNumber)?.episodes.find((e) => e.episodeNumber === episodeNumber);
  const finalPath = ep?.file?.diskPath ?? ep?.file?.path;
  if (ep?.status !== "available" || ep.lastImportedInfoHash !== infoHash || !finalPath || ep.file?.size !== file.size) return false;
  const finalFile = await fsp.stat(finalPath).catch(() => null);
  return !!finalFile?.isFile() && finalFile.size === file.size;
}
