import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS, TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { loadIndexers } from "@/lib/indexers/store";
import { countNewlyRateLimited } from "@/lib/indexers/rateLimit";
import { searchIndexer, searchMovie, sanitizeQuery, rescoreRelease } from "@/lib/indexers/torznab";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { IndexerRelease } from "@/lib/indexers/types";
import type { MediaType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Recherche directe = gros consommateur (N indexeurs × fetch HTTP en
 * parallèle). Sans limite, quelques recherches simultanées (plusieurs
 * onglets, plusieurs utilisateurs, ou une recherche pendant une bulk)
 * multiplient les sockets et ralentissent TOUT le serveur — y compris les
 * clics et le chargement des pages. Sémaphore global : 2 recherches directes
 * simultanées au plus ; la suivante attend un slot (≤ 15 s, ensuite elle
 * passe quand même — priorité au résultat utilisateur plutôt qu'à un timeout).
 */
const MAX_MANUAL_SEARCHES = 2;
const MANUAL_SEARCH_WAIT_MS = 15_000;

interface ManualSearchGate {
  active: number;
  waiters: Array<() => void>;
}

const gate =
  (globalThis as typeof globalThis & { __movvizManualSearchGate?: ManualSearchGate }).__movvizManualSearchGate ??= {
    active: 0,
    waiters: [],
  };

function acquireManualSearchSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;
    const release = () => {
      if (timer) clearTimeout(timer);
      gate.active--;
      const next = gate.waiters.shift();
      if (next) next();
    };
    const tryAcquire = () => {
      if (gate.active < MAX_MANUAL_SEARCHES) {
        const idx = gate.waiters.indexOf(tryAcquire);
        if (idx >= 0) gate.waiters.splice(idx, 1);
        gate.active++;
        resolve(release);
        return;
      }
      timer = setTimeout(() => {
        const idx = gate.waiters.indexOf(tryAcquire);
        if (idx >= 0) gate.waiters.splice(idx, 1);
        gate.active++;
        resolve(release);
      }, MANUAL_SEARCH_WAIT_MS);
    };
    gate.waiters.push(tryAcquire);
    tryAcquire();
  });
}

