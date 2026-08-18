package com.movviz.tv.ui.player

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import com.movviz.tv.data.ApiClient

private const val EXTRA_STREAM_URL = "extra_stream_url"

/**
 * Activity dédiée pour la lecture — Media3 gère lui-même le fullscreen/les
 * contrôles télécommande (play/pause/seek sur les touches média du D-pad).
 * La source vidéo est /api/stream/{ratingKey} (voir MovvizRepository) :
 * le serveur y proxy directement les octets Plex avec support des requêtes
 * range, exactement ce qu'ExoPlayer attend d'une source progressive.
 * OkHttpDataSource réutilise le MÊME OkHttpClient (donc le même CookieJar)
 * que les appels API — le cookie de session posé au login s'applique donc
 * aussi au flux vidéo, sans rien dupliquer.
 */
class PlayerActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val streamUrl = intent.getStringExtra(EXTRA_STREAM_URL) ?: run { finish(); return }

        setContent {
            androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
                PlayerScreen(streamUrl = streamUrl)
            }
        }
    }

    companion object {
        fun extraStreamUrl() = EXTRA_STREAM_URL
    }
}

@androidx.compose.runtime.Composable
private fun PlayerScreen(streamUrl: String) {
    val context = androidx.compose.ui.platform.LocalContext.current

    val exoPlayer = remember {
        val dataSourceFactory = OkHttpDataSource.Factory(ApiClient.httpClient())
        val mediaSourceFactory = DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory)
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()
            .apply {
                setMediaItem(MediaItem.fromUri(streamUrl))
                playWhenReady = true
                prepare()
            }
    }

    DisposableEffect(Unit) {
        onDispose { exoPlayer.release() }
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                player = exoPlayer
                useController = true
            }
        },
        modifier = Modifier.fillMaxSize(),
    )
}
