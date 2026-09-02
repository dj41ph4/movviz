from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
main = ROOT / 'android-mobile/app/src/main/java/com/movviz/mobile/MainActivity.kt'
discover = ROOT / 'android-mobile/app/src/main/java/com/movviz/mobile/discover/DiscoverScreen.kt'
dvm = ROOT / 'android-mobile/app/src/main/java/com/movviz/mobile/discover/DiscoverViewModel.kt'

# Profile-aware Discover cache.
s = dvm.read_text(encoding='utf-8')
s = s.replace('private var configuredBaseUrl: String? = null', 'private var configuredProfileKey: String? = null')
old = '''    fun configure(baseUrl: String) {\n        if (configuredBaseUrl == baseUrl) return\n        configuredBaseUrl = baseUrl\n        repo = DiscoverRepository(baseUrl)\n        loadHome()\n    }'''
new = '''    fun configure(baseUrl: String, profileId: String) {\n        val key = "${baseUrl.trim().trimEnd('/')}|$profileId"\n        if (configuredProfileKey == key) return\n        configuredProfileKey = key\n        repo = DiscoverRepository(baseUrl)\n        _rows.value = emptyList()\n        _libraryRecommendations.value = emptyList()\n        _genres.value = emptyList()\n        clearBrowse()\n        loadHome()\n    }'''
if old not in s: raise SystemExit('DiscoverViewModel configure anchor not found')
s = s.replace(old, new, 1)
dvm.write_text(s, encoding='utf-8')

# Hard-clear every user-scoped cache on profile switch.
s = main.read_text(encoding='utf-8')
needle = '''    fun selectProfile(profile: TvProfile) {\n        val base = profile.serverUrl'''
replacement = '''    fun selectProfile(profile: TvProfile) {\n        _currentUser.value = null\n        _hero.value = emptyList()\n        _movies.value = emptyList()\n        _series.value = emptyList()\n        _search.value = emptyList()\n        _queue.value = emptyList()\n        _heroLogos.value = emptyMap()\n        _aiMessages.value = emptyList()\n        _aiEnabled.value = null\n        val base = profile.serverUrl'''
if needle not in s: raise SystemExit('selectProfile anchor not found')
s = s.replace(needle, replacement, 1)
main.write_text(s, encoding='utf-8')

# Discover uses the exact same authenticated /api/dashboard/hero payload as desktop.
s = discover.read_text(encoding='utf-8')
old = '''    val discoverVm: DiscoverViewModel = viewModel()\n    val baseUrl = vm.getBaseUrlCached()\n    LaunchedEffect(baseUrl) { if (baseUrl != null) discoverVm.configure(baseUrl) }\n\n    val moviesState by vm.movies.collectAsState()\n    val seriesState by vm.series.collectAsState()'''
new = '''    val discoverVm: DiscoverViewModel = viewModel()\n    val baseUrl = vm.getBaseUrlCached()\n    val currentUser by vm.currentUser.collectAsState()\n    val heroSlides by vm.hero.collectAsState()\n    val heroLogos by vm.heroLogos.collectAsState()\n    LaunchedEffect(baseUrl, currentUser?.id) {\n        val profileId = currentUser?.id\n        if (baseUrl != null && profileId != null) discoverVm.configure(baseUrl, profileId)\n    }\n    LaunchedEffect(heroSlides) { if (heroSlides.isNotEmpty()) vm.preloadHeroLogos(heroSlides) }\n\n    val moviesState by vm.movies.collectAsState()\n    val seriesState by vm.series.collectAsState()'''
if old not in s: raise SystemExit('Discover profile anchor not found')
s = s.replace(old, new, 1)

old_call = '''                DiscoverHomeRows(\n                    rows = rows, libraryRecommendations = localRecommendations, loading = rowsLoading, moviesState = moviesState, seriesState = seriesState,\n                    vm = vm, onTitleClick = onTitleClick, onSeeAll = { key, meta -> discoverVm.seeAllRow(key, meta) },'''
new_call = '''                DiscoverHomeRows(\n                    heroSlides = heroSlides, heroLogos = heroLogos,\n                    rows = rows, libraryRecommendations = localRecommendations, loading = rowsLoading, moviesState = moviesState, seriesState = seriesState,\n                    vm = vm, onTitleClick = onTitleClick, onSeeAll = { key, meta -> discoverVm.seeAllRow(key, meta) },'''
if old_call not in s: raise SystemExit('DiscoverHomeRows call anchor not found')
s = s.replace(old_call, new_call, 1)

sig_old = '''private fun DiscoverHomeRows(\n    rows: List<DiscoverRowDto>, libraryRecommendations: List<DiscoverResultDto>,'''
sig_new = '''private fun DiscoverHomeRows(\n    heroSlides: List<com.movviz.tv.data.DashboardHeroSlideDto>,\n    heroLogos: Map<String, String>,\n    rows: List<DiscoverRowDto>, libraryRecommendations: List<DiscoverResultDto>,'''
if sig_old not in s: raise SystemExit('DiscoverHomeRows signature anchor not found')
s = s.replace(sig_old, sig_new, 1)

