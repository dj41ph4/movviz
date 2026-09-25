import { getPlexFriends, getSharedServers } from "./client";
import { ensureMachineIdentifier } from "./plexUserContext";
import { loadPlexConfig } from "./store";

export interface PlexServerAccount {
  /** plex.tv account id — the same id Movviz stores as `plexId`. */
  id: string;
  username: string;
  email: string;
  thumb: string | null;
}

/**
 * Every Plex account with access to the connected server, for « Importer
 * les utilisateurs Plex ». The source of truth is the server's own share
 * list: plex.tv's friends list (the only source used before) is a social
 * graph that routinely comes back empty for genuine server users — seen in
 * production: 0 friends while 16 Movviz accounts came from Plex, so every
 * import silently added nobody. Friends are still merged in, in case an
 * account is a friend without a share on this server yet.
 *
 * Returns null when neither source could be reached (the caller reports
 * the failure instead of pretending there is nobody to import).
 */
export async function getPlexServerAccounts(): Promise<PlexServerAccount[] | null> {
  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return null;
  const machineIdentifier = await ensureMachineIdentifier(cfg).catch(() => null);
  const [shares, friends] = await Promise.all([
    machineIdentifier ? getSharedServers(cfg.clientId, cfg.adminToken, machineIdentifier).catch(() => null) : Promise.resolve(null),
    getPlexFriends(cfg.clientId, cfg.adminToken),
  ]);
  if (shares === null && friends.length === 0) return null;

  const accounts = new Map<string, PlexServerAccount>();
  // A pending invite (not accepted yet) has no access to the server yet.
  for (const share of shares ?? []) {
    if (!share.accepted) continue;
    accounts.set(share.userId, { id: share.userId, username: share.username, email: share.email, thumb: share.thumb });
  }
  for (const friend of friends) {
    if (!accounts.has(friend.id)) accounts.set(friend.id, { id: friend.id, username: friend.username, email: friend.email, thumb: friend.thumb });
  }
  return [...accounts.values()];
}
