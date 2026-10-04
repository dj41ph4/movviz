/** Specials are season 0, never negative/undefined seasons. */
export function isVisibleSeason(seasonNumber: number, includeSpecials: boolean): boolean {
  return Number.isInteger(seasonNumber) && (seasonNumber > 0 || (includeSpecials && seasonNumber === 0));
}
