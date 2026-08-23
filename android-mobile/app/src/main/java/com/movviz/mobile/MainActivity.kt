package com.movviz.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import androidx.compose.ui.res.painterResource
import com.movviz.tv.data.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// ── Design system — 80% sombre/neutre, Movviz en accents ──
// TV est la vérité fonctionnelle, Desktop la vérité artistique.
private val Void = Color(0xFF050508)
private val VoidGlass = Color(0xFF0A0A14)
private val Surface = Color(0xFF141422)
private val SurfaceStrong = Color(0xFF1C1C2E)
private val SurfaceCard = Color(0xFF1E1E32)
private val Violet = Color(0xFF7C5CFF)
private val VioletSoft = Color(0xFF9B7FFF)
private val Magenta = Color(0xFFEC3FD1)
private val Cyan = Color(0xFF3DDC97)
private val TextPrimary = Color(0xFFF5F3FF)
private val TextSoft = Color(0xFFB8B5CC)
private val TextMuted = Color(0xFF8A87A3)
private val TextFaint = Color(0xFF6B6888)
private val MovvizCardShape = RoundedCornerShape(14.dp)
private val CapsuleShape = RoundedCornerShape(28.dp)
private val HeroShape = RoundedCornerShape(20.dp)
private const val POSTER = "https://image.tmdb.org/t/p/w500"
private const val BACKDROP = "https://image.tmdb.org/t/p/w780"

private sealed interface MobileState { data object Server : MobileState; data class Login(val base: String) : MobileState; data class Ready(val base: String, val user: String) : MobileState }

private class MobileViewModel : ViewModel() {
    private val _state = MutableStateFlow<MobileState>(MobileState.Server); val state: StateFlow<MobileState> = _state.asStateFlow()
    private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    private val _hero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList()); val hero = _hero.asStateFlow()
    private val _movies = MutableStateFlow<List<LibraryMovieDto>>(emptyList()); val movies = _movies.asStateFlow()
    private val _series = MutableStateFlow<List<LibrarySeriesDto>>(emptyList()); val series = _series.asStateFlow()
    private val _search = MutableStateFlow<List<SearchResultDto>>(emptyList()); val search = _search.asStateFlow()
    private var repo: MovvizRepository? = null
    fun connect(raw: String) { val base = raw.trim().trimEnd('/'); if (base.isBlank()) { _error.value = "Saisis l’adresse de ton serveur Movviz."; return }; viewModelScope.launch { _busy.value = true; _error.value = null; val r = MovvizRepository(base); val result = runCatching { r.ping() }.getOrElse { ApiResult.Failure("Serveur inaccessible") }; if (result is ApiResult.Success) { repo = r; _state.value = MobileState.Login(base) } else _error.value = "Ce serveur ne répond pas comme Movviz."; _busy.value = false } }
    fun login(username: String, password: String) { val r = repo ?: return; viewModelScope.launch { _busy.value = true; _error.value = null; when (val result = r.login(username.trim(), password)) { is ApiResult.Success -> { _state.value = MobileState.Ready((state.value as? MobileState.Login)?.base ?: "", result.data.username); refresh(r) }; is ApiResult.Failure -> _error.value = "Identifiant ou mot de passe incorrect."; ApiResult.Unauthorized -> _error.value = "Connexion refusée par le serveur." }; _busy.value = false } }
    fun disconnect() { repo = null; _state.value = MobileState.Server; _hero.value = emptyList(); _movies.value = emptyList(); _series.value = emptyList() }
    fun search(query: String) { val r = repo ?: return; if (query.trim().length < 2) { _search.value = emptyList(); return }; viewModelScope.launch { (r.search(query.trim()) as? ApiResult.Success)?.let { _search.value = it.data } } }
    private fun refresh(r: MovvizRepository) { viewModelScope.launch { launch { (r.dashboardHero() as? ApiResult.Success)?.let { _hero.value = it.data } }; launch { (r.movies() as? ApiResult.Success)?.let { _movies.value = it.data } }; launch { (r.series() as? ApiResult.Success)?.let { _series.value = it.data } } } }
}

class MainActivity : ComponentActivity() { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); ApiClient.initialize(applicationContext); setContent { MovvizMobileApp() } } }

