package com.movviz.mobile.discover

import com.movviz.tv.data.ApiClient
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Discover-only Retrofit surface. android-shared compiles android-tv's data
 * layer as source (see android-shared/build.gradle.kts) and MovvizApiService
 * already exposes GET api/metadata/rows, but not with the ranked/meta fields
 * this feature needs, and not /genres, /row-page or the filter-browse
 * /discover route at all — extending it would mean editing a file under
 * android-tv/, off-limits for this mobile-only feature. Same shared OkHttp
 * client (ApiClient.httpClient() — same PersistentCookieJar, same session)
 * so auth stays identical, just a second small Retrofit instance + its own
 * reflection-based Moshi (no codegen plugin in this project, see ApiClient.kt).
 */
interface DiscoverApiService {
    @GET("api/metadata/rows")
    suspend fun rows(@Query("type") type: String): Response<DiscoverRowsResponseDto>

    // Même moteur personnel que l'onglet « Recommandé » desktop. Les écrans
    // mobile le croisent avec la bibliothèque locale avant affichage : une
    // suggestion de cette zone est donc toujours lisible immédiatement.
    @GET("api/metadata/recommendations")
    suspend fun recommendations(@Query("type") type: String): Response<DiscoverPageDto>

    @GET("api/metadata/genres")
    suspend fun genres(@Query("type") type: String): Response<DiscoverGenresResponseDto>

    // `key` is left un-encoded by Retrofit by default, which is what we want:
    // a "becauseYouWatched:123456" key gets its colon percent-encoded
    // automatically, matching desktop's explicit encodeURIComponent(rowCategory).
    @GET("api/metadata/row-page")
    suspend fun rowPage(
        @Query("type") type: String,
        @Query("key") key: String,
        @Query("page") page: Int,
    ): Response<DiscoverPageDto>

    // The filter-browse endpoint desktop's grid uses for genre/year/sort —
    // `genre` also accepts the two synthetic ids ("anime"/"teen" from
    // genreTaxonomy.ts) exactly like a real numeric TMDb id, same contract.
    @GET("api/metadata/discover")
    suspend fun browse(
        @Query("type") type: String,
        @Query("genre") genre: String? = null,
        @Query("year") year: String? = null,
        @Query("sort") sort: String? = null,
        @Query("page") page: Int = 1,
    ): Response<DiscoverPageDto>

    @GET("api/metadata/search")
    suspend fun search(
        @Query("q") q: String,
        @Query("type") type: String,
        @Query("page") page: Int,
    ): Response<DiscoverPageDto>
}

object DiscoverApiClient {
    private val moshi: Moshi by lazy { Moshi.Builder().add(KotlinJsonAdapterFactory()).build() }
    private var cachedBaseUrl: String? = null
    private var cachedService: DiscoverApiService? = null

    fun service(baseUrl: String): DiscoverApiService {
        val normalized = baseUrl.trim().trimEnd('/')
        cachedService?.let { if (cachedBaseUrl == normalized) return it }
        val retrofit = Retrofit.Builder()
            .baseUrl("$normalized/")
            .client(ApiClient.httpClient())
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
        return retrofit.create(DiscoverApiService::class.java).also {
            cachedBaseUrl = normalized
            cachedService = it
        }
    }
}
