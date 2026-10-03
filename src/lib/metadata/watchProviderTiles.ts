import { STREAMING_PLATFORMS } from "./curated";

export interface RegionalWatchProvider {
  provider_id: number;
  logo_path?: string | null;
}

/** Keep every curated platform visible in its deliberate order. Regional
 * metadata only supplies the current TMDb logo; a regional zero-result must
 * never silently remove a user-selected platform such as OCS or YouTube. */
export function selectWatchProviderTiles(
  movieProviders: RegionalWatchProvider[],
  seriesProviders: RegionalWatchProvider[],
): { id: number; name: string; logoPath: string | null }[] {
  const byId = new Map<number, RegionalWatchProvider>();
  for (const provider of [...movieProviders, ...seriesProviders]) {
    const previous = byId.get(provider.provider_id);
    if (!previous || (!previous.logo_path && provider.logo_path)) byId.set(provider.provider_id, provider);
  }
  return STREAMING_PLATFORMS.map((platform) => {
    const match = byId.get(platform.id);
    return { id: platform.id, name: platform.name, logoPath: match?.logo_path ?? null };
  });
}
