package com.movviz.tv.ui.theme

import android.content.Context

/**
 * État partagé du splash Bêta « M ruban ».
 *
 * Le splash n'utilise plus que trois petites images (M, lueur pré-floutée, mot MOVVIZ, ~90 Ko au total) :
 * plus rien à décoder à l'avance. [betaHint] reste lu au lancement du processus pour afficher le décor
 * du splash ([CinemaSplashBackdrop]) dès la première image, avant même que la préférence soit chargée.
 */
object CinemaSplashAssets {
    /** Dernier état connu de la préférence Bêta, lu en parallèle du démarrage (null = pas encore lu). */
    @Volatile
    var betaHint: Boolean? = null

    /** Conservé pour l'appel de l'Application : les images du splash sont assez légères pour se passer de préchargement. */
    @Suppress("UNUSED_PARAMETER")
    fun preload(context: Context) = Unit

    fun release() = Unit
}
