import type { ActivityEntry } from "./types";

export interface HistoryPageFilters {
  kinds?: string[];
  users?: string[];
  indexers?: string[];
  query?: string;
  after?: string;
  limit?: number;
}

export function selectHistoryPage(entries: readonly ActivityEntry[], filters: HistoryPageFilters) {
  const facets = {
    users: [...new Set(entries.map((entry) => entry.actor))],
    indexers: [...new Set(entries.map((entry) => entry.release?.indexer).filter((value): value is string => !!value))],
  };
  const availableTotal = entries.length;
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  const selected = entries.filter((entry) =>
    (!filters.kinds?.length || filters.kinds.includes(entry.kind)) &&
    (!filters.users?.length || filters.users.includes(entry.actor)) &&
    (!filters.indexers?.length || !!entry.release?.indexer && filters.indexers.includes(entry.release.indexer)) &&
    (!query || entry.media.title.toLocaleLowerCase().includes(query))
  );
  const total = selected.length;
  const previous = filters.after ? selected.findIndex((entry) => entry.id === filters.after) : -1;
  const start = previous >= 0 ? previous + 1 : 0;
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 50);
  const items = selected.slice(start, start + limit);
  return { items, total, availableTotal, facets, nextCursor: start + limit < total ? items.at(-1)?.id ?? null : null };
}
