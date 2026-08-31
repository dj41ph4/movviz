export type ActivityKind = "added" | "approved" | "declined" | "removed" | "grabbed" | "imported" | "failed" | "upgraded";

export interface ActivityDetails {
  libraryRef?: string;
  releaseTitle?: string;
  quality?: string;
  indexer?: string;
  error?: string;
  infoHash?: string;
}

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  actor: string; // username, or "system" for automated actions
  subject: string; // title of the movie/series involved
  href: string | null;
  createdAt: number;
  details?: ActivityDetails;
}
