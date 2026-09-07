package com.movviz.tv.tvchannel

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.tvprovider.media.tv.PreviewChannel
import androidx.tvprovider.media.tv.PreviewProgram
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import com.movviz.tv.R
import com.movviz.tv.data.OnDeckEntryDto

/**
 * Deux rangées Android TV / Google TV, toutes deux backées par le TvProvider
 * du système — aucune API réservée, n'importe quelle app peut y publier :
 *
 * - **Chaîne "Movviz"** : une rangée dédiée sur le dashboard, listant les
 *   titres "à reprendre" du compte actif.
 * - **Rangée système "Continuer"** (Watch Next) : la rangée partagée tout en
 *   haut de l'accueil Google TV, celle que Plex/Netflix alimentent pour
 *   proposer une reprise même quand leur app n'est pas ouverte — c'est
 *   exactement ce mécanisme-là (demande explicite utilisateur, confirmé
 *   possible et implémenté ici).
 *
 * Contrairement à l'ancienne implémentation basée sur `android.media.tv.TvContract`
 * brut, celle-ci utilise `androidx.tvprovider` (Builders typés) : chaque
 * carte reçoit désormais son propre `setIntentUri()` vers
 * `movviz://title/{type}/{tmdbId}` (le deep link NavHost déjà branché dans
 * `MainActivity.kt`) — fini l'ouverture générique de l'app au clic, seule
 * limite que l'API bas-niveau imposait.
 */
object TvChannelProvider {

    private const val CHANNEL_INTERNAL_ID = "movviz_library"
    private const val CHANNEL_NAME = "Movviz"
    private const val CHANNEL_DESCRIPTION = "Reprendre la lecture de votre bibliothèque"
    private const val MAX_PROGRAMS = 15
    private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"

    /** Préfixe des `internalProviderId` que CETTE app pose dans la rangée
     *  Watch Next, partagée entre toutes les apps du boîtier — indispensable
     *  pour ne jamais lister, mettre à jour ou supprimer l'entrée d'une
     *  autre app en la confondant avec une des nôtres. */
    private const val WATCH_NEXT_ID_PREFIX = "movviz:"

    /** Remplace la chaîne "Movviz" et met à jour la rangée Watch Next à
     *  partir des mêmes titres "à reprendre". Idempotent et sûr : à appeler
     *  à chaque chargement réussi du on-deck. */
    fun sync(context: Context, items: List<OnDeckEntryDto>) {
        val trimmed = items.take(MAX_PROGRAMS)
        try {
            syncChannel(context, trimmed)
        } catch (e: Exception) {
            // Boîtier sans launcher compatible / provider restreint : la
            // chaîne n'apparaît pas, l'app continue de fonctionner normalement.
            android.util.Log.w("TvChannelProvider", "syncChannel failed", e)
        }
        try {
            syncWatchNext(context, trimmed)
        } catch (e: Exception) {
            android.util.Log.w("TvChannelProvider", "syncWatchNext failed", e)
            // Même repli — la rangée système "Continuer" est un bonus, pas
            // un prérequis au fonctionnement de l'app.
        }
    }

    // -------------------------------------------------------------------
    // Chaîne "Movviz"
    // -------------------------------------------------------------------

    private fun syncChannel(context: Context, items: List<OnDeckEntryDto>) {
        val resolver = context.contentResolver
        val channelId = findOrCreateChannel(context) ?: return
        resolver.delete(
            TvContractCompat.PreviewPrograms.CONTENT_URI,
            "${TvContractCompat.PreviewPrograms.COLUMN_CHANNEL_ID}=?",
            arrayOf(channelId.toString()),
        )
        for (item in items) {
            val program = PreviewProgram.Builder()
                .setChannelId(channelId)
                .setType(programType(item))
                .setTitle(episodeAwareTitle(item))
                .setDescription(progressDescription(item))
                .setIntentUri(titleDeepLink(item))
                .setInternalProviderId(watchNextInternalId(item))
                .apply { posterUri(item)?.let { setPosterArtUri(it) } }
                .build()
            resolver.insert(TvContractCompat.PreviewPrograms.CONTENT_URI, program.toContentValues())
        }
    }

