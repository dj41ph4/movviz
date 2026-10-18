/** Optional explicit episode contract. Source selects bytes; library identifies
 * progress; placement names the file for the server's configured episode order. */
import path from "node:path";
import fsp from "node:fs/promises";
function valid(c) { return c && Number.isInteger(c.season) && c.season >= 0 && Number.isInteger(c.episode) && c.episode > 0; }
function validPresentation(p) {
  return p && ["original", "tybw"].includes(p.seriesPart) && typeof p.folder === "string" && p.folder.length > 0 && p.folder.length <= 180 &&
    !/[\\/:\x00-\x1f]/.test(p.folder) && !p.folder.includes("..") && p.folder !== "." && p.folder.trim() === p.folder &&
    typeof p.title === "string" && p.title.length > 0 && !/[\r\n]/.test(p.title) && Number.isInteger(p.year) && p.year >= 1900 && p.year <= 2200 && /^plex:\/\/show\/[a-f0-9]{24}$/.test(p.plexGuid) && (p.imdbId == null || /^tt\d+$/.test(p.imdbId));
}
export function validateEpisodeTargets(targets = []) {
  const seen = new Map();
  for (const target of targets) {
    if (!target?.library && !target?.placement) continue;
    if (!valid(target) || !valid(target.library) || !valid(target.placement) || (target.presentation && !validPresentation(target.presentation))) throw new Error("invalid_episode_placement");
    const key = `${target.season}:${target.episode}`;
    const value = JSON.stringify([target.library, target.placement, target.presentation]);
    if (seen.has(key) && seen.get(key) !== value) throw new Error("conflicting_episode_placement");
    seen.set(key, value);
  }
}

/** Called for ALL selected files before transferring ANY bytes. A file that
 * spans different library seasons cannot be represented as one S/E range. */
export function resolveEpisodePlacement(targets, parsed, rawName = "") {
  if (!targets.some(t => t.library || t.placement)) return null;
  validateEpisodeTargets(targets);
  if (targets.some(t => !t.library || !t.placement)) throw new Error("mixed_episode_placement");
  const sorted = [...targets].sort((a, b) => a.episode - b.episode), first = sorted[0];
  // parseRelease may treat a terminal '-E21' as a release group. Inspect
  // the untouched basename before trusting a multi-episode file's coverage.
  const rawRange = rawName.match(/S\d{1,2}E(\d{1,3})(?:-E?|E)(\d{1,3})(?=[^\d]|$)/i);
  if (rawRange) parsed = { ...parsed, episode: Number(rawRange[1]), episodeEnd: Number(rawRange[2]) };
  const end = parsed.episodeEnd ?? parsed.episode;
  if (parsed.episode != null && (parsed.episode !== first.episode || end !== sorted.at(-1).episode)) throw new Error("partial_multi_episode_placement");
  for (const [index, target] of sorted.entries()) {
    if (target.season !== first.season || target.episode !== first.episode + index ||
        target.library.season !== first.library.season || target.library.episode !== first.library.episode + index ||
        target.placement.season !== first.placement.season || target.placement.episode !== first.placement.episode + index ||
        JSON.stringify(target.presentation) !== JSON.stringify(first.presentation)) throw new Error("non_contiguous_episode_placement");
  }
  const range = c => ({ season: c.season, episode: c.episode, ...(sorted.length > 1 ? { episodeEnd: c.episode + sorted.length - 1 } : {}) });
  return { source: range(first), library: range(first.library), placement: range(first.placement), ...(first.presentation ? { presentation: first.presentation } : {}) };
}

/** A provider GUID hint prevents a standalone sequel being matched back to
 * the original show. Existing user hints are checked, never overwritten. */
export async function ensurePresentationFolder(completedPath, presentation) {
  if (!validPresentation(presentation)) throw new Error("invalid_episode_presentation");
  const root = path.resolve(completedPath), folder = path.resolve(root, presentation.folder);
  if (!folder.startsWith(root + path.sep) || path.dirname(folder) !== root) throw new Error("unsafe_episode_presentation");
  await fsp.mkdir(root, { recursive: true });
  await fsp.mkdir(folder, { recursive: true });
  if ((await fsp.lstat(folder)).isSymbolicLink()) throw new Error("unsafe_episode_presentation");
  const hint = path.join(folder, ".plexmatch");
  const identityHint = presentation.imdbId ? `imdbid: ${presentation.imdbId}` : `guid: ${presentation.plexGuid}`;
  const content = `# Movviz: provider identity for this series folder\n${identityHint}\ntitle: ${presentation.title}\nyear: ${presentation.year}\n`;
  try { await fsp.writeFile(hint, content, { flag: "wx" }); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    if ((await fsp.lstat(hint)).isSymbolicLink()) throw new Error("unsafe_episode_presentation");
    const existing = await fsp.readFile(hint, "utf8");
    const identity = existing.split(/\r?\n/).filter(line => /^\s*(guid|tmdbid|tvdbid|imdbid)\s*:/i.test(line));
    if (identity.length !== 1 || identity[0].trim() !== identityHint) throw new Error("episode_presentation_hint_conflict");
  }
  return folder;
}