/**
 * Manual search — reads from the RSS cache first (instant), and for an
 * actual typed query (not the query-less "recent releases" browse) falls
 * back to a live direct search when the cache comes up empty. The cache only
 * holds the ~100-150 latest releases across all indexers, so anything not
 * extremely recent never appears there — same gap fixed for auto-grab in
 * autoGrab.ts/autoGrabSeries.ts, applied here too since this is a separate
 * code path that reads the cache on its own.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const qRaw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  // When search is launched from a specific title (its own card/detail page,
  // not the free-text /search box), refTitle is the clean title alone —
  // `q` is that SAME title with the year (movies) or a season/episode code
  // (series) appended, e.g. "“Hurlevent” 2026" or "9-1-1 S09". Confirmed
  // live: sending that combined text as the actual search query returns
  // ZERO results even when the release plainly exists — the title alone
  // finds it fine. So the clean title, not `q`, is what actually gets SENT
  // to an indexer's own text search.
  //
  // But the season/episode code in `q` must NOT simply be discarded: it's
  // the only signal that lets local scoring (rescoreRelease/torznab.ts) tell
  // a right-season release from a wrong-season one. Dropping it here (as a
  // previous version of this route did by using `refTitle || qRaw` for both
  // purposes) meant a "season 7" search scored season 8/9 episodes exactly
  // as high as season 7 ones — nothing left to distinguish them. `matchQuery`
  // keeps that code for scoring; `searchQuery` stays bare for the indexer.
  const refTitle = req.nextUrl.searchParams.get("refTitle")?.trim();
  const searchQuery = sanitizeQuery(refTitle || qRaw);
  const matchQuery = sanitizeQuery(qRaw || refTitle || "");
  const category = req.nextUrl.searchParams.get("category") as MediaType | null;
  const recent = req.nextUrl.searchParams.get("recent") === "1";
  const enabled = loadIndexers().filter((i) => i.enabled);
  // ID-based search params (from a known movie/series detail page)
  const tmdbIdParam = req.nextUrl.searchParams.get("tmdbId");
  const imdbIdParam = req.nextUrl.searchParams.get("imdbId");
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : null;
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  if (enabled.length === 0) {
    return NextResponse.json({ configured: false, releases: [], queried: 0, errors: [] });
  }

  const scope = category === "movie" ? MOVIE_CATEGORY_IDS : category === "series" ? TV_CATEGORY_IDS : undefined;
  const releases = searchFromCache(scope);

  if (recent) {
    const recentList = releases
      .filter((r) => r.score >= 10)
      .sort((a, b) => new Date(b.publishDate ?? 0).getTime() - new Date(a.publishDate ?? 0).getTime())
      .slice(0, 200);
    return NextResponse.json({ configured: true, queried: enabled.length, releases: recentList, errors: [] });
  }

  let filtered = releases;
  if (searchQuery) {
    const lower = searchQuery.toLowerCase();
    filtered = filtered.filter((r) => sanitizeQuery(r.title).toLowerCase().includes(lower));
  }
  // Re-score against the actual matchQuery (title + season/episode when
  // present): the cache was built with NO query context (the hourly RSS scan
  // doesn't know what will be searched later), so its cached score is only a
  // generic quality score — recomputing here is what makes wrong-season /
  // wrong-title releases rank correctly for THIS specific search.
  filtered = filtered.map((r) => rescoreRelease(r, matchQuery)).filter((r) => r.score >= 10);
  filtered.sort((a, b) => b.score - a.score);

  if (searchQuery && filtered.length === 0) {
    // A manual search is one deliberate, user-initiated request — not the
    // recurring background traffic (auto-grab, RSS scan) that the 10-minute
    // reactive cooldown (markRateLimited) exists to protect an indexer from.
    // Confirmed live: C411's cooldown routinely gets tripped by that
    // background load alone, then silently excludes it from manual search
    // for the next 10 minutes too — a title visible on C411's own site
    // came back with nothing in Movviz. The proactive per-minute throttle
    // in fetchXml (torznab.ts) still paces every request against the
    // indexer's documented quota regardless, so skipping the cooldown here
    // doesn't risk actually exceeding it — it only skips the extra
    // precautionary blackout that a real user waiting on a result shouldn't
    // pay for.
    const indexers = enabled.filter((i) => i.protocol === "torrent");
    if (indexers.length > 0) {
      // When the movie/series is known (tmdbId from the detail page), use
      // searchMovie (t=movie&tmdbid=XXX with text fallback) — far more
      // accurate than a plain text query for titles with accents or special
      // chars like "Team Démolition".
      const releaseSlot = await acquireManualSearchSlot();
      let directResults: IndexerRelease[][] = [];
      try {
        directResults = await Promise.all(
          indexers.map((ix) =>
            (category === "movie" && tmdbId
              ? searchMovie(ix, { title: refTitle || qRaw, year, tmdbId, imdbId: imdbIdParam }, scope)
              : searchIndexer(ix, searchQuery, scope, matchQuery)
            ).catch(() => [] as IndexerRelease[])
          )
        );
      } finally {
        releaseSlot();
      }
      const newlyLimited = countNewlyRateLimited(indexers);
      // Bug fix (live report: C411 silently absent from manual search results
      // for a query that DOES exist on C411 — confirmed working seconds later
      // via the auto-grab path, which hits the same indexer). Manual search
      // previously only ever logged one AGGREGATE line across every queried
      // indexer, so a single indexer returning nothing was invisible whenever
      // at least one OTHER indexer found something — exactly this case
      // (Tr4ker had a hit, so manual_search.fallback_match fired and no
      // per-indexer breakdown was ever recorded). Logged unconditionally, one
      // line per indexer, so the next occurrence of "indexer X missing from
      // results" shows raw count vs. score-filtered count immediately instead
      // of requiring a fresh investigation each time.
      indexers.forEach((ix, i) => {
        const raw = directResults[i] ?? [];
        const scored = raw.filter((r) => r.score >= 10);
        recordSearchLog(
          "debug",
          "manual_search.indexer_result",
          `"${searchQuery}" — ${ix.name}: ${raw.length} brut(s), ${scored.length} après filtrage score`
        );
      });
      const direct = directResults.flat().filter((r) => r.score >= 10);
      const seen = new Set<string>();
      filtered = direct
        .filter((r) => { if (seen.has(r.guid)) return false; seen.add(r.guid); return true; })
        .sort((a, b) => b.score - a.score);
      if (filtered.length === 0) {
        if (newlyLimited > 0) {
          recordSearchLog("warn", "manual_search.fallback_rate_limited", `"${searchQuery}" — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
        } else {
          recordSearchLog("info", "manual_search.fallback_empty", `"${searchQuery}" — recherche directe: ${directResults.flat().length} brut(s), 0 résultat après filtrage`);
        }
      } else {
        recordSearchLog("info", "manual_search.fallback_match", `"${searchQuery}" — ${filtered.length} résultat(s) via recherche directe`);
      }
    } else {
      recordSearchLog("warn", "manual_search.no_indexers_available", `"${searchQuery}" — aucun indexeur torrent configuré`);
    }
  }

  return NextResponse.json({
    configured: true,
    queried: enabled.length,
    releases: filtered,
    errors: [],
  });
}
