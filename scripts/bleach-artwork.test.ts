import test from "node:test";
import assert from "node:assert/strict";
import { bleachPartArtwork, patchBleachArtwork } from "@/lib/metadata/bleachArtwork";
import { projectBleachLibrary } from "@/lib/metadata/bleachPresentation";

test("legacy image choices stay on original Bleach and do not leak into TYBW", () => {
  const series = { customBackdropPath: "/original.jpg", customLogoPath: "/original.png" };
  assert.deepEqual(bleachPartArtwork(series, "original"), series);
  assert.deepEqual(bleachPartArtwork(series, "tybw"), { customBackdropPath: undefined, customLogoPath: undefined });
});

test("saving either part's logo preserves both backdrops and the other logo", () => {
  const initial = { original: { customBackdropPath: "/old.jpg", customLogoPath: "/old.png" }, tybw: { customBackdropPath: "/new.jpg" } };
  const before = JSON.stringify(initial);
  const updated = patchBleachArtwork(initial, "tybw", { customLogoPath: "/new.png" });
  assert.deepEqual(updated.original, initial.original);
  assert.equal(updated.tybw?.customBackdropPath, "/new.jpg");
  assert.equal(updated.tybw?.customLogoPath, "/new.png");
  assert.equal(JSON.stringify(initial), before);
});

test("resetting an original override explicitly does not restore a stale legacy custom choice", () => {
  const series = { customBackdropPath: "/legacy.jpg", customLogoPath: "/legacy.png", bleachArtwork: { original: { customLogoPath: null } } };
  assert.deepEqual(bleachPartArtwork(series, "original"), { customBackdropPath: "/legacy.jpg", customLogoPath: null });
});

test("fiche projection restores each part's choices without changing canonical media or tracking", () => {
  const series = { id: "one-catalogue", tmdbId: 30984, episodeOrder: "tvdb", seasons: [
    { seasonNumber: 2, episodes: [{ episodeNumber: 1, file: { path: "/original.mkv" }, watched: true }] },
    { seasonNumber: 17, episodes: [{ episodeNumber: 14, file: { path: "/tybw.mkv" }, watched: true }] },
  ], bleachArtwork: { original: { customBackdropPath: "/original.jpg", customLogoPath: "/original.png" }, tybw: { customBackdropPath: "/tybw.jpg", customLogoPath: "/tybw.png" } } };
  const before = JSON.stringify(series);
  const original = projectBleachLibrary(series, "original"), tybw = projectBleachLibrary(series, "tybw");
  assert.equal(original.id, tybw.id);
  assert.equal(original.customLogoPath, "/original.png"); assert.equal(tybw.customLogoPath, "/tybw.png");
  assert.equal(original.customBackdropPath, "/original.jpg"); assert.equal(tybw.customBackdropPath, "/tybw.jpg");
  assert.equal(original.seasons[0].episodes[0].file.path, "/original.mkv");
  assert.equal(tybw.seasons[0].episodes[0].episodeNumber, 14);
  assert.equal(JSON.stringify(series), before);
});
