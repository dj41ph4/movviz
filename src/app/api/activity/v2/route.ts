import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { loadActivityV2 } from "@/lib/activity/v2/store";
import { loadActivity } from "@/lib/activity/store";
import { getIndexer } from "@/lib/indexers/store";
import { loadMovies, loadSeries, libraryFilePaths } from "@/lib/library/store";
import { memoizeByFileMtimes } from "@/lib/fsJsonCache";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import type { ActivityEntry, QueueItem, WantedItem, ActivityMedia } from "@/lib/activity/v2/types";
import type { EngineTorrent } from "@/lib/types";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
/** Source files behind buildReleaseLookup — it only needs recomputing when one of them changes. */
const RELEASE_LOOKUP_FILES = [
  path.join(CONFIG_DIR, "activity.json"),
  path.join(CONFIG_DIR, "activity-v2.json"),
  path.join(CONFIG_DIR, "indexers.json"),
];

export const dynamic = "force-dynamic";

async function fetchEngine(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${ENGINE_BASE}/${path}`, {
      headers: engineHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") as "queue" | "history" | "failures" | "wanted" | "unlinked" | null;

  try {
    switch (tab) {
      case "queue":
        return await getQueue();
      case "history":
        return await getHistory();
      case "failures":
        return await getFailures();
      case "wanted":
        return await getWanted();
      case "unlinked":
        return await getUnlinked();
      default:
        return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface ResolvedRelease {
  indexer: string;
  quality: string;
  score: number;
  seeders: number;
  leechers: number;
}

/**
 * Every real grab already records its actual indexer/quality/score — in the
 * v2 log for a manual pick from Search, in the legacy log (as an indexer id)
 * for an automatic grab. getQueue() used to ignore both and fabricate a
 * value instead ("YGG" for a movie, "Torrent9" for a series, always
 * "1080p"/"720p") — invented data shown as fact. This looks the real record
 * up by infoHash, newest first, and only falls back to parsing the release
 * title (or "Inconnu") when truly nothing was ever recorded for it — e.g. a
 * torrent added by hand outside Movviz's own search/grab flow.
 */
/**
 * Keyed by infoHash (primary) and by libraryRef (fallback, e.g.
 * "movie:mv_xxx" or "episode:sr_xxx:1:2") — the engine can end up reporting
 * a different infoHash representation than what got logged at grab time for
 * the same torrent (hybrid v1/v2 BitTorrent hashes), so infoHash alone can
 * miss a release Movviz genuinely searched for and grabbed itself. libraryRef
 * isn't derived from the torrent at all, so it isn't affected by that.
 */
function buildReleaseLookup(): { byHash: Map<string, ResolvedRelease>; byLibraryRef: Map<string, ResolvedRelease> } {
  return memoizeByFileMtimes("activity-v2-release-lookup", RELEASE_LOOKUP_FILES, buildReleaseLookupImpl);
}

function buildReleaseLookupImpl(): { byHash: Map<string, ResolvedRelease>; byLibraryRef: Map<string, ResolvedRelease> } {
  const byHash = new Map<string, ResolvedRelease>();
  const byLibraryRef = new Map<string, ResolvedRelease>();

  // Legacy log first (oldest source) so the v2 log below — checked second —
  // wins on any overlapping key, since it's the more complete record.
  for (const entry of loadActivity()) {
    const hash = entry.details?.infoHash;
    const ref = entry.details?.libraryRef;
    if (!hash && !ref) continue;
    const indexerId = entry.details?.indexer;
    const indexerName = indexerId ? (getIndexer(indexerId)?.name ?? indexerId) : "Inconnu";
    const quality = extractResolution(entry.details?.releaseTitle ?? "") ?? "Inconnu";
    const resolved = { indexer: indexerName, quality, score: 0, seeders: 0, leechers: 0 };
    if (hash && !byHash.has(hash)) byHash.set(hash, resolved);
    if (ref && !byLibraryRef.has(ref)) byLibraryRef.set(ref, resolved);
  }

  for (const entry of loadActivityV2()) {
    const hash = entry.download?.infoHash;
    const rawRef = entry.metadata?.libraryRef;
    const ref = typeof rawRef === "string" ? rawRef : undefined;
    if (!entry.release || (!hash && !ref)) continue;
    const resolved = {
      indexer: entry.release.indexer || "Inconnu",
      quality: entry.release.quality || "Inconnu",
      score: entry.release.score ?? 0,
      seeders: entry.release.seeders ?? 0,
      leechers: entry.release.leechers ?? 0,
    };
    if (hash) byHash.set(hash, resolved);
    if (ref) byLibraryRef.set(ref, resolved);
  }

  return { byHash, byLibraryRef };
}

interface HashIndexEntry {
  movie?: LibraryMovie;
  seriesMatch?: { series: LibrarySeries; season: number; episode: number; count: number };
}

/**
 * infoHash → owning library item, built in ONE pass over the whole library
 * and memoized until a library file actually changes. getQueue() used to
 * re-scan every episode of every series PER TORRENT on every 3 s poll —
 * with ~640 series (~42 000 episodes) and a handful of active torrents,
 * that was hundreds of thousands of episode iterations per poll, a real
 * chunk of the latency the queue tab showed on the NAS.
 *
 * A season pack shares one activeInfoHash across several episodes — every
 * one of them is collected so the queue can say "season pack, N episodes"
 * instead of silently picking the first and looking stuck on one episode.
 */
function buildHashIndex(): Map<string, HashIndexEntry> {
  return memoizeByFileMtimes("activity-v2-hash-index", libraryFilePaths(), () => {
    const index = new Map<string, HashIndexEntry>();
    for (const movie of loadMovies()) {
      if (movie.activeInfoHash) index.set(movie.activeInfoHash, { movie });
    }
    for (const s of loadSeries()) {
      const matchesByHash = new Map<string, { season: number; episode: number }[]>();
      let totalMonitored = 0;
      for (const season of s.seasons) {
        for (const ep of season.episodes) {
          if (ep.monitored) totalMonitored++;
          if (ep.activeInfoHash) {
            const list = matchesByHash.get(ep.activeInfoHash) ?? [];
            list.push({ season: season.seasonNumber, episode: ep.episodeNumber });
            matchesByHash.set(ep.activeInfoHash, list);
          }
        }
      }
      for (const [hash, matches] of matchesByHash) {
        // A movie owning the same hash keeps priority — same precedence as
        // the old sequential scan (movie checked first).
        if (index.has(hash)) continue;
        const isComplete = totalMonitored > 0 && matches.length >= totalMonitored;
        index.set(hash, {
          seriesMatch: {
            series: s,
            season: isComplete ? 0 : matches[0].season,
            episode: isComplete ? 0 : matches[0].episode,
            count: matches.length,
          },
        });
      }
    }
    return index;
  });
}

async function getQueue(): Promise<NextResponse<{ items: QueueItem[] }>> {
  const engineData = await fetchEngine("torrents") as { torrents?: EngineTorrent[] } | null;
  const torrents = engineData?.torrents ?? [];
  const hashIndex = buildHashIndex();
  const { byHash: releaseByHash, byLibraryRef: releaseByLibraryRef } = buildReleaseLookup();

  const items: QueueItem[] = torrents
    .filter(t => t.state !== "seeding" && t.state !== "completed")
    .map(t => {
      const { movie, seriesMatch } = hashIndex.get(t.infoHash) ?? {};

      const media: ActivityMedia = movie
        ? { id: movie.id, title: movie.title, type: "movie", href: `/title/movie/${movie.tmdbId}` }
        : seriesMatch
          ? {
              id: seriesMatch.series.id, title: seriesMatch.series.title, type: "series",
              season: seriesMatch.season, episode: seriesMatch.episode,
              packEpisodeCount: seriesMatch.count > 1 ? seriesMatch.count : undefined,
              href: `/title/series/${seriesMatch.series.tmdbId}`,
            }
          : { id: t.infoHash, title: t.name, type: "movie", href: "#" };

      // t.timeRemaining is milliseconds (engine's summary()); QueueItem.download.eta
      // is documented/consumed as seconds everywhere downstream, so convert here.
      const eta = t.timeRemaining != null ? Math.round(t.timeRemaining / 1000) : 0;
      // The engine records the real add time of every torrent — use it. The
      // ETA-based guess only remains for a torrent predating that field.
      const addedAt = t.addedAt ?? Date.now() - (eta > 0 ? eta * 1000 : 3600000);
      // infoHash first (most direct); libraryRef as a fallback for the rare
      // case where the engine's reported hash doesn't match what got logged
      // at grab time — libraryRef isn't derived from the torrent, so it's
      // immune to that. See buildReleaseLookup().
      const resolved = releaseByHash.get(t.infoHash) ?? (t.libraryRef ? releaseByLibraryRef.get(t.libraryRef) : undefined);

      return {
        id: t.infoHash,
        media,
        release: {
          indexer: resolved?.indexer ?? "Inconnu",
          releaseTitle: t.name,
          protocol: "torrent" as const,
          size: t.size,
          seeders: t.numPeers,
          leechers: 0,
          age: 0,
          score: resolved?.score ?? 0,
          quality: resolved?.quality ?? extractResolution(t.name) ?? "Inconnu",
          customFormats: []
        },
        download: {
          client: "qBittorrent",
          infoHash: t.infoHash ?? "",
          progress: t.progress,
          downloadSpeed: t.downloadSpeed,
          uploadSpeed: t.uploadSpeed,
          eta,
          ratio: t.ratio ?? 0,
          peers: t.numPeers,
          state: (t.state === "metadata" ? "downloading" : t.state) as "downloading" | "paused" | "queued" | "completed" | "seeding" | "stalled"
        },
        status: t.state === "paused" ? "paused" : t.state === "stalled" ? "stalled" : t.state === "queued" ? "queued" : "downloading",
        addedAt
      };
    });

  return NextResponse.json({ items });
}

async function getHistory(): Promise<NextResponse<{ items: ActivityEntry[]; total: number }>> {
  const entries = loadActivityV2();
  return NextResponse.json({ items: entries, total: entries.length });
}

async function getFailures(): Promise<NextResponse<{ items: ActivityEntry[]; total: number }>> {
  const entries = loadActivityV2().filter(e => e.kind === "failed");
  return NextResponse.json({ items: entries, total: entries.length });
}

/**
 * Files that finished downloading, got renamed/moved onto disk, but were
 * never tied to a library item — a manual magnet/torrent add with no
 * movie/series picked, or any other grab that reached the engine without a
 * libraryRef. See src/app/api/library/manual-link/route.ts for how these get
 * resolved from here.
 */
async function getUnlinked(): Promise<NextResponse<{ items: ActivityEntry[]; total: number }>> {
  const entries = loadActivityV2().filter(e => e.kind === "imported" && e.import && e.media.href === "#");
  return NextResponse.json({ items: entries, total: entries.length });
}

function resolveQualityProfile(profileId: string) {
  return DEFAULT_QUALITY_PROFILES.find(p => p.id === profileId) ?? DEFAULT_QUALITY_PROFILES[0];
}

/** Best human-readable quality label for a resolution cutoff, e.g. "Ultra-HD (2160p)". */
function formatTargetQuality(profile: { name: string; cutoffResolution: string }): string {
  return `${profile.name} (${profile.cutoffResolution})`;
}

/** True when a file's resolution is at or above the profile's cutoff. */
function isCutoffMet(profile: { cutoffResolution: string }, fileResolution: string | null): boolean {
  const order = ["480p", "720p", "1080p", "1440p", "2160p"];
  const fileIdx = order.indexOf(fileResolution ?? "");
  const cutoffIdx = order.indexOf(profile.cutoffResolution);
  if (fileIdx < 0 || cutoffIdx < 0) return false;
  return fileIdx >= cutoffIdx;
}

function extractResolution(qualityStr: string): string | null {
  const m = qualityStr.match(/\b(4320p|2160p|1440p|1080p|720p|480p)\b/i);
  return m ? m[0].toLowerCase() : null;
}

async function getWanted(): Promise<NextResponse<{ missing: WantedItem[]; cutoffUnmet: WantedItem[] }>> {
  const result = memoizeByFileMtimes("activity-v2-wanted", libraryFilePaths(), computeWanted);
  return NextResponse.json(result);
}

function computeWanted(): { missing: WantedItem[]; cutoffUnmet: WantedItem[] } {
  const movies = loadMovies();
  const series = loadSeries();

  const missing: WantedItem[] = [];
  const cutoffUnmet: WantedItem[] = [];

  // Movies
  for (const movie of movies) {
    if (!movie.monitored) continue;
    const profile = resolveQualityProfile(movie.qualityProfileId);
    const targetLabel = formatTargetQuality(profile);

    if (movie.status === "missing") {
      missing.push({
        media: {
          id: movie.id,
          title: movie.title,
          type: "movie",
          href: `/title/movie/${movie.tmdbId}`
        },
        monitored: true,
        status: "missing",
        targetQuality: targetLabel,
        releaseDate: movie.releaseDate ?? undefined,
        lastSearch: movie.addedAt
      });
    } else if (movie.status === "available" && movie.file) {
      const fileRes = extractResolution(movie.file.quality);
      if (!isCutoffMet(profile, fileRes)) {
        cutoffUnmet.push({
          media: {
            id: movie.id,
            title: movie.title,
            type: "movie",
            href: `/title/movie/${movie.tmdbId}`
          },
          monitored: true,
          status: "cutoff_unmet",
          currentQuality: movie.file.quality,
          targetQuality: targetLabel,
          releaseDate: movie.releaseDate ?? undefined,
          lastSearch: movie.addedAt
        });
      }
    }
  }

  // Series episodes
  for (const s of series) {
    if (!s.monitored) continue;
    const profile = resolveQualityProfile(s.qualityProfileId);
    const targetLabel = formatTargetQuality(profile);

    for (const season of s.seasons) {
      for (const ep of season.episodes) {
        if (!ep.monitored) continue;
        if (ep.status === "missing") {
          missing.push({
            media: {
              id: s.id,
              title: s.title,
              type: "series",
              season: season.seasonNumber,
              episode: ep.episodeNumber,
              href: `/title/series/${s.tmdbId}`
            },
            monitored: true,
            status: "missing",
            targetQuality: targetLabel,
            releaseDate: ep.airDate ?? undefined
          });
        } else if (ep.status === "available" && ep.file) {
          const fileRes = extractResolution(ep.file.quality);
          if (!isCutoffMet(profile, fileRes)) {
            cutoffUnmet.push({
              media: {
                id: s.id,
                title: s.title,
                type: "series",
                season: season.seasonNumber,
                episode: ep.episodeNumber,
                href: `/title/series/${s.tmdbId}`
              },
              monitored: true,
              status: "cutoff_unmet",
              currentQuality: ep.file.quality,
              targetQuality: targetLabel,
              releaseDate: ep.airDate ?? undefined,
              lastSearch: ep.file.addedAt
            });
          }
        }
      }
    }
  }

  return { missing, cutoffUnmet };
}

