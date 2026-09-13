/**
 * Logos plateformes locaux (public/providers/*.svg — sources originales non
 * redessinées, OCS récupéré depuis Wikimedia) indexés par id TMDb
 * watch-provider (voir STREAMING_PLATFORMS dans ./curated.ts). Prioritaires
 * sur les logos TMDb distants, avec repli logo TMDb puis nom en texte quand
 * un id n'a pas de SVG local. Disney+ et Apple TV+ utilisent leurs variantes
 * blanches (mêmes tracés, wordmark blanc — l'arc bleu Disney+ est conservé :
 * c'est le rendu officiel sur fond sombre), donc aucune tuile claire.
 */
export const PROVIDER_SVG: Record<number, string> = {
  8: "/providers/netflix.svg",
  337: "/providers/disney-plus-white.svg",
  119: "/providers/prime-video.svg",
  1899: "/providers/hbo-max.svg",
  350: "/providers/apple-tv-plus-white.svg",
  192: "/providers/youtube.svg",
  283: "/providers/crunchyroll.svg",
  56: "/providers/ocs.svg",
};

/**
 * Mécanisme conservé pour l'avenir : un id listé ici prend la variante
 * claire de son contexte (.nx-provider-tile-light,
 * .nx-discover-provider-tab-light, fond clair dans PlatformsSection).
 * Actuellement vide — tous les logos se lisent sur tuile sombre (Disney+ et
 * Apple TV+ en version blanche, OCS sans fond blanc comme demandé).
 */
export const PROVIDER_LIGHT_TILE: ReadonlySet<number> = new Set([]);
