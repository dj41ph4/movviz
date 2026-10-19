import test from "node:test";
import assert from "node:assert/strict";
import type { LibrarySeries, LibraryEpisode } from "@/lib/library/types";

// An integral (366 episodes) finished downloading after the episodes had lost
// their grab claims: every file was rejected as "intent unverified" and nothing
// reached the library although the engine had filed every file correctly.
// The engine's placement is fully verifiable on its own; an unclaimed episode
// may be filled, never silently replaced, and a claim held by another download
// still wins. One bad file must not reject the rest of the pack.
async function fixture() {
  const { validateBleachImportedFiles } = await import("@/lib/library/applyImportedFiles");
  const { bleachFilePresentation } = await import("@/lib/metadata/bleachPlexIdentity");
  const presentation = bleachFilePresentation("original");
  const root = `/data/série/${presentation.folder}`;
  const ep = (seasonNumber: number, episodeNumber: number, extra: Partial<LibraryEpisode> = {}): LibraryEpisode => ({ seasonNumber, episodeNumber, title: "x", airDate: null, monitored: true, status: "missing", activeInfoHash: null, file: null, plexRatingKey: null, ...extra });
  const fileFor = (season: number, episode: number) => {
    const s = String(season).padStart(2, "0"), e = String(episode).padStart(2, "0");
    return {
      path: `${root}/Season ${s}/Bleach - S${s}E${e}.mkv`, quality: null, resolution: null, videoCodec: "x265", audioCodec: null, hdr: null, source: null, size: 1000, season, episode, episodeEnd: null,
      episodePlacement: { source: { season, episode }, library: { season, episode }, placement: { season, episode }, presentation },
    };
  };
  return { validateBleachImportedFiles, ep, fileFor, root };
}

test("files of a pack whose claims were lost are still accepted when the engine placement verifies", async () => {
  const { validateBleachImportedFiles, ep, fileFor } = await fixture();
  const series = { id: "sr_b", tmdbId: 30984, title: "Bleach", seasons: [
    { seasonNumber: 2, name: "S2", monitored: true, episodes: [ep(2, 1), ep(2, 2)] },
  ] } as unknown as LibrarySeries;
  const files = [fileFor(2, 1), fileFor(2, 2)];
  assert.equal(validateBleachImportedFiles(series, files, "integral-hash").length, 2);
});

test("an unclaimed episode is never replaced by another file; a claim held elsewhere wins; the rest still imports", async () => {
  const { validateBleachImportedFiles, ep, fileFor, root } = await fixture();
  const other = { path: `${root}/Season 02/Bleach - S02E01 (old).mkv`, size: 5, addedAt: 1, quality: "—", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null };
  const series = { id: "sr_b", tmdbId: 30984, title: "Bleach", seasons: [
    { seasonNumber: 2, name: "S2", monitored: true, episodes: [
      ep(2, 1, { status: "available", file: other }),
      ep(2, 2, { status: "downloading", activeInfoHash: "someone-else" }),
      ep(2, 3),
    ] },
  ] } as unknown as LibrarySeries;
  const kept = validateBleachImportedFiles(series, [fileFor(2, 1), fileFor(2, 2), fileFor(2, 3)], "integral-hash");
  assert.deepEqual(kept.map((f) => f.episode), [3]);
  assert.throws(() => validateBleachImportedFiles(series, [fileFor(2, 1)], "integral-hash"), /bleach_unclaimed_replacement/);
  assert.throws(() => validateBleachImportedFiles(series, [fileFor(2, 2)], "integral-hash"), /bleach_import_claimed_elsewhere/);
});

test("the same file already in place (Plex picked it up first) is accepted", async () => {
  const { validateBleachImportedFiles, ep, fileFor } = await fixture();
  const f = fileFor(1, 1);
  const series = { id: "sr_b", tmdbId: 30984, title: "Bleach", seasons: [
    { seasonNumber: 1, name: "S1", monitored: true, episodes: [ep(1, 1, { status: "available", file: { path: f.path, size: 1000, addedAt: 1, quality: "—", resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null } })] },
  ] } as unknown as LibrarySeries;
  assert.equal(validateBleachImportedFiles(series, [f], "integral-hash").length, 1);
});
