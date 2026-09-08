package com.movviz.nx.mobile.data

/**
 * Décision de lecture partagée entre TV et mobile.
 *
 * Une série peut contenir simultanément des épisodes locaux Movviz et des
 * épisodes Plex. Le fait que la série existe localement ne permet donc jamais
 * de déduire la source d'un épisode : seule sa propre `playbackSource` le
 * permet. Sans cette distinction, le client appelait la route locale pour un
 * épisode Plex et recevait `local_source_unavailable`.
 */
data class EpisodePlaybackTarget(
    val ratingKey: String,
    val localSeriesId: String? = null,
)

fun episodePlaybackTarget(
    seriesId: String?,
    plexRatingKey: String?,
    playbackSource: String?,
    seasonNumber: Int,
    episodeNumber: Int,
): EpisodePlaybackTarget? {
    // Les anciennes entrées Movviz n'avaient pas toujours playbackSource.
    // Sans ratingKey Plex, elles ne peuvent pas être Plex : les traiter comme
    // locales rétablit la lecture sans risquer d'envoyer un épisode Plex vers
    // la route locale. Une vraie clé Plex garde toujours priorité.
    val localSeriesId = seriesId?.takeIf {
        playbackSource == "movviz" || (playbackSource == null && plexRatingKey == null)
    }
    return when {
        localSeriesId != null -> EpisodePlaybackTarget(
            ratingKey = plexRatingKey ?: "$localSeriesId:s${seasonNumber}e${episodeNumber}",
            localSeriesId = localSeriesId,
        )
        plexRatingKey != null -> EpisodePlaybackTarget(ratingKey = plexRatingKey)
        else -> null
    }
}