    /** Le TvProvider REFUSE toute clause `selection` sur `Channels.CONTENT_URI`
     *  pour une app tierce (`SecurityException: Selection not allowed`,
     *  confirmé en direct sur cette build) — protection anti-fingerprinting
     *  des autres apps TV installées. `PreviewChannelHelper` existe
     *  précisément pour ça : il liste TOUTES les chaînes sans filtre côté
     *  provider, le tri par `internalProviderId` se fait ensuite en mémoire. */
    private fun findOrCreateChannel(context: Context): Long? {
        val helper = androidx.tvprovider.media.tv.PreviewChannelHelper(context)
        helper.allChannels.firstOrNull { it.internalProviderId == CHANNEL_INTERNAL_ID }?.let { return it.id }

        val channel = PreviewChannel.Builder()
            .setInternalProviderId(CHANNEL_INTERNAL_ID)
            .setDisplayName(CHANNEL_NAME)
            .setDescription(CHANNEL_DESCRIPTION)
            // Obligatoire : PreviewChannelHelper.publishChannel() écrit le
            // logo juste après l'insertion et annule la création entière de
            // la chaîne (IOException, confirmé en direct) si aucun logo
            // n'est fourni — l'icône de lancement de l'app fait l'affaire.
            .setLogo(launcherIconBitmap(context))
            .setAppLinkIntentUri(
                Uri.parse(
                    Intent(Intent.ACTION_MAIN)
                        .addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
                        .toUri(Intent.URI_INTENT_SCHEME),
                ),
            )
            .build()
        val channelId = helper.publishChannel(channel)
        // Rend la chaîne visible sur le dashboard — une seule fois, à la
        // création. Sur Google TV la chaîne apparaît dans l'écran "Chaînes" ;
        // sur Android TV classique, en rangée sur l'accueil.
        try {
            TvContractCompat.requestChannelBrowsable(context, channelId)
        } catch (_: Exception) {
            // Launcher sans support — la chaîne reste enregistrée en local.
        }
        return channelId
    }

    // -------------------------------------------------------------------
    // Rangée système "Continuer" (Watch Next)
    // -------------------------------------------------------------------

    private fun syncWatchNext(context: Context, items: List<OnDeckEntryDto>) {
        val resolver = context.contentResolver
        val ours = queryOwnWatchNextEntries(resolver)
        val currentIds = items.map { watchNextInternalId(it) }.toSet()

        // Retire les reprises qui ne sont plus d'actualité (terminées,
        // retirées de la bibliothèque…) — jamais l'entrée d'une autre app,
        // grâce au filtre par préfixe déjà appliqué dans queryOwnWatchNextEntries.
        for ((internalId, program) in ours) {
            if (internalId !in currentIds) {
                resolver.delete(TvContractCompat.buildWatchNextProgramUri(program.id), null, null)
            }
        }

        for (item in items) {
            val internalId = watchNextInternalId(item)
            val existing = ours[internalId]
            // Une carte explicitement retirée par l'utilisateur (browsable=0)
            // ne doit jamais être ressuscitée automatiquement au prochain
            // sync — on repart d'un programme neuf plutôt que de la rouvrir.
            val dismissed = existing != null && !existing.isBrowsable
            if (dismissed) {
                resolver.delete(TvContractCompat.buildWatchNextProgramUri(existing!!.id), null, null)
            }
            val reusable = existing != null && !dismissed
            val builder = if (reusable) {
                WatchNextProgram.Builder(existing)
            } else {
                WatchNextProgram.Builder()
                    .setInternalProviderId(internalId)
                    .setType(programType(item))
                    .setTitle(episodeAwareTitle(item))
                    .setIntentUri(titleDeepLink(item))
            }
            builder
                .setWatchNextType(TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE)
                .setLastEngagementTimeUtcMillis(if (item.lastPlayedAt > 0) item.lastPlayedAt else System.currentTimeMillis())
            if (item.offsetMs > 0) builder.setLastPlaybackPositionMillis(item.offsetMs.toInt())
            posterUri(item)?.let { builder.setPosterArtUri(it) }

            val values = builder.build().toContentValues()
            if (reusable) {
                resolver.update(TvContractCompat.buildWatchNextProgramUri(existing!!.id), values, null, null)
            } else {
                resolver.insert(TvContractCompat.WatchNextPrograms.CONTENT_URI, values)
            }
        }
    }

