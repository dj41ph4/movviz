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

    @POST("api/auth/plex/tv-pin")
    suspend fun createPlexTvPin(): Response<PlexPinDto>

    @POST("api/auth/plex/poll")
    suspend fun pollPlexPin(@Body body: PlexPollRequest): Response<PlexPollDto>

    // Répond 200 même sans session ({"user": null}) — voir MeResponseDto,
    // ne jamais traiter un simple succès HTTP comme "connecté".
    @GET("api/auth/me")
    suspend fun me(): Response<MeResponseDto>

    @GET("api/library/movies")
    suspend fun libraryMovies(@Query("tmdbId") tmdbId: Int? = null): Response<LibraryMoviesResponse>

    @GET("api/library/series")
    suspend fun librarySeries(@Query("tmdbId") tmdbId: Int? = null): Response<LibrarySeriesResponse>

    @GET("api/metadata/detail")
    suspend fun metadataDetail(
        @Query("type") type: String,
        @Query("tmdbId") tmdbId: Int,
    ): Response<MetaDetailDto>

    @GET("api/dashboard/hero")
    suspend fun dashboardHero(): Response<DashboardHeroResponseDto>

    @GET("api/metadata/images")
    suspend fun metadataImages(
        @Query("tmdbId") tmdbId: Int,
        @Query("type") type: String,
    ): Response<MetadataImagesDto>

    @POST("api/library/movies")
    suspend fun addMovie(@Body body: AddToLibraryRequest): Response<Map<String, Any?>>

    @POST("api/library/series")
    suspend fun addSeries(@Body body: AddToLibraryRequest): Response<Map<String, Any?>>

    @GET("api/library/series/{id}")
    suspend fun seriesDetail(@Path("id") id: String): Response<SeriesDetailDto>

    // Même route que SeasonAccordion.tsx côté desktop. Aucun nouvel endpoint
    // serveur : ces données enrichissent les épisodes déjà connus de Plex.
    @GET("api/metadata/season")
    suspend fun metadataSeason(
        @Query("tmdbId") tmdbId: Int,
        @Query("season") seasonNumber: Int,
    ): Response<MetadataSeasonDto>

    @GET("api/metadata/search")
    suspend fun search(@Query("q") query: String, @Query("page") page: Int = 1): Response<SearchResponseDto>

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

    @POST("api/library/series/{id}/season/{season}/search")
    suspend fun searchSeriesSeasonNow(
        @Path("id") libraryId: String,
        @Path("season") seasonNumber: Int,
    ): Response<SearchTriggerResponseDto>

    // File de téléchargement en cours (moteur BitTorrent intégré) — même
    // route que l'onglet Activité desktop (QueueTab.tsx), juste le tab
    // "queue". Le cœur de Movviz n'est pas que la lecture mais aussi la
    // recherche/le téléchargement, donc l'accueil TV en a besoin.
    @GET("api/activity/v2")
    suspend fun queue(@Query("tab") tab: String = "queue"): Response<QueueResponseDto>

    // Réponse au même format que /api/metadata/search (results: [...]),
    // donc réutilisation de SearchResponseDto — sert la rangée "Découverte"
    // de l'accueil (titres tendances pas encore en bibliothèque).
    @GET("api/metadata/trending")
    suspend fun trending(@Query("type") type: String): Response<SearchResponseDto>

    // Statut "vu" manuel par utilisateur (films + épisodes) — voir
    // WatchStatusDto. Sert la fiche titre TV (badge "Vu" sur un film déjà
    // terminé, coche sur les épisodes déjà regardés).
    @GET("api/watch-status")
    suspend fun watchStatus(): Response<WatchStatusDto>

    // Préférences de compte persistées côté serveur (voir
    // src/app/api/settings/preferences/route.ts) — écran Paramètres, section
    // Lecture (langue audio par défaut). Même route que le desktop, PATCH
    // fusionne côté serveur donc envoyer UserPrefsDto seul ne touche jamais
    // les autres champs (theme/gpuTier/...) déjà enregistrés par le client
    // web du même compte.
    @GET("api/settings/preferences")
    suspend fun preferences(): Response<PreferencesResponseDto>

    @retrofit2.http.PATCH("api/settings/preferences")
    suspend fun savePreferences(@Body body: UserPrefsDto): Response<PreferencesResponseDto>

    // Détruit la session côté serveur (voir src/app/api/auth/logout/route.ts)
    // en plus de vider le cookie jar local (ApiClient.clearSession) — sans
    // cet appel, la session restait valide côté serveur (sessions.json)
    // après une "déconnexion" purement locale.
    @POST("api/auth/logout")
    suspend fun logout(): Response<Map<String, Any?>>
}
