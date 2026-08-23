package com.movviz.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
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

private val Void = Color(0xFF070711)
private val Abyss = Color(0xFF0D0D1B)
private val SurfaceDark = Color(0xFF151526)
private val Violet = Color(0xFF8655FF)
private val Magenta = Color(0xFFEC3FD1)
private val TextMuted = Color(0xFFA9A5BE)
private const val POSTER = "https://image.tmdb.org/t/p/w500"
private const val BACKDROP = "https://image.tmdb.org/t/p/w780"

internal sealed interface MobileState { data object Server : MobileState; data class Login(val base: String) : MobileState; data class Ready(val base: String, val user: String) : MobileState }

internal class MobileViewModel : ViewModel() {
    private val _state = MutableStateFlow<MobileState>(MobileState.Server); val state: StateFlow<MobileState> = _state.asStateFlow()
    private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    private val _hero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList()); val hero = _hero.asStateFlow()
    private val _movies = MutableStateFlow<List<LibraryMovieDto>>(emptyList()); val movies = _movies.asStateFlow()
    private val _series = MutableStateFlow<List<LibrarySeriesDto>>(emptyList()); val series = _series.asStateFlow()
    private val _search = MutableStateFlow<List<SearchResultDto>>(emptyList()); val search = _search.asStateFlow()
    private var repo: MovvizRepository? = null
    fun connect(raw: String) { val base = raw.trim().trimEnd('/'); if (base.isBlank()) { _error.value = "Saisis lÔÇÖadresse de ton serveur Movviz."; return }; viewModelScope.launch { _busy.value = true; _error.value = null; val r = MovvizRepository(base); val result = runCatching { r.ping() }.getOrElse { ApiResult.Failure("Serveur inaccessible") }; if (result is ApiResult.Success) { repo = r; _state.value = MobileState.Login(base) } else _error.value = "Ce serveur ne r├®pond pas comme Movviz."; _busy.value = false } }
    fun login(username: String, password: String) { val r = repo ?: return; viewModelScope.launch { _busy.value = true; _error.value = null; when (val result = r.login(username.trim(), password)) { is ApiResult.Success -> { _state.value = MobileState.Ready((state.value as? MobileState.Login)?.base ?: "", result.data.username); refresh(r) }; is ApiResult.Failure -> _error.value = "Identifiant ou mot de passe incorrect."; ApiResult.Unauthorized -> _error.value = "Connexion refus├®e par le serveur." }; _busy.value = false } }
    fun disconnect() { repo = null; _state.value = MobileState.Server; _hero.value = emptyList(); _movies.value = emptyList(); _series.value = emptyList() }
    fun search(query: String) { val r = repo ?: return; if (query.trim().length < 2) { _search.value = emptyList(); return }; viewModelScope.launch { (r.search(query.trim()) as? ApiResult.Success)?.let { _search.value = it.data } } }
    private fun refresh(r: MovvizRepository) { viewModelScope.launch { launch { (r.dashboardHero() as? ApiResult.Success)?.let { _hero.value = it.data } }; launch { (r.movies() as? ApiResult.Success)?.let { _movies.value = it.data } }; launch { (r.series() as? ApiResult.Success)?.let { _series.value = it.data } } } }
}

class MainActivity : ComponentActivity() { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); ApiClient.initialize(applicationContext); setContent { MovvizMobileApp() } } }

@Composable private fun MovvizMobileApp(vm: MobileViewModel = viewModel()) { val state by vm.state.collectAsState(); MaterialTheme { Surface(Modifier.fillMaxSize(), color = Void) { when (val s = state) { MobileState.Server -> ServerOnboarding(vm); is MobileState.Login -> LoginScreen(s.base, vm); is MobileState.Ready -> MobileShell(s.user, vm) } } } }

