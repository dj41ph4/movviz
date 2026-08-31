import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value, "utf8"); }
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing anchor: ${label}`);
  return text.replace(from, to);
}
function replaceRegex(text, regex, to, label) {
  if (!regex.test(text)) throw new Error(`Missing regex anchor: ${label}`);
  return text.replace(regex, to);
}

// ---- Android API models: expose fields already present in /api/interface/dashboard.
{
  const path = "android-tv/app/src/main/kotlin/com/movviz/tv/data/ApiModels.kt";
  let s = read(path);
  s = replaceOnce(s,
`    val year: Int?,
    // Absent de /api/interface/dashboard : le snapshot d'accueil n'a pas
`,
`    val year: Int?,
    val releaseDate: String? = null,
    val vfReleaseDate: String? = null,
    val runtime: Int? = null,
    val addedAt: Long = 0L,
    val customBackdropPath: String? = null,
    val customLogoPath: String? = null,
    // Absent de /api/interface/dashboard : le snapshot d'accueil n'a pas
`, "LibraryMovieDto fields");
  s = replaceOnce(s,
`    val genres: List<String> = emptyList(),
    // Les saisons sont déjà renvoyées par /api/library/series. Les conserver
`,
`    val genres: List<String> = emptyList(),
    val addedAt: Long = 0L,
    val hasAvailableEpisode: Boolean = false,
    val customBackdropPath: String? = null,
    val customLogoPath: String? = null,
    // Les saisons sont déjà renvoyées par /api/library/series. Les conserver
`, "LibrarySeriesDto fields");
  s = replaceOnce(s,
`    val year: Int? = null,
    val posterPath: String? = null,
`,
`    val year: Int? = null,
    val releaseDate: String? = null,
    val vfReleaseDate: String? = null,
    val runtime: Int? = null,
    val addedAt: Long? = null,
    val customBackdropPath: String? = null,
    val customLogoPath: String? = null,
    val posterPath: String? = null,
`, "InterfaceMovieDto fields");
  s = replaceOnce(s,
`            year = year,
            posterPath = posterPath,
`,
`            year = year,
            releaseDate = releaseDate,
            vfReleaseDate = vfReleaseDate,
            runtime = runtime,
            addedAt = addedAt ?: 0L,
            customBackdropPath = customBackdropPath,
            customLogoPath = customLogoPath,
            posterPath = posterPath,
`, "InterfaceMovieDto conversion");
  // Target only InterfaceSeriesDto by anchoring the class header.
  s = replaceOnce(s,
`data class InterfaceSeriesDto(
    val id: String? = null,
    val tmdbId: Int? = null,
    val title: String? = null,
    val year: Int? = null,
    val posterPath: String? = null,
`,
`data class InterfaceSeriesDto(
    val id: String? = null,
    val tmdbId: Int? = null,
    val title: String? = null,
    val year: Int? = null,
    val addedAt: Long? = null,
    val hasAvailableEpisode: Boolean? = null,
    val customBackdropPath: String? = null,
    val customLogoPath: String? = null,
    val posterPath: String? = null,
`, "InterfaceSeriesDto fields");
  s = replaceOnce(s,
`            title = safeTitle,
            year = year,
            posterPath = posterPath,
            backdropPath = backdropPath,
            rating = rating ?: 0.0,
            genres = genres.orEmpty().filterNotNull(),
        )
`,
`            title = safeTitle,
            year = year,
            addedAt = addedAt ?: 0L,
            hasAvailableEpisode = hasAvailableEpisode ?: false,
            customBackdropPath = customBackdropPath,
            customLogoPath = customLogoPath,
            posterPath = posterPath,
            backdropPath = backdropPath,
            rating = rating ?: 0.0,
            genres = genres.orEmpty().filterNotNull(),
        )
`, "InterfaceSeriesDto conversion");
  write(path, s);
}

// ---- Shared dashboard layout endpoint.
{
  const path = "android-tv/app/src/main/kotlin/com/movviz/tv/data/ApiService.kt";
  let s = read(path);
  s = replaceOnce(s,
`    @GET("api/dashboard/hero")
    suspend fun dashboardHero(): Response<DashboardHeroResponseDto>
`,
`    @GET("api/dashboard/hero")
    suspend fun dashboardHero(): Response<DashboardHeroResponseDto>

    @GET("api/dashboard/layout")
    suspend fun dashboardLayout(): Response<DashboardLayoutResponseDto>
`, "ApiService dashboard layout");
  write(path, s);
}
{
  const path = "android-tv/app/src/main/kotlin/com/movviz/tv/data/MovvizRepository.kt";
  let s = read(path);
  s = replaceOnce(s,
`    suspend fun dashboardHero(): ApiResult<List<DashboardHeroSlideDto>> =
        safeCall { api.dashboardHero() }.map { it.slides }
