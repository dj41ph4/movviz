package com.movviz.nx.mobile.ui.theme

/** Logos plateformes embarqués (copies des SVG du site, public/providers) :
 *  jamais dépendants d'un logo TMDb absent ou lent (YouTube, OCS). */
fun providerBrandAsset(providerId: Int): String? {
    val fileName = when (providerId) {
        8 -> "netflix.svg"
        337 -> "disney-plus-white.svg"
        119 -> "prime-video.svg"
        1899 -> "hbo-max.svg"
        350 -> "apple-tv-plus-white.svg"
        192 -> "youtube.svg"
        283 -> "crunchyroll.svg"
        685 -> "ocs.svg"
        else -> return null
    }
    return "file:///android_asset/providers/$fileName"
}

/** Mot-symbole du site (public/providers, tel quel) pour les tuiles en verre sombre
 *  de l'accueil, comme sur le desktop. Distinct de [providerBrandAsset], qui garde
 *  l'icône carrée à fond de marque pour les autres écrans. */
fun providerWordmarkAsset(providerId: Int): String? {
    val fileName = when (providerId) {
        8 -> "netflix.svg"
        337 -> "disney-plus-white.svg"
        119 -> "prime-video.svg"
        1899 -> "hbo-max.svg"
        350 -> "apple-tv-plus-white.svg"
        192 -> "youtube.svg"
        283 -> "crunchyroll.svg"
        685 -> "ocs.svg"
        else -> return null
    }
    return "file:///android_asset/providers/desktop/$fileName"
}
