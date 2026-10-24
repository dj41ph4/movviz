import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Plex Continue Watching returns five entries first, then publishes the rest and invalidates on watch", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      const listeners = [];
      const events = [];
      const calls = [];
      const plex = Array.from({ length: 12 }, (_, i) => ({ ratingKey: String(i + 1) }));
      const eventBus = {
        on: listener => listeners.push(listener),
        emit: event => { events.push(event); for (const listener of listeners) listener(event); },
      };
      mock.module('@/lib/auth/guard', { namedExports: { requireUser: () => ({ id: 'profile-a' }) } });
      mock.module('@/lib/events/EventBus', { namedExports: { eventBus } });
      mock.module('@/lib/plex/store', { namedExports: { loadPlexConfig: () => ({ hostname: 'plex.local' }) } });
      mock.module('@/lib/plex/watchWrite', { namedExports: { getVerifiedOnDeck: async () => plex } });
      mock.module('@/lib/plex/onDeckService', { namedExports: {
        listOnDeckEntries: async (_user, options) => {
          calls.push(options?.maxPlexItems ?? 'all');
          return (options?.verifiedPlexItems ?? plex).slice(0, options?.maxPlexItems ?? plex.length)
            .map(item => ({ type: 'movie', plexRatingKey: item.ratingKey }));
        },
      } });
      const { GET } = await import('@/app/api/plex/on-deck/route');
      const request = new Request('http://localhost/api/plex/on-deck');
      const first = await (await GET(request)).json();
      assert.deepEqual(first.items.map(item => item.plexRatingKey), ['1', '2', '3', '4', '5']);
      assert.deepEqual(calls, [5]);
      for (let i = 0; i < 20 && events.filter(event => event.type === 'on_deck_refreshed').length < 2; i++)
        await new Promise(resolve => setTimeout(resolve, 10));
      const full = await (await GET(request)).json();
      assert.equal(full.items.length, 12);
      assert.deepEqual(calls, [5, 10, 'all']);
      assert.equal(events.filter(event => event.type === 'on_deck_refreshed').length, 2);
      eventBus.emit({ type: 'watch_changed', userId: 'profile-a' });
      const afterWatch = await (await GET(request)).json();
      assert.equal(afterWatch.items.length, 5);
      assert.equal(calls.at(-1), 5);
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("cold On Deck returns local resume within a budget and publishes delayed Plex resumes", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      const events = [];
      let finishPlex;
      const plex = new Promise(resolve => { finishPlex = resolve; });
      mock.module('@/lib/auth/guard', { namedExports: { requireUser: () => ({ id: 'profile-b' }) } });
      mock.module('@/lib/events/EventBus', { namedExports: { eventBus: {
        on: () => {}, emit: event => events.push(event),
      } } });
      mock.module('@/lib/plex/store', { namedExports: { loadPlexConfig: () => ({ hostname: 'plex.local' }) } });
      mock.module('@/lib/plex/watchWrite', { namedExports: { getVerifiedOnDeck: () => plex } });
      mock.module('@/lib/diagnostic/searchLog', { namedExports: { recordSearchLog: () => {} } });
      mock.module('@/lib/plex/onDeckService', { namedExports: {
        listOnDeckEntries: async (_user, options) => options?.verifiedPlexItems?.length
          ? options.verifiedPlexItems.slice(0, options.maxPlexItems ?? Infinity).map(item => ({ plexRatingKey: item.ratingKey }))
          : [{ plexRatingKey: 'local-resume' }],
      } });
      const { GET } = await import('@/app/api/plex/on-deck/route');
      const request = new Request('http://localhost/api/plex/on-deck');
      const start = performance.now();
      const first = await (await GET(request)).json();
      assert.ok(performance.now() - start < 2500, 'cold request exceeded the 2 s Plex budget');
      assert.deepEqual(first.items.map(item => item.plexRatingKey), ['local-resume']);
      finishPlex(Array.from({ length: 5 }, (_, i) => ({ ratingKey: String(i + 1) })));
      for (let i = 0; i < 20 && events.length === 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(events.filter(event => event.type === 'on_deck_refreshed').length, 1);
      const updated = await (await GET(request)).json();
      assert.deepEqual(updated.items.map(item => item.plexRatingKey), ['1', '2', '3', '4', '5']);
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