`,
`    suspend fun dashboardHero(): ApiResult<List<DashboardHeroSlideDto>> =
        safeCall { api.dashboardHero() }.map { it.slides }

    suspend fun dashboardLayout(): ApiResult<DashboardLayoutDto> =
        safeCall { api.dashboardLayout() }.map { it.layout }
`, "Repository dashboard layout");
  write(path, s);
}

// ---- ViewModel: one layout truth for desktop + TV.
{
  const path = "android-tv/app/src/main/kotlin/com/movviz/tv/AppViewModel.kt";
  let s = read(path);
  s = replaceOnce(s,
`    private val _dashboardHero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList())
    val dashboardHero: StateFlow<List<DashboardHeroSlideDto>> = _dashboardHero.asStateFlow()
`,
`    private val _dashboardHero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList())
    val dashboardHero: StateFlow<List<DashboardHeroSlideDto>> = _dashboardHero.asStateFlow()

    private val _dashboardLayout = MutableStateFlow(com.movviz.tv.data.DashboardLayoutDto())
    val dashboardLayout: StateFlow<com.movviz.tv.data.DashboardLayoutDto> = _dashboardLayout.asStateFlow()
`, "ViewModel dashboard layout state");
  s = replaceOnce(s,
`    fun loadDashboardHero() {
        val repo = repository ?: return
`,
`    fun loadDashboardLayout() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val result = repo.dashboardLayout()) {
                is ApiResult.Success -> _dashboardLayout.value = result.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun loadDashboardHero() {
        val repo = repository ?: return
`, "ViewModel loadDashboardLayout");
  write(path, s);
}

// ---- Home: consume exactly the desktop section order and recommendation sources.
{
  const path = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/home/HomeScreen.kt";
  let s = read(path);
  const marker = `/** Une rangée éditoriale de l'accueil, avec son type de média propre`;
  const start = s.indexOf("@Composable\nfun HomeScreen(");
  const end = s.indexOf(marker, start);
  if (start < 0 || end < 0) throw new Error("HomeScreen function markers missing");
  const before = s.slice(0, start);
  const after = s.slice(end);
  const fn = String.raw`@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit = { _, _, _ -> },
    onSeeAllRow: (mediaType: String, key: String, label: String) -> Unit = { _, _, _ -> },
    entryFocusRequester: FocusRequester? = null,
) {
    val movies by viewModel.movies.collectAsState()
    val series by viewModel.series.collectAsState()
    val continueWatching by viewModel.continueWatching.collectAsState()
    val queue by viewModel.queue.collectAsState()
    val movieRows by viewModel.movieRows.collectAsState()
    val seriesRows by viewModel.seriesRows.collectAsState()
    val movieRecommendations by viewModel.movieLibraryRecommendations.collectAsState()
    val seriesRecommendations by viewModel.seriesLibraryRecommendations.collectAsState()
    val dashboardHero by viewModel.dashboardHero.collectAsState()
    val dashboardLayout by viewModel.dashboardLayout.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()

    LaunchedEffect(Unit) {
        // Layout en premier : la TV compose directement les mêmes sections
        // visibles/ordonnées que le desktop, au lieu de flasher ses anciennes
        // rangées avant de se resynchroniser.
        viewModel.loadDashboardLayout()
        viewModel.loadLibrary()
        delay(120)
        viewModel.loadContinueWatching()
        delay(120)
        viewModel.loadDiscovery()
        delay(120)
        viewModel.loadDashboardHero()
    }
    LaunchedEffect(Unit) {
        while (true) {
            viewModel.loadQueue()
            delay(QUEUE_POLL_INTERVAL_MS)
        }
    }

    val minYear = dashboardLayout.hero.minYear
    fun yearAllowed(year: Int?): Boolean = minYear == null || (year ?: 0) >= minYear
    fun searchCard(item: com.movviz.tv.data.SearchResultDto, prefix: String) = TvTitleCard(
        id = "$prefix-${item.type}-${item.tmdbId}",
        title = item.title,
        posterPath = item.posterPath,
        backdropPath = item.backdropPath,
        tmdbId = item.tmdbId,
        isMovie = item.type == "movie",
        year = item.year,
        rating = item.rating,
    )

    val continueCards = remember(continueWatching) {
        continueWatching.map {
            TvTitleCard(
                id = "cw-${it.type}-${it.tmdbId}-${it.seasonNumber}-${it.episodeNumber}",
                title = it.title ?: "—",
                posterPath = it.posterPath,
                backdropPath = null,
                tmdbId = it.tmdbId,
                isMovie = it.type == "movie",
                rating = it.rating,
                progressPercent = it.progressPercent,
                resumeSeasonNumber = it.seasonNumber,
                resumeEpisodeNumber = it.episodeNumber,
            )
        }
    }

    // EXACTEMENT la même source que DashboardRows.desktop :
    // /api/metadata/recommendations movie + series, ordre conservé puis alterné.
    val recommendationCards = remember(movieRecommendations, seriesRecommendations, minYear) {
        movieRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") }
            .zipInterleave(seriesRecommendations.filter { yearAllowed(it.year) }.map { searchCard(it, "rec") })
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .take(20)
    }

    // EXACTEMENT la rangée trendingPopular/trending consommée sur desktop,
    // pas l'ancien appel /trending séparé de la TV.
    val trendingCards = remember(movieRows, seriesRows, minYear) {
        val movie = movieRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        val tv = seriesRows.firstOrNull { it.key == "trendingPopular" || it.key == "trending" }
            ?.results.orEmpty().filter { yearAllowed(it.year) }.map { searchCard(it, "trend") }
        movie.zipInterleave(tv).distinctBy { "${it.isMovie}-${it.tmdbId}" }.take(10)
    }

    val availableNowCards = remember(movies, series, minYear) {
        val movie = movies.filter { it.status == "available" && yearAllowed(it.year) }.map {
            it.addedAt to TvTitleCard(
                id = "available-movie-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
            )
        }
        val shows = series.filter { it.hasAvailableEpisode && yearAllowed(it.year) }.map {
            it.addedAt to TvTitleCard(
                id = "available-series-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = false,
                year = it.year, rating = it.rating, genres = it.genres,
            )
        }
        (movie + shows).sortedByDescending { it.first }.map { it.second }.take(20)
    }

    val shortSessionCards = remember(movies, minYear) {
        movies.filter { it.status == "available" && it.runtime != null && it.runtime <= 40 && yearAllowed(it.year) }
            .sortedByDescending { it.addedAt }
            .take(20)
            .map {
                TvTitleCard(
                    id = "short-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, runtime = it.runtime,
                    qualityLabel = resolutionLabel(it.file?.resolution), hasHdr = !it.file?.hdr.isNullOrBlank(),
                )
            }
    }

    val comingSoonCards = remember(movies, minYear) {
        movies.filter { it.status == "upcoming" && yearAllowed(it.year) }
            .sortedBy { it.vfReleaseDate ?: it.releaseDate ?: "9999-99-99" }
            .take(20)
            .map {
                TvTitleCard(
                    id = "soon-${it.tmdbId}", title = it.title, posterPath = it.posterPath,
                    backdropPath = it.customBackdropPath ?: it.backdropPath, tmdbId = it.tmdbId, isMovie = true,
                    year = it.year, rating = it.rating, genres = it.genres, status = it.status,
                )
            }
    }

    val heroFallback = remember(availableNowCards, recommendationCards) {
        (recommendationCards + availableNowCards)
            .filter { it.backdropPath != null }
            .distinctBy { "${it.isMovie}-${it.tmdbId}" }
            .sortedByDescending { it.rating }
    }
    val heroItems = remember(dashboardHero, heroFallback, dashboardLayout.hero.enabled, minYear) {
        if (!dashboardLayout.hero.enabled) emptyList() else {
            val exact = dashboardHero.map { slide ->
                val detail = slide.detail
                TvTitleCard(
                    id = "hero-${detail.type}-${detail.tmdbId}", title = detail.title,
                    posterPath = detail.posterPath, backdropPath = detail.backdropPath, tmdbId = detail.tmdbId,
                    isMovie = detail.type == "movie", year = detail.year, rating = detail.rating,
                    genres = detail.genres, status = slide.libraryStatus, overview = detail.overview,
                    runtime = detail.runtime, trailerKeys = detail.ambientVideoKeys,
                )
            }.filter { it.backdropPath != null && yearAllowed(it.year) }
            (exact + heroFallback.filter { it.tmdbId !in exact.map { h -> h.tmdbId } }).take(HERO_COUNT)
        }
    }

    var heroIndex by remember { mutableStateOf(0) }
    LaunchedEffect(heroItems) {
        if (heroIndex !in heroItems.indices) heroIndex = 0
        val movieIds = heroItems.filter { it.isMovie }.map { it.tmdbId }
        val seriesIds = heroItems.filter { !it.isMovie }.map { it.tmdbId }
        if (movieIds.isNotEmpty()) viewModel.loadHeroLogos("movie", movieIds)
        if (seriesIds.isNotEmpty()) viewModel.loadHeroLogos("series", seriesIds)
    }
    LaunchedEffect(heroItems, dashboardLayout.hero.slideshowSpeedSec) {
        if (heroItems.size < 2) return@LaunchedEffect
        val interval = dashboardLayout.hero.slideshowSpeedSec.coerceIn(5, 60) * 1_000L
        while (true) {
            delay(interval)
            if (heroItems.size < 2) return@LaunchedEffect
            heroIndex = (heroIndex + 1) % heroItems.size
        }
    }
    val activeHero = heroItems.getOrNull(heroIndex.coerceIn(0, (heroItems.size - 1).coerceAtLeast(0)))

    val visibleSections = remember(
        dashboardLayout.sections,
        continueCards,
        recommendationCards,
        shortSessionCards,
        trendingCards,
        availableNowCards,
        comingSoonCards,
    ) {
        dashboardLayout.sections.filter { it.visible }.mapNotNull { section ->
            val hasContent = when (section.id) {
                "continueWatching" -> continueCards.isNotEmpty()
                "becauseYouLike" -> recommendationCards.isNotEmpty()
                "shortSessions" -> shortSessionCards.isNotEmpty()
                "discover" -> trendingCards.isNotEmpty()
                "availableNow" -> availableNowCards.isNotEmpty()
                "comingSoon" -> comingSoonCards.isNotEmpty()
                else -> false // upgradesAvailable reste un outil desktop/admin, pas une suggestion TV inventée.
            }
            section.id.takeIf { hasContent }
        }
    }
    val firstVisibleSection = visibleSections.firstOrNull()
    val contentFocus = entryFocusRequester ?: remember { FocusRequester() }
    val topAnchor = remember { FocusRequester() }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 64.dp, bottom = 72.dp),
        ) {
            item(contentType = "topAnchor") {
                Box(
                    modifier = Modifier.fillMaxWidth().height(1.dp).focusRequester(topAnchor).focusable(),
                )
            }
            if (heroItems.isNotEmpty()) {
                item(contentType = "hero") {
                    HeroCarousel(
                        items = heroItems,
                        currentIndex = heroIndex,
                        logoPath = activeHero?.let { heroLogos["${if (it.isMovie) "movie" else "series"}-${it.tmdbId}"] },
                        onSelectIndex = { heroIndex = it },
                        ctaFocusRequester = contentFocus,
                        trailerAutoplay = dashboardLayout.hero.trailerAutoplay,
                        onOpen = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }

            visibleSections.forEach { sectionId ->
                when (sectionId) {
                    "continueWatching" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Continuer à regarder",
                            items = continueCards,
                            onClick = { card ->
                                val season = card.resumeSeasonNumber
                                val episode = card.resumeEpisodeNumber
                                if (!card.isMovie && season != null && episode != null) onOpenEpisode(card.tmdbId, season, episode)
                                else onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId)
                            },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                    "becauseYouLike" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Sélection pour vous",
                            items = recommendationCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                    "shortSessions" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Moins de 40 minutes",
                            items = shortSessionCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                    "discover" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Tendances Movviz",
                            items = trendingCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                    "availableNow" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Ajoutés récemment",
                            items = availableNowCards,
                            onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                    "comingSoon" -> item(contentType = "row") {
                        TitleRow(
                            heading = "Prochainement",
                            items = comingSoonCards,
                            onClick = { onOpenTitle("movie", it.tmdbId) },
                            firstItemFocusRequester = if (heroItems.isEmpty() && firstVisibleSection == sectionId) contentFocus else null,
                        )
                    }
                }
                if (sectionId == "becauseYouLike" && queue.isNotEmpty()) {
                    item(contentType = "queue") { DownloadQueueRow(items = queue, onOpenTitle = onOpenTitle) }
                }
            }

            if (visibleSections.isEmpty() && heroItems.isEmpty()) {
                item(contentType = "loading") {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(420.dp).padding(top = 48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            AnimatedLogo(size = 82.dp)
                            Spacer(Modifier.height(16.dp))
                            Text("Préparation de ton cinéma…", style = MaterialTheme.typography.labelLarge, color = Color.White.copy(alpha = .55f))
                        }
                    }
                }
            }
        }
    }
}

`;
  s = before + fn + after;

  s = replaceOnce(s,
`    ctaFocusRequester: FocusRequester,
    onOpen: (TvTitleCard) -> Unit,
) {`,
`    ctaFocusRequester: FocusRequester,
    trailerAutoplay: Boolean = true,
    onOpen: (TvTitleCard) -> Unit,
) {`, "HeroCarousel trailerAutoplay parameter");
  s = replaceOnce(s,
`        AmbientTrailer(
            trailerKeys = current.trailerKeys,
            title = current.title,
            modifier = Modifier.fillMaxSize(),
        )`,
`        if (trailerAutoplay) {
            AmbientTrailer(
                trailerKeys = current.trailerKeys,
                title = current.title,
                modifier = Modifier.fillMaxSize(),
            )
        }`, "HeroCarousel autoplay gate");
  write(path, s);
}

console.log("Android TV synchronized home migration applied.");
