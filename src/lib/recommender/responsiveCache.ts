import { runBackground } from "@/lib/priority/lane";
import { eventBus } from "@/lib/events/EventBus";

type Entry = { value?: unknown; ready: boolean; at: number; work?: Promise<void> };
/** Serve each shelf independently. A slow source never holds the entire page.
 * Keys include the profile and preferences; failed refreshes retain good data. */
export class ResponsiveCache {
  private entries = new Map<string, Entry>();
  constructor(private limit = 512) {}
  async read<T>(key: string, build: () => Promise<T>, fallback: T, onReady: () => void,
    ttlMs = 60_000, budgetMs = 150): Promise<T> {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { ready: false, at: 0 };
      this.entries.set(key, entry);
    }
    // LRU eviction never drops an active builder, hence no duplicate work.
    this.entries.delete(key); this.entries.set(key, entry);
    if (this.entries.size > this.limit) {
      for (const [oldKey, old] of this.entries) {
        if (!old.work && oldKey !== key) this.entries.delete(oldKey);
        if (this.entries.size <= this.limit) break;
      }
    }
    if (!entry.work && Date.now() - entry.at >= ttlMs) {
      const target = entry;
      target.work = new Promise<void>((resolve) => setImmediate(resolve))
        .then(() => runBackground(build))
        .then((value) => {
          // Metadata's upstream-error sentinel must not erase a good shelf.
          if (value && typeof value === "object" && "totalPages" in value && value.totalPages === 0)
            throw new Error("source_unavailable");
          const changed = !target.ready || JSON.stringify(target.value) !== JSON.stringify(value);
          target.value = value; target.ready = true; target.at = Date.now();
          if (changed) onReady();
        }).catch(() => { target.at = Date.now(); })
        .finally(() => { target.work = undefined; });
    }
    if (!entry.ready && entry.work && budgetMs > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([entry.work, new Promise<void>((resolve) => { timer = setTimeout(resolve, budgetMs); })]);
      if (timer) clearTimeout(timer);
    }
    return entry.ready ? entry.value as T : fallback;
  }
  pending(prefix: string): boolean {
    return [...this.entries].some(([key, entry]) => key.startsWith(prefix) && !!entry.work);
  }
  invalidateProfile(userId: string, watch: boolean) {
    for (const [key, entry] of this.entries) {
      // JSON keys avoid collisions between names such as user-1/user-10.
      if (!key.startsWith(`[${JSON.stringify(userId)},`)) continue;
      if (watch || key.endsWith(":recommended") || key.includes(":providerSuggested:")) entry.at = 0;
    }
  }
}
const g = globalThis as typeof globalThis & { __movvizResponsiveRows?: ResponsiveCache };
if (!g.__movvizResponsiveRows) {
  g.__movvizResponsiveRows = new ResponsiveCache();
  eventBus.on((event) => {
    if (event.type === "watch_changed" || event.type === "recommendations_changed")
      g.__movvizResponsiveRows?.invalidateProfile(event.userId, event.type === "watch_changed");
  });
}
export const responsiveRows = g.__movvizResponsiveRows;
