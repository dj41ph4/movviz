from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
main = ROOT / "android-mobile/app/src/main/java/com/movviz/mobile/MainActivity.kt"
discover = ROOT / "android-mobile/app/src/main/java/com/movviz/mobile/discover/DiscoverScreen.kt"
library = ROOT / "android-mobile/app/src/main/java/com/movviz/mobile/library/LibraryScreen.kt"

# --- Main shell: only Découverte / Bibliothèque / Profil. Search lives inside each relevant screen.
s = main.read_text(encoding="utf-8")
start = s.index("@Composable private fun MobileShell")
end = s.index("@Composable private fun FloatingCapsuleNav", start)
new_shell = r'''@Composable private fun MobileShell(user: String, vm: MobileViewModel) {
    var selected by remember { mutableStateOf(0) }
    var detailStack by remember { mutableStateOf(emptyList<Pair<String, Int>>()) }
    var downloadsOpen by remember { mutableStateOf(false) }
    val entries = remember(user) {
        listOf(
            NavEntry(Icons.Rounded.Explore, "Découverte"),
            NavEntry(Icons.Rounded.VideoLibrary, "Bibliothèque"),
            NavEntry(Icons.Rounded.Person, user),
        )
    }
    val haptic = LocalHapticFeedback.current
    val onTitleClick: (String, Int) -> Unit = { type, tmdbId ->
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
        detailStack = detailStack + (type to tmdbId)
        vm.loadDetail(type, tmdbId)
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        Scaffold(
            containerColor = Color.Black,
            bottomBar = {
                if (detailStack.isEmpty() && !downloadsOpen) {
                    FloatingCapsuleNav(entries, selected) {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        selected = it
                    }
                }
            },
        ) { padding ->
            when (selected) {
                0 -> com.movviz.mobile.discover.DiscoverScreen(
                    padding = padding,
                    vm = vm,
                    onTitleClick = onTitleClick,
                    onDownloads = { downloadsOpen = true },
                )
                1 -> com.movviz.mobile.library.LibraryScreen(
                    padding = padding,
                    vm = vm,
                    onTitleClick = onTitleClick,
                    onDownloads = { downloadsOpen = true },
                )
                else -> ProfileScreen(padding, user, vm) { vm.disconnect() }
            }
        }

        if (detailStack.isNotEmpty()) {
            val (type, tmdbId) = detailStack.last()
            DetailScreen(vm, type, tmdbId, onClose = {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                detailStack = detailStack.dropLast(1)
                if (detailStack.isEmpty()) vm.clearDetail() else {
                    val (pt, pi) = detailStack.last()
                    vm.loadDetail(pt, pi)
                }
            }, onOpenTitle = onTitleClick)
        }

        if (downloadsOpen) {
            com.movviz.mobile.downloads.DownloadsScreen(
                vm = vm,
                onClose = { downloadsOpen = false },
                onTitleClick = { type, tmdbId ->
                    downloadsOpen = false
                    onTitleClick(type, tmdbId)
                },
            )
        }
    }
}

'''
s = s[:start] + new_shell + s[end:]

# Replace bottom navigation with a Netflix-like 3-item bar: dark, compact, always-readable labels.
start = s.index("@Composable private fun FloatingCapsuleNav")
end = s.index("private data class CardData", start)
new_nav = r'''@Composable private fun FloatingCapsuleNav(entries: List<NavEntry>, selected: Int, onSelect: (Int) -> Unit) {
    Box(
        Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(30.dp))
                .background(Color(0xF21B1B1B))
                .border(1.dp, Color.White.copy(0.08f), RoundedCornerShape(30.dp))
                .padding(horizontal = 6.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            entries.forEachIndexed { i, e ->
                val isSel = i == selected
                val scale by animateFloatAsState(
                    if (isSel) 1f else 0.96f,
                    spring(dampingRatio = 0.7f, stiffness = 450f),
                    label = "navScale",
                )
                val hapticNav = LocalHapticFeedback.current
                Column(
                    Modifier.weight(1f).scale(scale)
                        .clip(RoundedCornerShape(24.dp))
                        .background(if (isSel) Color.White.copy(0.10f) else Color.Transparent)
                        .clickable {
                            hapticNav.performHapticFeedback(HapticFeedbackType.LongPress)
                            onSelect(i)
                        }
                        .padding(vertical = 7.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp),
                ) {
                    Icon(
                        e.icon,
                        contentDescription = e.label,
                        tint = if (isSel) Color.White else Color(0xFF9A9A9A),
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        e.label,
                        color = if (isSel) Color.White else Color(0xFF9A9A9A),
                        fontSize = 10.sp,
                        fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

'''
s = s[:start] + new_nav + s[end:]
main.write_text(s, encoding="utf-8")

