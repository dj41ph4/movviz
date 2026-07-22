import fs from "node:fs";
import { platform } from "node:os";
import { loadMovies, loadSeries, updateMovie, updateSeriesList } from "./store";
import { pathFor } from "./renamePath";
import { walkVideoFiles, engineRoots } from "./indexScan";
import { loadNamingTemplates } from "@/lib/naming/store";
import { renderSegment } from "@/lib/naming/render";
import { parseRelease } from "@/lib/naming/parser";
import type { NamingContext, NamingTemplates } from "@/lib/naming/types";
import type { LibraryMovie, LibraryEpisode, LibrarySeries } from "./types";

/**
 * Two paths that resolve to the same physical file (bind‑mount mirror or
 * Windows drive‑letter remap) are identical to us — if the recorded path is
 * dead we should accept the first live copy silently instead of asking the
 * user to "repair" a non‑issue.
 *
 *   Linux / Mac  →  device + inode  (statSync)
 *   Windows      →  realpathSync.native()  (resolves Z:\ → \\NAS\…)
 */
function physicalIdentityKey(filePath: string): string | null {
  try {
    if (platform() === "win32") {
      const real = fs.realpathSync.native(filePath);
      return `real:${real.toLowerCase()}`;
    }
    const st = fs.statSync(filePath);
    return `ino:${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
}

function dedupeByFileIdentity(paths: string[]): string[] {
  if (paths.length < 2) return paths;
  const seen = new Set<string>();
  return paths.filter((p) => {
    const key = physicalIdentityKey(p);
    if (key !== null) {
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });
}

/**
 * Number of trailing path segments that the two paths share (case‑insensitive).
 * Returns 0 when the shortest‑known non‑empty suffix is shorter than 2 — it
 * takes at least a parent folder + filename to call two paths the same file.
 */
function commonSuffixDepth(a: string, b: string, minDepth = 2): number {
  const sep = pathFor(a).sep;
  const aParts = a.split(sep).filter(Boolean);
  const bParts = b.split(sep).filter(Boolean);
  let i = aParts.length - 1;
  let j = bParts.length - 1;
  let depth = 0;
  while (i >= 0 && j >= 0) {
    if (aParts[i].toLowerCase() !== bParts[j].toLowerCase()) break;
    depth++;
    i--;
    j--;
  }
  return depth >= minDepth ? depth : 0;
}

/**
 * Where the current naming templates would place this movie's file today,
 * one candidate per configured movie root. Checked with a plain fs.existsSync
 * before falling back to filename search — a file that was already renamed
 * (new title, new format) sits at exactly this path even though its name no
 * longer matches the stale one recorded in the library.
 */
function computeExpectedMoviePaths(movie: LibraryMovie, roots: string[], templates: NamingTemplates): string[] {
  if (!movie.file) return [];
  const useDots = templates.useDotsInsteadOfSpaces;
  const ctx: NamingContext = {
    title: movie.title,
    year: movie.year ? String(movie.year) : null,
    season: null,
    episode: null,
    episodeTitle: null,
    quality: movie.file.quality ?? "",
    resolution: movie.file.resolution ?? null,
    source: null,
    videoCodec: null,
    audioCodec: null,
    hdr: null,
    group: null,
  };
  const expectedFolder = renderSegment(templates.movieFolder, ctx, useDots);
  const expectedFile = renderSegment(templates.movieFile, ctx, useDots);
  const ext = pathFor(movie.file.path).extname(movie.file.path);
  return roots.map((root) => pathFor(root).join(root, expectedFolder, expectedFile + ext));
}

/** Same idea as computeExpectedMoviePaths, for a single series episode. */
function computeExpectedEpisodePaths(
  series: LibrarySeries,
  ep: LibraryEpisode,
  roots: string[],
  templates: NamingTemplates
): string[] {
  if (!ep.file) return [];
  const useDots = templates.useDotsInsteadOfSpaces;
  const p = pathFor(ep.file.path);
  const parsed = parseRelease(p.basename(ep.file.path));
  const ctx: NamingContext = {
    title: series.title,
    year: series.year ? String(series.year) : null,
    season: ep.seasonNumber,
    episode: ep.episodeNumber,
    episodeTitle: ep.title || null,
    quality: ep.file.quality ?? "",
    resolution: parsed.resolution ?? ep.file.resolution,
    source: parsed.source,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    hdr: parsed.hdr,
    group: parsed.group,
  };
  const seriesFolderCtx: NamingContext = { ...ctx, season: null, episode: null };
  const expectedSeriesFolder = renderSegment(templates.seriesFolder, seriesFolderCtx, useDots);
  const seasonFolder = renderSegment(templates.seasonFolder, ctx, useDots);
  const epFile = renderSegment(templates.episodeFile, ctx, useDots);
  const ext = p.extname(ep.file.path);
  return roots.map((root) => pathFor(root).join(root, expectedSeriesFolder, seasonFolder, epFile + ext));
}

export interface RepairCandidate {
  id: string;
  type: "movie" | "series";
  title: string;
  /** For series: which episode this row is about. */
  season?: number;
  episode?: number;
  oldPath: string;
  /** null when no usable match was found; multiple entries mean an ambiguous match (same filename in more than one place) that needs a human to pick. */
  matches: string[];
  /** True when this candidate's single match is also the sole match of at least one other broken record — auto-relinking both would point two different library entries at the same file. */
  contested?: boolean;
}

/**
 * Files whose recorded path doesn't exist are matched back to reality by
 * filename alone — moving a batch of files out of their per-title
 * subfolders into one flat folder (e.g. a manual recovery after a botched
 * rename) doesn't usually rename the files themselves, so the original
 * basename is still the most reliable anchor available. Two different
 * tracked items sharing an identical filename would produce an ambiguous
 * match (multiple candidates) — never guessed, always left for manual
 * confirmation.
 */
export async function scanRepairCandidates(): Promise<RepairCandidate[]> {
  const movieRoots = await engineRoots("movie");
  const seriesRoots = await engineRoots("series");
  const allRoots = [...new Set([...movieRoots, ...seriesRoots])];
  const templates = loadNamingTemplates();

  const byBasename = new Map<string, string[]>();
  for (const root of allRoots) {
    for (const file of walkVideoFiles(root)) {
      const base = pathFor(file).basename(file).toLowerCase();
      const list = byBasename.get(base);
      if (list) list.push(file);
      else byBasename.set(base, [file]);
    }
  }

  const candidates: RepairCandidate[] = [];

  for (const movie of loadMovies()) {
    if (!movie.file || fs.existsSync(movie.file.path)) continue;

    // The file may already sit exactly where the current naming templates would
    // put it — this happens when it went through a rename after the recorded
    // path was left behind, so the old filename itself no longer exists anywhere.
    const expected = computeExpectedMoviePaths(movie, movieRoots, templates).filter((p) => fs.existsSync(p));
    if (expected.length > 0) {
      const deduped = dedupeByFileIdentity(expected);
      if (deduped.length === 1 && commonSuffixDepth(movie.file.path, deduped[0])) {
        updateMovie(movie.id, { file: { ...movie.file, path: deduped[0] } });
        continue;
      }
      candidates.push({ id: movie.id, type: "movie", title: movie.title, oldPath: movie.file.path, matches: deduped });
      continue;
    }

    const base = pathFor(movie.file.path).basename(movie.file.path).toLowerCase();
    const matches = dedupeByFileIdentity(
      (byBasename.get(base) ?? []).filter((m) => m !== movie.file!.path)
    );
    if (matches.length === 1 && commonSuffixDepth(movie.file.path, matches[0])) {
      updateMovie(movie.id, { file: { ...movie.file, path: matches[0] } });
      continue;
    }
    candidates.push({ id: movie.id, type: "movie", title: movie.title, oldPath: movie.file.path, matches });
  }

  for (const series of loadSeries()) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (!ep.file || fs.existsSync(ep.file.path)) continue;

        const expected = computeExpectedEpisodePaths(series, ep, seriesRoots, templates).filter((p) => fs.existsSync(p));
        if (expected.length > 0) {
          const deduped = dedupeByFileIdentity(expected);
          if (deduped.length === 1 && commonSuffixDepth(ep.file.path, deduped[0])) {
            updateSeriesList(
              new Map([[series.id, {
                seasons: series.seasons.map((s) =>
                  s.seasonNumber === season.seasonNumber
                    ? {
                        ...s,
                        episodes: s.episodes.map((e) =>
                          e.episodeNumber === ep.episodeNumber && e.file
                            ? { ...e, file: { ...e.file, path: deduped[0] } }
                            : e
                        ),
                      }
                    : s
                ),
              }]])
            );
            continue;
          }
          candidates.push({
            id: series.id, type: "series", title: series.title,
            season: season.seasonNumber, episode: ep.episodeNumber,
            oldPath: ep.file.path, matches: deduped,
          });
          continue;
        }

        const base = pathFor(ep.file.path).basename(ep.file.path).toLowerCase();
        const matches = dedupeByFileIdentity(
          (byBasename.get(base) ?? []).filter((m) => m !== ep.file!.path)
        );
        if (matches.length === 1 && commonSuffixDepth(ep.file.path, matches[0])) {
          updateSeriesList(
            new Map([[series.id, {
              seasons: series.seasons.map((s) =>
                s.seasonNumber === season.seasonNumber
                  ? {
                      ...s,
                      episodes: s.episodes.map((e) =>
                        e.episodeNumber === ep.episodeNumber && e.file
                          ? { ...e, file: { ...e.file, path: matches[0] } }
                          : e
                      ),
                    }
                  : s
              ),
            }]])
          );
          continue;
        }
        candidates.push({
          id: series.id, type: "series", title: series.title,
          season: season.seasonNumber, episode: ep.episodeNumber,
          oldPath: ep.file.path, matches,
        });
      }
    }
  }

  // A match claimed as the sole candidate by more than one broken record can't be
  // auto-relinked to all of them — that would point two different library entries
  // at the same physical file and create a visible duplicate. Flag those so the UI
  // never pre-selects them; a human has to pick which record (if any) really owns it.
  const soleMatchClaims = new Map<string, number>();
  for (const c of candidates) {
    if (c.matches.length === 1) {
      soleMatchClaims.set(c.matches[0], (soleMatchClaims.get(c.matches[0]) ?? 0) + 1);
    }
  }
  for (const c of candidates) {
    if (c.matches.length === 1 && (soleMatchClaims.get(c.matches[0]) ?? 0) > 1) {
      c.contested = true;
    }
  }

  return candidates;
}

export interface RepairSelection {
  id: string;
  type: "movie" | "series";
  season?: number;
  episode?: number;
  newPath: string;
}

/**
 * Pure metadata fix — updates the recorded path to the confirmed real
 * location. Never touches the filesystem: the file was already found
 * exactly where `newPath` says it is.
 */
export function applyRepairs(selections: RepairSelection[]): { relinked: number } {
  let relinked = 0;
  const seriesSeasons = new Map<string, ReturnType<typeof loadSeries>[number]["seasons"]>();
  // Defensive backstop: never let two selections in the same batch claim the same
  // file, even if the caller bypassed the UI's contested-match guard.
  const usedPaths = new Set<string>();

  for (const sel of selections) {
    if (!fs.existsSync(sel.newPath)) continue;
    if (usedPaths.has(sel.newPath)) continue;
    usedPaths.add(sel.newPath);

    if (sel.type === "movie") {
      const movie = loadMovies().find((m) => m.id === sel.id);
      if (!movie || !movie.file) continue;
      updateMovie(movie.id, { file: { ...movie.file, path: sel.newPath } });
      relinked++;
    } else {
      const series = loadSeries().find((s) => s.id === sel.id);
      if (!series) continue;
      const seasons = seriesSeasons.get(sel.id) ?? series.seasons;
      const newSeasons = seasons.map((season) => {
        if (season.seasonNumber !== sel.season) return season;
        return {
          ...season,
          episodes: season.episodes.map((ep) => {
            if (ep.episodeNumber !== sel.episode || !ep.file) return ep;
            return { ...ep, file: { ...ep.file, path: sel.newPath } };
          }),
        };
      });
      seriesSeasons.set(sel.id, newSeasons);
      relinked++;
    }
  }

  if (seriesSeasons.size > 0) {
    const patches = new Map<string, Partial<ReturnType<typeof loadSeries>[number]>>();
    for (const [id, seasons] of seriesSeasons) patches.set(id, { seasons });
    updateSeriesList(patches);
  }

  return { relinked };
}
