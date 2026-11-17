package com.movviz.nx.mobile.data

import coil.map.Mapper
import coil.request.Options

/**
 * Affiches et vignettes des versions fan Fan-Kai (séries à id synthétique,
 * chemins « /fankai-<16 hex>.png|jpg|webp »). Elles ne sont PAS sur le CDN
 * TMDb : le serveur Movviz les sert à « <serveur>/tmdb/<taille>/fankai-… ».
 * Les écrans construisent leurs URL en « https://image.tmdb.org/t/p/<taille> »
 * + chemin ; on réécrit ici uniquement ce motif exact, toute autre URL est
 * rendue telle quelle (aucun changement pour les images TMDb normales).
 * Même règle que imageUrl() du client Samsung (tizen-tv/src/app.ts).
 */
object FankaiImages {
    private val tmdbFankaiUrl =
        Regex("""^https://image\.tmdb\.org/t/p/([a-z0-9]+)(/fankai-[0-9a-f]{16}\.(?:png|jpg|webp))$""")

    fun rewrite(url: String): String {
        if (!url.contains("/fankai-")) return url
        val match = tmdbFankaiUrl.matchEntire(url) ?: return url
        val server = ApiClient.currentBaseUrl() ?: return url
        return "$server/tmdb/${match.groupValues[1]}${match.groupValues[2]}"
    }
}

/** Branché dans l'ImageLoader Coil partagé : couvre tous les écrans d'un coup. */
class FankaiImageMapper : Mapper<String, String> {
    override fun map(data: String, options: Options): String? =
        FankaiImages.rewrite(data).takeIf { it != data }
}
