import type { useT } from "@/i18n/provider";

export interface RowMeta {
  anchorTmdbId?: number;
  anchorTitle?: string;
  verb?: "watched" | "liked";
  providerId?: number;
  providerName?: string;
}

/** Titre d'une rangée éditoriale à partir de sa clé serveur — source unique pour Discover, Films et Séries. */
export function rowLabel(t: ReturnType<typeof useT>, key: string, meta?: RowMeta): string {
  if (key.startsWith("becauseYouWatched:") && meta) {
    return meta.verb === "liked"
      ? t("discover.rowBecauseYouLiked", { title: meta.anchorTitle ?? "" })
      : t("discover.rowBecauseYouWatched", { title: meta.anchorTitle ?? "" });
  }
  if (key.startsWith("providerNew:") && meta?.providerName) return t("discover.rowProviderNew", { provider: meta.providerName });
  if (key.startsWith("providerSuggested:") && meta?.providerName) return t("discover.rowProviderSuggested", { provider: meta.providerName });
  switch (key) {
    case "recommendedTop": return t("discover.rowRecommendedTop");
    case "trendingPopular": return t("discover.rowTrendingPopular");
    case "nowPlayingBoxOffice": return t("discover.rowNowPlayingBoxOffice");
    case "upcomingVod": return t("discover.rowUpcomingVod");
    case "newSeriesRenewed": return t("discover.rowNewSeriesRenewed");
    case "recommended": return t("discover.rowRecommended");
    case "trending": return t("discover.trending");
    case "popular": return t("discover.rowPopular");
    case "topRated": return t("discover.rowTopRated");
    case "upcoming": return t("discover.rowUpcoming");
    case "onAir": return t("discover.rowOnAir");
    case "newVod": return t("discover.rowNewVod");
    case "nowPlaying": return t("discover.rowNowPlaying");
    case "boxOffice": return t("discover.rowBoxOffice");
    case "kids": return t("discover.rowKids");
    case "newSeries": return t("discover.rowNewSeries");
    case "renewed": return t("discover.rowRenewed");
    case "c411Popular": return t("discover.c411Popular");
    case "c411Recent": return t("discover.c411Recent");
    case "c411Today": return t("discover.c411Today");
    case "acclaimed": return t("discover.rowAcclaimed");
    case "anime": return t("discover.rowAnime");
    case "teen": return t("discover.rowTeen");
    case "shortFormat": return t("discover.rowShortFormat");
    case "genreAction": return t("discover.rowGenreAction");
    case "genreComedy": return t("discover.rowGenreComedy");
    case "genreHorror": return t("discover.rowGenreHorror");
    case "genreSciFi": return t("discover.rowGenreSciFi");
    default: return key;
  }
}