@Composable private fun ServerOnboarding(vm: MobileViewModel) { var server by remember { mutableStateOf("") }; val busy by vm.busy.collectAsState(); val error by vm.error.collectAsState(); AuthFrame("Connecter Movviz", "Ton catalogue, ton serveur, tes r├¿gles.") { Mark(); Spacer(Modifier.height(18.dp)); Text("Adresse du serveur", color = TextMuted, fontSize = 13.sp); Spacer(Modifier.height(6.dp)); OutlinedTextField(server, { server = it }, Modifier.fillMaxWidth(), singleLine = true, placeholder = { Text("https://movvizÔÇª") }, shape = RoundedCornerShape(16.dp)); ErrorText(error); Spacer(Modifier.height(18.dp)); GradientButton(if (busy) "ConnexionÔÇª" else "Continuer", busy) { vm.connect(server) }; Spacer(Modifier.height(12.dp)); Text("Le serveur reste enregistr├® sur cet appareil.", color = TextMuted, fontSize = 12.sp) } }
@Composable private fun LoginScreen(base: String, vm: MobileViewModel) { var username by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; val busy by vm.busy.collectAsState(); val error by vm.error.collectAsState(); AuthFrame("Bienvenue sur Movviz", "Connecte-toi pour retrouver ta biblioth├¿que.") { Mark(); Spacer(Modifier.height(22.dp)); OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Identifiant") }, shape = RoundedCornerShape(16.dp)); Spacer(Modifier.height(10.dp)); OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Mot de passe") }, visualTransformation = PasswordVisualTransformation(), shape = RoundedCornerShape(16.dp)); ErrorText(error); Spacer(Modifier.height(18.dp)); GradientButton(if (busy) "ConnexionÔÇª" else "Se connecter", busy) { vm.login(username, password) }; TextButton({ vm.disconnect() }, Modifier.align(Alignment.CenterHorizontally)) { Text("Changer de serveur", color = TextMuted) }; Text("Serveur : $base", color = TextMuted, fontSize = 11.sp) } }
@Composable private fun AuthFrame(title: String, subtitle: String, content: @Composable ColumnScope.() -> Unit) { Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF1B1330), Void))).statusBarsPadding().padding(20.dp), contentAlignment = Alignment.Center) { Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(Abyss).padding(24.dp)) { Text(title, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold); Text(subtitle, color = TextMuted, fontSize = 14.sp); Spacer(Modifier.height(22.dp)); content() } } }
@Composable private fun Mark() { Box(Modifier.size(58.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), Alignment.Center) { Icon(painterResource(com.movviz.mobile.R.drawable.ic_movviz_clapperboard), null, tint = Color.White, modifier = Modifier.size(30.dp)) } }
@Composable private fun ErrorText(error: String?) { if (error != null) { Spacer(Modifier.height(8.dp)); Text(error, color = Color(0xFFFF718B), fontSize = 13.sp) } }
@Composable private fun GradientButton(label: String, disabled: Boolean, onClick: () -> Unit) { Button(onClick, Modifier.fillMaxWidth().height(52.dp), enabled = !disabled, shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text(label, fontWeight = FontWeight.Bold) } }

