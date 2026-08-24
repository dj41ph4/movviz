package com.movviz.mobile.discover

import com.movviz.tv.data.ApiResult
import retrofit2.Response

/** Same ApiResult<T> shape as MovvizRepository (com.movviz.tv.data) — reused
 *  as-is so Discover screens degrade (network error / session expired)
 *  exactly like every other mobile screen. */
class DiscoverRepository(baseUrl: String) {
    private val api = DiscoverApiClient.service(baseUrl)

    suspend fun rows(type: String): ApiResult<DiscoverRowsResponseDto> =
        safeCall { api.rows(type) }

    suspend fun genres(type: String): ApiResult<List<DiscoverGenreDto>> =
        safeCall { api.genres(type) }.map { it.genres }

    suspend fun rowPage(type: String, key: String, page: Int): ApiResult<DiscoverPageDto> =
        safeCall { api.rowPage(type, key, page) }

    suspend fun browse(type: String, genre: String?, page: Int): ApiResult<DiscoverPageDto> =
        safeCall { api.browse(type = type, genre = genre, page = page) }

    suspend fun search(q: String, type: String, page: Int): ApiResult<DiscoverPageDto> =
        safeCall { api.search(q, type, page) }

    private fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
        is ApiResult.Success -> ApiResult.Success(transform(data))
        is ApiResult.Failure -> this
        ApiResult.Unauthorized -> ApiResult.Unauthorized
    }

    private suspend fun <T> safeCall(block: suspend () -> Response<T>): ApiResult<T> {
        return try {
            val response = block()
            val body = response.body()
            when {
                response.code() == 401 -> ApiResult.Unauthorized
                response.isSuccessful && body != null -> ApiResult.Success(body)
                else -> ApiResult.Failure("Erreur serveur (${response.code()})")
            }
        } catch (e: Exception) {
            ApiResult.Failure(e.message ?: "Impossible de joindre le serveur")
        }
    }
}
