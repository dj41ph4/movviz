import type { NamingContext } from "./types";

/** One entry of the token reference shown in the settings UI. */
export interface TokenDef {
  key: string; // used as {key} in templates
  labelKey: string;
  exampleKey: string;
  /** Numeric tokens support zero-padding, e.g. {season:00}. */
  paddable?: boolean;
  scope: "movie" | "series" | "shared";
}

export const TOKEN_DEFS: TokenDef[] = [
  { key: "title", labelKey: "naming.token.title", exampleKey: "naming.token.titleExample", scope: "shared" },
  { key: "year", labelKey: "naming.token.year", exampleKey: "naming.token.yearExample", scope: "shared" },
  { key: "season", labelKey: "naming.token.season", exampleKey: "naming.token.seasonExample", paddable: true, scope: "series" },
  { key: "episode", labelKey: "naming.token.episode", exampleKey: "naming.token.episodeExample", paddable: true, scope: "series" },
  { key: "episodeTitle", labelKey: "naming.token.episodeTitle", exampleKey: "naming.token.episodeTitleExample", scope: "series" },
  { key: "quality", labelKey: "naming.token.quality", exampleKey: "naming.token.qualityExample", scope: "shared" },
  { key: "resolution", labelKey: "naming.token.resolution", exampleKey: "naming.token.resolutionExample", scope: "shared" },
  { key: "source", labelKey: "naming.token.source", exampleKey: "naming.token.sourceExample", scope: "shared" },
  { key: "videoCodec", labelKey: "naming.token.videoCodec", exampleKey: "naming.token.videoCodecExample", scope: "shared" },
  { key: "audioCodec", labelKey: "naming.token.audioCodec", exampleKey: "naming.token.audioCodecExample", scope: "shared" },
  { key: "hdr", labelKey: "naming.token.hdr", exampleKey: "naming.token.hdrExample", scope: "shared" },
  { key: "group", labelKey: "naming.token.group", exampleKey: "naming.token.groupExample", scope: "shared" },
];

type Resolver = (ctx: NamingContext) => string | number | null;

export const TOKEN_RESOLVERS: Record<string, Resolver> = {
  title: (c) => c.title,
  year: (c) => c.year,
  season: (c) => c.season,
  episode: (c) => c.episode,
  episodeTitle: (c) => c.episodeTitle,
  quality: (c) => c.quality,
  resolution: (c) => c.resolution,
  source: (c) => c.source,
  videoCodec: (c) => c.videoCodec,
  audioCodec: (c) => c.audioCodec,
  hdr: (c) => c.hdr,
  group: (c) => c.group,
};
