import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("episode removal is admin-only and never deletes a shared video", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      import { NextRequest } from 'next/server';
      let admin = false;
      let busy = false;
      let shared = true;
      const cleared = [];
      const trashed = [];
      const episode = { episodeNumber: 4, status: 'available', activeInfoHash: null, monitored: true, file: { path: '/media/show/s02e04.mkv' } };
      const series = { id: 'sr_one', tmdbId: 100, title: 'Show', posterPath: null, backdropPath: null, year: 2026, rating: 0, overview: '', seasons: [{ seasonNumber: 2, episodes: [episode] }] };
      mock.module('@/lib/auth/guard', { namedExports: { requireAdmin: () => admin ? { username: 'Admin' } : null } });
      mock.module('@/lib/library/store', { namedExports: {
        getSeries: () => series,
        loadSeries: () => shared ? [series, { ...series, id: 'sr_other', seasons: [{ seasonNumber: 2, episodes: [{ ...episode, episodeNumber: 5 }] }] }] : [series],
        loadMovies: () => [],
        clearEpisodeFile: (...args) => { cleared.push(args); return true; },
      } });
      mock.module('@/lib/library/trashStore', { namedExports: {
        loadTrash: () => [], addToTrash: item => trashed.push(item),
        addTrashEntry: () => {}, getTrashConfig: () => ({ seriesPath: null }),
      } });
      mock.module('@/lib/library/trashMove', { namedExports: { moveToTrash: async () => { throw Error('unexpected file move'); } } });
      mock.module('@/lib/activity/store', { namedExports: { logActivity: () => {} } });
      const { DELETE } = await import('@/app/api/library/series/[id]/episode/[season]/[episode]/route');
      const ctx = { params: Promise.resolve({ id: 'sr_one', season: '2', episode: '4' }) };
      const req = withFiles => new NextRequest('http://localhost/api/library/series/sr_one/episode/2/4?deleteFiles=' + withFiles, { method: 'DELETE' });
      assert.equal((await DELETE(req(false), ctx)).status, 403);
      admin = true;
      assert.equal((await DELETE(req(true), ctx)).status, 409);
      assert.equal(cleared.length, 0);
      assert.equal(trashed.length, 0);
      assert.equal((await DELETE(req(false), ctx)).status, 200);
      assert.deepEqual(cleared, [['sr_one', 2, 4]]);
      assert.equal(trashed[0].type, 'episode');
      assert.equal(trashed[0].snapshot.file.path, '/media/show/s02e04.mkv');
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
