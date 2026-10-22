import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function isolated(program: string) {
  const result = spawnSync(process.execPath, [
    "--experimental-transform-types", "--no-warnings", "--experimental-test-module-mocks",
    "--import", "./scripts/movviz-test-loader.mjs", "--input-type=module", "-e", program,
  ], { encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr + result.stdout);
}

test("phone adds queue acquisition after approval, including existing missing series, without bypassing permissions or skipSearch", () => {
  isolated(`
    import { mock } from 'node:test';
    import assert from 'node:assert/strict';
    const items = new Map(), requests = [], jobs = [], searches = [];
    const series = { id: 'gintama', tmdbId: 57041, title: 'Gintama', monitored: true,
      seasons: [{ seasonNumber: 1, monitored: true, episodes: [{ monitored: true, status: 'missing' }] }] };
    const movie = { id: 'inception', tmdbId: 27205, title: 'Inception', monitored: true, status: 'missing' };
    mock.module('@/lib/library/store', { namedExports: {
      getMovie: id => items.get(id), getSeries: id => items.get(id),
      getMovieByTmdbId: id => [...items.values()].find(x => !x.seasons && x.tmdbId === id),
      getSeriesByTmdbId: id => [...items.values()].find(x => x.seasons && x.tmdbId === id),
    } });
    async function add(item, options) {
      assert.equal(options.skipSearch, true, 'indexer search must not keep the HTTP add open');
      items.set(item.id, item); options.onAdded(item);
      return item.seasons ? { series: item, searchResult: null } : { movie: item, searchResult: null };
    }
    mock.module('@/lib/library/autoGrab', { namedExports: {
      addMovieToLibrary: async (_id, _q, options) => add(movie, options),
      searchAndGrabMovie: async id => { searches.push(id); return { ok: true }; },
    } });
    mock.module('@/lib/library/autoGrabSeries', { namedExports: {
      addSeriesToLibrary: async (_id, _q, _seasons, options) => add(series, options),
      searchAndGrabSeries: async id => { searches.push(id); return { ok: true }; },
    } });
    mock.module('@/lib/jobs/queue', { namedExports: {
      activeJobForSource: source => jobs.find(j => j.source === source && j.active),
      isJobCancelled: () => false,
      enqueueJob: (_type, _label, _total, runner, source, options) => {
        assert.equal(options.immediate, true);
        assert.notEqual(options.heavy, true, 'single-title acquisition must not wait for bulk tasks');
        assert.ok(requests.length, 'approved request exists before any job is queued');
        const job = { id: String(jobs.length), active: true, source, runner }; jobs.push(job); return job;
      },
    } });
    mock.module('@/lib/requests/store', { namedExports: { addRequest: r => { requests.push(r); return r; }, loadRequests: () => requests } });
    mock.module('@/lib/metadata/tmdb', { namedExports: { getMovie: async () => movie, getSeries: async () => series } });
    mock.module('@/lib/activity/store', { namedExports: { logActivity: () => {} } });
    let blocked = false;
    mock.module('@/lib/blocklist/store', { namedExports: { isBlocked: () => blocked } });
    mock.module('@/lib/library/trashStore', { namedExports: { loadTrash: () => [], restoreFromTrash: () => {} } });
    const { requestMedia } = await import('@/lib/requests/requestMedia');
    const admin = { id: 'admin', username: 'Admin', role: 'admin' };
    const first = await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(first.added.id, 'gintama'); assert.equal(first.searchResult.queued, true);
    assert.equal(requests[0].status, 'approved'); assert.deepEqual(searches, []);
    // A repeated tap shares the queued job, then the server runs it after the HTTP response.
    const second = await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(second.searchResult.jobId, first.searchResult.jobId); assert.equal(jobs.length, 1);
    await jobs[0].runner(() => {}, { jobId: jobs[0].id }); jobs[0].active = false;
    assert.deepEqual(searches, ['gintama']);
    const retry = await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(retry.alreadyInLibrary, true); assert.equal(jobs.length, 2);
    await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true, skipSearch: true });
    await requestMedia({ ...admin, role: 'user', autoApproveRequests: false }, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(jobs.length, 2, 'link-only adds and users without auto-approval cannot launch downloads');
    jobs[1].active = false;
    series.seasons[0].episodes[0].status = 'available';
    await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(jobs.length, 2, 'available titles are never downloaded again');
    const addedMovie = await requestMedia(admin, 'movie', movie.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(addedMovie.searchResult.queued, true);
    await jobs[2].runner(() => {}, { jobId: jobs[2].id }); assert.deepEqual(searches, ['gintama', 'inception']);
    blocked = true;
    assert.equal((await requestMedia(admin, 'series', series.tmdbId, undefined, undefined, { queueSearch: true })).blocked, true);
    assert.equal(jobs.length, 3);
    blocked = false; items.clear(); requests.length = 0;
    const pending = await requestMedia({ id: 'user', username: 'User', role: 'user' }, 'series', series.tmdbId, undefined, undefined, { queueSearch: true });
    assert.equal(pending.pendingRequest.status, 'pending'); assert.equal(jobs.length, 3);
  `);
});

test("Gintama: real series creation and queued search fall back from integral to season packs and send each season to the engine", () => {
  isolated(`
    import { mock } from 'node:test';
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { parseRelease } from '@/lib/naming/parser';
    const library = new Map(), jobs = [], sent = [], requests = [];
    const releases = [1, 2].map(season => ({ title: 'Gintama.S0' + season + '.MULTi.1080p.WEB-DL.x264-GRP',
      guid: 'season-' + season, infoHash: String(season).repeat(40), score: 100, size: 1000000000, indexerId: 'fixture', magnetUrl: 'magnet:?xt=urn:btih:' + String(season).repeat(40) }));
    const overrides = {
      getSeries: id => library.get(id), getSeriesByTmdbId: () => [...library.values()][0],
      addSeries: item => { library.set(item.id, item); return item; },
      updateSeries: (id, patch) => { const item = { ...library.get(id), ...patch }; library.set(id, item); return item; },
      loadSeries: () => [...library.values()], getMovieByTmdbId: () => null,
      getMovie: () => null,
      getSeason: async (_id, season) => ({ episodes: [1, 2].map(episodeNumber => ({ seasonNumber: season, episodeNumber, title: 'Episode ' + episodeNumber, airDate: '2006-04-04' })) }),
      tvdbConfigured: () => false, specialsEnabled: () => false,
      searchFromCache: () => releases, loadIndexers: () => [], withoutRateLimited: items => items, countNewlyRateLimited: () => 0,
      loadReleaseRules: () => ({ sizePreference: 'balanced' }), withinSizeLimit: () => true,
      compareBySizePreference: () => 0, isBlockedForAutoGrab: () => ({ blocked: false }),
      isRecentlyFailedRelease: () => false,
      getReleaseMatchPool: () => ({ run: async ({ releases: raw, seasonNumber, episodeNumber, filterPack }) => {
        const survivors = raw.map((r, idx) => ({ idx, parsed: parseRelease(r.title) }))
          .filter(({ parsed }) => parsed.season === seasonNumber && (filterPack ? parsed.episode == null : parsed.episode === episodeNumber));
        return { survivors, titleCount: raw.length, secondCount: survivors.length, packCount: survivors.length };
      } }),
      buildGrabPayload: r => ({ magnetUrl: r.magnetUrl }),
      engineHeaders: () => ({}), ENGINE_BASE: 'http://engine.fixture', ENGINE_TIMEOUT_MS: 1000,
      COMPLETE_SERIES_TERMS: ['Complete', 'Integrale'],
      notifySeerrProcessingOnce: async () => {},
      activeJobForSource: () => null, isJobCancelled: () => false,
      enqueueJob: (_type, _label, _total, runner) => { const job = { id: 'acquire', runner }; jobs.push(job); return job; },
      addRequest: r => { requests.push(r); return r; }, loadRequests: () => requests,
      isBlocked: () => false, loadTrash: () => [], restoreFromTrash: () => {},
    };
    // Keep the real orchestration, locks, parsing, release matching and date/profile
    // rules. Replace I/O boundaries only; fixtures never touch user data/indexers.
    const keep = new Set(['@/lib/library/types', '@/lib/library/qualityProfiles', '@/lib/naming/parser', '@/lib/naming/types',
      '@/lib/library/matching', '@/lib/library/locks', '@/lib/library/releaseSchedule', '@/lib/indexers/categories',
      '@/lib/library/autoGrabSeries', '@/lib/requests/queueAcquisition',
      '@/lib/library/bleachEngine', '@/lib/library/bleachRelease', '@/lib/metadata/bleachEpisodeOrder']);
    const modules = new Map();
    for (const file of ['src/lib/library/autoGrabSeries.ts', 'src/lib/requests/requestMedia.ts', 'src/lib/requests/queueAcquisition.ts']) {
      for (const m of readFileSync(file, 'utf8').matchAll(/import \\{([^}]+)\\} from "([^"]+)";/g)) {
        if (keep.has(m[2])) continue;
        const exports = modules.get(m[2]) ?? {};
        for (const entry of m[1].split(',').map(s => s.trim()).filter(s => !s.startsWith('type '))) {
          const name = entry.split(/\\s+as\\s+/)[0]; exports[name] = overrides[name] ?? (() => {});
        }
        modules.set(m[2], exports);
      }
    }
    modules.get('@/lib/metadata/tmdb').getSeries = async () => ({ tmdbId: 57041, title: 'Gintama', originalTitle: '銀魂', year: 2006,
      isAnime: true, seasons: [1, 2].map(seasonNumber => ({ seasonNumber, name: 'Saison ' + seasonNumber })) });
    modules.get('@/lib/metadata/tmdb').findByExternalId = async () => { throw Error('unexpected external identity lookup for Gintama'); };
    for (const [name, namedExports] of modules) mock.module(name, { namedExports });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'http://engine.fixture/torrents');
      const body = JSON.parse(options.body); sent.push(body);
      return { ok: true, json: async () => ({ infoHash: String(sent.length).repeat(40) }) };
    };
    const { requestMedia } = await import('@/lib/requests/requestMedia');
    const result = await requestMedia({ id: 'admin', username: 'Admin', role: 'admin' }, 'series', 57041, undefined, undefined, { queueSearch: true });
    assert.equal(result.searchResult.queued, true); assert.equal(sent.length, 0); assert.equal(requests.length, 1);
    await jobs[0].runner(() => {}, { jobId: 'acquire' });
    assert.equal(sent.length, 2, 'both season packs must be handed to the engine');
    assert.deepEqual(sent.map(b => b.episodeTargets), [[{season:1,episode:1},{season:1,episode:2}], [{season:2,episode:1},{season:2,episode:2}]]);
    assert.ok([...library.values()][0].seasons.every(s => s.episodes.every(e => e.status === 'downloading' && e.activeInfoHash)));

    // The real auto-grab pipeline must not take the classic show's yearless
    // season pack just because both shows are called Scrubs and have an S02.
    const template = [...library.values()][0];
    const reboot = { ...template, id: 'scrubs-2026', tmdbId: 295778, title: 'Scrubs', originalTitle: 'Scrubs', year: 2026,
      seasons: [{ seasonNumber: 2, monitored: true, episodes: [1, 2].map(episodeNumber => ({
        seasonNumber: 2, episodeNumber, title: 'Episode ' + episodeNumber, monitored: true,
        status: 'missing', file: null, activeInfoHash: null, airDate: '2026-01-01'
      })) }] };
    library.clear(); library.set(reboot.id, reboot);
    library.set('scrubs-2001', { ...template, id: 'scrubs-2001', tmdbId: 4556, title: 'Scrubs', originalTitle: 'Scrubs', year: 2001 });
    const release = title => ({ ...releases[0], title });
    releases.splice(0, releases.length, release('Scrubs.S02.MULTi.1080p.WEB-DL'), release('Scrubs.2001.S02.MULTi.1080p.WEB-DL'));
    const { searchAndGrabSeason, searchCompleteSeriesCandidates } = await import('@/lib/library/autoGrabSeries');
    const before = sent.length;
    await searchAndGrabSeason(reboot.id, 2, { skipSeriesPackRetry: true });
    assert.equal(sent.length, before, 'ambiguous and classic packs must never reach the engine');
    releases.push(release('Scrubs.2026.S02.MULTi.1080p.WEB-DL'));
    await searchAndGrabSeason(reboot.id, 2, { skipSeriesPackRetry: true });
    assert.equal(sent.length, before + 1, 'the correctly dated reboot pack is downloaded');
    releases.splice(0, releases.length, ...[null, 2001, 2026].map(year => release('Scrubs.' + (year ? year + '.' : '') + 'Complete.Series.1080p.WEB-DL')));
    const complete = await searchCompleteSeriesCandidates(reboot, { allowedResolutions: ['1080p'], minScore: 0 });
    assert.deepEqual(complete.candidates.map(c => c.release.title), ['Scrubs.2026.Complete.Series.1080p.WEB-DL']);
  `);
});

test("approval queues search only after a successful add and keeps failed requests pending", () => {
  isolated(`
    import { mock } from 'node:test';
    import assert from 'node:assert/strict';
    import { NextRequest } from 'next/server';
    let allowed = false, fail = true, queued = 0;
    const request = { id: 'req', status: 'pending', type: 'series', tmdbId: 57041, title: 'Gintama' };
    mock.module('@/lib/auth/guard', { namedExports: { requireUser: () => ({ username: 'Admin', role: allowed ? 'admin' : 'user' }) } });
    mock.module('@/lib/requests/store', { namedExports: { getRequest: () => request, updateRequest: (_id, patch) => Object.assign(request, patch) } });
    mock.module('@/lib/library/autoGrab', { namedExports: { addMovieToLibrary: async () => { throw Error('unexpected movie'); } } });
    mock.module('@/lib/library/autoGrabSeries', { namedExports: { addSeriesToLibrary: async (_id, _q, _s, options) => {
      assert.equal(options.skipSearch, true);
      return fail ? { error: 'unavailable' } : { series: { id: 'gintama' } };
    } } });
    mock.module('@/lib/notifications/store', { namedExports: { emitNotification: () => {} } });
    mock.module('@/lib/activity/store', { namedExports: { logActivity: () => {} } });
    mock.module('@/lib/requests/queueAcquisition', { namedExports: { queueAcquisition: () => {
      assert.equal(request.status, 'approved'); queued++; return { queued: true, jobId: 'acquire' };
    } } });
    const { POST } = await import('@/app/api/requests/[id]/approve/route');
    const post = () => POST(new NextRequest('http://localhost/api/requests/req/approve', { method: 'POST' }), { params: Promise.resolve({ id: 'req' }) });
    assert.equal((await post()).status, 403); assert.equal(queued, 0);
    allowed = true;
    assert.equal((await post()).status, 502); assert.equal(request.status, 'pending'); assert.equal(queued, 0);
    fail = false;
    const success = await post(); assert.equal(success.status, 200);
    assert.equal((await success.json()).searchResult.queued, true); assert.equal(queued, 1);
    assert.equal((await post()).status, 400); assert.equal(queued, 1);
  `);
});
