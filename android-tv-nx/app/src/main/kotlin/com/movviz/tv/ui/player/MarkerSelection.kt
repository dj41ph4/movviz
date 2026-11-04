package com.movviz.tv.ui.player

import com.movviz.tv.data.PlaybackMarkerDto

/**
 * Choix du marqueur actif — même règle que le lecteur web, Android NX mobile
 * et Tizen. Plusieurs marqueurs peuvent se chevaucher (avant-première
 * pendant le générique, récap qui déborde sur l'intro) : un seul bouton est
 * affiché, celui du type le plus prioritaire puis du plus tôt commencé. Le
 * générique passe avant l'avant-première (le sauter mène à l'épisode
 * suivant). Un type inconnu, venu d'un serveur plus récent, est ignoré.
 */
private val SKIP_PRIORITY = listOf("recap", "intro", "credits", "preview")

internal fun pickActiveMarker(markers: List<PlaybackMarkerDto>, positionMs: Long): PlaybackMarkerDto? =
    markers
        .filter { positionMs >= it.startMs && positionMs < it.endMs && it.type in SKIP_PRIORITY }
        .minWithOrNull(compareBy<PlaybackMarkerDto>({ SKIP_PRIORITY.indexOf(it.type) }, { it.startMs }))

/** Libellé du bouton de saut. Le générique d'une série avec suite devient
 *  « Épisode suivant » : c'est justement là qu'on veut passer. */
internal fun markerSkipLabel(type: String, hasNext: Boolean): String = when (type) {
    "recap" -> "Passer le récap"
    "intro" -> "Passer l'intro"
    "preview" -> "Passer l'aperçu"
    else -> if (hasNext) "Épisode suivant" else "Passer le générique"
}
