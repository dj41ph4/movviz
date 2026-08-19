package com.movviz.tv.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// Sous-ensemble des champs réels de LibraryMovie/LibrarySeries
// (src/lib/library/types.ts) — uniquement ce dont l'UI TV a besoin pour
// l'instant (accueil + fiche). Moshi ignore silencieusement les champs du
// JSON serveur non déclarés ici, donc rien ne casse si le serveur en
// renvoie davantage.

// Bug corrigé (audit contrat Plex/TV) : plexRatingKey était déclaré à
// l'intérieur de LibraryFileDto (imbriqué dans "file"), calqué sur le nom
// mais pas sur la vraie forme JSON. Le vrai LibraryFile (src/lib/library/types.ts,
// ligne ~32) n'a JAMAIS de champ plexRatingKey — c'est un champ séparé au
// niveau racine de LibraryMovie (ligne ~119 : "Plex library item id — set by
// the Plex library sync"). Résultat : LibraryMovieDto.file?.plexRatingKey
// désérialisait toujours à null (String? nullable, donc pas de crash Moshi,
// juste une valeur silencieusement fausse), ce qui cassait
// AppViewModel.libraryPlexRatingKey() pour TOUS les films — plus aucun film
// ne pouvait démarrer la lecture côté TV. Confirmé en lisant
// src/app/api/library/movies/route.ts : "movies: all.map(m => ({...m,
// plexUrl}))" — m est LibraryMovie tel quel, plexRatingKey est bien un
// champ frère de "file", pas un enfant.
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
    val plexRatingKey: String? = null,
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
    // Les saisons sont déjà renvoyées par /api/library/series. Les conserver
    // côté TV permet d'afficher une saison manquante avant même qu'un fichier
    // Plex existe, afin de proposer sa recherche ciblée.
    val seasons: List<SeriesSeasonDto> = emptyList(),
)

// Champs qualité confirmés en direct contre /api/library/movies (RoboCop :
// resolution="2160p", videoCodec="HEVC", hdr="HDR10") — jamais mappés côté TV
// jusqu'ici alors que le badge desktop (LibraryMovieCard.tsx/MediaBadges.tsx)
// les affiche déjà. hdr est absent (null) sur un fichier SDR, pas une chaîne
// vide — distinct de source (release scene: "web-dl"/"bluray"/... ou null).
// Sert à la fois la pastille qualité des posters (accueil) et la zone
// technique secondaire de la fiche titre.
@JsonClass(generateAdapter = true)
data class LibraryFileDto(
    val plexRatingKey: String?,
    val resolution: String? = null,
    val videoCodec: String? = null,
    val audioCodec: String? = null,
    val hdr: String? = null,
    val source: String? = null,
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
    // Older Plex-provisioned users may not have a status field in the
    // persisted public response. The TV client does not gate navigation on
    // this field, so tolerate its absence instead of crashing Moshi parsing.
    @Json(name = "status") val accountStatus: String? = null,
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
    val type: String = "movie",
    val tmdbId: Int,
    val title: String,
    // Titre TMDb non localisé — confirmé en direct (GET /api/metadata/detail
    // ?type=movie&tmdbId=27205 renvoie "originalTitle":"Inception"). Affiché
    // côté fiche titre TV uniquement quand il diffère du titre localisé
    // (voir MetaDetail dans src/lib/metadata/types.ts).
    val originalTitle: String? = null,
    val year: Int?,
    val overview: String,
    val tagline: String = "",
    val posterPath: String?,
    val backdropPath: String?,
    val rating: Double,
    val genres: List<String> = emptyList(),
    val runtime: Int?,
    /** Même liste ordonnée de candidats YouTube que le hero et la fiche web.
     * Le client TV joue l'ambiance muette si possible et conserve le
     * backdrop en repli : aucune nouvelle source ni API serveur. */
    val trailerKeys: List<String> = emptyList(),
    // Déjà renvoyé par /api/metadata/detail (voir tmdb.ts, "similar":
    // data.recommendations.results) mais jusqu'ici ignoré côté TV — sert la
    // rangée "Titres similaires" en bas de la fiche (même esprit Netflix/
    // Apple TV que le web, voir TitleContent.tsx "title.similar").
    val similar: List<SearchResultDto> = emptyList(),
    // cast/crew déjà renvoyés par /api/metadata/detail (voir
    // src/lib/metadata/types.ts MetaCastMember/MetaCrewMember) mais jamais
    // consommés côté TV jusqu'ici — confirmé en direct contre la vraie
    // réponse serveur (ex. tmdbId=27205 "Inception").
    val cast: List<MetaCastMemberDto> = emptyList(),
    val crew: List<MetaCrewMemberDto> = emptyList(),
    // Appartenance à une saga TMDb (belongs_to_collection) — confirmé en
    // direct (tmdbId=155 "The Dark Knight" renvoie
    // {"id":263,"name":"The Dark Knight - Saga","posterPath":"..."}). Pas
    // d'écran Collections côté TV : simple mention texte sur la fiche, pas
    // de duplication d'un parcours qui n'existe pas encore ici.
    val collection: MetaCollectionDto? = null,
)

