export type ImportListKind = "trakt" | "imdb" | "letterboxd";

export interface ImportListConfig {
  id: string;
  name: string;
  kind: ImportListKind;
  url: string;
  enabled: boolean;
  autoApprove: boolean;
  lastSync: number | null;
}

export interface ImportListEntry {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  year: number | null;
}