    /** Uniquement les entrées posées par CETTE app (préfixe dédié) — la
     *  rangée Watch Next est partagée par tout le boîtier. */
    private fun queryOwnWatchNextEntries(resolver: ContentResolver): Map<String, WatchNextProgram> {
        val map = mutableMapOf<String, WatchNextProgram>()
        resolver.query(TvContractCompat.WatchNextPrograms.CONTENT_URI, null, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val program = WatchNextProgram.fromCursor(cursor)
                val internalId = program.internalProviderId ?: continue
                if (internalId.startsWith(WATCH_NEXT_ID_PREFIX)) map[internalId] = program
            }
        }
        return map
    }

    // -------------------------------------------------------------------
    // Commun
    // -------------------------------------------------------------------

    private fun isEpisode(item: OnDeckEntryDto): Boolean =
        item.type == "series" && item.seasonNumber != null && item.episodeNumber != null

    private fun programType(item: OnDeckEntryDto): Int =
        if (isEpisode(item)) TvContractCompat.PreviewPrograms.TYPE_TV_EPISODE else TvContractCompat.PreviewPrograms.TYPE_MOVIE

    private fun episodeAwareTitle(item: OnDeckEntryDto): String = buildString {
        append(item.title ?: "—")
        if (isEpisode(item)) append(" — S").append(item.seasonNumber).append('E').append(item.episodeNumber)
    }

    private fun progressDescription(item: OnDeckEntryDto): String =
        if (item.progressPercent > 0) "${item.progressPercent}% regardé" else "Reprendre la lecture"

    private fun posterUri(item: OnDeckEntryDto): Uri? = item.posterPath?.let { Uri.parse(TMDB_IMAGE_BASE + it) }

    /** Identifiant stable par titre (ou par épisode précis pour une série) —
     *  sert à la fois d'`internalProviderId` Watch Next (dédoublonnage/mise à
     *  jour plutôt que doublon à chaque sync) et de clé de tri interne. */
    private fun watchNextInternalId(item: OnDeckEntryDto): String =
        if (isEpisode(item)) {
            "$WATCH_NEXT_ID_PREFIX${item.type}:${item.tmdbId}:${item.seasonNumber}:${item.episodeNumber}"
        } else {
            "$WATCH_NEXT_ID_PREFIX${item.type}:${item.tmdbId}"
        }

    /** `movviz://title/{type}/{tmdbId}` — le deep link NavHost déjà branché
     *  dans `MainActivity.kt` (navDeepLink uriPattern). Une carte de la
     *  chaîne ou de Watch Next ouvre donc directement la fiche du titre, pas
     *  seulement l'app. */
    private fun titleDeepLink(item: OnDeckEntryDto): Uri = Uri.parse("movviz://title/${item.type}/${item.tmdbId}")

    /** L'icône de lancement de l'app, rendue en Bitmap — `setLogo()` n'accepte
     *  qu'un Bitmap, jamais une ressource drawable/mipmap directement (icône
     *  adaptative comprise). */
    private fun launcherIconBitmap(context: Context): Bitmap {
        val drawable = ContextCompat.getDrawable(context, R.mipmap.ic_launcher)
        val size = 192
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        drawable?.setBounds(0, 0, size, size)
        drawable?.draw(Canvas(bitmap))
        return bitmap
    }
}
