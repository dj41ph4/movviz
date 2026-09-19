/**
 * Resolves the season that an imported season-pack can safely update.
 *
 * The requested season remains the default. We only override it when every
 * file which exposes a season number agrees on one other tracked season;
 * partial, mixed and season-less packs are intentionally left untouched.
 */
export function resolveImportedSeasonAssociation(
  requestedSeason: number,
  fileSeasons: Array<number | null | undefined>,
  trackedSeasons: readonly number[],
): number {
  // A single season-less file makes the pack ambiguous: do not let the
  // numbered siblings pull it into another season by inference.
  if (fileSeasons.some((season) => season == null)) return requestedSeason;
  const explicitSeasons = [...new Set(fileSeasons.filter((season): season is number => season != null))];
  const actualSeason = explicitSeasons.length === 1 ? explicitSeasons[0] : null;
  return actualSeason != null && actualSeason !== requestedSeason && trackedSeasons.includes(actualSeason)
    ? actualSeason
    : requestedSeason;
}