@Composable private fun MovvizMobileApp(vm: MobileViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    MaterialTheme(colorScheme = darkColorScheme(primary = Violet, surface = Void, background = Void)) {
        Surface(Modifier.fillMaxSize(), color = Void) {
            AnimatedContent(targetState = state, transitionSpec = { fadeIn(tween(260)) togetherWith fadeOut(tween(200)) }, label = "root") { s ->
                when (s) {
                    MobileState.Server -> ServerOnboarding(vm)
                    is MobileState.Login -> LoginScreen(s.base, vm)
                    is MobileState.Ready -> MobileShell(s.user, vm)
                }
            }
        }
    }
}

// ── Auth — dark cinematic, glass card ──
@Composable private fun ServerOnboarding(vm: MobileViewModel) {
    var server by remember { mutableStateOf("") }; val busy by vm.busy.collectAsState(); val error by vm.error.collectAsState()
    AuthFrame("Connecter Movviz", "Ton catalogue, ton serveur, tes règles.") {
        Mark(); Spacer(Modifier.height(18.dp))
        Text("Adresse du serveur", color = TextSoft, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.3.sp)
        Spacer(Modifier.height(7.dp))
        OutlinedTextField(server, { server = it }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("https://movviz…", color = TextFaint) }, shape = RoundedCornerShape(16.dp), colors = authFieldColors())
        ErrorText(error); Spacer(Modifier.height(18.dp))
        GradientButton(if (busy) "Connexion…" else "Continuer", busy) { vm.connect(server) }
        Spacer(Modifier.height(10.dp)); Text("Le serveur reste enregistré sur cet appareil.", color = TextFaint, fontSize = 11.sp, lineHeight = 15.sp)
    }
}
@Composable private fun LoginScreen(base: String, vm: MobileViewModel) {
    var username by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; val busy by vm.busy.collectAsState(); val error by vm.error.collectAsState()
    AuthFrame("Bienvenue sur Movviz", "Connecte-toi pour retrouver ta bibliothèque.") {
        Mark(); Spacer(Modifier.height(22.dp))
        OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Identifiant") }, shape = RoundedCornerShape(16.dp), colors = authFieldColors())
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Mot de passe") }, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(16.dp), colors = authFieldColors())
        ErrorText(error); Spacer(Modifier.height(18.dp))
        GradientButton(if (busy) "Connexion…" else "Se connecter", busy) { vm.login(username, password) }
        TextButton({ vm.disconnect() }, Modifier.align(Alignment.CenterHorizontally)) { Text("Changer de serveur", color = TextMuted, fontSize = 13.sp) }
        Text("Serveur : $base", color = TextFaint, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
@Composable private fun AuthFrame(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF1A1033), Void, Void))).statusBarsPadding().padding(horizontal = 20.dp, vertical = 24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(Brush.verticalGradient(listOf(Color(0xFF131328), Surface))).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(28.dp)).padding(24.dp)) {
            Text(title, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp)
            Text(subtitle, color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(22.dp)); content()
        }
    }
}
@Composable private fun Mark() { Box(Modifier.size(56.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), Alignment.Center) { Icon(painterResource(com.movviz.mobile.R.drawable.ic_movviz_clapperboard), null, tint = Color.White, modifier = Modifier.size(28.dp)) } }
@Composable private fun ErrorText(error: String?) { if (error != null) { Spacer(Modifier.height(8.dp)); Text(error, color = Color(0xFFFF6B8A), fontSize = 12.sp, lineHeight = 16.sp, modifier = Modifier.background(Color(0xFFFF6B8A).copy(0.1f), RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 7.dp).fillMaxWidth()) } }
@Composable private fun GradientButton(label: String, disabled: Boolean, onClick: () -> Unit) {
    Button(onClick, Modifier.fillMaxWidth().height(50.dp), enabled = !disabled, shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet, disabledContainerColor = Violet.copy(0.45f))) {
        Text(label, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}
@Composable private fun authFieldColors() = OutlinedTextFieldDefaults.colors(focusedBorderColor = Violet.copy(0.5f), unfocusedBorderColor = Color.White.copy(0.08f), focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, cursorColor = Violet)

// ── Shell + Navigation capsule flottante ──
private data class NavEntry(val icon: ImageVector, val label: String)

@Composable private fun MobileShell(user: String, vm: MobileViewModel) {
    var selected by remember { mutableStateOf(0) }
    val hero by vm.hero.collectAsState(); val movies by vm.movies.collectAsState(); val series by vm.series.collectAsState()
    val entries = remember(user) { listOf(NavEntry(Icons.Rounded.Home, "Accueil"), NavEntry(Icons.Rounded.Search, "Recherche"), NavEntry(Icons.Rounded.FavoriteBorder, "Ma liste"), NavEntry(Icons.Rounded.Person, user)) }
    Scaffold(
        containerColor = Void,
        bottomBar = { FloatingCapsuleNav(entries, selected) { selected = it } },
    ) { padding ->
        when (selected) {
            0 -> HomeScreen(padding, hero, movies, series)
            1 -> SearchScreen(padding, vm)
            2 -> Placeholder(padding, "Ma liste", "Tes titres favoris apparaîtront ici. Ajoute des films et séries depuis leur fiche.")
            else -> ProfileScreen(padding, user) { vm.disconnect() }
        }
    }
}

@Composable private fun FloatingCapsuleNav(entries: List<NavEntry>, selected: Int, onSelect: (Int) -> Unit) {
    Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
        Row(
            Modifier.clip(CapsuleShape)
                .background(Color(0xFF12121E).copy(0.92f))
                .border(1.dp, Color.White.copy(0.07f), CapsuleShape)
                .padding(horizontal = 6.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            entries.forEachIndexed { i, e ->
                val isSel = i == selected
                // Spring douce sur la sélection — le chrome reste neutre, seul l'onglet actif prend la couleur.
                val scale by animateFloatAsState(if (isSel) 1f else 0.96f, spring(dampingRatio = 0.7f, stiffness = 380f), label = "navScale")
                Box(
                    Modifier.clip(CapsuleShape)
                        .background(if (isSel) Color.White else Color.Transparent)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onSelect(i) }
                        .padding(horizontal = 18.dp, vertical = 9.dp)
                        .scale(scale),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(e.icon, null, tint = if (isSel) Void else TextMuted, modifier = Modifier.size(20.dp))
                        if (isSel) Text(e.label, color = Void, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                }
            }
        }
    }
}

// ── Accueil — hero 62% viewport + rails Netflix density ──
@Composable private fun HomeScreen(padding: PaddingValues, hero: List<DashboardHeroSlideDto>, movies: List<LibraryMovieDto>, series: List<LibrarySeriesDto>) {
    val cfg = LocalConfiguration.current
    val heroH = (cfg.screenHeightDp * 0.62f).dp
    LazyColumn(Modifier.fillMaxSize().background(Void), contentPadding = PaddingValues(bottom = 96.dp)) {
        item { Spacer(Modifier.statusBarsPadding().height(56.dp)) }
        if (hero.isNotEmpty()) {
            item { HeroCard(hero.first()) }
        } else {
            item { Box(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(320.dp).clip(HeroShape).background(Surface), contentAlignment = Alignment.Center) { Text("Aucun titre à la une", color = TextMuted, fontSize = 14.sp) } }
        }
        if (movies.isNotEmpty()) item { Rail("Films dans ta bibliothèque", movies.map { CardData(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.rating) }) }
        if (series.isNotEmpty()) item { Rail("Séries dans ta bibliothèque", series.map { CardData(it.tmdbId.toString(), it.title, it.posterPath, it.backdropPath, it.rating) }) }
        item { Text("Continue à explorer — ajoute des titres depuis la recherche.", Modifier.padding(horizontal = 20.dp, vertical = 8.dp), color = TextFaint, fontSize = 12.sp, lineHeight = 16.sp) }
    }
}

private data class CardData(val id: String, val title: String, val poster: String?, val backdrop: String?, val rating: Double)

@Composable private fun HeroCard(slide: DashboardHeroSlideDto) {
    val d = slide.detail
    val posterSource = d.posterPath?.let { POSTER + it }
    val backdropSource = d.backdropPath?.let { BACKDROP + it } ?: posterSource
    Box(
        Modifier.padding(horizontal = 14.dp).fillMaxWidth()
            .heightIn(min = 380.dp).clip(HeroShape)
            .background(Surface)
    ) {
        // Backdrop edge-to-edge, 62% viewport feel — on utilise le poster en fallback portrait si pas de backdrop.
        AsyncImage(backdropSource, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, fallback = null)
        // Gradients Movviz : contenu lisible, pas de grosse tuile
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.38f to Color.Transparent, 1f to Color(0xF005050C))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x6605050C), 0.22f to Color.Transparent)))
        // Logo si dispo — sinon titre texte premium
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 18.dp, vertical = 18.dp).fillMaxWidth()) {
            if (d.title.isNotBlank()) {
                Text(d.title, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black, lineHeight = 28.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, letterSpacing = (-0.4).sp)
            }
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (d.rating > 0) {
                    Row(Modifier.background(Color.White.copy(0.14f), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("★", color = Color(0xFFFFD54F), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text("%.1f".format(d.rating), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
                d.genres?.take(2)?.forEach { g ->
                    Text(g, color = Color.White.copy(0.75f), fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                }
            }
            if (d.overview.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(d.overview, color = Color.White.copy(0.72f), fontSize = 12.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                // CTA principal — blanc, une main, 60% violet en accents seulement (règle 80/20)
                var pressed by remember { mutableStateOf(false) }
                val ctaScale by animateFloatAsState(if (pressed) 0.97f else 1f, tween(120), label = "cta")
                Box(
                    Modifier.scale(ctaScale).clip(RoundedCornerShape(12.dp)).background(Color.White)
                        .clickable { pressed = true } // TODO: ouvrir fiche/lecture (conserve nav existante)
                        .padding(horizontal = 22.dp, vertical = 11.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        Icon(Icons.Rounded.PlayArrow, null, tint = Void, modifier = Modifier.size(18.dp))
                        Text("Lecture", color = Void, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
                // Actions secondaires — glass discret, pas de grosse tuile
                IconButtonGlass(Icons.Rounded.Add, "Ajouter")
                IconButtonGlass(Icons.Rounded.Info, "Infos")
            }
        }
    }
}

@Composable private fun IconButtonGlass(icon: ImageVector, desc: String) {
    Box(Modifier.size(38.dp).clip(CircleShape).background(Color.White.copy(0.14f)).border(1.dp, Color.White.copy(0.12f), CircleShape).clickable { }, contentAlignment = Alignment.Center) {
        Icon(icon, desc, tint = Color.White, modifier = Modifier.size(18.dp))
    }
}

@Composable private fun Rail(title: String, cards: List<CardData>) {
    Column(Modifier.padding(top = 18.dp)) {
        Text(title, Modifier.padding(horizontal = 20.dp), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp)
        Spacer(Modifier.height(10.dp))
        LazyRow(
            contentPadding = PaddingValues(start = 20.dp, end = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(cards, key = { it.id }) { c ->
                var pressed by remember { mutableStateOf(false) }
                val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.55f, stiffness = 420f), label = "card")
                Column(
                    Modifier.width(128.dp).scale(scale).clickable(
                        interactionSource = remember { MutableInteractionSource() }, indication = null,
                        onClick = { pressed = !pressed },
                    )
                ) {
                    Box(Modifier.fillMaxWidth().height(184.dp).clip(MovvizCardShape).background(SurfaceCard)) {
                        if (c.poster != null) {
                            AsyncImage(POSTER + c.poster, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        } else if (c.backdrop != null) {
                            AsyncImage(BACKDROP + c.backdrop, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        } else {
                            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(SurfaceCard, Surface))), contentAlignment = Alignment.Center) {
                                Text("○", color = TextFaint, fontSize = 22.sp)
                            }
                        }
                        // Peeking hint is natural via contentPadding end 12dp — 3 cartes + amorce du suivant
                    }
                    Text(c.title, color = TextSoft, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 7.dp))
                    if (c.rating > 0) Text("★ ${"%.1f".format(c.rating)}", color = Color(0xFFFFBF3F).copy(0.9f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable private fun SearchScreen(padding: PaddingValues, vm: MobileViewModel) {
    var query by remember { mutableStateOf("") }; val results by vm.search.collectAsState()
    // debounce 280ms — annule la requête précédente implicitement via le StateFlow
    LaunchedEffect(query) { if (query.trim().length >= 2) { kotlinx.coroutines.delay(280); vm.search(query) } else if (query.isEmpty()) vm.search("") }
    Column(Modifier.fillMaxSize().background(Void).padding(padding).padding(horizontal = 16.dp)) {
        Text("Recherche", color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = query, onValueChange = { query = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            leadingIcon = { Icon(Icons.Rounded.Search, null, tint = TextMuted) },
            trailingIcon = { if (query.isNotEmpty()) IconButton({ query = ""; vm.search("") }) { Icon(Icons.Rounded.Close, null, tint = TextMuted, modifier = Modifier.size(18.dp)) } },
            placeholder = { Text("Un titre, une série…", color = TextFaint) },
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Violet.copy(0.45f), unfocusedBorderColor = Color.White.copy(0.08f), focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, cursorColor = Violet),
        )
        Spacer(Modifier.height(16.dp))
        when {
            query.trim().length < 2 && results.isEmpty() -> {
                Column(Modifier.fillMaxWidth().padding(top = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Rounded.Search, null, tint = TextFaint, modifier = Modifier.size(36.dp))
                    Text("Commence à écrire pour explorer", color = TextMuted, fontSize = 13.sp)
                    Text("Films, séries et collections Movviz", color = TextFaint, fontSize = 12.sp)
                }
            }
            results.isEmpty() -> {
                Box(Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) { Text("Aucun résultat pour « $query »", color = TextMuted, fontSize = 13.sp) }
            }
            else -> {
                LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(results, key = { "${it.type}-${it.tmdbId}" }) { r ->
                        var pressed by remember { mutableStateOf(false) }
                        val scale by animateFloatAsState(if (pressed) 0.98f else 1f, tween(110), label = "res")
                        Row(
                            Modifier.fillMaxWidth().scale(scale).clip(RoundedCornerShape(14.dp)).background(Surface)
                                .border(1.dp, Color.White.copy(if (pressed) 0.10f else 0.05f), RoundedCornerShape(14.dp))
                                .clickable { pressed = !pressed }.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.size(width = 52.dp, height = 74.dp).clip(RoundedCornerShape(10.dp)).background(SurfaceStrong)) {
                                if (r.posterPath != null) AsyncImage(POSTER + r.posterPath, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                else Box(Modifier.align(Alignment.Center).size(22.dp), contentAlignment = Alignment.Center) { Text("○", color = TextFaint, fontSize = 14.sp) }
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(r.title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.height(2.dp))
                                Text("${r.year?.toString() ?: "—"}  •  ${r.type.replaceFirstChar { it.uppercase() }}", color = TextMuted, fontSize = 12.sp)
                            }
                            Icon(Icons.Rounded.KeyboardArrowRight, null, tint = TextFaint, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun ProfileScreen(padding: PaddingValues, user: String, onDisconnect: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Void).padding(padding).padding(horizontal = 20.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Profil", color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brush.verticalGradient(listOf(Surface, SurfaceStrong))).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(20.dp)).padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.size(54.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), contentAlignment = Alignment.Center) {
                    Text(user.take(2).uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                Column(Modifier.weight(1f)) {
                    Text(user, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("Profil actif", color = TextMuted, fontSize = 12.sp)
                }
                Icon(Icons.Rounded.KeyboardArrowRight, null, tint = TextFaint)
            }
        }
        TextButton(onDisconnect, Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White.copy(0.06f)).padding(vertical = 4.dp)) { Text("Se déconnecter", color = TextSoft, fontWeight = FontWeight.SemiBold) }
        Text("Movviz Mobile — même catalogue, même progression, pensé pour le pouce.", color = TextFaint, fontSize = 11.sp, lineHeight = 15.sp)
    }
}

@Composable private fun Placeholder(padding: PaddingValues, title: String, subtitle: String, onDisconnect: (() -> Unit)? = null) {
    Column(Modifier.fillMaxSize().background(Void).padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Text(subtitle, color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
        onDisconnect?.let { TextButton(it, Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(0.06f))) { Text("Changer de serveur", color = VioletSoft, fontWeight = FontWeight.SemiBold, fontSize = 13.sp) } }
    }
}
