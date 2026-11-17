// Fan-Kai fan versions of anime (« Death Note Kaï », « Bleach Yabaï »): the
// part number in a file name such as « [Johker] Bleach Yabaï - 05 - Fourteen
// days for conspiracy - 1080p.MULTI.x264.mkv ». Same reading as the web side
// (src/lib/metadata/fankaiWikitext.ts, parseFankaiReleaseName) — keep in sync.
//
// The Fan-Kai packs file their parts by saga in « Saison 1 », « Saison 2 »…
// folders while numbering them straight through (Bleach Yabaï: 01-04 in
// « Saison 1 », 05-11 in « Saison 2 »…). Movviz's fiche of a fan version has
// one season holding every part, so the number is the part and the folder
// says nothing about it.

const FAN_MARKER = String.raw`(?:ka[iï]|hensh[uū]|yaba[iï]|fan[-/ ]?cut|recut)`;
const FAN_PART_RE = new RegExp(String.raw`^(.+?\s${FAN_MARKER}(?:\s+ultime\s+pack)?)(?:\s*\([^)]*\))?(?:\s+(?:19|20)\d{2})?\s+-\s+(\d{1,4})(?:\s+-\s+|\s*$|\s+(?=\d{3,4}p\b))`, "i");

/** The part number of a Fan-Kai file name, null for any other name. */
export function fankaiPartNumber(fileName) {
  const name = String(fileName)
    .replace(/\.(?:mkv|mp4|avi|m4v|ts|webm)$/i, "")
    .replace(/^\s*(?:\[[^\]]*\]\s*)+/, "")
    .replace(/[._]+/g, (m) => (m.length === 1 ? " " : m))
    .trim();
  const match = name.match(FAN_PART_RE);
  if (!match) return null;
  const part = Number(match[2]);
  return part > 0 ? part : null;
}

/**
 * True when a grab's targets are those of a fan version's fiche: the web
 * marks them (`fanVersion`, src/lib/library/episodeTargetTitles.ts), and
 * they sit in season 1 with plain numbering. A real series whose title ends
 * with « Kai » (Dragon Ball Z Kai on TMDb) is never marked, so its files are
 * read exactly as before.
 */
export function targetsLookLikeFanVersion(targets) {
  return targets.length > 0 && targets.every((t) => t.fanVersion === true && t.season === 1 && t.absolute == null);
}
