import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("Plex sync reuses imported movie and episode identities and files", () => {
  const program = `
    import assert from 'node:assert/strict';
    import { mock } from 'node:test';
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'movviz-plex-existing-'));
    process.env.MOVVIZ_CONFIG_DIR = root;
    const movieFile = path.join(root, 'Movie.mkv'), episodeFile = path.join(root, 'Show.S01E01.mkv');
    fs.writeFileSync(movieFile, 'movie'); fs.writeFileSync(episodeFile, 'episode');
    const item = (ratingKey, tmdbId, filePath) => ({ ratingKey, tmdbId, title: 'Fixture', addedAt: 1700000000,
      file: { path: filePath, size: fs.statSync(filePath).size, resolution: '1080p' }, mediaDetail: null });
    const movie = item('plex-movie', 101, movieFile);
    const show = { ratingKey: 'plex-show', tmdbId: 102, title: 'Fixture show' };
    const episode = { ...item('plex-episode', null, episodeFile), seasonNumber: 1, episodeNumber: 1 };
    const actualStore = await import('@/lib/plex/store');
    const actualClient = await import('@/lib/plex/client');
    mock.module('@/lib/plex/store', { namedExports: { ...actualStore, loadPlexConfig: () => ({ hostname: 'fixture', adminToken: 'fixture', machineIdentifier: 'fixture' }), savePlexConfig: () => {} } });
    mock.module('@/lib/plex/client', { namedExports: { ...actualClient,
      getLibrarySections: async () => [{ key: 'movies', title: 'Films', type: 'movie' }, { key: 'series', title: 'Séries', type: 'show' }],
      getSectionItems: async (_cfg, key) => key === 'movies' ? [movie] : [show],
      getShowEpisodes: async () => [episode], getServerIdentity: async () => 'fixture', refreshSection: async () => {}, batchTmdbIds: async () => new Map(),
    } });
    mock.module('@/lib/playback/engine/probeLibrary', { namedExports: { probeMovieInBackground: () => {}, probeEpisodeInBackground: () => {} } });
    const lib = await import('@/lib/library/store');
    const file = (p) => ({ path: p, size: fs.statSync(p).size, addedAt: 1700000000000, quality: '1080p' });
    lib.addMovie({ id: 'existing-movie', tmdbId: 101, title: 'Movie', status: 'available', monitored: false, file: file(movieFile), plexRatingKey: null });
    lib.addSeries({ id: 'existing-series', tmdbId: 102, title: 'Show', monitored: false, plexRatingKey: null,
      seasons: [{ seasonNumber: 1, monitored: true, episodes: [{ seasonNumber: 1, episodeNumber: 1, status: 'available', monitored: true, file: file(episodeFile), plexRatingKey: null }] }] });
    const { syncPlexLibrary } = await import('@/lib/plex/librarySync');
    await syncPlexLibrary({ force: true });
    assert.equal(lib.loadMovies().length, 1); assert.equal(lib.loadSeries().length, 1);
    assert.equal(lib.getMovie('existing-movie').file.path, movieFile);
    assert.equal(lib.getMovie('existing-movie').plexRatingKey, 'plex-movie');
    assert.equal(lib.getMovie('existing-movie').monitored, false);
    const saved = lib.getSeries('existing-series');
    assert.equal(saved.seasons[0].episodes[0].file.path, episodeFile);
    assert.equal(saved.seasons[0].episodes[0].plexRatingKey, 'plex-episode');
    assert.equal(saved.monitored, false);
    assert.equal(fs.readFileSync(movieFile, 'utf8'), 'movie'); assert.equal(fs.readFileSync(episodeFile, 'utf8'), 'episode');
  `;
  const result = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks", "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", program], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
