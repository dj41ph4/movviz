import type { User } from "./types";

/**
 * Qui peut relancer la recherche d'un titre MANQUANT déjà dans la bibliothèque (film, saison, épisode) :
 * un admin, ou un utilisateur dont les demandes sont acceptées automatiquement. Les autres passent par une
 * demande classique, validée par un admin. Remplacer ou supprimer un fichier existant reste réservé aux admins,
 * quel que soit ce réglage.
 */
export function canCompleteMissing(user: Pick<User, "role" | "autoApproveRequests"> | null | undefined): boolean {
  return !!user && (user.role === "admin" || user.autoApproveRequests === true);
}
