import { test } from "node:test";
import assert from "node:assert/strict";
import { selectMediaVideo } from "@/lib/metadata/tmdb";

const SUPPORTED = ["fr", "en", "it", "nl", "de"] as const;

function baseCtx(overrides: Partial<{ userLanguage: string; originalLanguage: string | null }> = {}) {
  return { userLanguage: "fr", originalLanguage: "en", supportedLanguages: SUPPORTED, ...overrides };
}

test("carrousel : un Trailer officiel passe avant un Teaser", () => {
  const videos = [
    { key: "trailer-official-new", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr", published_at: "2026-01-01" },
    { key: "teaser-plain-old", site: "YouTube", type: "Teaser", official: false, iso_639_1: "fr", published_at: "2020-01-01" },
  ];
  const result = selectMediaVideo(videos, { context: "carousel", ...baseCtx() });
  assert.equal(result[0], "trailer-official-new");
});

test("details : le Trailer prend aussi la priorité sur le Teaser", () => {
  const videos = [
    { key: "trailer-fr", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr" },
    { key: "teaser-fr", site: "YouTube", type: "Teaser", official: true, iso_639_1: "fr" },
  ];
  const result = selectMediaVideo(videos, { context: "details", ...baseCtx() });
  assert.equal(result[0], "trailer-fr");
});

test("Doomsday : un spot TMDb officiel ne peut jamais précéder la bande-annonce", () => {
  const videos = [
    { key: "wrong-spot", site: "YouTube", type: "Teaser", official: true, iso_639_1: "fr", name: "Avengers : Doomsday - Spot : Les Wakandais reviendront (VOST) | Marvel", published_at: "2026-01-13" },
    { key: "right-trailer", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr", name: "Avengers : Doomsday - Bande-annonce (VF) | Marvel", published_at: "2026-08-21" },
  ];
  for (const context of ["carousel", "details"] as const) {
    assert.deepEqual(selectMediaVideo(videos, { context, ...baseCtx() }), ["right-trailer"]);
  }
});

test("ordre des paliers de langue : officiel langue utilisateur > langue utilisateur > officiel langue originale > langue originale > autre langue Movviz > le reste", () => {
  const videos = [
    { key: "other-lang", site: "YouTube", type: "Trailer", official: false, iso_639_1: "it" },
    { key: "original-lang-plain", site: "YouTube", type: "Trailer", official: false, iso_639_1: "en" },
    { key: "original-lang-official", site: "YouTube", type: "Trailer", official: true, iso_639_1: "en" },
    { key: "user-lang-plain", site: "YouTube", type: "Trailer", official: false, iso_639_1: "fr" },
    { key: "user-lang-official", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr" },
  ];
  const result = selectMediaVideo(videos, { context: "details", ...baseCtx() });
  assert.deepEqual(result, ["user-lang-official", "user-lang-plain", "original-lang-official", "original-lang-plain", "other-lang"]);
});

test("ignore les sites autres que YouTube et les types hors Teaser/Trailer (Clip, Featurette...)", () => {
  const videos = [
    { key: "vimeo-trailer", site: "Vimeo", type: "Trailer", official: true, iso_639_1: "fr" },
    { key: "clip-fr", site: "YouTube", type: "Clip", official: true, iso_639_1: "fr" },
    { key: "featurette-fr", site: "YouTube", type: "Featurette", official: true, iso_639_1: "fr" },
    { key: "real-trailer", site: "YouTube", type: "Trailer", official: false, iso_639_1: "fr" },
  ];
  const result = selectMediaVideo(videos, { context: "details", ...baseCtx() });
  assert.deepEqual(result, ["real-trailer"]);
});

test("carrousel : à défaut de Teaser exploitable, retombe sur la chaîne Trailer complète", () => {
  const videos = [
    { key: "trailer-fr", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr" },
    { key: "trailer-en", site: "YouTube", type: "Trailer", official: false, iso_639_1: "en" },
  ];
  const result = selectMediaVideo(videos, { context: "carousel", ...baseCtx() });
  assert.deepEqual(result, ["trailer-fr", "trailer-en"]);
});

test("langue originale identique à la langue utilisateur : pas de palier compté deux fois", () => {
  const videos = [{ key: "only-one", site: "YouTube", type: "Trailer", official: true, iso_639_1: "fr" }];
  const result = selectMediaVideo(videos, { context: "details", ...baseCtx({ originalLanguage: "fr" }) });
  assert.deepEqual(result, ["only-one"]);
});

test("aucune vidéo exploitable => liste vide", () => {
  assert.deepEqual(selectMediaVideo([], { context: "details", ...baseCtx() }), []);
  assert.deepEqual(selectMediaVideo(undefined, { context: "carousel", ...baseCtx() }), []);
});
