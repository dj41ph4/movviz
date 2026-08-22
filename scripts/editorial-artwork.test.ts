import assert from "node:assert/strict";
import test from "node:test";
import { pickEditorialArtwork } from "../src/lib/metadata/tmdb.ts";

test("editorial artwork uses a neutral backdrop before placing the official logo", () => {
  const artwork = pickEditorialArtwork({
    backdrops: [
      { filePath: "/localized-title.jpg", width: 1920, height: 1080, language: "fr", voteAverage: 9 },
      { filePath: "/clean-backdrop.jpg", width: 1920, height: 1080, language: null, voteAverage: 7 },
    ],
    logos: [{ filePath: "/official-logo.png", width: 1000, height: 300, language: "fr", voteAverage: 8 }],
  });

  assert.deepEqual(artwork, { backdropPath: "/clean-backdrop.jpg", logoPath: "/official-logo.png" });
});

test("editorial artwork refuses to overlay a logo when TMDb offers no neutral background", () => {
  const artwork = pickEditorialArtwork({
    backdrops: [{ filePath: "/key-art-with-title.jpg", width: 1920, height: 1080, language: "en", voteAverage: 9 }],
    logos: [{ filePath: "/official-logo.png", width: 1000, height: 300, language: "en", voteAverage: 8 }],
  });

  assert.deepEqual(artwork, { backdropPath: null, logoPath: null });
});
