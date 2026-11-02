import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-tmdb-slim-"));
const previousConfigDir = process.env.MOVVIZ_CONFIG_DIR;
const previousApiKey = process.env.MOVVIZ_TMDB_API_KEY;
const previousFetch = globalThis.fetch;
process.env.MOVVIZ_CONFIG_DIR = configDir;
process.env.MOVVIZ_TMDB_API_KEY = "slim-test-key";

after(async () => {
  globalThis.fetch = previousFetch;
  const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
  flushPendingJsonWritesSync();
  assert.equal(path.dirname(configDir), path.resolve(os.tmpdir()));
  fs.rmSync(configDir, { recursive: true, force: true });
  if (previousConfigDir === undefined) delete process.env.MOVVIZ_CONFIG_DIR;
  else process.env.MOVVIZ_CONFIG_DIR = previousConfigDir;
  if (previousApiKey === undefined) delete process.env.MOVVIZ_TMDB_API_KEY;
  else process.env.MOVVIZ_TMDB_API_KEY = previousApiKey;
});

const provider = (id: number) => ({ provider_id: id, provider_name: `P${id}`, logo_path: `/p${id}.png`, display_priority: 3 });

function stubFetch(payloads: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const hit = Object.entries(payloads).find(([needle]) => url.includes(needle));
    if (!hit) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  }) as typeof fetch;
}

test("les fournisseurs de visionnage gardent le même résultat, sans les listes location/achat en cache", async () => {
  stubFetch({
    "/tv/9001/watch/providers": {
      id: 9001,
      results: {
        FR: { link: "https://x", flatrate: [provider(8)], rent: [provider(2), provider(3)], buy: [provider(2)] },
        US: { link: "https://y", ads: [provider(7)], free: [provider(9)] },
      },
    },
  });
  const tmdb = await import("@/lib/metadata/tmdb");
  const fr = await tmdb.getWatchProviders("series", 9001, "FR", false);
  assert.deepEqual(fr, [{ providerId: 8, name: "P8", logoPath: "/p8.png" }]);
  const us = await tmdb.getWatchProviders("series", 9001, "US", false);
  assert.deepEqual(us.map((p) => p.providerId), [7, 9]);

  const { getCache } = await import("@/lib/cache/registry");
  const cache = getCache("The Movie Database API", 5 * 60 * 1000);
  const cached = cache.getStale<{ results: Record<string, Record<string, unknown>> }>(
    "https://api.themoviedb.org/3/tv/9001/watch/providers?api_key=slim-test-key&language=fr-FR"
  );
  assert.ok(cached, "l'entrée allégée est bien en cache");
  assert.equal("rent" in cached.value.results.FR, false);
  assert.equal("link" in cached.value.results.FR, false);
  assert.equal("display_priority" in (cached.value.results.FR.flatrate as object[])[0], false);
});

test("les pays d'origine et le titre traduit lisent la même entrée allégée", async () => {
  stubFetch({
    "/tv/9002": {
      id: 9002,
      name: "Le Titre",
      original_name: "The Title",
      overview: "Résumé",
      origin_country: ["JP"],
      genres: [{ id: 1, name: "Drame" }],
      seasons: [{ id: 1, episodes: new Array(50).fill({ x: "y".repeat(200) }) }],
      production_companies: [{ id: 5, name: "Studio" }],
    },
    "/movie/9003": {
      id: 9003,
      title: "Le Film",
      original_title: "The Movie",
      production_countries: [{ iso_3166_1: "FR", name: "France" }, { iso_3166_1: "BE", name: "Belgique" }],
      credits: { cast: new Array(100).fill({ name: "Acteur" }) },
    },
  });
  const tmdb = await import("@/lib/metadata/tmdb");
  assert.deepEqual(await tmdb.getTitleOriginCountries("series", 9002), ["JP"]);
  assert.deepEqual(await tmdb.getTitleOriginCountries("movie", 9003), ["FR", "BE"]);
  // Même URL (fr-FR) que l'entrée allégée ci-dessus : doit toujours répondre.
  assert.equal(await tmdb.getTitleInLanguage(9002, "series", "fr-FR"), "Le Titre");
  assert.equal(await tmdb.getTitleInLanguage(9003, "movie", "fr-FR"), "Le Film");

  const { getCache } = await import("@/lib/cache/registry");
  const cache = getCache("The Movie Database API", 5 * 60 * 1000);
  const cached = cache.getStale<Record<string, unknown>>(
    "https://api.themoviedb.org/3/tv/9002?api_key=slim-test-key&language=fr-FR"
  );
  assert.ok(cached);
  assert.equal("seasons" in cached.value, false);
  assert.equal("production_companies" in cached.value, false);
});
