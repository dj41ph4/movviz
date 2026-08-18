package com.movviz.tv

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.memory.MemoryCache
import com.movviz.tv.data.ApiClient

/** Initialise le CookieJar persistant avant que quoi que ce soit d'autre
 *  (MainActivity, AppViewModel) ne puisse déclencher un appel réseau, et
 *  fournit l'ImageLoader Coil partagé par tous les écrans (posters/backdrops
 *  TMDb, chargés en dizaines d'exemplaires dans les TvLazyRow). */
class MovvizTvApplication : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(this)
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        // RGB_565 (2 octets/pixel) au lieu du ARGB_8888 par défaut (4
        // octets/pixel) : les posters/backdrops TMDb sont des JPEG opaques,
        // aucun canal alpha à perdre — moitié moins de mémoire pour un cache
        // qui contient facilement 50+ affiches en même temps sur l'accueil,
        // sensible sur un boîtier TV à 1-2 Go de RAM.
        .bitmapConfig(Bitmap.Config.RGB_565)
        .memoryCache {
            MemoryCache.Builder(this)
                .maxSizePercent(0.2)
                .build()
        }
        .crossfade(false)
        .build()
}
