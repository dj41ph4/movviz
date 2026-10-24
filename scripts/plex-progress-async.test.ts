import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Plex progress is sent after the player response without holding playback", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", `
      import { mock } from 'node:test';
      import assert from 'node:assert/strict';
      let resolveAuth;
      const auth = new Promise(resolve => { resolveAuth = resolve; });
      const sent = [];
      mock.module('@/lib/auth/guard', { namedExports: { requireUser: () => ({ id: 'profile-a' }) } });
      mock.module('@/lib/plex/store', { namedExports: { loadPlexConfig: () => ({ hostname: 'plex.local', port: 32400, useSsl: false }) } });
      mock.module('@/lib/plex/safeUrl', { namedExports: { safePlexUrl: value => value } });
      mock.module('@/lib/plex/watchWrite', { namedExports: { resolvePlexServerAuth: () => auth } });
      mock.method(globalThis, 'fetch', async (url, options) => { sent.push({ url: String(url), token: options.headers['X-Plex-Token'] }); return new Response('', { status: 200 }); });
      const { POST } = await import('@/app/api/stream/[ratingKey]/progress/route');
      const started = performance.now();
      const response = await POST(new Request('http://localhost/api/stream/42/progress', {
        method: 'POST', body: JSON.stringify({ offset: 120000, state: 'paused' }),
      }), { params: Promise.resolve({ ratingKey: '42' }) });
      assert.equal(response.status, 200);
      assert.ok(performance.now() - started < 250, 'the player waited for Plex authentication');
      assert.equal(sent.length, 0);
      resolveAuth({ token: 'profile-token' });
      for (let i = 0; i < 20 && sent.length === 0; i++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(sent.length, 1);
      assert.equal(sent[0].token, 'profile-token');
      assert.match(sent[0].url, /time=120000/);
    `,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});
