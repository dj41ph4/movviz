package com.movviz.tv.ui.theme

/** Canonical desktop brand marks bundled from public/providers at build time. */
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