# --- Discovery: global dynamic search, Netflix-like header, server-download shortcut and hero.
d = discover.read_text(encoding="utf-8")
d = d.replace(
    "internal fun DiscoverScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {",
    "internal fun DiscoverScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit, onDownloads: () -> Unit = {}) {",
)
old_header = '''                Text("Découverte", color = MovvizInk, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)\n                Spacer(Modifier.height(10.dp))'''
new_header = '''                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {\n                    Text("Découverte", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp, modifier = Modifier.weight(1f))\n                    IconButton(onClick = onDownloads) {\n                        Icon(Icons.Rounded.Download, "Téléchargements du serveur", tint = Color.White, modifier = Modifier.size(28.dp))\n                    }\n                }\n                Spacer(Modifier.height(10.dp))'''
if old_header not in d:
    raise SystemExit("Discover header anchor not found")
d = d.replace(old_header, new_header, 1)
# Make search surface deliberately neutral/dark like Netflix while preserving dynamic server search.
d = d.replace(
    'shape = RoundedCornerShape(14.dp),\n                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MovvizBrand.copy(0.5f), unfocusedBorderColor = Color.White.copy(0.08f), focusedTextColor = MovvizInk, unfocusedTextColor = MovvizInk, cursorColor = MovvizBrand),',
    'shape = RoundedCornerShape(12.dp),\n                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color.White.copy(0.30f), unfocusedBorderColor = Color.White.copy(0.10f), focusedContainerColor = Color(0xFF181818), unfocusedContainerColor = Color(0xFF181818), focusedTextColor = Color.White, unfocusedTextColor = Color.White, cursorColor = Color.White),',
    1,
)
# Insert a large editorial hero before rows (inspired by the supplied Netflix home screenshot).
anchor = '''        } else {\n            if (libraryRecommendations.isNotEmpty()) {'''
hero_insert = '''        } else {\n            rows.firstOrNull { it.results.isNotEmpty() }?.results?.firstOrNull()?.let { hero ->\n                item(key = "discover-hero") {\n                    DiscoveryHero(hero, moviesState, seriesState, vm, onTitleClick)\n                }\n            }\n            if (libraryRecommendations.isNotEmpty()) {'''
if anchor not in d:
    raise SystemExit("Discover hero anchor not found")
d = d.replace(anchor, hero_insert, 1)

# Append the hero composable once.
if "private fun DiscoveryHero(" not in d:
    d += r'''

@Composable
private fun DiscoveryHero(
    hero: DiscoverResultDto,
    moviesState: List<LibraryMovieDto>,
    seriesState: List<LibrarySeriesDto>,
    vm: MobileViewModel,
    onTitleClick: (String, Int) -> Unit,
) {
    val image = hero.backdropPath?.let { "https://image.tmdb.org/t/p/w780$it" }
        ?: hero.posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Box(
            Modifier.fillMaxWidth().height(430.dp).clip(RoundedCornerShape(18.dp))
                .background(Color(0xFF181818)).clickable { onTitleClick(hero.type, hero.tmdbId) },
        ) {
            if (image != null) AsyncImage(image, hero.title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.55f to Color.Transparent, 1f to Color.Black.copy(0.96f))))
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(18.dp)) {
                Text(hero.title, color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    hero.year?.let { Text(it.toString(), color = Color.White.copy(0.78f), fontSize = 12.sp) }
                    if (hero.rating > 0) Text("★ %.1f".format(hero.rating), color = Color.White.copy(0.78f), fontSize = 12.sp)
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = { onTitleClick(hero.type, hero.tmdbId) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Black),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
                    ) {
                        Icon(Icons.Rounded.PlayArrow, null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("Voir", fontWeight = FontWeight.Bold)
                    }
                    StatusButton(
                        libState = cardLibState(hero.type, hero.tmdbId, moviesState, seriesState),
                        size = 42.dp,
                        type = hero.type,
                        tmdbId = hero.tmdbId,
                        vm = vm,
                    )
                }
            }
        }
    }
}
'''
discover.write_text(d, encoding="utf-8")

# --- Library: local-only search remains local; add the same server-download shortcut.
l = library.read_text(encoding="utf-8")
l = l.replace(
    "import androidx.compose.material.icons.rounded.Close\n",
    "import androidx.compose.material.icons.rounded.Close\nimport androidx.compose.material.icons.rounded.Download\n",
    1,
)
l = l.replace(
    "internal fun LibraryScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {",
    "internal fun LibraryScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit, onDownloads: () -> Unit = {}) {",
    1,
)
old = '            Text("Bibliothèque", color = MovvizInk, fontSize = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)\n            Spacer(Modifier.height(12.dp))'
new = '            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {\n                Text("Bibliothèque", color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp, modifier = Modifier.weight(1f))\n                IconButton(onClick = onDownloads) { Icon(Icons.Rounded.Download, "Téléchargements du serveur", tint = Color.White, modifier = Modifier.size(27.dp)) }\n            }\n            Spacer(Modifier.height(12.dp))'
if old not in l:
    raise SystemExit("Library header anchor not found")
l = l.replace(old, new, 1)
library.write_text(l, encoding="utf-8")

# One-shot helper: remove itself and the workflow after applying the actual product changes.
(ROOT / "scripts/_apply_mobile_netflix_refresh.py").unlink(missing_ok=True)
(ROOT / ".github/workflows/_mobile_netflix_refresh.yml").unlink(missing_ok=True)
