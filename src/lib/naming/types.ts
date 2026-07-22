/**
 * Movviz naming engine — variable-driven renaming templates.
 *
 * A completed download is analyzed (title, year, quality, codec, group,
 * season/episode when present) and that data feeds user-defined templates to
 * produce the final folder and file names. Movies and series each get their
 * own set of templates so the two flows stay independent.
 */

export interface ReleaseInfo {
  title: string;
  year: string | null;
  season: number | null;
  episode: number | null;
  /** Last episode number covered when the release is a combined multi-episode
   *  file (e.g. S04E01E02, S04E01-02) — a single file airing/released as one
   *  block for what TMDb still lists as separate episode entries. Undefined/
   *  null for a normal single-episode file. */
  episodeEnd?: number | null;
  episodeTitle: string | null;
  resolution: string | null;
  source: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  group: string | null;
}

/** Everything a token resolver can read from. */
export interface NamingContext extends ReleaseInfo {
  quality: string; // "source resolution" combined, e.g. "WEB-DL 1080p"
}

export interface NamingTemplates {
  enabled: boolean;
  movieFolder: string;
  movieFile: string;
  seriesFolder: string;
  seasonFolder: string;
  episodeFile: string;
  /** Replace spaces with dots in the rendered output (scene-style naming). */
  useDotsInsteadOfSpaces: boolean;
}
