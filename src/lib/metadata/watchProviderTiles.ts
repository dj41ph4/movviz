import { STREAMING_PLATFORMS } from "./curated";

export interface RegionalWatchProvider {
  provider_id: number;
  logo_path?: string | null;
}

/** Keep the curated order, but never advertise a provider absent from the
 * selected country's catalogues. TV-only providers must remain available. */
export function selectWatchProviderTiles(
  movieProviders: RegionalWatchProvider[],
  seriesProviders: RegionalWatchProvider[],
): { id: number; name: string; logoPath: string | null }[] {
  const byId = new Map<number, RegionalWatchProvider>();
  for (const provider of [...movieProviders, ...seriesProviders]) {
    const previous = byId.get(provider.provider_id);
    if (!previous || (!previous.logo_path && provider.logo_path)) byId.set(provider.provider_id, provider);
  }
  return STREAMING_PLATFORMS.flatMap((platform) => {
    const match = byId.get(platform.id);
    return match ? [{ id: platform.id, name: platform.name, logoPath: match.logo_path ?? null }] : [];
  });
}
