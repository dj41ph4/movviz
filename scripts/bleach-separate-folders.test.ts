import test from "node:test";
import assert from "node:assert/strict";
import { bleachFilePresentation, bleachPlexPart, BLEACH_ORIGINAL_PLEX_GUID, BLEACH_TYBW_PLEX_GUID } from "@/lib/metadata/bleachPlexIdentity";
import { projectBleachPlexEpisodes } from "@/lib/metadata/bleachEpisodeOrder";
import { planBleachEngineTargets } from "@/lib/library/bleachEngine";
import { getPlexEpisodeOrdering, resolveTmdbIdForDebug } from "@/lib/plex/client";
import type { PlexServerConfig } from "@/lib/plex/types";
import { bleachPlexKeysPatch } from "@/lib/plex/bleachSnapshot";
import { projectBleachLibrary } from "@/lib/metadata/bleachPresentation";

test("standalone Plex and IMDb sequel identities keep canonical TMDb ownership without network lookup", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Identity is explicit; no metadata lookup expected"); });
  for (const guid of [BLEACH_TYBW_PLEX_GUID, "imdb://tt14986406"]) {
    assert.equal(bleachPlexPart([{ id: guid }]), "tybw");
    assert.equal(await resolveTmdbIdForDebug([{ id: guid }], undefined, "series"), 30984);
  }
  assert.equal(await resolveTmdbIdForDebug([], BLEACH_TYBW_PLEX_GUID, "series"), 30984);
  assert.equal(bleachPlexPart([{ id: "imdb://tt0434665" }]), "original");
  assert.equal(bleachPlexPart([{ id: "imdb://tt0000001" }]), null);
});

test("original and TYBW receive distinct physical folders and standalone TYBW restarts each cour", () => {
  const original = planBleachEngineTargets([{ season: 2, episode: 1 }], "Bleach.S02E01.1080p", "tvdbAiring", true)[0];
  const sequel = planBleachEngineTargets([{ season: 17, episode: 14 }], "Bleach.TYBW.S02E01.1080p", "tmdbAiring", true)[0];
  assert.notEqual(original.presentation?.folder, sequel.presentation?.folder);
  assert.equal(original.presentation?.plexGuid, BLEACH_ORIGINAL_PLEX_GUID);
  assert.equal(sequel.presentation?.plexGuid, BLEACH_TYBW_PLEX_GUID);
  assert.deepEqual(sequel.library, { season: 17, episode: 14 });
  assert.deepEqual(sequel.placement, { season: 2, episode: 1 });
  assert.deepEqual(original.placement, { season: 2, episode: 1 });
  assert.deepEqual(planBleachEngineTargets([{ season: 11, episode: 1 }], "Bleach.S11E01.1080p", "tmdbAiring", true)[0].placement, { season: 1, episode: 206 });
  assert.equal(planBleachEngineTargets([{ season: 17, episode: 14 }], "Bleach.S02E01.1080p", "tmdbAiring", true).length, 0);
  assert.deepEqual(sequel.presentation, bleachFilePresentation("tybw"));
});

test("Plex GUID preserves cour identity even after a user renames the standalone show", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ MediaContainer: { Metadata: [{ title: "My renamed sequel", guid: BLEACH_TYBW_PLEX_GUID, showOrdering: "tmdbAiring" }] } }));
  const ordering = await getPlexEpisodeOrdering({ hostname: "https://plex.example.com", port: 443, clientId: "movviz-test" } as PlexServerConfig, "show", "fixture-token");
  assert.equal(ordering?.seriesPart, "tybw");
  const mapped = projectBleachPlexEpisodes(ordering!.title, [{ seasonNumber: 2, episodeNumber: 1, ratingKey: "sequel-14" }], ordering!.order, ordering!.seriesPart);
  assert.deepEqual(mapped.items[0], { seasonNumber: 17, episodeNumber: 14, ratingKey: "sequel-14" });
  const original = projectBleachPlexEpisodes("Bleach TYBW", [{ seasonNumber: 2, episodeNumber: 1 }], "tvdbAiring", "original");
  assert.deepEqual(original.items[0], { seasonNumber: 2, episodeNumber: 1 });
});

test("separate Plex links update even with unchanged episodes and incomplete scans preserve unknown links", () => {
  const existing = { plexRatingKey: "original", bleachPlexKeys: { original: "original", tybw: "combined" } };
  const snapshot = { items: [], complete: false, unresolved: 1, uncertainShows: 0, showKeys: { original: null, tybw: "sequel" } };
  const patch = bleachPlexKeysPatch(existing, snapshot);
  assert.deepEqual(patch.bleachPlexKeys, { original: "original", tybw: "sequel" });
  assert.equal(patch.plexRatingKey, "original");
  const view = projectBleachLibrary({ tmdbId: 30984, seasons: [], ...patch, bleachPlexUrls: { original: "https://app.plex.tv/original", tybw: "https://app.plex.tv/sequel" } }, "tybw");
  assert.equal(view.plexRatingKey, "sequel"); assert.equal(view.plexUrl, "https://app.plex.tv/sequel");
});
