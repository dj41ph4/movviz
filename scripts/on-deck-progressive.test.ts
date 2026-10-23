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
