package com.movviz.tv.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// Sous-ensemble des champs réels de LibraryMovie/LibrarySeries
// (src/lib/library/types.ts) — uniquement ce dont l'UI TV a besoin pour
// l'instant (accueil + fiche). Moshi ignore silencieusement les champs du
// JSON serveur non déclarés ici, donc rien ne casse si le serveur en
// renvoie davantage.

@JsonClass(generateAdapter = true)
data class LibraryMovieDto(
    val id: String,
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val overview: String,
    val posterPath: String?,
    val backdropPath: String?,
    val rating: Double,
    val genres: List<String> = emptyList(),
    val status: String,
    val file: LibraryFileDto?,
)

@JsonClass(generateAdapter = true)
data class LibrarySeriesDto(
    val id: String,
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val overview: String,
    val posterPath: String?,
    val backdropPath: String?,
    val rating: Double,
    val genres: List<String> = emptyList(),
    val status: String,
)

@JsonClass(generateAdapter = true)
data class LibraryFileDto(
    val plexRatingKey: String?,
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val username: String,
    val password: String,
)

@JsonClass(generateAdapter = true)
data class AddToLibraryRequest(
    val tmdbId: Int,
)

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val user: MovvizUserDto? = null,
    val error: String? = null,
)

@JsonClass(generateAdapter = true)
data class MovvizUserDto(
    val id: String,
    val username: String,
    val role: String,
    @Json(name = "status") val accountStatus: String,
)

@JsonClass(generateAdapter = true)
data class LibraryMoviesResponse(
    val movies: List<LibraryMovieDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class LibrarySeriesResponse(
    val series: List<LibrarySeriesDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class SystemInfoDto(
    val platform: String? = null,
    val isContainer: Boolean? = null,
)

/** Sous-ensemble de MetaDetail (src/lib/metadata/types.ts) — la fiche titre
 *  TV n'a pas besoin des champs desktop-only (watchProviders, studios...). */
@JsonClass(generateAdapter = true)
data class MetaDetailDto(
    val tmdbId: Int,
    val title: String,
    val year: Int?,
    val overview: String,
    val tagline: String = "",
    val posterPath: String?,
    val backdropPath: String?,
    val rating: Double,
    val genres: List<String> = emptyList(),
    val runtime: Int?,
)

// Miroir de LibraryEpisode/LibrarySeason (src/lib/library/types.ts) — juste
// ce qu'il faut pour afficher/lancer un épisode depuis la fiche série.
@JsonClass(generateAdapter = true)
data class SeriesEpisodeDto(
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String,
    val status: String,
    val plexRatingKey: String?,
)

@JsonClass(generateAdapter = true)
data class SeriesSeasonDto(
    val seasonNumber: Int,
    val name: String,
    val episodes: List<SeriesEpisodeDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class SeriesDetailDto(
    val id: String,
    val seasons: List<SeriesSeasonDto> = emptyList(),
)
