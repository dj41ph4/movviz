package com.movviz.tv.ui.home

import android.util.Log
import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.movviz.tv.data.ApiClient

/**
 * Player ambiant Piped — ExoPlayer natif DASH, muet, autoplay, boucle.
 *
 * Remplace l'iframe YouTube quand le toggle serveur `piped-youtube` est ON.
 * - MediaItem DASH (MIME explicite `application/dash+xml`, l'URL ne finit pas par .mpd)
 * - muted (volume 0f), playWhenReady true, repeat ONE
 * - onError → fallback vers YouTubeWebViewPool côté parent (aucune WebView Piped)
 * - libération propre dans DisposableEffect
 *
 * Ne jamais créer de WebView ici : la fuite mémoire WebView et le
 * blocage intégration YouTube sont exactement ce que Piped contourne.
 */
@Composable
fun PipedAmbientPlayer(
    manifestUrl: String,
    modifier: Modifier = Modifier,
    onPlaying: () -> Unit = {},
    onError: () -> Unit = {},
) {
    val context = LocalContext.current

    if (manifestUrl.isBlank()) {
        // URL vide = configuration incomplète, basculer direct sur fallback
        DisposableEffect(Unit) { onDispose { onError() } }
        return
    }

    // HttpDataSource avec le même OkHttpClient/CookieJar que le reste de
    // l'app — le manifeste /api/trailers/piped/{id}/manifest nécessite la
    // session Movviz (requireUser), alors que les segments eux-mêmes sont des
    // URLs Piped https publiques (BaseURL) sans auth.
    val exoPlayer = remember(manifestUrl) {
        val httpFactory = OkHttpDataSource.Factory(ApiClient.httpClient())
        val mediaSourceFactory = DefaultMediaSourceFactory(context)
            .setDataSourceFactory(httpFactory)

        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build().apply {
                repeatMode = Player.REPEAT_MODE_ONE
                volume = 0f
                playWhenReady = true
                videoScalingMode = C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING

                val item = MediaItem.Builder()
                    .setUri(manifestUrl)
                    .setMimeType(MimeTypes.APPLICATION_MPD)
                    .build()
                setMediaItem(item)
                prepare()
                Log.i("PipedAmbientPlayer", "prepare DASH $manifestUrl")
            }
    }

    DisposableEffect(manifestUrl) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                    Log.i("PipedAmbientPlayer", "PLAYING $manifestUrl")
                    onPlaying()
                }
            }

            override fun onPlaybackStateChanged(state: Int) {
                // STATE_READY + isPlaying est géré via onIsPlayingChanged,
                // mais certains boîtiers n'émettent pas isPlaying immédiatement
                // si la vidéo démarre déjà en boucle — on capte aussi READY
                // comme signal secondaire (le parent fade déjà sur playing).
                if (state == Player.STATE_READY && exoPlayer.isPlaying) {
                    onPlaying()
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.w("PipedAmbientPlayer", "error code=${error.errorCode} msg=${error.message} url=$manifestUrl", error)
                onError()
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
            Log.i("PipedAmbientPlayer", "released $manifestUrl")
        }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = false
                // Le rendu vidéo n'a jamais besoin du focus D-pad — sinon
                // cette View native capte le focus et bloque toute la nav,
                // même piège que PlayerActivity (voir FOCUS_BLOCK_DESCENDANTS).
                isFocusable = false
                isFocusableInTouchMode = false
                descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                // Couvrir entièrement le hero, même si le DASH est en 4:3 ou
                // 2.39 — même effet cover que le backdrop Image(Crop) et que
                // l'iframe YouTube oversizée.
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
            }
        },
        update = { view ->
            if (view.player !== exoPlayer) view.player = exoPlayer
        },
        modifier = modifier,
        onRelease = { view ->
            // Ne pas release ici — DisposableEffect ci-dessus est la seule
            // source de vérité, sinon double-release en cas de recomposition.
            view.player = null
        },
    )
}
