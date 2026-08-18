package com.movviz.tv.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Miroir des routes /api réellement utilisées côté web (src/app/api/...)
 *  — aucune nouvelle route serveur, ce client consomme l'API existante
 *  telle quelle. */
interface MovvizApiService {
    // Sert de "ping" de connectivité dans le wizard : répond vite, ne
    // nécessite pas d'être authentifié, et confirme qu'on parle bien à un
    // serveur Movviz (pas juste à un port ouvert au hasard).
    @GET("api/system/changelog")
    suspend fun ping(): Response<Map<String, Any?>>

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    // Répond 200 même sans session ({"user": null}) — voir MeResponseDto,
    // ne jamais traiter un simple succès HTTP comme "connecté".
    @GET("api/auth/me")
    suspend fun me(): Response<MeResponseDto>

    @GET("api/library/movies")
    suspend fun libraryMovies(): Response<LibraryMoviesResponse>

    @GET("api/library/series")
    suspend fun librarySeries(): Response<LibrarySeriesResponse>

    @GET("api/metadata/detail")
    suspend fun metadataDetail(
        @Query("type") type: String,
        @Query("tmdbId") tmdbId: Int,
    ): Response<MetaDetailDto>

    @POST("api/library/movies")
    suspend fun addMovie(@Body body: AddToLibraryRequest): Response<Map<String, Any?>>

    @POST("api/library/series")
    suspend fun addSeries(@Body body: AddToLibraryRequest): Response<Map<String, Any?>>

    @GET("api/library/series/{id}")
    suspend fun seriesDetail(@Path("id") id: String): Response<SeriesDetailDto>

    @GET("api/metadata/search")
    suspend fun search(@Query("q") query: String): Response<SearchResponseDto>

    @GET("api/stream/{ratingKey}/info")
    suspend fun streamInfo(@Path("ratingKey") ratingKey: String): Response<StreamInfoDto>

    @POST("api/stream/{ratingKey}/progress")
    suspend fun streamProgress(
        @Path("ratingKey") ratingKey: String,
        @Body body: ProgressRequest,
    ): Response<Map<String, Any?>>

    @POST("api/stream/{ratingKey}/stop")
    suspend fun streamStop(@Path("ratingKey") ratingKey: String): Response<Map<String, Any?>>

    @GET("api/plex/on-deck")
    suspend fun onDeck(): Response<OnDeckResponseDto>

    // Recherche manuelle "maintenant" pour un titre déjà en bibliothèque —
    // voir SearchTriggerResponseDto. Pas encore branché à l'UI TV, disponible
    // pour l'écran de découverte/téléchargement.
    @POST("api/library/movies/{id}/search")
    suspend fun searchMovieNow(@Path("id") libraryId: String): Response<SearchTriggerResponseDto>

    @POST("api/library/series/{id}/search")
    suspend fun searchSeriesNow(@Path("id") libraryId: String): Response<SearchTriggerResponseDto>
}
