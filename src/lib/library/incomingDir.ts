/**
 * Dossier d'attente du moteur (`<completedPath>/.movviz-incoming/<infoHash>/…`).
 *
 * Quand le nom final d'un fichier importé est déjà occupé (remplacement, nouveau
 * téléchargement d'un épisode existant), le moteur y dépose le nouveau fichier au
 * lieu de créer « Nom (2).mkv » à côté de l'ancien. La bibliothèque l'installe
 * sous son nom final une fois le remplacement validé ; s'il n'est jamais validé
 * il reste là, hors de la vue de Plex, et le moteur finit par le purger.
 *
 * Ce dossier ne fait JAMAIS partie de la bibliothèque : tout parcours du disque
 * qui découvre ou rattache des fichiers doit l'ignorer.
 */
export const INCOMING_DIR_NAME = ".movviz-incoming";

/** Vrai si le chemin (ou un chemin relatif à une racine) passe par le dossier d'attente. */
export function isInIncomingDir(p: string): boolean {
  return p.split(/[\\/]+/).includes(INCOMING_DIR_NAME);
}
