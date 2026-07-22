/**
 * Movviz users. Everyone can ask for a title; whether that request lands in
 * the library immediately or waits for an admin depends on the role and the
 * per-user "auto-approve" flag an admin can grant from Settings.
 *
 * A user signs in either with a local password or with their Plex account —
 * both produce the same session, so the rest of the app never needs to care
 * which one was used.
 */

export type UserRole = "admin" | "user";

/** "pending" accounts can't sign in to anything yet — an admin has to approve them from /users first. */
export type UserStatus = "pending" | "approved";

export interface User {
  id: string;
  username: string;
  /** Null for Plex-only accounts — they never set a Movviz password. */
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  /** When true, this user's requests skip admin approval entirely. */
  autoApproveRequests: boolean;
  /** When true, titles added to this user's real Plex watchlist are auto-requested. */
  autoRequestFromWatchlist: boolean;
  /** Continent ids (see @/lib/metadata/continents) this user cares about in Discover — empty means unfiltered. */
  discoverContinents: string[];
  /** Max pending+approved movie requests this user can have outstanding — null means unlimited. Ignored for admins. */
  requestLimitMovies: number | null;
  /** Same as requestLimitMovies, for series. */
  requestLimitSeries: number | null;
  /** When true, this user can approve/decline other users' requests without being an admin. */
  canManageRequests: boolean;
  /** Plex account id (plex.tv), null for local-only accounts. */
  plexId: string | null;
  /** This user's own Plex token — needed to read their watchlist, never sent to the browser. */
  plexToken: string | null;
  /** Managed user id within the Plex Home — used with X-Plex-Profile to scope watch status. */
  plexManagedUserId: string | null;
  plexAvatar: string | null;
  createdAt: number;
}

/** Never send passwordHash or plexToken to the browser — but UI needs to know whether one exists. */
export type PublicUser = Omit<User, "passwordHash" | "plexToken"> & { hasPlexToken: boolean };

export function toPublicUser(u: User): PublicUser {
  const { passwordHash: _passwordHash, plexToken, ...rest } = u;
  return { ...rest, hasPlexToken: !!plexToken };
}
