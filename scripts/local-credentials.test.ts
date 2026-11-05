import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLocalCredentials } from "@/lib/auth/localCredentials";

const plexOnly = { id: "usr_plex", username: "PlexName", passwordHash: null };
const local = { id: "usr_local", username: "maison", passwordHash: "hash:secret123" };
const verify = (password: string, hash: string) => hash === `hash:${password}`;
const nobody = () => null;

function run(user: typeof plexOnly | typeof local, over: Partial<Parameters<typeof validateLocalCredentials>[0]> = {}) {
  return validateLocalCredentials({
    user,
    username: "nouveau-pseudo",
    password: "motdepasse1",
    currentPassword: "",
    findByUsername: nobody,
    verifyPassword: verify,
    ...over,
  });
}

test("un compte Plex sans mot de passe crée son pseudo local sans mot de passe actuel", () => {
  assert.equal(run(plexOnly), null);
});

test("le mot de passe est obligatoire et de 8 caractères minimum pour un compte Plex seul", () => {
  assert.equal(run(plexOnly, { password: "" }), "password_too_short");
  assert.equal(run(plexOnly, { password: "court" }), "password_too_short");
});

test("le pseudo doit faire 3 à 40 caractères", () => {
  assert.equal(run(plexOnly, { username: "ab" }), "username_too_short");
  assert.equal(run(plexOnly, { username: "x".repeat(41) }), "username_too_long");
});

test("un pseudo déjà pris par un autre compte est refusé", () => {
  assert.equal(run(plexOnly, { findByUsername: () => ({ id: "usr_other" }) }), "username_taken");
});

test("garder son propre pseudo n'est pas un conflit", () => {
  assert.equal(run(local, { username: "maison", password: "", currentPassword: "secret123", findByUsername: () => ({ id: "usr_local" }) }), null);
});

test("un compte qui a déjà un mot de passe doit fournir le mot de passe actuel", () => {
  assert.equal(run(local, { password: "", currentPassword: "faux" }), "wrong_password");
  assert.equal(run(local, { password: "", currentPassword: "secret123" }), null);
});

test("pour changer seulement le pseudo, le nouveau mot de passe reste facultatif mais, s'il est donné, il fait 8 caractères", () => {
  assert.equal(run(local, { password: "court", currentPassword: "secret123" }), "password_too_short");
});

import { checkPlexLink } from "@/lib/auth/plexLink";

test("un compte local sans lien Plex peut lier un compte Plex libre", () => {
  assert.equal(checkPlexLink({ user: { id: "usr_local", plexId: null }, plexAccountId: "42", findByPlexId: () => null }), null);
});

test("un compte déjà lié à Plex n'est pas relié en silence à un autre compte Plex", () => {
  assert.equal(checkPlexLink({ user: { id: "usr_local", plexId: "7" }, plexAccountId: "42", findByPlexId: () => null }), "already_linked");
});

test("un compte Plex déjà utilisé par un autre profil Movviz est refusé", () => {
  assert.equal(checkPlexLink({ user: { id: "usr_local", plexId: null }, plexAccountId: "42", findByPlexId: () => ({ id: "usr_other" }) }), "plex_already_linked");
});

import { watchlistLibraryKey } from "@/lib/watchlist/libraryKey";

test("la clé bibliothèque d'un titre de la liste : film, série, et épisode rattaché à sa série", () => {
  assert.equal(watchlistLibraryKey({ type: "movie", tmdbId: 10 }), "movie:10");
  assert.equal(watchlistLibraryKey({ type: "series", tmdbId: 20 }), "series:20");
  assert.equal(watchlistLibraryKey({ type: "episode", tmdbId: 20 }), "series:20");
});
