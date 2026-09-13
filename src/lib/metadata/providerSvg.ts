/**
 * Logos plateformes locaux (public/providers/*.svg — sources originales non
 * redessinées, OCS récupéré depuis Wikimedia) indexés par id TMDb
 * watch-provider (voir STREAMING_PLATFORMS dans ./curated.ts). Prioritaires
 * sur les logos TMDb distants, avec repli logo TMDb puis nom en texte quand
 * un id n'a pas de SVG local.
 */
export const PROVIDER_SVG: Record<number, string> = {
  8: "/providers/netflix.svg",
  337: "/providers/disney-plus.svg",
  119: "/providers/prime-video.svg",
  1899: "/providers/hbo-max.svg",
  350: "/providers/apple-tv-plus.svg",
  192: "/providers/youtube.svg",
  283: "/providers/crunchyroll.svg",
  56: "/providers/ocs.svg",
};

/**
 * Ces logos sont sombres (noir/marine) et illisibles sur tuile sombre — les
 * tuiles qui les portent prennent la variante claire de leur contexte
 * (.nx-provider-tile-light, .nx-discover-provider-tab-light, fond clair
 * dans PlatformsSection).
 */
export const PROVIDER_LIGHT_TILE: ReadonlySet<number> = new Set([337, 350, 56]);
