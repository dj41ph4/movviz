import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { movieHasReleased, movieReleasedRecently } from "@/lib/library/releaseSchedule";
import { acquisitionInterval } from "@/lib/scheduler/interval";

const now = Date.parse("2026-10-08T12:00:00Z");

test("sortie il y a deux jours : repli sans date VF et priorité de la date VF", () => {
  assert.equal(movieHasReleased(null, "2026-10-06", now), true);
  assert.equal(movieReleasedRecently(null, "2026-10-06", now), true);
  assert.equal(movieReleasedRecently("2026-10-06", "2026-05-01", now), true);
  assert.equal(movieReleasedRecently("2026-12-01", "2026-10-06", now), false);
  assert.equal(movieReleasedRecently(null, "2026-05-01", now), false);
  assert.equal(movieReleasedRecently(null, null, now), false);
  assert.equal(movieReleasedRecently(null, "invalid", now), false);
});

test("les anciennes fréquences quotidiennes sont limitées à huit heures", () => {
  for (const id of ["rss-indexer-scan", "release-day-search", "retry-missing-movies"]) {
    assert.equal(acquisitionInterval(id, 86400000), 28800000);
    assert.equal(acquisitionInterval(id, 3600000), 3600000);
    assert.equal(acquisitionInterval(id, 21600000), 21600000);
  }
  assert.equal(acquisitionInterval("metadata-refresh", 86400000), 86400000);
});

test("RSS : titre original déclenche un seul grab, année incorrecte et série sont ignorées", () => {
  // Execute the real RSS loop with isolated boundaries: no library writes,
  // indexer calls or real downloads. Node mocks require their explicit flag.
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      const hits = [];
      const movie = { id: 'toronto', title: 'Un homme de Toronto', originalTitle: 'The Man from Toronto', year: 2022, monitored: true, status: 'missing', aliases: [] };
      const titles = [
        'The.Man.from.Toronto.2022.MULTi.1080p.WEB-DL',
        'The.Man.from.Toronto.2022.MULTi.2160p.WEB-DL',
        'The.Man.from.Toronto.2010.MULTi.1080p.WEB-DL',
        'The.Man.from.Toronto.2022.S01E01.1080p.WEB-DL',
      ];
      mock.module('@/lib/indexers/rssCache', { namedExports: { readRssCache: () => titles.map(title => ({ title })) } });
      mock.module('@/lib/library/store', { namedExports: { loadMovies: () => [movie, { ...movie, id: 'off', monitored: false }, { ...movie, id: 'owned', status: 'available' }], loadSeries: () => [] } });
      mock.module('@/lib/library/autoGrab', { namedExports: { searchAndGrabMovie: async id => { hits.push(id); return { ok: true }; } } });
      mock.module('@/lib/library/autoGrabSeries', { namedExports: { searchAndGrabSeason: async () => { throw Error('unexpected series search'); }, withSearchLock: async (_key, fn) => fn() } });
      mock.module('@/lib/priority/lane', { namedExports: { runBackground: fn => fn() } });
      mock.module('@/lib/priority/userActivity', { namedExports: { yieldToUser: async () => {} } });
      const { rssMatchIndexers } = await import('@/lib/library/rssScan');
      assert.deepEqual(await rssMatchIndexers(), { grabbed: 1 });
      assert.deepEqual(hits, ['toronto']);
      titles.splice(0, 2);
      hits.length = 0;
      assert.deepEqual(await rssMatchIndexers(), { grabbed: 0 });
      assert.deepEqual(hits, []);
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("la tâche RSS active réconcilie les sorties avant refresh et grab, désactivée elle ne fait rien", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      const calls = [];
      let enabled = true;
      const overrides = {
        transitionUpcomingMovies: () => calls.push('movies'),
        transitionUpcomingEpisodes: () => calls.push('episodes'),
        refreshRssCache: async () => calls.push('refresh'),
        rssMatchIndexers: async () => calls.push('grab'),
        isAutoSearchMissingEnabled: () => enabled,
      };
      // Isolate every external boundary of the real task definitions.
      const source = readFileSync('src/lib/scheduler/tasks.ts', 'utf8');
      for (const match of source.matchAll(/import \{([^}]+)\} from "([^"]+)";/g)) {
        const namedExports = Object.fromEntries(match[1].split(',').map(s => s.trim()).map(name => [name, overrides[name] ?? (() => {})]));
        mock.module(match[2], { namedExports });
      }
      const { TASKS } = await import('@/lib/scheduler/tasks');
      const rss = TASKS.find(t => t.id === 'rss-indexer-scan');
      assert.equal(rss.intervalMs, 3600000);
      await rss.run();
      assert.deepEqual(calls, ['movies', 'episodes', 'refresh', 'grab']);
      enabled = false;
      calls.length = 0;
      await rss.run();
      assert.deepEqual(calls, []);
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
