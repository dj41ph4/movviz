/** Optional explicit episode contract. Source selects bytes; library identifies
 * progress; placement names the file for the server's configured episode order. */
function valid(c) { return c && Number.isInteger(c.season) && c.season >= 0 && Number.isInteger(c.episode) && c.episode > 0; }
export function validateEpisodeTargets(targets = []) {
  const seen = new Map();
  for (const target of targets) {
    if (!target?.library && !target?.placement) continue;
    if (!valid(target) || !valid(target.library) || !valid(target.placement)) throw new Error("invalid_episode_placement");
    const key = `${target.season}:${target.episode}`;
    const value = JSON.stringify([target.library, target.placement]);
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
        target.placement.season !== first.placement.season || target.placement.episode !== first.placement.episode + index) throw new Error("non_contiguous_episode_placement");
  }
  const range = c => ({ season: c.season, episode: c.episode, ...(sorted.length > 1 ? { episodeEnd: c.episode + sorted.length - 1 } : {}) });
  return { source: range(first), library: range(first.library), placement: range(first.placement) };
}
