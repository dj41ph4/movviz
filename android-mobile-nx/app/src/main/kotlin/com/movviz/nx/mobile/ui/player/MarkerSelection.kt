package com.movviz.nx.mobile.ui.player

import com.movviz.nx.mobile.data.PlaybackMarkerDto

/**
 * Choix du marqueur actif — même règle que le lecteur web, Android NX TV et
 * Tizen. Plusieurs marqueurs peuvent se chevaucher (avant-première pendant
 * le générique, récap qui déborde sur l'intro) : un seul bouton est affiché,
 * celui du type le plus prioritaire puis du plus tôt commencé. Le générique
 * passe avant l'avant-première (le sauter mène à l'épisode suivant). Un type
 * inconnu, venu d'un serveur plus récent, est ignoré.
 */
private val SKIP_PRIORITY = listOf("recap", "intro", "credits", "preview")

internal fun pickActiveMarker(markers: List<PlaybackMarkerDto>, positionMs: Long): PlaybackMarkerDto? =
    markers
        .filter { positionMs >= it.startMs && positionMs < it.endMs && it.type in SKIP_PRIORITY }
        .minWithOrNull(compareBy<PlaybackMarkerDto>({ SKIP_PRIORITY.indexOf(it.type) }, { it.startMs }))

internal fun markerSkipLabel(type: String): String = when (type) {
    "recap" -> "Passer le récap"
    "intro" -> "Passer l'intro"
    "preview" -> "Passer l'aperçu"
    else -> "Passer le générique"
}
