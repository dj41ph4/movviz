import assert from "node:assert/strict";
import { test } from "node:test";
import { announcedWindow, selectAnnounced } from "../src/lib/metadata/announcedMovies.ts";
import type { MetaSearchResult } from "../src/lib/metadata/types.ts";

const film = (tmdbId: number, releaseDate: string | null, extra: Partial<MetaSearchResult> = {}): MetaSearchResult => ({
  tmdbId, type: "movie", title: `Film ${tmdbId}`, year: null, releaseDate, overview: "Un synopsis.", posterPath: "/p.jpg", backdropPath: null, rating: 0, ...extra,
});

test("Prochainement keeps dated announcements of the next 12 months, in release order", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.deepEqual(announcedWindow(now), { from: "2026-10-27", to: "2027-10-26" });
  const picked = selectAnnounced([
    film(1, "2027-03-01"),
    film(2, "2026-11-15"),
    film(3, "2028-12-25"), // hypothetical, two years out
    film(4, "2026-10-20"), // already out
    film(5, null), // no date
    film(6, "2026-12-01", { posterPath: null }), // no poster
    film(7, "2026-12-02", { overview: "" }), // no synopsis yet: still announced
    film(2, "2026-11-15"), // duplicate
    film(8, "2026-11-15", { popularity: 90 }),
    film(9, "2026-11-20", { genreIds: [99] }), // documentary
  ], now);
  assert.deepEqual(picked.map((m) => m.tmdbId), [8, 2, 7, 1]);
});
