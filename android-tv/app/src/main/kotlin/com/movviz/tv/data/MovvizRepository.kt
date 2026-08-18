package com.movviz.tv.data

/** Résultat uniforme des appels réseau — évite de faire fuiter les
 *  exceptions Retrofit/OkHttp jusqu'aux écrans, qui n'ont qu'à gérer trois
 *  états (succès / erreur réseau / non autorisé). */
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Failure(val message: String) : ApiResult<Nothing>()
    data object Unauthorized : ApiResult<Nothing>()
}

class MovvizRepository(private val baseUrl: String) {
    private val api get() = ApiClient.service(baseUrl)

    suspend fun ping(): ApiResult<Unit> = safeCall { api.ping() }.let {
        when (it) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> it
            ApiResult.Unauthorized -> ApiResult.Success(Unit) // 401 = vrai serveur Movviz, juste pas connecté
        }
    }

    suspend fun login(username: String, password: String): ApiResult<MovvizUserDto> {
        return safeCall { api.login(LoginRequest(username, password)) }.let { result ->
            when (result) {
                is ApiResult.Success -> {
                    val user = result.data.user
                    if (user != null) ApiResult.Success(user)
                    else ApiResult.Failure(result.data.error ?: "invalid_credentials")
                }
                is ApiResult.Failure -> result
                ApiResult.Unauthorized -> ApiResult.Failure("invalid_credentials")
            }
        }
    }

    suspend fun movies(): ApiResult<List<LibraryMovieDto>> =
        safeCall { api.libraryMovies() }.map { it.movies }

    suspend fun series(): ApiResult<List<LibrarySeriesDto>> =
        safeCall { api.librarySeries() }.map { it.series }

    /** Ping authentifié — sert à savoir, au lancement, si le cookie de
     *  session persisté (voir PersistentCookieJar) est toujours valide,
     *  pour sauter l'écran de login quand c'est le cas (comme Plex/Netflix
     *  qui ne redemandent jamais les identifiants tant que la session tient).
     *  /api/auth/me répond 200 même sans être connecté (user: null) — un
     *  succès HTTP seul ne prouve rien, confirmé en live (accueil accessible
     *  sans jamais avoir saisi d'identifiants). Il faut que user soit
     *  réellement non-null. */
    suspend fun hasValidSession(): Boolean {
        val result = safeCall { api.me() }
        return result is ApiResult.Success && result.data.user != null
    }

    suspend fun detail(type: String, tmdbId: Int): ApiResult<MetaDetailDto> =
        safeCall { api.metadataDetail(type, tmdbId) }

    suspend fun seriesSeasons(seriesId: String): ApiResult<List<SeriesSeasonDto>> =
        safeCall { api.seriesDetail(seriesId) }.map { it.seasons }

    suspend fun search(query: String): ApiResult<List<SearchResultDto>> =
        safeCall { api.search(query) }.map { it.results }

    /** Liste brute "Continuer à regarder" — voir OnDeckEntryDto. Distinct de
     *  resumeOffsetMs ci-dessous, qui ne fait qu'y chercher une seule entrée
     *  précise pour calculer un offset de reprise ; ici on veut la rangée
     *  entière pour l'accueil. */
    suspend fun onDeckItems(): ApiResult<List<OnDeckEntryDto>> =
        safeCall { api.onDeck() }.map { it.items }

    /** File de téléchargement en cours — voir QueueItemDto. */
    suspend fun queue(): ApiResult<List<QueueItemDto>> =
        safeCall { api.queue() }.map { it.items }

    /** Titres tendance TMDb, tous confondus (bibliothèque ou non) — le
     *  filtrage "pas encore en bibliothèque" se fait côté AppViewModel, qui
     *  a déjà movies()/series() chargés, plutôt que de dupliquer cette
     *  logique ici. */
    suspend fun trending(type: String): ApiResult<List<SearchResultDto>> =
        safeCall { api.trending(type) }.map { it.results }

    suspend fun addToLibrary(type: String, tmdbId: Int): ApiResult<Unit> {
        val result = safeCall {
            if (type == "movie") api.addMovie(AddToLibraryRequest(tmdbId))
            else api.addSeries(AddToLibraryRequest(tmdbId))
        }
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
            ApiResult.Unauthorized -> ApiResult.Unauthorized
        }
    }

    /** Construit l'URL de lecture directe — /api/stream/{ratingKey} sert les
     *  octets vidéo avec support des requêtes range (voir la route serveur),
     *  exactement ce qu'attend ExoPlayer. Le cookie de session posé au login
     *  s'applique automatiquement (même OkHttpClient/CookieJar partagé). */
    fun streamUrl(plexRatingKey: String): String = "$baseUrl/api/stream/$plexRatingKey"

    /** URL de repli quand le direct-play échoue (codec non décodable
     *  nativement par ExoPlayer) — démarre une session de transcodage Plex
     *  côté serveur et renvoie un manifeste HLS (.m3u8). tv=1&ta=1 = le
     *  serveur ré-encode vidéo ET audio dans un format universellement lisible
     *  (h264/aac), le repli le plus sûr possible (voir transcode/route.ts —
     *  ne PAS toucher cette route, elle contient déjà toute la logique de
     *  décision copy/transcode). */
    fun transcodeUrl(plexRatingKey: String): String = "$baseUrl/api/stream/$plexRatingKey/transcode?tv=1&ta=1"

    suspend fun streamInfo(plexRatingKey: String): ApiResult<StreamInfoDto> =
        safeCall { api.streamInfo(plexRatingKey) }

    /** Ping "best-effort" de progression — jamais fatal pour la lecture,
     *  Plex n'a besoin de savoir où on en est que pour la reprise/l'état
     *  "en cours de lecture" côté serveur, un échec réseau ponctuel ne doit
     *  jamais interrompre le lecteur. */
    suspend fun reportProgress(plexRatingKey: String, offsetMs: Long, state: String) {
        runCatching { api.streamProgress(plexRatingKey, ProgressRequest(offsetMs, state)) }
    }

    suspend fun reportStop(plexRatingKey: String) {
        runCatching { api.streamStop(plexRatingKey) }
    }

    /** Position de reprise (ms) — l'entrée on-deck expose désormais offsetMs
     *  (viewOffset Plex brut, exact) en plus de progressPercent, donc plus
     *  besoin de reconstituer un offset approximatif à partir du pourcentage
     *  et de la durée réelle obtenue via streamInfo. durationMs (optionnel)
     *  ne sert plus qu'à ignorer une reprise aberrante (offset ≥ durée,
     *  fichier remplacé entre-temps par exemple). Retourne null si rien à
     *  reprendre (< 2%, jamais commencé, ou terminé à plus de 95% — pas la
     *  peine de "reprendre" un film déjà fini). */
    suspend fun resumeOffsetMs(
        type: String,
        tmdbId: Int,
        durationMs: Long?,
        seasonNumber: Int? = null,
        episodeNumber: Int? = null,
    ): Long? {
        val result = safeCall { api.onDeck() }
        val items = (result as? ApiResult.Success)?.data?.items ?: return null
        val match = items.firstOrNull { entry ->
            entry.tmdbId == tmdbId &&
                (type == "movie" && entry.type == "movie" ||
                    type == "series" && entry.type == "episode" &&
                        entry.seasonNumber == seasonNumber && entry.episodeNumber == episodeNumber)
        } ?: return null
        if (match.progressPercent < 2 || match.progressPercent > 95) return null
        if (match.offsetMs <= 0) return null
        if (durationMs != null && durationMs > 0 && match.offsetMs >= durationMs) return null
        return match.offsetMs
    }

    /** Déclenche une recherche indexeurs manuelle pour un film déjà en
     *  bibliothèque (ex: statut "missing"/"searching" bloqué). Réponse
     *  immédiate côté serveur, le vrai grab tourne en tâche de fond — voir
     *  SearchTriggerResponseDto. Pas encore branché à l'UI, pour l'agent
     *  découverte/téléchargement. */
    suspend fun searchMovieNow(libraryId: String): ApiResult<Unit> =
        safeCall { api.searchMovieNow(libraryId) }.map { }

    suspend fun searchSeriesNow(libraryId: String): ApiResult<Unit> =
        safeCall { api.searchSeriesNow(libraryId) }.map { }

    private fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
        is ApiResult.Success -> ApiResult.Success(transform(data))
        is ApiResult.Failure -> this
        ApiResult.Unauthorized -> ApiResult.Unauthorized
    }

    private suspend fun <T> safeCall(block: suspend () -> retrofit2.Response<T>): ApiResult<T> {
        return try {
            val response = block()
            val body = response.body()
            when {
                response.code() == 401 -> ApiResult.Unauthorized
                response.isSuccessful && body != null -> ApiResult.Success(body)
                else -> ApiResult.Failure("Erreur serveur (${response.code()})")
            }
        } catch (e: java.io.IOException) {
            ApiResult.Failure(e.message ?: "Impossible de joindre le serveur")
        }
    }
}
