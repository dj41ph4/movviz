import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserByPlexId, updateUser } from "@/lib/auth/store";
import { checkPlexLink } from "@/lib/auth/plexLink";
import { loadPlexConfig } from "@/lib/plex/store";
import { checkPin, getPlexAccount } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/**
 * Appelée par le bouton « Lier mon compte Plex » du profil (le PIN vient de /api/auth/plex/pin).
 * Contrairement à /api/auth/plex/poll, personne ne se connecte ici et aucun compte n'est créé :
 * l'utilisateur est déjà connecté, on renseigne seulement ses champs Plex. La connexion Plex
 * retrouve ensuite ce même compte par son identifiant Plex. Rien d'autre n'est modifié
 * (jeton serveur, synchronisation de la liste de suivi : réglages inchangés).
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pinId = Number(body.id);
  if (!pinId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const cfg = loadPlexConfig();
  const token = await checkPin(cfg.clientId, pinId);
  if (!token) return NextResponse.json({ done: false });

  const account = await getPlexAccount(cfg.clientId, token);
  if (!account) return NextResponse.json({ error: "plex_account_lookup_failed" }, { status: 502 });

  const refusal = checkPlexLink({ user, plexAccountId: account.id, findByPlexId: getUserByPlexId });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  updateUser(user.id, { plexId: account.id, plexToken: token, plexServerToken: null, plexAvatar: account.thumb });
  return NextResponse.json({ done: true });
}
