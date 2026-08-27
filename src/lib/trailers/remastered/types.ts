import type { TrailerSource } from "../types";

export type PremiumProvider =
  | "digitalCine"
  | "hdRetroTrailers"
  | "casu"
  | "filmsActu"
  | "digitalTheater";

export type RestorationType =
  | "restored"
  | "remastered"
  | "re-trailer"
  | "hd-master"
  | "unknown";

export type TrustedYoutubeSource = {
  provider: PremiumProvider;
  channelId: string;
};

/**
 * Whitelist stricte des chaînes YouTube de confiance.
 * Un provider n'est reconnu que si channelId correspond exactement.
 * Les vrais IDs doivent être vérifiés live sur YouTube Studio — les valeurs
 * ci-dessous sont des placeholders documentés, à remplacer par les IDs réels
 * observés (ex: https://www.youtube.com/channel/UC...).
 */
export const TRUSTED_YOUTUBE_SOURCES: TrustedYoutubeSource[] = [
  { provider: "digitalCine", channelId: "UC_DIGITAL_CINE_PLACEHOLDER" },
  { provider: "hdRetroTrailers", channelId: "UC_HD_RETRO_TRAILERS_PLACEHOLDER" },
  { provider: "casu", channelId: "UC_CASU_RE_TRAILER_PLACEHOLDER" },
  { provider: "filmsActu", channelId: "UC_FILMSACTU_PLACEHOLDER" },
  { provider: "digitalTheater", channelId: "UC_DIGITAL_THEATER_PLACEHOLDER" },
];

export function isTrustedChannel(channelId: string): TrustedYoutubeSource | null {
  return TRUSTED_YOUTUBE_SOURCES.find((s) => s.channelId === channelId) ?? null;
}

export function trustedChannelForProvider(provider: PremiumProvider): TrustedYoutubeSource | undefined {
  return TRUSTED_YOUTUBE_SOURCES.find((s) => s.provider === provider);
}

export type PremiumTrailerCandidate =
  | {
      kind: "youtube";
      provider: PremiumProvider;
      key: string;
      title: string;
      channelId: string;
      channelTitle?: string;
      contentType: "teaser" | "trailer";
      language: string | null;
      restoration: RestorationType;
      width?: number;
      height?: number;
      titleScore: number;
      yearScore: number;
      confidence: number;
    }
  | {
      kind: "direct";
      provider: PremiumProvider;
      source: TrailerSource;
      title: string;
      contentType: "teaser" | "trailer";
      language: string | null;
      restoration: RestorationType;
      titleScore: number;
      yearScore: number;
      confidence: number;
    };

export interface ResolveRemasteredParams {
  type: "movie" | "series";
  tmdbId: number;
  title: string;
  originalTitle?: string | null;
  year: number | null;
  locale: string;
  originalLanguage?: string | null;
  context: "carousel" | "details";
}