@Composable private fun MobileShell(user: String, vm: MobileViewModel) { var selected by remember { mutableStateOf(0) }; val hero by vm.hero.collectAsState(); val movies by vm.movies.collectAsState(); val series by vm.series.collectAsState(); Scaffold(containerColor = Void, bottomBar = { Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp).clip(RoundedCornerShape(30.dp)).background(SurfaceDark).padding(6.dp), horizontalArrangement = Arrangement.SpaceEvenly) { listOf(Icons.Rounded.Home to "Accueil", Icons.Rounded.Search to "Recherche", Icons.Rounded.Favorite to "Ma liste", Icons.Rounded.Person to user).forEachIndexed { i, item -> Column(Modifier.clip(RoundedCornerShape(24.dp)).clickable { selected = i }.padding(horizontal = 14.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(item.first, null, tint = if (selected == i) Color.White else TextMuted); Text(item.second, color = if (selected == i) Color.White else TextMuted, fontSize = 11.sp, maxLines = 1) } } } }) { padding -> when (selected) { 0 -> HomeScreen(padding, hero, movies, series); 1 -> SearchScreen(padding, vm); 2 -> Placeholder(padding, "Ma liste", "Tes titres favoris appara├«tront ici."); else -> Placeholder(padding, "Profil", "Profil actif : $user") { vm.disconnect() } } } }
@Composable private fun HomeScreen(padding: PaddingValues, hero: List<DashboardHeroSlideDto>, movies: List<LibraryMovieDto>, series: List<LibrarySeriesDto>) { LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(bottom = 30.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) { item { Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) { Text("Movviz", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black); Spacer(Modifier.weight(1f)); IconButton({}) { Icon(Icons.Rounded.Settings, null, tint = TextMuted) } } }; if (hero.isNotEmpty()) item { HeroCard(hero.first()) }; if (movies.isNotEmpty()) item { Rail("Films dans ta biblioth├¿que", movies.map { CardData(it.tmdbId.toString(), it.title, it.posterPath, it.rating) }) }; if (series.isNotEmpty()) item { Rail("S├®ries dans ta biblioth├¿que", series.map { CardData(it.tmdbId.toString(), it.title, it.posterPath, it.rating) }) }; item { Text("Continue ├á explorer", Modifier.padding(horizontal = 20.dp), color = TextMuted, fontSize = 15.sp) } } }
private data class CardData(val id: String, val title: String, val poster: String?, val rating: Double)
@Composable private fun HeroCard(slide: DashboardHeroSlideDto) { val d = slide.detail; Box(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(270.dp).clip(RoundedCornerShape(24.dp))) { AsyncImage(d.backdropPath?.let { BACKDROP + it }, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop); Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xE6070711))))); Column(Modifier.align(Alignment.BottomStart).padding(18.dp)) { Text(d.title, color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold); Text(d.overview, color = TextMuted, maxLines = 2, fontSize = 13.sp) } } }
@Composable private fun Rail(title: String, cards: List<CardData>) { Column { Text(title, Modifier.padding(horizontal = 20.dp), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(10.dp)); LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) { items(cards, key = { it.id }) { c -> Column(Modifier.width(122.dp)) { AsyncImage(c.poster?.let { POSTER + it }, null, Modifier.fillMaxWidth().height(174.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Crop); Text(c.title, color = Color.White, maxLines = 1, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)); Text("Ôÿà ${"%.1f".format(c.rating)}", color = Color(0xFFFFBF3F), fontSize = 11.sp) } } } } }
@Composable private fun SearchScreen(padding: PaddingValues, vm: MobileViewModel) { var query by remember { mutableStateOf("") }; val results by vm.search.collectAsState(); Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp)) { Text("Recherche", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(12.dp)); OutlinedTextField(query, { query = it; vm.search(it) }, Modifier.fillMaxWidth(), singleLine = true, leadingIcon = { Icon(Icons.Rounded.Search, null) }, placeholder = { Text("Un titre, une s├®rieÔÇª") }, shape = RoundedCornerShape(16.dp)); Spacer(Modifier.height(18.dp)); if (results.isEmpty() && query.length < 2) Text("Commence ├á ├®crire pour explorer le catalogue.", color = TextMuted); LazyColumn(contentPadding = PaddingValues(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { items(results, key = { "${it.type}-${it.tmdbId}" }) { r -> Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(SurfaceDark).padding(10.dp), verticalAlignment = Alignment.CenterVertically) { AsyncImage(r.posterPath?.let { POSTER + it }, null, Modifier.size(58.dp).clip(RoundedCornerShape(9.dp)), contentScale = ContentScale.Crop); Spacer(Modifier.width(12.dp)); Column { Text(r.title, color = Color.White, fontWeight = FontWeight.SemiBold); Text("${r.year ?: ""}  ÔÇó  ${r.type}", color = TextMuted, fontSize = 12.sp) } } } } } }
@Composable private fun Placeholder(padding: PaddingValues, title: String, subtitle: String, onDisconnect: (() -> Unit)? = null) { Column(Modifier.fillMaxSize().padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { Text(title, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold); Text(subtitle, color = TextMuted); onDisconnect?.let { TextButton(it) { Text("Changer de serveur", color = Violet) } } } }
