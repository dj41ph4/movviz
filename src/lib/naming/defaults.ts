import type { NamingTemplates, NamingContext } from "./types";

export const DEFAULT_TEMPLATES: NamingTemplates = {
  enabled: true,
  movieFolder: "{title} ({year})",
  movieFile: "{title} ({year}) {quality} {videoCodec} {group}",
  seriesFolder: "{title}",
  seasonFolder: "Season {season:00}",
  episodeFile: "{title} - S{season:00}E{episode:00} {quality} {videoCodec} {group}",
  useDotsInsteadOfSpaces: false,
};

/** Sample data used to render a live preview in the settings UI. */
export const SAMPLE_MOVIE: NamingContext = {
  title: "Galactic Horizon",
  year: "2024",
  season: null,
  episode: null,
  episodeTitle: null,
  resolution: "2160p",
  source: "BluRay",
  videoCodec: "x265",
  audioCodec: "DDP5.1",
  hdr: "HDR10",
  group: "MOVVIZ",
  quality: "BluRay 2160p",
};

export const SAMPLE_EPISODE: NamingContext = {
  title: "The Last Signal",
  year: "2023",
  season: 2,
  episode: 6,
  episodeTitle: "Into the Static",
  resolution: "1080p",
  source: "WEB-DL",
  videoCodec: "x264",
  audioCodec: "AAC",
  hdr: null,
  group: "MOVVIZ",
  quality: "WEB-DL 1080p",
};
