import { test } from "node:test";
import assert from "node:assert/strict";
import { saveUserPrefs } from "@/lib/userPrefs/store";
import { resolveWatchRegion } from "@/lib/metadata/tmdb";

let counter = 0;
function freshUserId(): string {
  counter += 1;
  return `test-region-${Date.now()}-${counter}`;
}

test("sans préférence explicite, retombe sur le défaut global (jamais déduit de la langue)", () => {
  const userId = freshUserId();
  assert.equal(resolveWatchRegion(userId), "FR");
});

test("une région explicite (ex. BE) est respectée telle quelle", () => {
  const userId = freshUserId();
  saveUserPrefs(userId, { watchRegion: "BE" });
  assert.equal(resolveWatchRegion(userId), "BE");
});

test("une valeur invalide (pas 2 lettres majuscules) est rejetée par sanitize(), retombe sur le défaut", () => {
  const userId = freshUserId();
  saveUserPrefs(userId, { watchRegion: "belgique" });
  assert.equal(resolveWatchRegion(userId), "FR");
});

test("sans userId, retombe aussi sur le défaut", () => {
  assert.equal(resolveWatchRegion(undefined), "FR");
  assert.equal(resolveWatchRegion(null), "FR");
});
