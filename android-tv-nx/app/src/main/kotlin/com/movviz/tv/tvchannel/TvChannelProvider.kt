package com.movviz.tv.tvchannel

import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.net.Uri
import com.movviz.tv.data.OnDeckEntryDto

/**
 * Chaîne Android TV « Movviz » sur le dashboard du launcher.
 *
 * Le launcher Android TV affiche une rangée de cartes par chaîne enregistrée
 * dans le TvProvider : c'est le mécanisme que Plex, Netflix etc. utilisent
 * pour proposer des films / "continuer à regarder" directement sur l'écran
 * d'accueil — aucune API réservée ni partenariat, n'importe quelle app peut
 * enregistrer des chaînes et pousser des programmes.
 *
 * Chaque sync remplace les programmes de la chaîne par les titres "à
 * reprendre" du compte actif (on-deck) : la rangée reflète la vraie activité
 * de l'utilisateur. Cliquer sur une carte ouvre l'app (TvProvider ne permet
 * qu'un intent par chaîne, pas par programme — le deep link
 * movviz://title/{type}/{tmdbId} reste néanmoins branché côté MainActivity
 * pour les autres points d'entrée).
 */
object TvChannelProvider {

    private const val CHANNEL_ID_TAG = "movviz_library"
    private const val CHANNEL_NAME = "Movviz"
    private const val CHANNEL_DESCRIPTION = "Reprendre la lecture de votre bibliothèque"
    private const val MAX_PROGRAMS = 15
    private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"

    /** Remplace la rangée du dashboard par les titres à reprendre. Idempotent
     *  et sûr : la chaîne est créée si absente, les programmes sont purgés
     *  puis réinsérés (jamais de doublons ni de cartes périmées). À appeler
     *  à chaque chargement réussi du on-deck. */
    fun sync(context: Context, items: List<OnDeckEntryDto>) {
        try {
            val resolver = context.contentResolver
            val channelId = findOrCreateChannel(context, resolver) ?: return
            replacePrograms(resolver, channelId, items.take(MAX_PROGRAMS))
        } catch (_: Exception) {
            // Boîtier sans launcher compatible / provider restreint : la
            // chaîne n'apparaît pas, l'app continue de fonctionner normalement.
        }
    }

    private fun findOrCreateChannel(context: Context, resolver: ContentResolver): Long? {
        resolver.query(
            TvContract.Channels.CONTENT_URI,
            arrayOf(TvContract.Channels._ID),
            "${TvContract.Channels.COLUMN_INTERNAL_PROVIDER_ID}=?",
            arrayOf(CHANNEL_ID_TAG),
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getLong(0)
        }
        val values = ContentValues().apply {
            put(TvContract.Channels.COLUMN_INTERNAL_PROVIDER_ID, CHANNEL_ID_TAG)
            put(TvContract.Channels.COLUMN_TYPE, TvContract.Channels.TYPE_PREVIEW)
            put(TvContract.Channels.COLUMN_DISPLAY_NAME, CHANNEL_NAME)
            put(TvContract.Channels.COLUMN_DESCRIPTION, CHANNEL_DESCRIPTION)
            put(TvContract.Channels.COLUMN_APP_LINK_INTENT_URI, appLinkIntent())
        }
        val uri = resolver.insert(TvContract.Channels.CONTENT_URI, values) ?: return null
        val channelId = ContentUris.parseId(uri)
        // Rend la chaîne visible sur le dashboard — une seule fois, à la
        // création. Sur Google TV la chaîne apparaît dans l'écran "Chaînes" ;
        // sur Android TV classique, en rangée sur l'accueil.
        try {
            TvContract.requestChannelBrowsable(context, channelId)
        } catch (_: Exception) {
            // Launcher sans support — la chaîne reste enregistrée en local.
        }
        return channelId
    }

    private fun replacePrograms(resolver: ContentResolver, channelId: Long, items: List<OnDeckEntryDto>) {
        resolver.delete(
            TvContract.Programs.CONTENT_URI,
            "${TvContract.Programs.COLUMN_CHANNEL_ID}=?",
            arrayOf(channelId.toString()),
        )
        val now = System.currentTimeMillis()
        val end = now + 3 * 60 * 60 * 1000L
        for (item in items) {
            val isEpisode = item.type == "series" && item.seasonNumber != null && item.episodeNumber != null
            val title = buildString {
                append(item.title ?: "—")
                if (isEpisode) append(" — S").append(item.seasonNumber).append('E').append(item.episodeNumber)
            }
            val values = ContentValues().apply {
                put(TvContract.Programs.COLUMN_CHANNEL_ID, channelId)
                put(TvContract.Programs.COLUMN_TITLE, title)
                if (isEpisode) {
                    put(TvContract.Programs.COLUMN_SEASON_DISPLAY_NUMBER, item.seasonNumber)
                    put(TvContract.Programs.COLUMN_EPISODE_DISPLAY_NUMBER, item.episodeNumber)
                    item.episodeTitle?.let { put(TvContract.Programs.COLUMN_EPISODE_TITLE, it) }
                }
                put(
                    TvContract.Programs.COLUMN_SHORT_DESCRIPTION,
                    if (item.progressPercent > 0) "${item.progressPercent}% regardé" else "Reprendre la lecture",
                )
                item.posterPath?.let { put(TvContract.Programs.COLUMN_POSTER_ART_URI, TMDB_IMAGE_BASE + it) }
                put(TvContract.Programs.COLUMN_START_TIME_UTC_MILLIS, now)
                put(TvContract.Programs.COLUMN_END_TIME_UTC_MILLIS, end)
                // Pas de deep link par programme : TvProvider ne supporte
                // l'intent d'app que par CHAÎNE (COLUMN_APP_LINK_INTENT_URI
                // n'existe pas sur Programs) — cliquer sur une carte ouvre
                // l'app via l'intent leanback de la chaîne.
            }
            resolver.insert(TvContract.Programs.CONTENT_URI, values)
        }
    }

    /** Intent de repli de la chaîne : ouvre simplement l'app (résolu par le
     *  launcher via l'action + catégorie leanback, aucun composant explicite). */
    private fun appLinkIntent(): String =
        Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
            .toUri(Intent.URI_INTENT_SCHEME)
}