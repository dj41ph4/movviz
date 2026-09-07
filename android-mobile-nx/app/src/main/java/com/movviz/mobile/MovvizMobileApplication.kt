package com.movviz.mobile

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.memory.MemoryCache
import com.movviz.tv.data.ApiClient
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

class MovvizMobileApplication : Application(), ImageLoaderFactory {
    private var videoCacheInstance: SimpleCache? = null

    override fun onCreate() {
        super.onCreate()
        ApiClient.initialize(this)
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .bitmapConfig(Bitmap.Config.RGB_565)
        .memoryCache {
            MemoryCache.Builder(this)
                .maxSizePercent(0.10)
                .build()
        }
        .crossfade(false)
        // Same shared OkHttpClient as the rest of the app (ApiClient.httpClient(),
        // same PersistentCookieJar) — most images (TMDb posters/backdrops) don't
        // need it, but the player's scrub-thumb preview (/api/stream/{ratingKey}/
        // scrub-thumb, a Movviz-authenticated proxy, not TMDb) 401s without the
        // session cookie Coil's own default client wouldn't otherwise carry.
        .okHttpClient { ApiClient.httpClient() }
        .build()

    @Synchronized
    fun videoCache(): SimpleCache {
        return videoCacheInstance ?: SimpleCache(
            File(cacheDir, "movviz-video-cache"),
            LeastRecentlyUsedCacheEvictor(500L * 1024L * 1024L),
            StandaloneDatabaseProvider(this),
        ).also { videoCacheInstance = it }
    }

    override fun onTerminate() {
        videoCacheInstance?.release()
        videoCacheInstance = null
        super.onTerminate()
    }
}
