import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@/lib/auth/types";
import { plexAvatarFingerprint, plexAvatarRefreshPatch } from "@/lib/plex/avatarSync";
import { effectiveAvatar } from "@/lib/auth/types";

const user = (patch: Partial<User> = {}): User => ({
  id: "usr_test", username: "test", passwordHash: null, role: "user", status: "approved",
  autoApproveRequests: false, autoRequestFromWatchlist: false, discoverContinents: [],
  requestLimitMovies: null, requestLimitSeries: null, canManageRequests: false,
  plexId: "1", plexToken: "token", plexManagedUserId: null,
  plexAvatar: "https://plex/old", customAvatar: "/api/avatars/usr_test?v=1", createdAt: 1,
  ...patch,
});

test("first Plex observation only establishes a baseline", () => {
  const patch = plexAvatarRefreshPatch(user(), "https://plex/old", 100);
  assert.deepEqual(patch, { plexAvatar: "https://plex/old", plexAvatarFingerprint: plexAvatarFingerprint("https://plex/old") });
});

test("same Plex fingerprint is a no-op", () => {
  const u = user({ plexAvatarFingerprint: plexAvatarFingerprint("https://plex/old") });
  assert.equal(plexAvatarRefreshPatch(u, "https://plex/old", 200), null);
});

test("a later observed Plex change wins and exposes Plex through effectiveAvatar", () => {
  const u = user({ plexAvatarFingerprint: plexAvatarFingerprint("https://plex/old"), avatarSource: "movviz", avatarUpdatedAt: 100 });
  const patch = plexAvatarRefreshPatch(u, "https://plex/new", 200);
  assert.equal(patch?.customAvatar, null);
  assert.equal(patch?.avatarSource, "plex");
  assert.equal(patch?.avatarUpdatedAt, 200);
});

test("effectiveAvatar cache-busts a changed Plex URL for TV/browser image caches", () => {
  assert.equal(effectiveAvatar(user({ customAvatar: null, avatarUpdatedAt: 200 })), "https://plex/old?movvizAvatarVersion=200");
  assert.equal(effectiveAvatar(user({ customAvatar: null, plexAvatar: "https://plex/old?x=1", avatarUpdatedAt: 200 })), "https://plex/old?x=1&movvizAvatarVersion=200");
});
