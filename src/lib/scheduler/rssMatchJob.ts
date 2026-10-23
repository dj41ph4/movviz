import { enqueueJob, isSourceActive } from "@/lib/jobs/queue";
import { rssMatchIndexers } from "@/lib/library/rssScan";
import { readRssCache } from "@/lib/indexers/rssCache";
import type { IndexerRelease } from "@/lib/indexers/types";

const SOURCE_ID = "rss-indexer-match";
const g = globalThis as typeof globalThis & {
  __movvizRssPendingMatches?: Map<string, IndexerRelease>;
};
const pending = (g.__movvizRssPendingMatches ??= new Map());

/** Keep feed collection frequent while the CPU/search/grab phase obeys the
 * same one-heavy-task-at-a-time rule as missing-title retries. */
export function queueRssMatch(): void {
  // Preserve releases from every refresh while another heavy job owns the
  // slot. A later RSS refresh may replace the live cache before matching runs.
  for (const release of readRssCache()) {
    pending.set(release.guid || `${release.indexerId}|${release.title}`, release);
  }
  if (isSourceActive(SOURCE_ID)) return;
  enqueueJob("rssScan", "Appariement RSS et téléchargements", 1, async (setProgress) => {
    const batch = [...pending.values()];
    pending.clear();
    try {
      await rssMatchIndexers(batch);
      setProgress(1, 1);
      // A new feed may have arrived during this pass; it has its own batch.
      if (pending.size > 0) setImmediate(queueRssMatch);
    } catch (error) {
      for (const release of batch) {
        const key = release.guid || `${release.indexerId}|${release.title}`;
        if (!pending.has(key)) pending.set(key, release);
      }
      throw error;
    }
  }, SOURCE_ID, { heavy: true, scheduled: true });
}
