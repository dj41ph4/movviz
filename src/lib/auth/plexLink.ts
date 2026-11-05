import type { User } from "./types";

export type PlexLinkError = "already_linked" | "plex_already_linked";

/**
 * Lier un compte Plex à un compte Movviz EXISTANT (par exemple un compte local) : c'est le même
 * utilisateur, mêmes données — seuls les champs Plex sont renseignés. Deux refus :
 * - le compte a déjà un lien Plex (on ne le remplace pas en silence) ;
 * - ce compte Plex appartient déjà à un autre utilisateur Movviz (sinon deux profils partageraient
 *   le même Plex, et la connexion Plex ne saurait plus lequel ouvrir).
 */
export function checkPlexLink(input: {
  user: Pick<User, "id" | "plexId">;
  plexAccountId: string;
  findByPlexId: (plexId: string) => Pick<User, "id"> | null;
}): PlexLinkError | null {
  if (input.user.plexId) return "already_linked";
  const owner = input.findByPlexId(input.plexAccountId);
  if (owner && owner.id !== input.user.id) return "plex_already_linked";
  return null;
}
