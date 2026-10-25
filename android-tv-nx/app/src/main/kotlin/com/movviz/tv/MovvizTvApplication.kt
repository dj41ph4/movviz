package com.movviz.tv

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.decode.SvgDecoder
import coil.memory.MemoryCache
import com.movviz.tv.data.ApiClient
import com.movviz.tv.data.ServerPrefs
import com.movviz.tv.ui.theme.CinemaSplashAssets
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

/** Initialise le CookieJar persistant avant que quoi que ce soit d'autre
 *  (MainActivity, AppViewModel) ne puisse déclencher un appel réseau, et
 *  fournit l'ImageLoader Coil partagé par tous les écrans (posters/backdrops
 *  TMDb, chargés en dizaines d'exemplaires dans les TvLazyRow). */
class MovvizTvApplication : Application(), ImageLoaderFactory {
    private var videoCacheInstance: SimpleCache? = null

    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(this)
        // Splash Bêta : lire la préférence puis décoder les images PENDANT que l'activité se crée,
        // hors du thread principal. Quand le splash est composé, tout est déjà prêt.
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val beta = runCatching { ServerPrefs(applicationContext).betaUiEnabled.first() }.getOrDefault(false)
            CinemaSplashAssets.betaHint = beta
            if (beta) CinemaSplashAssets.preload(applicationContext)
        }
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .components { add(SvgDecoder.Factory()) }
        // Client HTTP PARTAGÉ avec l'API (même CookieJar persistant), comme
        // sur le client mobile : les avatars protégés par la session (401 sans
        // cookie) se chargent comme les posters publics. Avec le client
        // anonyme par défaut de Coil, la photo de profil restait vide et
        // retombait sur les initiales.
        .okHttpClient(ApiClient.httpClient())
        // RGB_565 (2 octets/pixel) seulement pour les images SANS transparence
        // (affiches et fonds JPEG TMDb : moitié moins de mémoire, sensible sur un
        // boîtier TV à 1-2 Go). Forcer RGB_565 partout supprimait le canal alpha :
        // logos de plateformes (SVG) et logos de titres PNG s'affichaient sur un
        // rectangle noir. allowRgb565 laisse Coil garder ARGB_8888 quand l'image
        // a de la transparence.
        .allowRgb565(true)
        .memoryCache {
            MemoryCache.Builder(this)
                .maxSizePercent(0.20)
                .build()
        }
        // Les affiches, backdrops et logos TMDb utilisent tous leur URL
        // canonique comme clé Coil. Un logo de série (ex. Futurama) est donc
        // téléchargé une fois, puis partagé par la fiche, chaque épisode et
        // toutes les rangées, y compris après un redémarrage de l'app. Le
        // cache reste borné et Android peut toujours le purger si nécessaire.
        .diskCache {
            DiskCache.Builder()
                .directory(File(cacheDir, "movviz-image-cache"))
                .maxSizeBytes(160L * 1024L * 1024L)
                .build()
        }
        .crossfade(false)
        .build()

    /** Cache disque partagé par tous les lecteurs de la TV. 1,5 Go est assez
     * grand pour absorber les relectures et les sauts arrière, tout en restant
     * borné : on ne transforme pas le boîtier en copie de toute la médiathèque. */
    @Synchronized
    fun videoCache(): SimpleCache {
        return videoCacheInstance ?: SimpleCache(
            File(cacheDir, "movviz-video-cache"),
            LeastRecentlyUsedCacheEvictor(1_500L * 1024L * 1024L),
            StandaloneDatabaseProvider(this),
        ).also { videoCacheInstance = it }
    }

    override fun onTerminate() {
        videoCacheInstance?.release()
        videoCacheInstance = null
        super.onTerminate()
    }
}
