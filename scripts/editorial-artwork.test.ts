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

  assert.deepEqual(artwork, { backdropPath: "/clean-backdrop.jpg", logoPath: "/official-logo.png", titleEmbedded: false });
});

test("editorial artwork uses localized 16:9 key art without overlaying a second logo", () => {
  const artwork = pickEditorialArtwork({
    backdrops: [{ filePath: "/key-art-with-title.jpg", width: 1920, height: 1080, language: "en", voteAverage: 9 }],
    logos: [{ filePath: "/official-logo.png", width: 1000, height: 300, language: "en", voteAverage: 8 }],
  });

  assert.deepEqual(artwork, { backdropPath: "/key-art-with-title.jpg", logoPath: null, titleEmbedded: true });
});

test("editorial artwork favors a well-voted true landscape over a poorly framed neutral asset", () => {
  const artwork = pickEditorialArtwork({
    backdrops: [
      { filePath: "/portrait-promo.jpg", width: 1000, height: 1400, language: null, voteAverage: 10, voteCount: 100 },
      { filePath: "/community-pick.jpg", width: 1920, height: 1080, language: null, voteAverage: 8.4, voteCount: 20 },
      { filePath: "/single-vote.jpg", width: 1920, height: 1080, language: null, voteAverage: 10, voteCount: 1 },
    ],
    logos: [{ filePath: "/official-logo.png", width: 1000, height: 300, language: "fr", voteAverage: 8 }],
  });

  assert.deepEqual(artwork, { backdropPath: "/community-pick.jpg", logoPath: "/official-logo.png", titleEmbedded: false });
});
