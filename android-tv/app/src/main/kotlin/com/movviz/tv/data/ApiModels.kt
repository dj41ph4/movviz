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

// status absent du DTO volontairement : contrairement aux films, l'API ne
// renvoie jamais de champ "status" au niveau série (voir LibrarySeries dans
// src/lib/library/types.ts — seul "tvStatus" existe, un statut TMDb/TVDB
// global, différent). Le statut affiché côté desktop est calculé à partir
// des épisodes (overallSeriesStatus() dans TitleContent.tsx), jamais envoyé
// tel quel. Le décrire ici comme obligatoire faisait planter l'app avec un
// JsonDataException dès qu'une vraie bibliothèque contenait une série sans
// ce champ (confirmé en direct : "Required value 'status' missing at
// $.series[1]").
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

// /api/auth/me répond 200 même sans session — {"user": null} est une
// réponse "réussie" mais NON connectée. Un simple Response<Map<...>> avec un
// corps non-null suffisait à faire passer hasValidSession() pour vrai à
// tort (bug confirmé en live : accueil/réglages accessibles sans jamais
// avoir saisi d'identifiants). Il faut regarder le champ user lui-même.
@JsonClass(generateAdapter = true)
data class MeResponseDto(
    val user: MovvizUserDto? = null,
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
    // Déjà renvoyé par /api/metadata/detail (voir tmdb.ts, "similar":
    // data.recommendations.results) mais jusqu'ici ignoré côté TV — sert la
    // rangée "Titres similaires" en bas de la fiche (même esprit Netflix/
    // Apple TV que le web, voir TitleContent.tsx "title.similar").
    val similar: List<SearchResultDto> = emptyList(),
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

// Miroir de MetaSearchResult (src/lib/metadata/types.ts).
@JsonClass(generateAdapter = true)
data class SearchResultDto(
    val tmdbId: Int,
    val type: String,
    val title: String,
    val year: Int?,
    val posterPath: String?,
    val rating: Double = 0.0,
)

@JsonClass(generateAdapter = true)
data class SearchResponseDto(
    val results: List<SearchResultDto> = emptyList(),
)

// Miroir de la réponse de /api/stream/{ratingKey}/info (voir
// src/app/api/stream/[ratingKey]/info/route.ts) — la TV n'a besoin ni de
// ffmpegAvailable ni de videoCodec/container (pas de transcodage côté TV,
// direct-play uniquement), seulement de la durée réelle et des pistes
// audio/sous-titres EMBARQUÉES dans le fichier. Le direct-play sert le
// fichier Plex tel quel (voir stream/[ratingKey]/route.ts, Media[0]/Part[0]
// bruts, aucun paramètre de sélection de piste) donc la sélection
// audio/sous-titres se fait côté client, dans les pistes que Media3 détecte
// lui-même dans le conteneur — pas d'appel serveur supplémentaire.
@JsonClass(generateAdapter = true)
data class StreamAudioTrackDto(
    val id: String,
    val codec: String,
    val language: String,
    val channels: Int = 0,
    val selected: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class StreamSubtitleTrackDto(
    val id: String,
    val codec: String,
    val language: String,
    val toTextConvertible: Boolean = false,
    val selected: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class StreamInfoDto(
    val audioStreams: List<StreamAudioTrackDto> = emptyList(),
    val subtitleStreams: List<StreamSubtitleTrackDto> = emptyList(),
    val durationMs: Long? = null,
)

@JsonClass(generateAdapter = true)
data class ProgressRequest(
    val offset: Long,
    val state: String,
)

// Miroir de OnDeckEntry (src/app/api/plex/on-deck/route.ts) — utilisé à la
// fois pour retrouver un pourcentage de progression approximatif pour la
// reprise de lecture (l'API ne renvoie pas de ratingKey ni d'offset en ms,
// seulement un progressPercent déjà calculé côté serveur ; combiné à la
// durée réelle obtenue via /info, ça suffit à reprendre au bon endroit sans
// route serveur supplémentaire — voir MovvizRepository.resumeOffsetMs) ET
// pour peupler la rangée "Continuer à regarder" de l'accueil TV (title/
// posterPath/rating étaient ignorés jusqu'ici alors que le serveur les
// renvoie déjà — pas besoin de croiser avec movies()/series() pour afficher
// la rangée).
@JsonClass(generateAdapter = true)
data class OnDeckEntryDto(
    val type: String,
    val tmdbId: Int,
    val title: String? = null,
    val posterPath: String? = null,
    val rating: Double = 0.0,
    val progressPercent: Int = 0,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val episodeTitle: String? = null,
)

@JsonClass(generateAdapter = true)
data class OnDeckResponseDto(
    val items: List<OnDeckEntryDto> = emptyList(),
)

// Miroir (partiel) de ActivityMedia/ActivityDownload/QueueItem
// (src/lib/activity/v2/types.ts), servis par GET /api/activity/v2?tab=queue
// — le cœur de Movviz n'est pas que la lecture mais aussi le téléchargement
// (voir la doc de mission), donc l'accueil TV a besoin de voir la file en
// cours. Seuls les champs affichés dans la rangée "Téléchargements en
// cours" sont déclarés ; tmdbId/posterPath/season/episode restent
// nullables car un torrent ajouté à la main hors recherche Movviz n'a
// aucune de ces infos (voir `linked: false` côté serveur).
@JsonClass(generateAdapter = true)
data class QueueMediaDto(
    val title: String,
    val type: String,
    val posterPath: String? = null,
    val tmdbId: Int? = null,
    val season: Int? = null,
    val episode: Int? = null,
)

@JsonClass(generateAdapter = true)
data class QueueDownloadDto(
    // progress est une fraction 0..1 (pas un pourcentage) — voir
    // useSmoothProgress/DownloadQueue.tsx côté desktop qui multiplie par 100
    // à l'affichage seulement.
    val progress: Double = 0.0,
    val downloadSpeed: Long = 0,
    val eta: Long = 0, // secondes
    val state: String = "downloading",
)

@JsonClass(generateAdapter = true)
data class QueueItemDto(
    val id: String,
    val media: QueueMediaDto,
    val download: QueueDownloadDto,
    val status: String,
)

@JsonClass(generateAdapter = true)
data class QueueResponseDto(
    val items: List<QueueItemDto> = emptyList(),
)
