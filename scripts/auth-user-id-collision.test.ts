import { test } from "node:test";
import assert from "node:assert/strict";
import { addUser, deleteUser } from "@/lib/auth/store";
import type { User } from "@/lib/auth/types";

function throwawayUser(id: string, username: string): User {
  return {
    id,
    username,
    passwordHash: null,
    role: "user",
    status: "approved",
    autoApproveRequests: false,
    autoRequestFromWatchlist: false,
    discoverContinents: [],
    requestLimitMovies: null,
    requestLimitSeries: null,
    canManageRequests: false,
    plexId: null,
    plexToken: null,
    plexManagedUserId: null,
    plexAvatar: null,
    customAvatar: null,
    createdAt: Date.now(),
  };
}

/**
 * Bug réel confirmé en direct (2026-09) : deux comptes Plex distincts ont
 * fini avec le même `user.id` (ancien schéma faible Date.now()+4 caractères
 * aléatoires dans les routes de création, déjà corrigé) — comme
 * plex-watch-status.json est indexé par `user.id` et pas par plexId, les
 * deux comptes partageaient silencieusement le même historique vu.
 * addUser() doit maintenant refuser tout id déjà utilisé plutôt que de
 * corrompre silencieusement des données partagées entre deux comptes.
 */
test("addUser() refuse un id déjà utilisé au lieu de corrompre silencieusement les données d'un autre compte", () => {
  const id = `test-collision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  addUser(throwawayUser(id, `test-user-a-${id}`));
  try {
    assert.throws(() => addUser(throwawayUser(id, `test-user-b-${id}`)), /id déjà utilisé/);
  } finally {
    deleteUser(id);
  }
});
