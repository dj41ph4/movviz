import type { ChangelogEntry } from "../changelog";

// The old key was written even on failure, so it is not a reliable acknowledgement.
export const CHANGELOG_SEEN_KEY = "movviz_last_seen_changelog_version";

export function readableChangelog(payload: unknown, version: string): ChangelogEntry[] {
  const data = payload as { version?: string; entries?: ChangelogEntry[] } | null;
  if (data?.version !== version || !Array.isArray(data.entries)) return [];
  return data.entries.filter((entry) => typeof entry?.version === "string" && Array.isArray(entry.sections)
    && entry.sections.every((section) => typeof section?.heading === "string" && Array.isArray(section.items) && section.items.every((item) => typeof item === "string"))
    && entry.sections.some((section) => Array.isArray(section?.items) && section.items.some((item) => typeof item === "string" && item.trim())));
}

/** Bounded retry; never writes an acknowledgement before the user closes the popup. */
export async function loadWhatsNew(version: string, fetchPayload: () => Promise<unknown>, wait: (ms: number) => Promise<void>, cancelled: () => boolean): Promise<ChangelogEntry[]> {
  for (let attempt = 0; attempt < 3 && !cancelled(); attempt++) {
    if (attempt) await wait(attempt * 2_000);
    if (cancelled()) return [];
    try {
      const entries = readableChangelog(await fetchPayload(), version);
      if (!cancelled() && entries.length) return entries;
    } catch { /* Network/auth/startup failure: leave the version unseen. */ }
  }
  return [];
}
