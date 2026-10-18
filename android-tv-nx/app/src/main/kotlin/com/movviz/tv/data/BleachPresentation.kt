package com.movviz.tv.data

/** Presentation identities only. Playback, watch and downloads keep canonical coordinates. */
object BleachPresentation {
    const val TMDB_ID = 30984
    data class Cour(val part: Int, val offset: Int, val count: Int, val title: String)
    val cours = listOf(Cour(1, 0, 13, "The Blood Warfare"), Cour(2, 13, 13, "The Separation"), Cour(3, 26, 14, "The Conflict"), Cour(4, 40, 10, "The Calamity"))
    fun part(tmdbId: Int, type: String, requested: String? = null, season: Int? = null): String? =
        if (tmdbId != TMDB_ID || type != "series") null else requested?.takeIf { it == "original" || it == "tybw" } ?: if (season == 17) "tybw" else "original"
    fun title(part: String) = if (part == "tybw") "Bleach: Thousand-Year Blood War" else "Bleach"
    fun canonicalSeasons(part: String?): List<Int>? = when (part) { "original" -> (1..16).toList(); "tybw" -> listOf(17); else -> null }
    fun contains(part: String?, season: Int?, episode: Int? = null): Boolean = when (part) {
        "original" -> season != null && season in 1..16
        "tybw" -> season == 17 && (episode == null || episode in 1..50)
        else -> true
    }
    fun scope(part: String?, cour: Int? = null): Map<String, Any> = buildMap {
        if (part != null) put("seriesPart", part)
        if (cour != null) put("bleachPart", cour)
    }
    fun key(type: String, tmdbId: Int, part: String?) = "$type-$tmdbId-${part.orEmpty()}"
    fun key(item: SearchResultDto) = key(item.type, item.tmdbId, item.seriesPart)
    fun searchViews(items: List<SearchResultDto>): List<SearchResultDto> = items.flatMap { item ->
        if (item.tmdbId != TMDB_ID || item.type != "series" || item.seriesPart != null) listOf(item)
        else listOf("original", "tybw").map { part -> item.copy(title = title(part), year = if (part == "tybw") 2022 else 2004, seriesPart = part) }
    }.distinctBy { key(it) }
    fun seasons(seasons: List<SeriesSeasonDto>, part: String?): List<SeriesSeasonDto> {
        if (part == null) return seasons
        if (part == "original") return seasons.filter { contains(part, it.seasonNumber) }
        val canonical = seasons.firstOrNull { it.seasonNumber == 17 } ?: return emptyList()
        return cours.map { cour -> canonical.copy(name = "Saison ${cour.part} · ${cour.title}", bleachPart = cour.part,
            episodes = canonical.episodes.filter { it.episodeNumber > cour.offset && it.episodeNumber <= cour.offset + cour.count }.map { it.copy(displayEpisodeNumber = it.episodeNumber - cour.offset, displaySeasonNumber = cour.part) }) }
    }
    fun seasonKey(season: SeriesSeasonDto) = season.bleachPart?.let { 100 + it } ?: season.seasonNumber
    fun metadata(metadata: MetadataSeasonDto?, season: SeriesSeasonDto): MetadataSeasonDto? {
        val cour = cours.firstOrNull { it.part == season.bleachPart } ?: return metadata
        return metadata?.copy(name = season.name, episodes = metadata.episodes.filter { it.episodeNumber > cour.offset && it.episodeNumber <= cour.offset + cour.count })
    }
    fun episodeLabel(season: Int, episode: Int): String {
        val cour = if (season == 17) cours.firstOrNull { episode > it.offset && episode <= it.offset + it.count } else null
        return if (cour != null) "S${cour.part} · Ép ${episode - cour.offset}" else "S$season · Ép $episode"
    }
    fun displaySeasonNumber(tmdbId: Int, season: Int, episode: Int): Int =
        if (tmdbId == TMDB_ID && season == 17) cours.firstOrNull { episode > it.offset && episode <= it.offset + it.count }?.part ?: season else season
    fun displayEpisodeNumber(tmdbId: Int, season: Int, episode: Int): Int =
        if (tmdbId == TMDB_ID && season == 17) cours.firstOrNull { episode > it.offset && episode <= it.offset + it.count }?.let { episode - it.offset } ?: episode else episode
    fun libraryViews(items: List<LibrarySeriesDto>): List<LibrarySeriesDto> = items.flatMap { item ->
        if (item.tmdbId != TMDB_ID) listOf(item) else listOf("original", "tybw").mapNotNull { part ->
            val projected = item.seasons.filter { contains(part, it.seasonNumber) }.map { s -> s.copy(episodes = s.episodes.filter { contains(part, s.seasonNumber, it.episodeNumber) }) }
            val available = item.availableBySeason.filterKeys { contains(part, it.toIntOrNull()) }
            if (item.seasons.isNotEmpty() && projected.none { it.episodes.isNotEmpty() }) null else item.copy(
                title = title(part), year = if (part == "tybw") 2022 else 2004, seriesPart = part, seasons = projected,
                customBackdropPath = item.bleachArtwork[part]?.customBackdropPath ?: if (part == "original") item.customBackdropPath else null,
                customLogoPath = item.bleachArtwork[part]?.customLogoPath ?: if (part == "original") item.customLogoPath else null,
                hasAvailableEpisode = projected.any { it.episodes.any { e -> e.status == "available" } } || available.values.any { it > 0 }, availableBySeason = available)
        }
    }
}
