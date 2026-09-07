package com.movviz.mobile.discover

/**
 * DTOs for the Discover feature's own routes (/api/metadata/rows, /genres,
 * /row-page, /discover, /search) — kept entirely inside android-mobile/
 * rather than added to android-tv's ApiModels.kt (android-shared/build.gradle.kts
 * compiles that file as source, but this feature must never modify anything
 * under android-tv/). See DiscoverApi.kt for why a second, separate Retrofit
 * surface exists instead of extending MovvizApiService/MovvizRepository.
 *
 * Field shapes mirror src/app/api/metadata/{rows,row-page,genres,discover,search}/route.ts
 * and MetaSearchResult (src/lib/metadata/types.ts) exactly — reflection-based
 * Moshi (see DiscoverApi.kt, same KotlinJsonAdapterFactory as ApiClient.kt)
 * matches JSON keys to these Kotlin property names directly, no @Json aliases
 * needed since the server already returns camelCase.
 */

data class DiscoverResultDto(
    val tmdbId: Int,
    val type: String,
    val title: String,
    val year: Int? = null,
    val releaseDate: String? = null,
    val overview: String = "",
    val posterPath: String? = null,
    val backdropPath: String? = null,
    val rating: Double = 0.0,
)

/** Carried by a "becauseYouWatched:{anchorTmdbId}" row so its label can be
 *  built client-side, same reasoning as the desktop RowMeta (discover/page.tsx)
 *  — see becauseYouWatched.ts for what verb "watched" vs "liked" means. */
data class DiscoverRowMetaDto(
    val anchorTmdbId: Int,
    val anchorTitle: String,
    val verb: String, // "watched" | "liked"
)

data class DiscoverRowDto(
    val key: String,
    val results: List<DiscoverResultDto> = emptyList(),
    val ranked: Boolean = false,
    val meta: DiscoverRowMetaDto? = null,
)

data class DiscoverRowsResponseDto(
    val configured: Boolean = true,
    val layout: String = "movviz",
    val rows: List<DiscoverRowDto> = emptyList(),
)

data class DiscoverGenreDto(
    val id: Int,
    val name: String,
)

data class DiscoverGenresResponseDto(
    val genres: List<DiscoverGenreDto> = emptyList(),
)

/** Shared shape for /row-page, /discover (filter browse) and /search — all
 *  three return {results, page, totalPages[, meta]}; extra JSON fields
 *  (e.g. /search's "configured") are simply ignored by Moshi. */
data class DiscoverPageDto(
    val results: List<DiscoverResultDto> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val meta: DiscoverRowMetaDto? = null,
)
