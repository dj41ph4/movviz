/**
 * Kaamelott only. Blu-ray packs of Livre V hold its 8 long episodes under the
 * numbers of the short broadcast scenes they contain, e.g.
 * "Kaamelott.S05E07E08E09E10E11E12...mkv" is long episode 2. Only an exact scene
 * list matches, so no other series or file name ever reaches this rule.
 */
const SCENE_RANGES = [[1, 6], [7, 12], [13, 18], [19, 25], [26, 32], [33, 38], [39, 43], [44, 50]];

/** The long episode number (1-8) this file holds, or null. */
export function kaamelottLongEpisode(fileName) {
  if (!/kaamelott/i.test(fileName)) return null;
  const chain = fileName.match(/\bS0?5((?:E\d{1,3}){2,})(?![\dA-Za-z])/i);
  if (!chain) return null;
  const scenes = chain[1].split(/E/i).filter(Boolean).map(Number);
  const index = SCENE_RANGES.findIndex(([first, last]) =>
    scenes.length === last - first + 1 && scenes.every((scene, position) => scene === first + position));
  return index >= 0 ? index + 1 : null;
}
