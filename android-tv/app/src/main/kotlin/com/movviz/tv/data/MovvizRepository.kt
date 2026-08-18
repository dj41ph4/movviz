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
     *  qui ne redemandent jamais les identifiants tant que la session tient). */
    suspend fun hasValidSession(): Boolean = safeCall { api.me() } is ApiResult.Success

    suspend fun detail(type: String, tmdbId: Int): ApiResult<MetaDetailDto> =
        safeCall { api.metadataDetail(type, tmdbId) }

    suspend fun seriesSeasons(seriesId: String): ApiResult<List<SeriesSeasonDto>> =
        safeCall { api.seriesDetail(seriesId) }.map { it.seasons }

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