/** PIN éphémère créé par /api/auth/plex/pin. authUrl pointe uniquement vers
 * Plex : l'application TV ne reçoit ni identifiant ni jeton Plex. */
@JsonClass(generateAdapter = true)
data class PlexPinDto(
    val id: Long,
    val code: String = "",
    val authUrl: String,
)

@JsonClass(generateAdapter = true)
data class PlexPollDto(
    val done: Boolean = false,
    val user: MovvizUserDto? = null,
    val error: String? = null,
)

@JsonClass(generateAdapter = true)
data class PlexPollRequest(val id: Long)

/** Réponse de /api/dashboard/hero — source éditoriale commune au desktop et
 * à la TV. Les champs de score restent côté serveur : la TV reçoit seulement
 * la sélection déjà personnalisée pour l'utilisateur connecté. */
@JsonClass(generateAdapter = true)
data class DashboardHeroResponseDto(
    val slides: List<DashboardHeroSlideDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class DashboardHeroSlideDto(
    val detail: MetaDetailDto,
    val libraryStatus: String? = null,
)

/** /api/metadata/images — mêmes logos TMDb que DashboardHero/TitleContent
 * web. Le fichier est un path TMDb, jamais une URL fournie par un utilisateur. */
@JsonClass(generateAdapter = true)
data class MetadataImagesDto(
    val logos: List<MetadataImageDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class MetadataImageDto(
    val filePath: String,
)

@JsonClass(generateAdapter = true)
data class MetaCollectionDto(
    val id: Int,
    val name: String,
    val posterPath: String? = null,
)

@JsonClass(generateAdapter = true)
data class MetaCastMemberDto(
    val id: Int,
    val name: String,
    val character: String = "",
    val profilePath: String? = null,
)

@JsonClass(generateAdapter = true)
data class MetaCrewMemberDto(
    val id: Int,
    val name: String,
    val job: String = "",
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

/** Détails éditoriaux d'une saison déjà exposés par /api/metadata/season.
 *  La bibliothèque reste la source de vérité pour disponibilité/Plex ; TMDb
 *  n'apporte ici que les visuels et le synopsis nécessaires à une vraie
 *  fiche épisode de salon. */
@JsonClass(generateAdapter = true)
data class MetadataEpisodeDto(
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String,
    val airDate: String? = null,
    val overview: String = "",
    val stillPath: String? = null,
)

@JsonClass(generateAdapter = true)
data class MetadataSeasonDto(
    val seasonNumber: Int,
    val name: String,
    val episodeCount: Int = 0,
    val episodes: List<MetadataEpisodeDto> = emptyList(),
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
    val page: Int = 1,
    val totalPages: Int = 1,
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

// Miroir de OnDeckEntry (src/app/api/plex/on-deck/route.ts) — sert à la fois
// à retrouver la position de reprise pour la lecture (offsetMs, le
// viewOffset Plex brut exact en ms — progressPercent reste présent en repli
// pour compatibilité mais n'est plus utilisé côté Android depuis que le
// serveur expose offsetMs directement, voir MovvizRepository.resumeOffsetMs)
// ET à peupler la rangée "Continuer à regarder" de l'accueil TV (title/
// posterPath/rating, pas besoin de croiser avec movies()/series()).
@JsonClass(generateAdapter = true)
data class OnDeckEntryDto(
    val type: String,
    val tmdbId: Int,
    val title: String? = null,
    val posterPath: String? = null,
    val rating: Double = 0.0,
    val progressPercent: Int = 0,
    val offsetMs: Long = 0L,
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
    // Double, pas Long : le moteur BitTorrent renvoie un débit brut non
    // arrondi (voir t.downloadSpeed dans src/app/api/activity/v2/route.ts,
    // contrairement à `eta` qui lui passe par Math.round côté serveur) —
    // un Long ici plantait le parsing JSON dès qu'un torrent avait un débit
    // non entier (crash confirmé en direct juste après connexion : "Expected
    // a long but was 7485.6").
    val downloadSpeed: Double = 0.0,
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

// Réponse de POST /api/library/movies/{id}/search et
// POST /api/library/series/{id}/search (src/app/api/library/movies/[id]/search/route.ts,
// src/app/api/library/series/[id]/search/route.ts) — déclenche manuellement
// une recherche indexeurs + grab automatique pour un titre déjà en
// bibliothèque (ex: statut "missing" ou pour forcer une nouvelle recherche).
// Réponse immédiate ({"queued": true}), le vrai travail est mis en file
// d'attente côté serveur — le statut du titre (déjà exposé via
// LibraryMovieDto.status / SeriesEpisodeDto.status) passe à "searching" puis
// "available" au fil du polling normal de la bibliothèque, pas besoin de
// suivre ce job explicitement.
@JsonClass(generateAdapter = true)
data class SearchTriggerResponseDto(
    val queued: Boolean = false,
)

// Miroir de GET /api/watch-status (src/app/api/watch-status/route.ts) —
// statut "vu" manuel PAR UTILISATEUR (distinct du statut LibraryStatus qui
// dit si le FICHIER existe, pas si quelqu'un l'a regardé). Confirmé en
// direct : {"movies":[102899,...],"episodes":[{"tmdbId":..,"season":..,
// "episode":..}]}. "episodes[].tmdbId" est le tmdbId de la SÉRIE, pas de
// l'épisode (mêmes conventions que WatchStatus côté serveur,
// src/lib/plex/watchStore.ts).
@JsonClass(generateAdapter = true)
data class WatchedEpisodeDto(
    val tmdbId: Int,
    val season: Int,
    val episode: Int,
)

@JsonClass(generateAdapter = true)
data class WatchStatusDto(
    val movies: List<Int> = emptyList(),
    val episodes: List<WatchedEpisodeDto> = emptyList(),
)

// Miroir (partiel) de UserPrefs (src/lib/userPrefs/store.ts) — la TV n'a
// besoin que du champ qui affecte réellement la lecture, pas de gpuTier/
// theme/libraryViewMode qui n'ont pas de sens sur ce client (TV = un seul
// thème sombre, pas de vue liste). Le PATCH ne renvoie que ce champ, la
// route serveur fusionne (voir saveUserPrefs, "merge only known fields") —
// envoyer un objet partiel ne touche jamais reduceAnimations/theme/etc. des
// autres clients (desktop/mobile) du même compte.
@JsonClass(generateAdapter = true)
data class UserPrefsDto(
    val preferredAudioLanguage: String? = null,
)

@JsonClass(generateAdapter = true)
data class PreferencesResponseDto(
    val prefs: UserPrefsDto = UserPrefsDto(),
)