old_hero = '''            rows.firstOrNull { it.results.isNotEmpty() }?.results?.firstOrNull()?.let { hero ->\n                item(key = "discover-hero") {\n                    DiscoveryHero(hero, moviesState, seriesState, vm, onTitleClick)\n                }\n            }'''
new_hero = '''            if (heroSlides.isNotEmpty()) {\n                item(key = "desktop-synced-hero") {\n                    DesktopSyncedHeroCarousel(heroSlides, heroLogos, moviesState, seriesState, vm, onTitleClick)\n                }\n            }'''
if old_hero not in s: raise SystemExit('old hero block not found')
s = s.replace(old_hero, new_hero, 1)

start = s.find('\n@Composable\nprivate fun DiscoveryHero(')
if start < 0: raise SystemExit('DiscoveryHero not found')
s = s[:start] + r'''

@Composable
private fun DesktopSyncedHeroCarousel(
    slides: List<com.movviz.tv.data.DashboardHeroSlideDto>,
    heroLogos: Map<String, String>,
    moviesState: List<LibraryMovieDto>,
    seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel,
    onTitleClick: (String, Int) -> Unit,
) {
    val pagerState = androidx.compose.foundation.pager.rememberPagerState(pageCount = { slides.size })
    LaunchedEffect(slides.map { "${it.detail.type}:${it.detail.tmdbId}" }) {
        if (slides.size > 1) while (true) {
            kotlinx.coroutines.delay(7000)
            pagerState.animateScrollToPage((pagerState.currentPage + 1) % slides.size)
        }
    }
    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        androidx.compose.foundation.pager.HorizontalPager(
            state = pagerState,
            contentPadding = PaddingValues(horizontal = 16.dp),
            pageSpacing = 10.dp,
        ) { page ->
            val slide = slides[page]
            val d = slide.detail
            val image = d.backdropPath?.let { "https://image.tmdb.org/t/p/w780$it" }
                ?: d.posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }
            val logo = heroLogos["${d.type}-${d.tmdbId}"]
            Box(
                Modifier.fillMaxWidth().height(430.dp).clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF181818)).clickable { onTitleClick(d.type, d.tmdbId) },
            ) {
                if (image != null) AsyncImage(image, d.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.5f to Color.Transparent, 1f to Color.Black.copy(0.97f))))
                Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(18.dp)) {
                    if (logo != null) {
                        AsyncImage("https://image.tmdb.org/t/p/w500$logo", d.title, Modifier.fillMaxWidth(0.72f).heightIn(max = 82.dp), contentScale = ContentScale.Fit, alignment = Alignment.CenterStart)
                    } else {
                        Text(d.title, color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        d.year?.let { Text(it.toString(), color = Color.White.copy(0.78f), fontSize = 12.sp) }
                        if (d.rating > 0) Text("★ %.1f".format(d.rating), color = Color.White.copy(0.78f), fontSize = 12.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Button(
                            onClick = { onTitleClick(d.type, d.tmdbId) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Black),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Icon(Icons.Rounded.PlayArrow, null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Voir", fontWeight = FontWeight.Bold)
                        }
                        StatusButton(
                            libState = cardLibState(d.type, d.tmdbId, moviesState, seriesState),
                            size = 42.dp,
                            type = d.type,
                            tmdbId = d.tmdbId,
                            vm = vm,
                        )
                    }
                }
            }
        }
        if (slides.size > 1) {
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                slides.indices.forEach { i ->
                    Box(
                        Modifier.padding(horizontal = 3.dp).height(4.dp)
                            .width(if (i == pagerState.currentPage) 18.dp else 7.dp)
                            .clip(CircleShape)
                            .background(if (i == pagerState.currentPage) Color.White else Color.White.copy(0.25f))
                    )
                }
            }
        }
    }
}
'''
discover.write_text(s, encoding='utf-8')

# Version 1.24.39 across server + both Android local fallbacks + README badge.
new_version = '1.24.39'
for rel in ['package.json', 'package-lock.json']:
    p = ROOT / rel
    txt = p.read_text(encoding='utf-8')
    txt = txt.replace('"version": "1.24.38"', '"version": "1.24.39"', 1)
    if rel == 'package-lock.json':
        txt = txt.replace('"version": "1.24.38"', '"version": "1.24.39"', 1)
    p.write_text(txt, encoding='utf-8')
for rel in ['android-mobile/app/build.gradle.kts', 'android-tv/app/build.gradle.kts']:
    p = ROOT / rel
    txt = p.read_text(encoding='utf-8').replace('?: 12438', '?: 12439').replace('?: "1.24.38"', '?: "1.24.39"')
    p.write_text(txt, encoding='utf-8')
p = ROOT / 'README.md'
txt = p.read_text(encoding='utf-8').replace('Movviz-1.24.38-', 'Movviz-1.24.39-', 1)
p.write_text(txt, encoding='utf-8')

# Self-clean one-shot files.
(ROOT / 'scripts/_apply_mobile_profile_parity.py').unlink(missing_ok=True)
(ROOT / '.github/workflows/_mobile_profile_parity.yml').unlink(missing_ok=True)
