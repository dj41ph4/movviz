import { discoverByFilters, resolveWatchRegion } from "@/lib/metadata/tmdb";
import { getWatchedTitles } from "./watchedTitles";
import { getFeedback } from "@/lib/ai/tasteProfile";
import { STREAMING_PLATFORMS } from "@/lib/metadata/curated";
import { filterSuggestable } from "@/lib/metadata/suggestable";
import { getProviderRelationPool } from "./providerRelations";
import type { MetaSearchResult } from "@/lib/metadata/types";

export interface ProviderPersonalizedRow {
  key: string;
  results: MetaSearchResult[];
  meta: { providerId: number; providerName: string };
}
export const PERSONALIZED_DISCOVER_PROVIDERS = [8, 337, 119]
  .map((id) => STREAMING_PLATFORMS.find((p) => p.id === id))
  .filter((p): p is { id: number; name: string } => !!p);
const ROW_SIZE = 20;
export function providerPoolIsCacheable(state: { results: MetaSearchResult[] }): boolean { return state.results.length > 0; }
export function providerNameFor(providerId: number): string | null {
  return STREAMING_PLATFORMS.find((p) => p.id === providerId)?.name ?? null;
}
function dateSortFor(type: "movie" | "series"): string {
  return type === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
}
function excludedTmdbIds(type: "movie" | "series", userId: string): Set<number> {
  return new Set([...getWatchedTitles(userId, type).keys(),
    ...getFeedback(userId).filter((f) => !f.liked && f.type === type).map((f) => f.tmdbId)]);
}

/** New releases deliberately remain an editorial chronological catalogue. */
export async function getProviderNewPage(userId: string, type: "movie" | "series", providerId: number,
  page: number, originCountries?: string[]) {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;
  const excluded = excludedTmdbIds(type, userId);
  const raw = await discoverByFilters(type, { watchProvider: String(providerId), sort: dateSortFor(type),
    originCountries, region: resolveWatchRegion(userId) }, page);
  return { results: filterSuggestable(raw.results.filter((c) => !excluded.has(c.tmdbId))),
    page: raw.page, totalPages: raw.totalPages, meta: { providerId, providerName } };
}
export async function buildProviderNewRow(userId: string, type: "movie" | "series", providerId: number, originCountries?: string[]): Promise<ProviderPersonalizedRow | null> {
  const page = await getProviderNewPage(userId, type, providerId, 1, originCountries);
  return page?.results.length ? { key: `providerNew:${providerId}`, results: page.results.slice(0, ROW_SIZE), meta: page.meta } : null;
}

/** Same full-history ranking as every other client/rail, only availability
 * is filtered. No popularity-catalogue fallback disguised as personal taste. */
export async function buildProviderSuggestedRow(userId: string, type: "movie" | "series", providerId: number, originCountries?: string[]): Promise<ProviderPersonalizedRow | null> {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;
  const pool = await getProviderRelationPool(userId, type, providerId, resolveWatchRegion(userId), originCountries);
  return pool.results.length ? { key: `providerSuggested:${providerId}`, results: pool.results.slice(0, ROW_SIZE), meta: { providerId, providerName } } : null;
}
export async function buildProviderPersonalizedRows(userId: string, type: "movie" | "series", originCountries?: string[]): Promise<ProviderPersonalizedRow[]> {
  const rows = await Promise.all(PERSONALIZED_DISCOVER_PROVIDERS.flatMap((p) => [
    buildProviderSuggestedRow(userId, type, p.id, originCountries).catch(() => null),
    buildProviderNewRow(userId, type, p.id, originCountries).catch(() => null),
  ]));
  return rows.filter((r): r is ProviderPersonalizedRow => r !== null);
}
export async function getProviderSuggestedPage(userId: string, type: "movie" | "series", providerId: number,
  page: number, originCountries?: string[], sort: "personalized" | "rating" | "date" = "personalized") {
  const providerName = providerNameFor(providerId);
  if (!providerName) return null;
  if (sort === "date") return getProviderNewPage(userId, type, providerId, page, originCountries);
  const pool = await getProviderRelationPool(userId, type, providerId, resolveWatchRegion(userId), originCountries);
  const ranked = sort === "rating" ? [...pool.results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.popularity ?? 0) - (a.popularity ?? 0)) : pool.results;
  return { results: ranked.slice((page - 1) * ROW_SIZE, page * ROW_SIZE), page,
    totalPages: Math.max(1, Math.ceil(ranked.length / ROW_SIZE), pool.pending ? page + 1 : 1),
    meta: { providerId, providerName } };
}
