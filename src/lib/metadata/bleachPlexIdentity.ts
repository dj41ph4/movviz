/** Plex's standalone TYBW catalogue uses a different show identity from TMDb's
 * combined Bleach record. Keep these provider identities separate from the
 * canonical Movviz episode coordinates and user history. */
export const BLEACH_ORIGINAL_PLEX_GUID = "plex://show/5d9c084902391c001f58594b";
export const BLEACH_TYBW_PLEX_GUID = "plex://show/6ab51a54533bd19e6cf62868";
export const BLEACH_TYBW_WEB_PLEX_GUID = "plex://show/68ae02ab39b1f79ac7d49761";
export const BLEACH_TYBW_IMDB_ID = "tt14986406";

export function bleachFilePresentation(seriesPart: "original" | "tybw") {
  const sequel = seriesPart === "tybw";
  return {
    seriesPart,
    folder: sequel ? "Bleach - Thousand-Year Blood War (2022) {imdb-tt14986406}" : "Bleach (2004) {imdb-tt0434665}",
    title: sequel ? "Bleach - Thousand-Year Blood War" : "Bleach", year: sequel ? 2022 : 2004,
    plexGuid: sequel ? BLEACH_TYBW_PLEX_GUID : BLEACH_ORIGINAL_PLEX_GUID,
    imdbId: sequel ? BLEACH_TYBW_IMDB_ID : "tt0434665",
  };
}

export function bleachPlexPart(guids: { id: string }[] | undefined, guid?: string): "original" | "tybw" | null {
  const ids = [guid, ...(guids ?? []).map(g => g.id)];
  if (ids.includes(BLEACH_TYBW_PLEX_GUID) || ids.includes(BLEACH_TYBW_WEB_PLEX_GUID) || ids.includes(`imdb://${BLEACH_TYBW_IMDB_ID}`) || ids.some(id => id?.split("?")[0] === `com.plexapp.agents.imdb://${BLEACH_TYBW_IMDB_ID}`)) return "tybw";
  if (ids.includes(BLEACH_ORIGINAL_PLEX_GUID) || ids.includes("imdb://tt0434665") || ids.includes("tvdb://74796") || ids.includes("tmdb://30984")) return "original";
  return null;
}
