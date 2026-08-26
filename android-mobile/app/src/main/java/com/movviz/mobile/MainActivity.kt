package com.movviz.mobile

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import androidx.compose.ui.res.painterResource
import com.movviz.tv.data.*
import com.movviz.mobile.playback.PlaybackService
import com.movviz.mobile.ui.theme.AnimatedLogo
import com.movviz.mobile.ui.theme.MovvizWordmark
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

// ── Design system — aligné TV/web : fond pure black NETFLIX, accents Movviz ──
private val Void = Color(0xFF000000)
private val VoidGlass = Color(0xFF0A0A14)
private val Surface = Color(0xFF0D0D0D)
private val SurfaceStrong = Color(0xFF141414)
private val SurfaceCard = Color(0xFF1E1E32)
private val Violet = Color(0xFF7C5CFF)
private val VioletSoft = Color(0xFF9B7FFF)
private val Magenta = Color(0xFFFF4BD0)
private val Cyan = Color(0xFF5CE0D8)
private val TextPrimary = Color(0xFFFFFFFF)
private val TextSoft = Color(0xFFB3B3B3)
private val TextMuted = Color(0xFF8A87A3)
private val TextFaint = Color(0xFF6B6B6B)
private val MovvizCardShape = RoundedCornerShape(14.dp)
private val CapsuleShape = RoundedCornerShape(28.dp)
private val HeroShape = RoundedCornerShape(20.dp)
private const val POSTER = "https://image.tmdb.org/t/p/w500"
private const val BACKDROP = "https://image.tmdb.org/t/p/w780"

internal sealed interface MobileState { data object Loading : MobileState; data object Server : MobileState; data class Picker(val base: String) : MobileState; data class Login(val base: String) : MobileState; data class PlexPin(val base: String, val pin: PlexPinDto) : MobileState; data class Ready(val base: String, val user: String) : MobileState }

internal class MobileViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = ServerPrefs(application)
    private val profilePrefs = ProfilePrefs(application)
    private val _state = MutableStateFlow<MobileState>(MobileState.Loading); val state: StateFlow<MobileState> = _state.asStateFlow()
    private val _busy = MutableStateFlow(false); val busy = _busy.asStateFlow()
    private val _error = MutableStateFlow<String?>(null); val error = _error.asStateFlow()
    private val _hero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList()); val hero = _hero.asStateFlow()
    private val _movies = MutableStateFlow<List<LibraryMovieDto>>(emptyList()); val movies = _movies.asStateFlow()
    private val _series = MutableStateFlow<List<LibrarySeriesDto>>(emptyList()); val series = _series.asStateFlow()
    private val _search = MutableStateFlow<List<SearchResultDto>>(emptyList()); val search = _search.asStateFlow()
    private val _queue = MutableStateFlow<List<QueueItemDto>>(emptyList()); val queue = _queue.asStateFlow()
    private val _heroLogos = MutableStateFlow<Map<String, String>>(emptyMap()); val heroLogos = _heroLogos.asStateFlow()
    private val _detail = MutableStateFlow<MetaDetailDto?>(null); val detail = _detail.asStateFlow()
    private val _detailLoading = MutableStateFlow(false); val detailLoading = _detailLoading.asStateFlow()
    private val _addingToLibrary = MutableStateFlow(false); val addingToLibrary = _addingToLibrary.asStateFlow()
    private val _seriesSeasons = MutableStateFlow<List<SeriesSeasonDto>>(emptyList()); val seriesSeasons = _seriesSeasons.asStateFlow()
    private val _seasonMetadata = MutableStateFlow<Map<String, MetadataSeasonDto>>(emptyMap()); val seasonMetadata = _seasonMetadata.asStateFlow()
    private val _searchingSeason = MutableStateFlow<Int?>(null); val searchingSeason = _searchingSeason.asStateFlow()
    private val _profiles = MutableStateFlow<List<TvProfile>>(emptyList()); val profiles = _profiles.asStateFlow()
    private val _currentUser = MutableStateFlow<MovvizUserDto?>(null); val currentUser = _currentUser.asStateFlow()
    suspend fun loadHeroLogo(type: String, tmdbId: Int) {
        val key = "$type-$tmdbId"
        if (_heroLogos.value.containsKey(key)) return
        val r = repo ?: return
        var result = r.metadataImages(type, tmdbId)
        if (result is ApiResult.Failure) {
            kotlinx.coroutines.delay(1000)
            result = r.metadataImages(type, tmdbId)
        }
        when (result) {
            is ApiResult.Success -> {
                val path = result.data.logos.firstOrNull()?.filePath
                if (path != null) _heroLogos.value = _heroLogos.value + (key to path)
            }
            else -> Unit
        }
    }
    fun preloadHeroLogos(slides: List<DashboardHeroSlideDto>) {
        viewModelScope.launch {
            // Séquentiel rapide 30ms — évite burst tout en restant <200ms pour 6 logos
            slides.take(6).forEach { s ->
                loadHeroLogo(s.detail.type, s.detail.tmdbId)
                kotlinx.coroutines.delay(30)
            }
        }
    }
    fun queueForTmdb(tmdbId: Int): QueueItemDto? = _queue.value.firstOrNull { it.media.tmdbId == tmdbId }
    // IA hermétique — identique au desktop, même conversation serveur (ai-sessions.json par userId)
    private val _aiMessages = MutableStateFlow<List<AiChatMessageDto>>(emptyList()); val aiMessages = _aiMessages.asStateFlow()
    private val _aiSending = MutableStateFlow(false); val aiSending = _aiSending.asStateFlow()
    private val _aiEnabled = MutableStateFlow<Boolean?>(null); val aiEnabled = _aiEnabled.asStateFlow()
    fun loadAiSession() {
        val r = repo ?: return
        viewModelScope.launch {
            when (val res = r.aiSession()) {
                is ApiResult.Success -> { _aiMessages.value = res.data.messages; _aiEnabled.value = res.data.enabled }
                is ApiResult.Failure -> _aiEnabled.value = false
                ApiResult.Unauthorized -> _aiEnabled.value = false
            }
        }
    }
    fun sendAiMessage(text: String) {
        val q = text.trim(); if (q.isBlank() || _aiSending.value) return
        val r = repo ?: return
        _aiMessages.value = _aiMessages.value + AiChatMessageDto(role = "user", content = q)
        _aiSending.value = true
        val pageCtx = _detail.value?.let { d -> AiPageContextDto(tmdbId = d.tmdbId, type = d.type, title = d.title) }
        viewModelScope.launch {
            when (val res = r.aiChat(q, pageCtx)) {
                is ApiResult.Success -> {
                    val msg = res.data.message
                    if (msg != null) _aiMessages.value = _aiMessages.value + msg
                    else _aiMessages.value = _aiMessages.value + AiChatMessageDto(role = "assistant", content = "Réponse vide du serveur.")
                }
                is ApiResult.Failure -> {
                    val err = res.message
                    val detail = if (err == "ai_disabled") "IA désactivée sur le serveur (Réglages → Assistant IA)."
                    else "Erreur IA : $err"
                    _aiMessages.value = _aiMessages.value + AiChatMessageDto(role = "assistant", content = detail)
                }
                ApiResult.Unauthorized -> {
                    _aiMessages.value = _aiMessages.value + AiChatMessageDto(role = "assistant", content = "Session expirée — reconnecte-toi.")
                }
            }
            _aiSending.value = false
        }
    }
    fun clearAiSession() {
        val r = repo ?: return
        viewModelScope.launch {
            r.aiClearSession()
            _aiMessages.value = emptyList()
        }
    }
    fun clearAiMessages() { _aiMessages.value = emptyList(); _aiSending.value = false }
    private var repo: MovvizRepository? = null
    private var seasonsTmdbId: Int? = null
    private var cachedBaseUrl: String? = null

    init { viewModelScope.launch { bootstrap() } }

    private suspend fun bootstrap() {
        val url = prefs.serverUrl.first()
        if (url.isNullOrBlank()) { _state.value = MobileState.Server; return }
        val base = url.trim().trimEnd('/'); cachedBaseUrl = base; val r = MovvizRepository(base); repo = r
        // Toujours passer par le picker Netflix même si une session existe — hermétique
        val me = (r.me() as? ApiResult.Success)?.data
        if (me != null) {
            _currentUser.value = me
            val cookie = ApiClient.sessionSnapshot(base)
            if (!cookie.isNullOrBlank()) profilePrefs.saveSession(base, me.id, cookie)
        }
        loadProfilesInternal(base)
        _state.value = MobileState.Picker(base)
    }

    private suspend fun loadProfilesInternal(base: String) {
        val r = MovvizRepository(base)
        val res = r.tvProfiles()
        val list = if (res is ApiResult.Success) res.data.map { dto ->
            TvProfile(id = dto.id, serverUrl = base, name = dto.name, avatar = dto.avatar, cookieSnapshot = profilePrefs.getSession(base, dto.id))
        } else emptyList()
        val me = _currentUser.value
        val withMe = if (me != null && list.none { it.id == me.id }) {
            list + TvProfile(id = me.id, serverUrl = base, name = me.username, avatar = me.plexAvatar, cookieSnapshot = ApiClient.sessionSnapshot(base))
        } else list
        _profiles.value = withMe
    }

    fun refreshProfiles() {
        val base = (_state.value as? MobileState.Picker)?.base ?: cachedBaseUrl ?: runBlocking { prefs.serverUrl.first() }?.trim()?.trimEnd('/') ?: return
        viewModelScope.launch { loadProfilesInternal(base) }
    }

    fun selectProfile(profile: TvProfile) {
        val base = profile.serverUrl
        cachedBaseUrl = base
        if (profile.cookieSnapshot.isNullOrBlank()) {
            // Pas de session locale — redemande login pour ce profil
            _state.value = MobileState.Login(base)
            _error.value = "Session expirée pour ${profile.name} — reconnecte-toi."
            return
        }
        viewModelScope.launch {
            _busy.value = true
            ApiClient.restoreSession(base, profile.cookieSnapshot)
            when (val res = MovvizRepository(base).me()) {
                is ApiResult.Success -> {
                    val user = res.data
                    if (user != null) {
                        _currentUser.value = user
                        repo = MovvizRepository(base)
                        cachedBaseUrl = base
                        _state.value = MobileState.Ready(base, user.username)
                        refresh(MovvizRepository(base)); loadAiSession()
                    } else {
                        _error.value = "Session expirée pour ${profile.name}"
                        _state.value = MobileState.Login(base)
                    }
                }
                else -> { _error.value = "Impossible de restaurer ${profile.name}"; _state.value = MobileState.Login(base) }
            }
            _busy.value = false
        }
    }

    fun showLogin(base: String) { _state.value = MobileState.Login(base); _error.value = null }
    fun showPlexPin(base: String) {
        val r = repo ?: MovvizRepository(base).also { repo = it }
        viewModelScope.launch {
            _busy.value = true
            when (val res = r.createPlexPin()) {
                is ApiResult.Success -> _state.value = MobileState.PlexPin(base, res.data)
                is ApiResult.Failure -> _error.value = res.message
                ApiResult.Unauthorized -> _error.value = "Plex non configuré sur ce serveur"
            }
            _busy.value = false
        }
    }
    fun pollPlexPin(pinId: Long, base: String) {
        val r = repo ?: return
        viewModelScope.launch {
            when (val res = r.pollPlexPin(pinId)) {
                is ApiResult.Success -> {
                    val u = res.data.user
                    if (res.data.done && u != null) {
                        _currentUser.value = u
                        val cookie = ApiClient.sessionSnapshot(base)
                        if (!cookie.isNullOrBlank()) profilePrefs.saveSession(base, u.id, cookie)
                        _state.value = MobileState.Ready(base, u.username)
                        refresh(r); loadAiSession()
                    }
                }
                else -> Unit
            }
        }
    }

    fun connect(raw: String) {
        val base = raw.trim().trimEnd('/'); if (base.isBlank()) { _error.value = "Saisis l'adresse de ton serveur Movviz."; return }
        viewModelScope.launch { _busy.value = true; _error.value = null; val r = MovvizRepository(base); val result = runCatching { r.ping() }.getOrElse { ApiResult.Failure("Serveur inaccessible") }; if (result is ApiResult.Success) { prefs.setServerUrl(base); repo = r; cachedBaseUrl = base; _state.value = MobileState.Picker(base); loadProfilesInternal(base) } else _error.value = "Ce serveur ne répond pas comme Movviz."; _busy.value = false }
    }

    fun login(username: String, password: String) {
        val r = repo ?: return; viewModelScope.launch { _busy.value = true; _error.value = null; when (val result = r.login(username.trim(), password)) { is ApiResult.Success -> {
            _currentUser.value = result.data
            val base = (state.value as? MobileState.Login)?.base ?: (state.value as? MobileState.Picker)?.base ?: cachedBaseUrl ?: ""
            val cookie = ApiClient.sessionSnapshot(base.ifBlank { r.toString() })
            // Save profile locally (hermétique)
            val baseNorm = base.ifBlank { cachedBaseUrl ?: runBlocking { prefs.serverUrl.first() } ?: "" }.trim().trimEnd('/')
            if (baseNorm.isNotBlank() && cachedBaseUrl == null) cachedBaseUrl = baseNorm
            if (baseNorm.isNotBlank() && !cookie.isNullOrBlank()) profilePrefs.saveSession(baseNorm, result.data.id, cookie)
            _state.value = MobileState.Ready(baseNorm, result.data.username); refresh(r); loadAiSession()
        }; is ApiResult.Failure -> _error.value = "Identifiant ou mot de passe incorrect."; ApiResult.Unauthorized -> _error.value = "Connexion refusée par le serveur." }; _busy.value = false }
    }

    fun switchProfile() {
        val s = _state.value
        val baseFromState: String? = when (s) {
            is MobileState.Ready -> s.base
            is MobileState.Picker -> s.base
            is MobileState.Login -> s.base
            is MobileState.PlexPin -> s.base
            else -> null
        }
        val base = baseFromState ?: cachedBaseUrl ?: runBlocking { prefs.serverUrl.first() }?.trim()?.trimEnd('/')
        if (base.isNullOrBlank()) return
        viewModelScope.launch { loadProfilesInternal(base); _state.value = MobileState.Picker(base) }
    }

    fun getBaseUrl(): String? = cachedBaseUrl ?: runBlocking { prefs.serverUrl.first() }?.trim()?.trimEnd('/')

    // Version non-bloquante pour Compose (évite runBlocking sur le thread UI)
    fun getBaseUrlCached(): String? = cachedBaseUrl

    fun disconnect() { viewModelScope.launch { val base = prefs.serverUrl.first()?.trim()?.trimEnd('/'); if (base != null) profilePrefs.clearServer(base); prefs.clearServerUrl(); ApiClient.clearSession(); repo = null; cachedBaseUrl = null; _state.value = MobileState.Server; _hero.value = emptyList(); _movies.value = emptyList(); _series.value = emptyList(); _search.value = emptyList(); _detail.value = null; _profiles.value = emptyList(); _currentUser.value = null; clearAiMessages(); _aiEnabled.value = null } }
    fun forgetServer() { disconnect() }

    fun search(query: String) { val r = repo ?: return; if (query.trim().length < 2) { _search.value = emptyList(); return }; viewModelScope.launch { (r.search(query.trim()) as? ApiResult.Success)?.let { _search.value = it.data } } }

    fun loadQueue() { val r = repo ?: return; viewModelScope.launch { when (val q = r.queue()) { is ApiResult.Success -> _queue.value = q.data.filter { it.status != "completed" && it.status != "seeding" }; else -> Unit } } }

    private fun refresh(r: MovvizRepository) {
        viewModelScope.launch {
            launch {
                (r.dashboardHero() as? ApiResult.Success)?.let {
                    _hero.value = it.data
                    preloadHeroLogos(it.data)
                }
            }
            launch {
                // Même snapshot compact que la TV : un seul appel à travers
                // Internet. Le repli protège les serveurs plus anciens.
                when (val snapshot = r.interfaceDashboard()) {
                    is ApiResult.Success -> {
                        // Même contrat compact/tolérant que la TV (AppViewModel.kt) :
                        // une entrée incomplète est ignorée plutôt que de faire
                        // planter tout l'écran d'accueil mobile.
                        _movies.value = snapshot.data.movies.orEmpty().mapNotNull { it?.toLibraryMovieOrNull() }
                        _series.value = snapshot.data.series.orEmpty().mapNotNull { it?.toLibrarySeriesOrNull() }
                    }
                    else -> {
                        (r.movies() as? ApiResult.Success)?.let { _movies.value = it.data }
                        (r.series() as? ApiResult.Success)?.let { _series.value = it.data }
                    }
                }
            }
            launch { loadAiSession() }
            launch { loadQueue() }
        }
    }

    // ── Fiche ──
    fun loadDetail(type: String, tmdbId: Int) {
        val r = repo ?: return; _detail.value = null; _detailLoading.value = true; _seriesSeasons.value = emptyList(); seasonsTmdbId = null
        viewModelScope.launch {
            when (val d = r.detail(type, tmdbId)) { is ApiResult.Success -> _detail.value = d.data; else -> Unit }
            _detailLoading.value = false
            // Synchronise immédiatement l'entrée bibliothèque pour ce tmdbId (évite flash "Ajouter" alors que le film est déjà dans la lib, si movies pas encore chargés)
            launch { refreshTitleLibraryEntrySync(type, tmdbId) }
            if (type == "series") loadSeriesSeasonsInternal(tmdbId)
        }
    }

    fun clearDetail() { _detail.value = null; _detailLoading.value = false; _seriesSeasons.value = emptyList(); seasonsTmdbId = null }

    fun isInLibrary(type: String, tmdbId: Int): Boolean = if (type == "movie") _movies.value.any { it.tmdbId == tmdbId } else _series.value.any { it.tmdbId == tmdbId }
    fun libraryMovieStatus(tmdbId: Int): String? = _movies.value.firstOrNull { it.tmdbId == tmdbId }?.status
    fun libraryMovieFile(tmdbId: Int): LibraryFileDto? = _movies.value.firstOrNull { it.tmdbId == tmdbId }?.file
    fun libraryPlexRatingKey(type: String, tmdbId: Int): String? = if (type == "movie") _movies.value.firstOrNull { it.tmdbId == tmdbId }?.plexRatingKey else null
    fun seriesLibraryId(tmdbId: Int): String? = _series.value.firstOrNull { it.tmdbId == tmdbId }?.id

    private fun loadSeriesSeasonsInternal(tmdbId: Int) {
        val r = repo ?: return; val seriesId = seriesLibraryId(tmdbId) ?: return
        if (seasonsTmdbId != tmdbId) { seasonsTmdbId = tmdbId; _seriesSeasons.value = emptyList() }
        viewModelScope.launch { when (val s = r.seriesSeasons(seriesId)) { is ApiResult.Success -> if (seasonsTmdbId == tmdbId) _seriesSeasons.value = s.data; else -> Unit } }
    }

    fun seasonMetadataKey(tmdbId: Int, seasonNumber: Int): String = "${tmdbId}-${seasonNumber}"
    fun loadSeasonMetadata(tmdbId: Int, seasonNumber: Int) {
        val key = seasonMetadataKey(tmdbId, seasonNumber); if (_seasonMetadata.value.containsKey(key)) return; val r = repo ?: return
        viewModelScope.launch { when (val result = r.metadataSeason(tmdbId, seasonNumber)) { is ApiResult.Success -> _seasonMetadata.value = _seasonMetadata.value + (key to result.data); else -> Unit } }
    }

    // Logique Movviz comprise : Plex = vérité fichiers, Movviz = suivi/monitoring/recherche.
    // Après un ajout, le serveur met en file une recherche automatique, mais comme sur TV/Desktop
    // on déclenche aussi une recherche manuelle si le statut reste "missing" — évite le piège "Manquant" sans téléchargement.
    suspend fun addToLibrary(type: String, tmdbId: Int): ApiResult<Unit> {
        val r = repo ?: return ApiResult.Failure("Aucun serveur configuré"); _addingToLibrary.value = true
        try {
            val result = r.addToLibrary(type, tmdbId)
            if (result is ApiResult.Unauthorized) return result
            refreshTitleLibraryEntry(type, tmdbId)
            var attempt = 0
            while (attempt < 2 && !isInLibrary(type, tmdbId)) { kotlinx.coroutines.delay(350); refreshTitleLibraryEntrySync(type, tmdbId); attempt++ }
            if (!isInLibrary(type, tmdbId) && _detail.value != null) addOptimisticEntry(type, tmdbId)
            val curStatus = libraryMovieStatus(tmdbId)
            if (curStatus == "missing" || curStatus == "searching") {
                triggerSearchInternal(type, tmdbId)
            } else if (!isInLibrary(type, tmdbId)) {
                triggerSearchInternal(type, tmdbId)
            }
            return if (result is ApiResult.Failure && !isInLibrary(type, tmdbId)) result else ApiResult.Success(Unit)
        } finally { _addingToLibrary.value = false }
    }

    private suspend fun triggerSearchInternal(type: String, tmdbId: Int) {
        val r = repo ?: return
        val libId = if (type == "movie") _movies.value.firstOrNull { it.tmdbId == tmdbId }?.id else _series.value.firstOrNull { it.tmdbId == tmdbId }?.id
        if (libId != null) {
            if (type == "movie") r.searchMovieNow(libId) else r.searchSeriesNow(libId)
            kotlinx.coroutines.delay(400); refreshTitleLibraryEntrySync(type, tmdbId); loadQueue()
        }
    }

    fun triggerSearch(tmdbId: Int, type: String) {
        viewModelScope.launch {
            triggerSearchInternal(type, tmdbId)
            kotlinx.coroutines.delay(800); loadQueue()
            kotlinx.coroutines.delay(1200); refreshTitleLibraryEntry(type, tmdbId)
        }
    }

    private suspend fun refreshTitleLibraryEntrySync(type: String, tmdbId: Int) {
        val r = repo ?: return
        if (type == "movie") { (r.movieByTmdbId(tmdbId) as? ApiResult.Success)?.data?.let { updated -> _movies.value = _movies.value.replaceOrAppend(updated) { it.tmdbId } } }
        else { (r.seriesByTmdbId(tmdbId) as? ApiResult.Success)?.data?.let { updated -> _series.value = _series.value.replaceOrAppend(updated) { it.tmdbId }; loadSeriesSeasonsInternal(tmdbId) } }
    }

    fun refreshTitleLibraryEntry(type: String, tmdbId: Int) { viewModelScope.launch { refreshTitleLibraryEntrySync(type, tmdbId) } }

    private fun addOptimisticEntry(type: String, tmdbId: Int) {
        val d = _detail.value ?: return
        if (type == "movie") {
            _movies.value = _movies.value.filter { it.tmdbId != tmdbId } + LibraryMovieDto(id = "optimistic-$tmdbId", tmdbId = tmdbId, title = d.title, year = d.year, overview = d.overview, posterPath = d.posterPath, backdropPath = d.backdropPath, rating = d.rating, genres = d.genres, status = "searching", file = null, plexRatingKey = null)
        } else {
            _series.value = _series.value.filter { it.tmdbId != tmdbId } + LibrarySeriesDto(id = "optimistic-$tmdbId", tmdbId = tmdbId, title = d.title, year = d.year, overview = d.overview, posterPath = d.posterPath, backdropPath = d.backdropPath, rating = d.rating, genres = d.genres)
        }
    }
}

class MainActivity : ComponentActivity() { override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); ApiClient.initialize(applicationContext); setContent { MovvizMobileApp() } } }

@Composable private fun MovvizMobileApp(vm: MobileViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    MaterialTheme(colorScheme = darkColorScheme(primary = Violet, surface = Void, background = Void)) {
        Surface(Modifier.fillMaxSize(), color = Void) {
            AnimatedContent(targetState = state, transitionSpec = { fadeIn(tween(260)) togetherWith fadeOut(tween(200)) }, label = "root") { s ->
                when (s) {
                    MobileState.Loading -> Box(Modifier.fillMaxSize().background(Void), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Violet, strokeWidth = 3.dp, modifier = Modifier.size(32.dp)) }
                    MobileState.Server -> ServerOnboarding(vm)
                    is MobileState.Picker -> ProfilePickerScreen(s.base, vm)
                    is MobileState.Login -> LoginScreen(s.base, vm)
                    is MobileState.PlexPin -> PlexPinScreen(s.base, s.pin, vm)
                    is MobileState.Ready -> MobileShell(s.user, vm)
                }
            }
        }
    }
}

// ── Picker Netflix — qui est-ce ? — hermétique par profil ──
@Composable private fun ProfilePickerScreen(base: String, vm: MobileViewModel) {
    val profiles by vm.profiles.collectAsState()
    val busy by vm.busy.collectAsState()
    val error by vm.error.collectAsState()
    val haptic = LocalHapticFeedback.current
    var showAddSheet by remember { mutableStateOf(false) }
    LaunchedEffect(base) { vm.refreshProfiles() }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0D0D1A), Void))).statusBarsPadding().padding(horizontal = 20.dp, vertical = 24.dp)) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Qui est-ce ?", color = TextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.5).sp)
                Text("Choisis ton profil — chacun a sa bibliothèque et son IA", color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
            }
            if (busy && profiles.isEmpty()) {
                Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Violet, modifier = Modifier.size(32.dp)) }
            } else {
                // Netflix grid 2 colonnes, + en dernier
                val columns = 2
                val rows = (profiles.size + 1 + columns - 1) / columns
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    for (row in 0 until rows) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            for (col in 0 until columns) {
                                val idx = row * columns + col
                                if (idx < profiles.size) {
                                    val p = profiles[idx]
                                    var pressed by remember { mutableStateOf(false) }
                                    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "prof")
                                    Column(
                                        Modifier.weight(1f).scale(scale).clip(RoundedCornerShape(16.dp)).background(Surface).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(16.dp))
                                            .clickable { haptic.performHapticFeedback(HapticFeedbackType.LongPress); pressed = true; vm.selectProfile(p); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressed = false } }
                                            .padding(14.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(Modifier.size(64.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), contentAlignment = Alignment.Center) {
                                            if (p.avatar != null) AsyncImage(p.avatar, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                                            else Text(p.name.take(2).uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                        }
                                        Text(p.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("Profil hermétique", color = TextFaint, fontSize = 10.sp)
                                    }
                                } else if (idx == profiles.size) {
                                    // Carte +
                                    var pressedAdd by remember { mutableStateOf(false) }
                                    val scaleAdd by animateFloatAsState(if (pressedAdd) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "add")
                                    Column(
                                        Modifier.weight(1f).scale(scaleAdd).clip(RoundedCornerShape(16.dp)).background(Color.Transparent).border(1.dp, Violet.copy(0.35f), RoundedCornerShape(16.dp))
                                            .clickable { haptic.performHapticFeedback(HapticFeedbackType.LongPress); pressedAdd = true; showAddSheet = true; kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressedAdd = false } }
                                            .padding(vertical = 22.dp, horizontal = 14.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(Modifier.size(64.dp).clip(CircleShape).background(Violet.copy(0.12f)).border(1.dp, Violet.copy(0.2f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Add, null, tint = VioletSoft, modifier = Modifier.size(32.dp)) }
                                        Text("Ajouter un profil", color = VioletSoft, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text("Movviz ou Plex", color = TextFaint, fontSize = 10.sp)
                                    }
                                } else {
                                    Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                    ErrorText(error)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                TextButton({ vm.disconnect() }) { Text("Changer de serveur", color = TextMuted, fontSize = 13.sp) }
                Text(base, color = TextFaint, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(start = 12.dp))
            }
        }
        if (showAddSheet) {
            // Bottom sheet simple
            Box(Modifier.fillMaxSize().background(Color.Black.copy(0.55f)).clickable { showAddSheet = false }, contentAlignment = Alignment.BottomCenter) {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)).background(SurfaceStrong).padding(20.dp).clickable(enabled = false) {}, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(0.15f)).align(Alignment.CenterHorizontally))
                    Text("Ajouter un profil", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Choisis comment te connecter — chaque profil reste hermétique", color = TextMuted, fontSize = 12.sp)
                    Button({ showAddSheet = false; vm.showLogin(base) }, Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet)) {
                        Icon(Icons.Rounded.Person, null, tint = Color.White, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Compte Movviz", fontWeight = FontWeight.Bold)
                    }
                    Button({ showAddSheet = false; vm.showPlexPin(base) }, Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Surface)) {
                        Icon(painterResource(com.movviz.mobile.R.drawable.ic_movviz_clapperboard), null, tint = VioletSoft, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Se connecter avec Plex", color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    TextButton({ showAddSheet = false }, Modifier.align(Alignment.CenterHorizontally)) { Text("Annuler", color = TextMuted) }
                }
            }
        }
    }
}

@Composable private fun PlexPinScreen(base: String, pin: PlexPinDto, vm: MobileViewModel) {
    val haptic = LocalHapticFeedback.current
    var polling by remember { mutableStateOf(true) }
    LaunchedEffect(pin.id) {
        while (polling) {
            kotlinx.coroutines.delay(2000)
            vm.pollPlexPin(pin.id, base)
            // Si le VM a changé d'état (Ready), on sort
            if (vm.state.value is MobileState.Ready) { polling = false; break }
        }
    }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0D0D1A), Void))).statusBarsPadding().padding(horizontal = 20.dp, vertical = 24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(Surface).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(24.dp)).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.size(56.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), contentAlignment = Alignment.Center) { Icon(painterResource(com.movviz.mobile.R.drawable.ic_movviz_clapperboard), null, tint = Color.White, modifier = Modifier.size(28.dp)) }
            Text("Connexion Plex", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Ouvre plex.tv/link et entre ce code", color = TextMuted, fontSize = 13.sp)
            Box(Modifier.clip(RoundedCornerShape(16.dp)).background(Void).border(1.dp, Violet.copy(0.25f), RoundedCornerShape(16.dp)).padding(horizontal = 24.dp, vertical = 14.dp)) {
                Text(pin.code, color = TextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
            }
            Text(pin.authUrl, color = VioletSoft, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CircularProgressIndicator(color = Violet, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Text("En attente de validation…", color = TextMuted, fontSize = 12.sp)
            }
            Spacer(Modifier.height(4.dp))
            OutlinedButton({ haptic.performHapticFeedback(HapticFeedbackType.LongPress); polling = false; vm.showLogin(base) }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) { Text("Utiliser un mot de passe") }
            TextButton({ vm.showLogin(base) }) { Text("Retour", color = TextMuted) }
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
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(0.08f)))
            Text("ou", color = TextFaint, fontSize = 12.sp)
            Box(Modifier.weight(1f).height(1.dp).background(Color.White.copy(0.08f)))
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton({ vm.showPlexPin(base) }, Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary), border = androidx.compose.foundation.BorderStroke(1.dp, Violet.copy(0.25f))) {
            Icon(painterResource(com.movviz.mobile.R.drawable.ic_movviz_clapperboard), null, tint = VioletSoft, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Se connecter avec Plex", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        }
        TextButton({ vm.switchProfile() }, Modifier.align(Alignment.CenterHorizontally)) { Text("Retour aux profils", color = TextMuted, fontSize = 13.sp) }
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
@Composable private fun Mark() {
    // Port TV : logo animé complet (halo aurora + ondes + particules + pulsation)
    // au lieu du cercle plat historique — même signature que le desktop.
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        AnimatedLogo(size = 72.dp)
    }
    Spacer(Modifier.height(10.dp))
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { MovvizWordmark(fontSize = 22.sp) }
}
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
    var detailStack by remember { mutableStateOf(emptyList<Pair<String, Int>>()) }
    val hero by vm.hero.collectAsState(); val movies by vm.movies.collectAsState(); val series by vm.series.collectAsState()
    val entries = remember(user) { listOf(NavEntry(Icons.Rounded.Home, "Accueil"), NavEntry(Icons.Rounded.Explore, "Découverte"), NavEntry(Icons.Rounded.Search, "Recherche"), NavEntry(Icons.Rounded.FavoriteBorder, "Ma liste"), NavEntry(Icons.Rounded.Person, user), NavEntry(Icons.Rounded.Star, "IA")) }
    val haptic = LocalHapticFeedback.current
    val onTitleClick: (String, Int) -> Unit = { type, tmdbId -> haptic.performHapticFeedback(HapticFeedbackType.LongPress); detailStack = detailStack + (type to tmdbId); vm.loadDetail(type, tmdbId) }
    Box(Modifier.fillMaxSize().background(Void)) {
        Scaffold(
            containerColor = Void,
            bottomBar = { if (detailStack.isEmpty()) FloatingCapsuleNav(entries, selected) { haptic.performHapticFeedback(HapticFeedbackType.LongPress); selected = it } },
        ) { padding ->
            when (selected) {
                0 -> HomeScreen(padding, hero, movies, series, onTitleClick)
                1 -> com.movviz.mobile.discover.DiscoverScreen(padding, vm, onTitleClick)
                2 -> SearchScreen(padding, vm, onTitleClick)
                3 -> Placeholder(padding, "Ma liste", "Tes titres favoris apparaîtront ici. Ajoute des films et séries depuis leur fiche.")
                4 -> ProfileScreen(padding, user) { vm.disconnect() }
                else -> AiChatScreen(padding, vm, onTitleClick)
            }
        }
        if (detailStack.isNotEmpty()) {
            val (type, tmdbId) = detailStack.last()
            DetailScreen(vm, type, tmdbId, onClose = {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                detailStack = detailStack.dropLast(1)
                if (detailStack.isEmpty()) vm.clearDetail() else {
                    val (pt, pi) = detailStack.last(); vm.loadDetail(pt, pi)
                }
            }, onOpenTitle = onTitleClick)
        }
    }
}

@Composable private fun FloatingCapsuleNav(entries: List<NavEntry>, selected: Int, onSelect: (Int) -> Unit) {
    Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
        Row(
            // fillMaxWidth + weight(1f) per item ci-dessous : sans ça, la Row
            // ne se contentait que de la largeur intrinsèque de ses 5 enfants
            // (icônes + libellé de l'onglet sélectionné) — sur un écran assez
            // étroit (ex. Galaxy Z Flip6, ~360-406dp de large), cette somme
            // dépassait la largeur réelle et le dernier item (étoile "IA")
            // débordait purement et simplement hors de l'écran, à moitié
            // invisible. Le partage à parts égales garantit que ça tient
            // toujours, quelle que soit la largeur de l'appareil.
            Modifier.fillMaxWidth()
                .clip(CapsuleShape)
                .background(Color(0xFF12121E).copy(0.92f))
                .border(1.dp, Color.White.copy(0.07f), CapsuleShape)
                .padding(horizontal = 6.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            entries.forEachIndexed { i, e ->
                val isSel = i == selected
                val scale by animateFloatAsState(if (isSel) 1f else 0.96f, spring(dampingRatio = 0.65f, stiffness = 420f), label = "navScale")
                val hapticNav = LocalHapticFeedback.current
                Box(
                    Modifier.weight(1f)
                        .clip(CapsuleShape)
                        .background(if (isSel) Color.White else Color.Transparent)
                        .heightIn(min = 44.dp)
                        .clickable { hapticNav.performHapticFeedback(HapticFeedbackType.LongPress); onSelect(i) }
                        .padding(horizontal = 8.dp, vertical = 9.dp)
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

private data class CardData(val tmdbId: Int, val title: String, val poster: String?, val backdrop: String?, val rating: Double, val type: String)

// ── Accueil — hero 62% viewport + rails Netflix density — logo réel comme desktop ──
@Composable private fun HomeScreen(padding: PaddingValues, hero: List<DashboardHeroSlideDto>, movies: List<LibraryMovieDto>, series: List<LibrarySeriesDto>, onTitleClick: (String, Int) -> Unit) {
    // On récupère le ViewModel ambient pour les logos (pas de param supplémentaire pour garder MobileShell simple)
    val vm: MobileViewModel = viewModel()
    val logos by vm.heroLogos.collectAsState()
    LaunchedEffect(hero) { if (hero.isNotEmpty()) vm.preloadHeroLogos(hero) }
    LazyColumn(Modifier.fillMaxSize().background(Void), contentPadding = PaddingValues(bottom = 96.dp)) {
        item { Spacer(Modifier.statusBarsPadding().height(56.dp)) }
        if (hero.isNotEmpty()) {
            val slide = hero.first()
            val logoKey = "${slide.detail.type}-${slide.detail.tmdbId}"
            val logoPath = logos[logoKey]
            item { HeroCard(slide, logoPath, onTitleClick) }
        } else {
            item { Box(Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(320.dp).clip(HeroShape).background(Surface), contentAlignment = Alignment.Center) { Text("Aucun titre à la une", color = TextMuted, fontSize = 14.sp) } }
        }
        if (movies.isNotEmpty()) item { Rail("Films dans ta bibliothèque", movies.map { CardData(it.tmdbId, it.title, it.posterPath, it.backdropPath, it.rating, "movie") }, onTitleClick) }
        if (series.isNotEmpty()) item { Rail("Séries dans ta bibliothèque", series.map { CardData(it.tmdbId, it.title, it.posterPath, it.backdropPath, it.rating, "series") }, onTitleClick) }
        item { Text("Continue à explorer — ajoute des titres depuis la recherche.", Modifier.padding(horizontal = 20.dp, vertical = 8.dp), color = TextFaint, fontSize = 12.sp, lineHeight = 16.sp) }
    }
}

@Composable private fun HeroCard(slide: DashboardHeroSlideDto, logoPath: String?, onTitleClick: (String, Int) -> Unit) {
    // Wrapper contextuel : Lecture uniquement si déjà en bibliothèque et dispo, sinon Ajouter
    val isAvailable = slide.libraryStatus == "available"
    val isDownloading = slide.libraryStatus == "downloading" || slide.libraryStatus == "searching"
    val d = slide.detail
    val posterSource = d.posterPath?.let { POSTER + it }
    val backdropSource = d.backdropPath?.let { BACKDROP + it } ?: posterSource
    Box(
        Modifier.padding(horizontal = 14.dp).fillMaxWidth()
            .heightIn(min = 380.dp).clip(HeroShape)
            .background(Surface)
            .clickable { onTitleClick(d.type, d.tmdbId) }
    ) {
        AsyncImage(backdropSource, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, fallback = null)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.38f to Color.Transparent, 1f to Color(0xF005050C))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x6605050C), 0.22f to Color.Transparent)))
        Column(Modifier.align(Alignment.BottomStart).padding(horizontal = 18.dp, vertical = 18.dp).fillMaxWidth()) {
            // Logo réel si dispo (comme desktop DashboardHero), sinon titre texte
            if (logoPath != null) {
                AsyncImage(
                    "https://image.tmdb.org/t/p/w500$logoPath",
                    contentDescription = d.title,
                    modifier = Modifier.fillMaxWidth(0.72f).heightIn(max = 84.dp).padding(bottom = 6.dp),
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.CenterStart
                )
            } else if (d.title.isNotBlank()) {
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
                d.genres.take(2).forEach { g ->
                    Text(g, color = Color.White.copy(0.75f), fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                }
            }
            if (logoPath == null && d.overview.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(d.overview, color = Color.White.copy(0.72f), fontSize = 12.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            } else if (logoPath != null && d.overview.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(d.overview, color = Color.White.copy(0.65f), fontSize = 11.sp, lineHeight = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val hapticHero = LocalHapticFeedback.current
                if (isAvailable) {
                    var pressed by remember { mutableStateOf(false) }
                    val ctaScale by animateFloatAsState(if (pressed) 0.92f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "cta")
                    Box(
                        Modifier.heightIn(min = 44.dp).scale(ctaScale).clip(RoundedCornerShape(12.dp)).background(Color.White)
                            .clickable { hapticHero.performHapticFeedback(HapticFeedbackType.LongPress); pressed = true; onTitleClick(d.type, d.tmdbId); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressed = false } }
                            .padding(horizontal = 22.dp, vertical = 11.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            Icon(Icons.Rounded.PlayArrow, null, tint = Void, modifier = Modifier.size(18.dp))
                            Text("Lecture", color = Void, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                } else if (isDownloading) {
                    Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).background(SurfaceStrong).border(1.dp, Violet.copy(0.2f), RoundedCornerShape(12.dp)).padding(horizontal = 18.dp, vertical = 11.dp), contentAlignment = Alignment.Center) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(color = VioletSoft, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Text("Téléchargement…", color = TextSoft, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                } else {
                    var pressedAdd by remember { mutableStateOf(false) }
                    val ctaScale by animateFloatAsState(if (pressedAdd) 0.92f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "ctaAdd")
                    Box(
                        Modifier.heightIn(min = 44.dp).scale(ctaScale).clip(RoundedCornerShape(12.dp)).background(Violet)
                            .clickable { hapticHero.performHapticFeedback(HapticFeedbackType.LongPress); pressedAdd = true; onTitleClick(d.type, d.tmdbId); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressedAdd = false } }
                            .padding(horizontal = 22.dp, vertical = 11.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            Icon(Icons.Rounded.Add, null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Text("Ajouter", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                IconButtonGlass(Icons.Rounded.Info, "Infos") { onTitleClick(d.type, d.tmdbId) }
            }
        }
    }
}

@Composable private fun IconButtonGlass(icon: ImageVector, desc: String, onClick: () -> Unit = {}) {
    val hapticGlass = LocalHapticFeedback.current
    var pressedGlass by remember { mutableStateOf(false) }
    val scaleGlass by animateFloatAsState(if (pressedGlass) 0.92f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "glass")
    Box(Modifier.size(44.dp).scale(scaleGlass).clip(CircleShape).background(Color.White.copy(0.14f)).border(1.dp, Color.White.copy(0.12f), CircleShape).clickable { hapticGlass.performHapticFeedback(HapticFeedbackType.LongPress); pressedGlass = true; onClick(); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(120); pressedGlass = false } }, contentAlignment = Alignment.Center) {
        Icon(icon, desc, tint = Color.White, modifier = Modifier.size(18.dp))
    }
}

@Composable private fun Rail(title: String, cards: List<CardData>, onTitleClick: (String, Int) -> Unit) {
    Column(Modifier.padding(top = 18.dp)) {
        Text(title, Modifier.padding(horizontal = 20.dp), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp)
        Spacer(Modifier.height(10.dp))
        LazyRow(
            contentPadding = PaddingValues(start = 20.dp, end = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(cards, key = { "${it.type}-${it.tmdbId}" }) { c ->
                var pressed by remember { mutableStateOf(false) }
                val scale by animateFloatAsState(if (pressed) 0.92f else 1f, spring(dampingRatio = 0.55f, stiffness = 500f), label = "card")
                val hapticRail = LocalHapticFeedback.current
                Column(
                    Modifier.width(128.dp).scale(scale).clickable {
                        hapticRail.performHapticFeedback(HapticFeedbackType.LongPress); pressed = true
                        onTitleClick(c.type, c.tmdbId)
                        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressed = false }
                    }
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
                    }
                    Text(c.title, color = TextSoft, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 7.dp))
                    if (c.rating > 0) Text("★ ${"%.1f".format(c.rating)}", color = Color(0xFFFFBF3F).copy(0.9f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable private fun SearchScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {
    var query by remember { mutableStateOf("") }; val results by vm.search.collectAsState()
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
                        val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "res")
                        val hapticSearch = LocalHapticFeedback.current
                        Row(
                            Modifier.fillMaxWidth().scale(scale).clip(RoundedCornerShape(14.dp)).background(Surface)
                                .border(1.dp, Color.White.copy(if (pressed) 0.10f else 0.05f), RoundedCornerShape(14.dp))
                                .clickable { hapticSearch.performHapticFeedback(HapticFeedbackType.LongPress); pressed = true; onTitleClick(r.type, r.tmdbId); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressed = false } }.padding(10.dp),
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

// ── Fiche détail tactile — réactive à la bibliothèque comme Desktop/TV ──
@Composable private fun DetailScreen(vm: MobileViewModel, type: String, tmdbId: Int, onClose: () -> Unit, onOpenTitle: (String, Int) -> Unit = { _, _ -> }) {
    val detail by vm.detail.collectAsState()
    val loading by vm.detailLoading.collectAsState()
    val adding by vm.addingToLibrary.collectAsState()
    val seasons by vm.seriesSeasons.collectAsState()
    val seasonMeta by vm.seasonMetadata.collectAsState()
    val moviesState by vm.movies.collectAsState()
    val seriesState by vm.series.collectAsState()
    val queueState by vm.queue.collectAsState()
    // Réactif : se recompose quand movies/series/queue changent (ajout → Manquant → Recherche → Téléchargement → Disponible)
    val inLibrary = if (type == "movie") moviesState.any { it.tmdbId == tmdbId } else seriesState.any { it.tmdbId == tmdbId }
    val status = if (type == "movie") moviesState.firstOrNull { it.tmdbId == tmdbId }?.status else null
    BackHandler { onClose() }
    Box(Modifier.fillMaxSize().background(Void)) {
        if (loading && detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Violet, modifier = Modifier.size(36.dp)) }
        } else if (detail == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Rounded.Warning, null, tint = TextFaint, modifier = Modifier.size(36.dp))
                    Text("Impossible de charger la fiche", color = TextMuted, fontSize = 13.sp)
                    Button(onClick = { vm.loadDetail(type, tmdbId) }, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet)) { Text("Réessayer") }
                }
            }
        } else {
            val d = detail!!
            // Même mécanisme que HeroCard (loadHeroLogo, cache clé "type-tmdbId")
            // — le logo TMDb du titre remplace le titre texte, superposé sur le
            // fond, exactement comme partout ailleurs dans l'app (Hero) et sur
            // desktop/TV.
            LaunchedEffect(type, tmdbId) { vm.loadHeroLogo(type, tmdbId) }
            val heroLogos by vm.heroLogos.collectAsState()
            val logoPath = heroLogos["$type-$tmdbId"]
            LazyColumn(Modifier.fillMaxSize().background(Void), contentPadding = PaddingValues(bottom = 24.dp)) {
                item {
                    Box(Modifier.fillMaxWidth().height(320.dp).background(Surface)) {
                        val bg = d.backdropPath?.let { BACKDROP + it } ?: d.posterPath?.let { POSTER + it }
                        if (bg != null) AsyncImage(bg, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.55f to Color.Transparent, 1f to Color(0xFF050508))))
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x55050508), 0.22f to Color.Transparent)))
                        if (logoPath != null) {
                            AsyncImage(
                                "https://image.tmdb.org/t/p/w500$logoPath",
                                contentDescription = d.title,
                                modifier = Modifier.align(Alignment.BottomStart).padding(horizontal = 20.dp, vertical = 16.dp)
                                    .fillMaxWidth(0.7f).heightIn(max = 72.dp),
                                contentScale = ContentScale.Fit,
                                alignment = Alignment.BottomStart
                            )
                        }
                        // Top bar
                        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            val hapticBack = LocalHapticFeedback.current
                            var pressedBack by remember { mutableStateOf(false) }
                            val scaleBack by animateFloatAsState(if (pressedBack) 0.92f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "back")
                            Box(Modifier.size(44.dp).scale(scaleBack).clip(CircleShape).background(Color.Black.copy(0.45f)).clickable { hapticBack.performHapticFeedback(HapticFeedbackType.LongPress); pressedBack = true; onClose(); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressedBack = false } }, contentAlignment = Alignment.Center) { Icon(Icons.Rounded.ArrowBack, null, tint = Color.White, modifier = Modifier.size(22.dp)) }
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
                item {
                    Column(Modifier.padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        // Titre texte seulement si aucun logo TMDb — le logo (dans
                        // l'image ci-dessus) le remplace déjà visuellement, comme
                        // partout ailleurs dans l'app.
                        if (logoPath == null) Text(d.title, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black, lineHeight = 26.sp, letterSpacing = (-0.4).sp)
                        run { val ot = d.originalTitle; if (!ot.isNullOrBlank() && ot != d.title) Text(ot, color = TextMuted, fontSize = 12.sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic) }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (d.rating > 0) Row(Modifier.background(Color.White.copy(0.10f), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) { Text("★", color = Color(0xFFFFD54F), fontSize = 11.sp, fontWeight = FontWeight.Bold); Text("%.1f".format(d.rating), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            d.year?.let { Text(it.toString(), color = TextMuted, fontSize = 12.sp) }
                            d.runtime?.let { if (it > 0) Text("${it / 60}h ${it % 60}min", color = TextMuted, fontSize = 12.sp) }
                        }
                        if (d.genres.isNotEmpty()) { Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { d.genres.take(3).forEach { g -> Box(Modifier.background(SurfaceStrong, RoundedCornerShape(8.dp)).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp)) { Text(g, color = TextSoft, fontSize = 11.sp, fontWeight = FontWeight.Medium) } } } }
                        if (d.overview.isNotBlank()) Text(d.overview, color = TextSoft, fontSize = 13.sp, lineHeight = 19.sp)
                    }
                }
                // Action bibliothèque
                item {
                    // Si bibliothèque encore vide (bulk load en cours) et qu'on vient d'ouvrir une fiche, on vérifie d'abord l'entrée ciblée pour éviter le flash "Ajouter" alors que le titre est déjà présent (ex: Buzz l'Éclair)
                    val libraryEmpty = moviesState.isEmpty() && seriesState.isEmpty()
                    LaunchedEffect(tmdbId, type, libraryEmpty) {
                        if (!inLibrary && detail != null && libraryEmpty) {
                            vm.refreshTitleLibraryEntry(type, tmdbId)
                        }
                    }
                    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (!inLibrary) {
                            if (libraryEmpty) {
                                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(SurfaceStrong).padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    CircularProgressIndicator(color = Violet, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                    Text("Vérification bibliothèque…", color = TextMuted, fontSize = 12.sp)
                                }
                            } else {
                                Button(
                                    onClick = { kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { vm.addToLibrary(type, tmdbId) } },
                                    modifier = Modifier.fillMaxWidth().height(48.dp), enabled = !adding,
                                    shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet, disabledContainerColor = Violet.copy(0.5f))
                                ) {
                                    if (adding) { CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)); Text("Ajout…", fontWeight = FontWeight.Bold) }
                                    else { Icon(Icons.Rounded.Add, null, tint = Color.White, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Ajouter à la bibliothèque", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
                                }
                                Text("Movviz cherchera automatiquement le meilleur fichier", color = TextFaint, fontSize = 11.sp, lineHeight = 14.sp)
                            }
                        } else {
                            // Réactif : utilise moviesState/queueState déjà collectés en haut (pas vm.libraryMovieStatus qui ne recompose pas)
                            val file = moviesState.firstOrNull { it.tmdbId == tmdbId }?.file
                            val statusLabel = when (status) { "searching" -> "Recherche en cours"; "downloading" -> "Téléchargement"; "available" -> "Disponible"; "missing" -> "Manquant"; "upcoming" -> "À venir"; else -> status ?: "Dans ta bibliothèque" }
                            val statusColor = when (status) { "available" -> Cyan; "downloading","searching" -> VioletSoft; "missing" -> Color(0xFFFF6B8A); else -> TextMuted }
                            val ratingKey = moviesState.firstOrNull { it.tmdbId == tmdbId }?.plexRatingKey
                            val baseUrl = vm.getBaseUrl()
                            val context = LocalContext.current
                            val hapticPlay = LocalHapticFeedback.current
                            val qItem = remember(status, queueState, tmdbId) { queueState.firstOrNull { it.media.tmdbId == tmdbId } }
                            // Poll queue + bibliothèque comme TV/Desktop — sinon reste bloqué en "Téléchargement" alors que Plex a déjà le fichier (vu sur "Les Maîtres du jeu")
                            LaunchedEffect(status, inLibrary) {
                                if (status == "downloading" || status == "searching" || status == "missing") {
                                    while (true) {
                                        vm.loadQueue()
                                        vm.refreshTitleLibraryEntry(type, tmdbId)
                                        kotlinx.coroutines.delay(3000)
                                        val cur = vm.libraryMovieStatus(tmdbId) ?: vm.movies.value.firstOrNull { it.tmdbId == tmdbId }?.status
                                        if (cur == "available") break
                                        if (cur == null) break
                                        // Si la file est vide mais le statut est encore "downloading", c'est que le fichier est déjà dans Plex — on force un refresh global
                                        if (cur == "downloading" && vm.queue.value.none { it.media.tmdbId == tmdbId }) {
                                            vm.refreshTitleLibraryEntry(type, tmdbId)
                                        }
                                    }
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Surface).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
                                Box(Modifier.size(10.dp).clip(CircleShape).background(statusColor))
                                Column(Modifier.weight(1f)) { Text(statusLabel, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold); if (file != null) { val q = listOfNotNull(file.resolution, file.videoCodec?.uppercase(), file.hdr, file.source).joinToString(" • "); if (q.isNotBlank()) Text(q, color = TextMuted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) } }
                                Icon(Icons.Rounded.CheckCircle, null, tint = statusColor, modifier = Modifier.size(20.dp))
                            }
                            when {
                                status == "available" && ratingKey != null && baseUrl != null -> {
                                    var pressedPlay by remember { mutableStateOf(false) }
                                    val scalePlay by animateFloatAsState(if (pressedPlay) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "play")
                                    Spacer(Modifier.height(8.dp))
                                    Button(
                                        onClick = {
                                            hapticPlay.performHapticFeedback(HapticFeedbackType.LongPress)
                                            pressedPlay = true
                                            val intent = com.movviz.mobile.player.PlayerActivity.forMovie(context, baseUrl, ratingKey, tmdbId, d.title, d.posterPath)
                                            context.startActivity(intent)
                                            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressedPlay = false }
                                        },
                                        modifier = Modifier.fillMaxWidth().height(48.dp).scale(scalePlay),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                                    ) {
                                        Icon(Icons.Rounded.PlayArrow, null, tint = Void, modifier = Modifier.size(20.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("Lecture", color = Void, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                    Text("Lecture système • notification + lock screen", color = TextFaint, fontSize = 10.sp, lineHeight = 13.sp)
                                }
                                (status == "downloading" || status == "searching") && qItem != null -> {
                                    val pct = (qItem.download.progress * 100).toInt().coerceIn(0, 100)
                                    val speed = qItem.download.downloadSpeed
                                    val etaSec = qItem.download.eta
                                    val speedStr = when {
                                        speed >= 1024 * 1024 -> String.format("%.1f MB/s", speed / (1024 * 1024))
                                        speed >= 1024 -> String.format("%.0f KB/s", speed / 1024)
                                        else -> String.format("%.0f B/s", speed)
                                    }
                                    val etaStr = when {
                                        etaSec <= 0 -> "--"
                                        etaSec >= 3600 -> String.format("%dh%02dm", etaSec / 3600, (etaSec % 3600) / 60)
                                        etaSec >= 60 -> String.format("%dm%02ds", etaSec / 60, etaSec % 60)
                                        else -> "${etaSec}s"
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(SurfaceStrong).border(1.dp, Violet.copy(0.15f), RoundedCornerShape(14.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Text("Téléchargement", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                            Text("$pct%", color = VioletSoft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                        }
                                        LinearProgressIndicator(progress = { pct / 100f }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Violet, trackColor = Color.White.copy(0.08f))
                                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text(speedStr, color = TextMuted, fontSize = 11.sp)
                                            Text("reste $etaStr", color = TextMuted, fontSize = 11.sp)
                                        }
                                        Text(qItem.media.title, color = TextFaint, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                                status == "downloading" || status == "searching" -> {
                                    Spacer(Modifier.height(8.dp))
                                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(SurfaceStrong).padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        CircularProgressIndicator(color = VioletSoft, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                        Column { Text("Recherche en cours…", color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold); Text("Le bouton passera à Lecture dès que prêt", color = TextFaint, fontSize = 11.sp) }
                                    }
                                }
                                status == "missing" -> {
                                    Spacer(Modifier.height(8.dp))
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                        var searchingManually by remember { mutableStateOf(false) }
                                        val scaleSearch by animateFloatAsState(if (searchingManually) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "searchMan")
                                        Button(
                                            onClick = {
                                                hapticPlay.performHapticFeedback(HapticFeedbackType.LongPress)
                                                searchingManually = true
                                                vm.triggerSearch(tmdbId, type)
                                                kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); searchingManually = false }
                                            },
                                            modifier = Modifier.weight(1f).height(44.dp).scale(scaleSearch),
                                            shape = RoundedCornerShape(12.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = Violet),
                                            enabled = !searchingManually
                                        ) {
                                            if (searchingManually) { CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp); Spacer(Modifier.width(8.dp)); Text("Recherche…", fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                                            else { Icon(Icons.Rounded.Search, null, tint = Color.White, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Rechercher", fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                                        }
                                        Text("Aucun fichier trouvé — relance une recherche", color = TextFaint, fontSize = 11.sp, lineHeight = 13.sp, modifier = Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
                // Saisons (séries)
                if (type == "series") {
                    val localSeriesId = vm.seriesLibraryId(tmdbId)
                    if (!inLibrary) {
                        item { Box(Modifier.padding(horizontal = 20.dp, vertical = 14.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Surface).padding(14.dp)) { Text("Ajoute la série pour voir ses saisons et épisodes.", color = TextMuted, fontSize = 12.sp, lineHeight = 16.sp) } }
                    } else if (seasons.isEmpty()) {
                        item { Box(Modifier.padding(horizontal = 20.dp, vertical = 14.dp).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Violet, modifier = Modifier.size(22.dp), strokeWidth = 2.dp) } }
                    } else {
                        item { Text("Saisons", Modifier.padding(horizontal = 20.dp, vertical = 12.dp), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold) }
                        items(seasons, key = { it.seasonNumber }) { season ->
                            var expanded by remember(season.seasonNumber) { mutableStateOf(season.seasonNumber == 1) }
                            LaunchedEffect(season.seasonNumber) { if (expanded) vm.loadSeasonMetadata(tmdbId, season.seasonNumber) }
                            Column(Modifier.padding(horizontal = 14.dp, vertical = 6.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Surface).border(1.dp, Color.White.copy(0.05f), RoundedCornerShape(14.dp))) {
                                Row(Modifier.fillMaxWidth().clickable { expanded = !expanded; if (expanded) vm.loadSeasonMetadata(tmdbId, season.seasonNumber) }.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(season.name.ifBlank { "Saison ${season.seasonNumber}" }, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                    Text("${season.episodes.size} épisodes", color = TextFaint, fontSize = 11.sp)
                                    Spacer(Modifier.width(8.dp)); Icon(if (expanded) Icons.Rounded.KeyboardArrowUp else Icons.Rounded.KeyboardArrowDown, null, tint = TextMuted, modifier = Modifier.size(20.dp))
                                }
                                if (expanded) {
                                    val meta = seasonMeta[vm.seasonMetadataKey(tmdbId, season.seasonNumber)]
                                    Column(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        season.episodes.forEach { ep ->
                                            val metaEp = meta?.episodes?.firstOrNull { it.episodeNumber == ep.episodeNumber }
                                            val epStatus = when (ep.status) { "available" -> "Dispo"; "missing" -> "Manquant"; "downloading" -> "Téléchargement"; "searching" -> "Recherche"; else -> ep.status }
                                            val epColor = when (ep.status) { "available" -> Cyan; "downloading","searching" -> VioletSoft; "missing" -> Color(0xFFFF6B8A); else -> TextFaint }
                                            val episodeTarget = episodePlaybackTarget(
                                                seriesId = localSeriesId,
                                                plexRatingKey = ep.plexRatingKey,
                                                playbackSource = ep.playbackSource,
                                                seasonNumber = ep.seasonNumber,
                                                episodeNumber = ep.episodeNumber,
                                            )
                                            val epBaseUrl = vm.getBaseUrl()
                                            val epContext = LocalContext.current
                                            val hapticEp = LocalHapticFeedback.current
                                            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(SurfaceStrong).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                                Box(Modifier.size(width = 72.dp, height = 42.dp).clip(RoundedCornerShape(8.dp)).background(Void)) {
                                                    val still = metaEp?.stillPath?.let { BACKDROP + it }
                                                    if (still != null) AsyncImage(still, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("○", color = TextFaint, fontSize = 12.sp) }
                                                }
                                                Spacer(Modifier.width(10.dp))
                                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                                    Text("${ep.episodeNumber}. ${if (metaEp?.title?.isNotBlank() == true) metaEp.title else ep.title}", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                    if (!metaEp?.overview.isNullOrBlank()) Text(metaEp!!.overview, color = TextMuted, fontSize = 11.sp, lineHeight = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                                        Box(Modifier.background(epColor.copy(0.14f), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp)) { Text(epStatus, color = epColor, fontSize = 10.sp, fontWeight = FontWeight.SemiBold) }
                                                        metaEp?.airDate?.let { Text(it, color = TextFaint, fontSize = 10.sp) }
                                                    }
                                                }
                                                if (ep.status == "available" && episodeTarget != null && epBaseUrl != null) {
                                                    Spacer(Modifier.width(8.dp))
                                                    // Hitbox 44dp (WCAG) — visuel 36dp reste identique
                                                    Box(Modifier.size(44.dp).clip(CircleShape).clickable {
                                                        hapticEp.performHapticFeedback(HapticFeedbackType.LongPress)
                                                        // Une série peut mixer des épisodes Plex et locaux. La
                                                        // source est choisie par épisode, jamais par série.
                                                        val avail = season.episodes.mapNotNull { available ->
                                                            episodePlaybackTarget(
                                                                seriesId = localSeriesId,
                                                                plexRatingKey = available.plexRatingKey,
                                                                playbackSource = available.playbackSource,
                                                                seasonNumber = available.seasonNumber,
                                                                episodeNumber = available.episodeNumber,
                                                            )?.takeIf { available.status == "available" }?.let { available to it }
                                                        }.sortedBy { it.first.episodeNumber }
                                                        val idx = avail.indexOfFirst { it.first.episodeNumber == ep.episodeNumber }.coerceAtLeast(0)
                                                        val queue = avail.map { (ae, target) ->
                                                            val aeMeta = seasonMeta[vm.seasonMetadataKey(tmdbId, season.seasonNumber)]?.episodes?.firstOrNull { it.episodeNumber == ae.episodeNumber }
                                                            com.movviz.mobile.player.PlayerQueueItem(
                                                                ratingKey = target.ratingKey,
                                                                label = "S${ae.seasonNumber}:E${ae.episodeNumber} · ${aeMeta?.title?.takeIf { it.isNotBlank() } ?: ae.title}",
                                                                seasonNumber = ae.seasonNumber,
                                                                episodeNumber = ae.episodeNumber,
                                                                localKey = target.localSeriesId,
                                                            )
                                                        }
                                                        val intent = com.movviz.mobile.player.PlayerActivity.forQueue(
                                                            epContext, epBaseUrl, "series", tmdbId, d.title,
                                                            queue, idx, posterPath = d.posterPath,
                                                        )
                                                        epContext.startActivity(intent)
                                                    }, contentAlignment = Alignment.Center) {
                                                        Box(Modifier.size(36.dp).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) {
                                                            Icon(Icons.Rounded.PlayArrow, null, tint = Void, modifier = Modifier.size(18.dp))
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    Spacer(Modifier.height(6.dp))
                                }
                            }
                        }
                    }
                }
                // Cast
                if (d.cast.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(top = 18.dp)) {
                            Text("Distribution", Modifier.padding(horizontal = 20.dp), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(d.cast.take(12), key = { it.id }) { c ->
                                    Column(Modifier.width(84.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                        Box(Modifier.size(64.dp).clip(CircleShape).background(SurfaceCard)) {
                                            val pp = c.profilePath?.let { POSTER + it }
                                            if (pp != null) AsyncImage(pp, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, null, tint = TextFaint, modifier = Modifier.size(28.dp)) }
                                        }
                                        Spacer(Modifier.height(6.dp)); Text(c.name, color = TextSoft, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(c.character, color = TextFaint, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                            }
                        }
                    }
                }
                // Similaires
                if (d.similar.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(top = 18.dp)) {
                            Text("Titres similaires", Modifier.padding(horizontal = 20.dp), color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(d.similar.take(12), key = { "${it.type}-${it.tmdbId}" }) { s ->
                                    Column(Modifier.width(110.dp).clickable { onOpenTitle(s.type, s.tmdbId) }) {
                                        Box(Modifier.fillMaxWidth().height(156.dp).clip(MovvizCardShape).background(SurfaceCard)) { if (s.posterPath != null) AsyncImage(POSTER + s.posterPath, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("○", color = TextFaint) } }
                                        Text(s.title, color = TextSoft, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                                    }
                                }
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
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
        val hapticProfile = LocalHapticFeedback.current
        TextButton({ hapticProfile.performHapticFeedback(HapticFeedbackType.LongPress); onDisconnect() }, Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(Color.White.copy(0.06f))) { Text("Se déconnecter", color = TextSoft, fontWeight = FontWeight.SemiBold) }
        Text("Movviz Mobile — même catalogue, même progression, pensé pour le pouce.", color = TextFaint, fontSize = 11.sp, lineHeight = 15.sp)
    }
}

@Composable private fun AiChatScreen(padding: PaddingValues, vm: MobileViewModel, onTitleClick: (String, Int) -> Unit) {
    var input by remember { mutableStateOf("") }
    val messages by vm.aiMessages.collectAsState()
    val sending by vm.aiSending.collectAsState()
    val enabled by vm.aiEnabled.collectAsState()
    val haptic = LocalHapticFeedback.current
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()
    LaunchedEffect(Unit) { vm.loadAiSession() }
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1) }
    Column(Modifier.fillMaxSize().background(Void).padding(padding)) {
        // Header hermétique — identique au desktop, mémoire par profil
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(Violet.copy(0.18f), Magenta.copy(0.12f)))).border(1.dp, Color.White.copy(0.06f), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Violet, Magenta))), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Star, null, tint = Color.White, modifier = Modifier.size(22.dp)) }
            Column(Modifier.weight(1f)) { Text("Movviz IA", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp); Text("Mémoire hermétique • par profil", color = TextMuted, fontSize = 11.sp) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (messages.isNotEmpty()) {
                    Box(Modifier.clip(RoundedCornerShape(8.dp)).background(Color.White.copy(0.08f)).clickable { haptic.performHapticFeedback(HapticFeedbackType.LongPress); vm.clearAiSession() }.padding(horizontal = 8.dp, vertical = 4.dp)) { Text("Effacer", color = TextSoft, fontSize = 10.sp, fontWeight = FontWeight.SemiBold) }
                }
                Box(Modifier.background(if (enabled == true) Cyan.copy(0.14f) else Color.White.copy(0.08f), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp)) { Text(if (enabled == true) "Actif" else if (enabled == false) "Désactivé" else "…", color = if (enabled == true) Cyan else TextFaint, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
            }
        }
        if (enabled == false) {
            Box(Modifier.weight(1f).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Rounded.Star, null, tint = TextFaint, modifier = Modifier.size(32.dp))
                    Text("IA désactivée sur ce serveur", color = TextMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Text("Active-la dans Réglages → Assistant IA (admin). La conversation est partagée avec le desktop.", color = TextFaint, fontSize = 11.sp, lineHeight = 15.sp)
                }
            }
        } else {
            LazyColumn(state = listState, modifier = Modifier.weight(1f).padding(horizontal = 16.dp), contentPadding = PaddingValues(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (messages.isEmpty() && !sending) {
                    item {
                        Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(Modifier.size(56.dp).clip(CircleShape).background(Surface), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Star, null, tint = VioletSoft, modifier = Modifier.size(28.dp)) }
                            Text("Salut ! Je connais tes goûts, ta bibliothèque et tes demandes.", color = TextSoft, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(horizontal = 16.dp))
                            Text("Demande-moi « qu’est-ce que j’ai en comédie ? » ou « recommande-moi un thriller » — chaque profil a sa propre mémoire. Identique au desktop.", color = TextFaint, fontSize = 11.sp, lineHeight = 15.sp, modifier = Modifier.padding(horizontal = 20.dp))
                        }
                    }
                }
                items(messages, key = { it.hashCode().toString() + it.content.take(20) }) { msg ->
                    val isUser = msg.role == "user"
                    val scale by animateFloatAsState(if (isUser) 1f else 0.98f, spring(dampingRatio = 0.6f, stiffness = 400f), label = "bubble")
                    Column(Modifier.fillMaxWidth().scale(scale), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
                            Box(
                                Modifier.widthIn(max = 280.dp).clip(RoundedCornerShape(18.dp, 18.dp, if (isUser) 4.dp else 18.dp, if (isUser) 18.dp else 4.dp))
                                    .background(if (isUser) Violet else Surface).padding(horizontal = 14.dp, vertical = 10.dp)
                            ) {
                                Text(msg.content, color = if (isUser) Color.White else TextPrimary, fontSize = 13.sp, lineHeight = 18.sp)
                            }
                        }
                        // Actions (add_media) — même rendu que desktop ChatWidget ActionList
                        msg.actions?.takeIf { it.isNotEmpty() }?.let { actions ->
                            actions.forEach { a ->
                                val statusColor = when (a.status) { "added", "requested" -> Cyan; "already" -> VioletSoft; "not_found" -> Color(0xFFFF6B8A); else -> TextFaint }
                                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(SurfaceStrong).border(1.dp, statusColor.copy(0.18f), RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(Modifier.size(8.dp).clip(CircleShape).background(statusColor))
                                    Column(Modifier.weight(1f)) { Text(a.title + (a.year?.let { " ($it)" } ?: ""), color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis); Text(a.status, color = TextMuted, fontSize = 11.sp) }
                                    val aid = a.tmdbId
                                    if (a.status == "already" && aid != null) {
                                        Box(Modifier.clip(RoundedCornerShape(8.dp)).background(Violet.copy(0.12f)).clickable { onTitleClick(a.type, aid) }.padding(horizontal = 8.dp, vertical = 4.dp)) { Text("Voir", color = VioletSoft, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                                    }
                                }
                            }
                        }
                        // Recommandations — cartes comme desktop
                        msg.recommendations?.takeIf { it.isNotEmpty() }?.let { recs ->
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(vertical = 4.dp)) {
                                items(recs, key = { "${it.type}-${it.tmdbId}" }) { r ->
                                    var pressedRec by remember { mutableStateOf(false) }
                                    val scaleRec by animateFloatAsState(if (pressedRec) 0.96f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "rec")
                                    Column(Modifier.width(120.dp).scale(scaleRec).clip(MovvizCardShape).background(SurfaceCard).border(1.dp, Color.White.copy(0.05f), MovvizCardShape).clickable { pressedRec = true; onTitleClick(r.type, r.tmdbId); kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch { kotlinx.coroutines.delay(140); pressedRec = false } }) {
                                        Box(Modifier.fillMaxWidth().height(160.dp).background(Surface)) {
                                            if (r.posterPath != null) AsyncImage(POSTER + r.posterPath, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("○", color = TextFaint) }
                                            if (r.inLibrary) Box(Modifier.align(Alignment.TopEnd).padding(6.dp).background(Cyan.copy(0.9f), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp)) { Text("Déjà", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                                        }
                                        Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                            Text(r.title, color = TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            run { val rsn = r.reason; if (!rsn.isNullOrBlank()) Text(rsn, color = TextFaint, fontSize = 10.sp, lineHeight = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis) }
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                if (r.rating > 0) Text("★ ${"%.1f".format(r.rating)}", color = Color(0xFFFFBF3F), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                                r.year?.let { Text(it.toString(), color = TextFaint, fontSize = 10.sp) }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (sending) item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) { Box(Modifier.clip(RoundedCornerShape(18.dp)).background(Surface).padding(horizontal = 14.dp, vertical = 10.dp)) { Text("…", color = TextMuted, fontSize = 13.sp) } } }
            }
        }
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 14.dp, vertical = 10.dp).clip(RoundedCornerShape(16.dp)).background(Surface).border(1.dp, Color.White.copy(0.07f), RoundedCornerShape(16.dp)).padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = input, onValueChange = { input = it }, modifier = Modifier.weight(1f), singleLine = false, maxLines = 4,
                placeholder = { Text("Parle à ton IA…", color = TextFaint, fontSize = 13.sp) },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent, focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, cursorColor = Violet),
            )
            val sendEnabled = input.trim().isNotEmpty() && !sending && enabled != false
            val sendScale by animateFloatAsState(if (sendEnabled) 1f else 0.9f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "send")
            Box(
                Modifier.size(44.dp).scale(sendScale).clip(CircleShape).background(if (sendEnabled) Violet else SurfaceStrong).clickable {
                    if (!sendEnabled) return@clickable
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    val q = input.trim(); input = ""
                    vm.sendAiMessage(q)
                }, contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Rounded.Send, null, tint = if (sendEnabled) Color.White else TextFaint, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable private fun Placeholder(padding: PaddingValues, title: String, subtitle: String, onDisconnect: (() -> Unit)? = null) {
    Column(Modifier.fillMaxSize().background(Void).padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Text(subtitle, color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
        onDisconnect?.let { TextButton(it, Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White.copy(0.06f))) { Text("Changer de serveur", color = VioletSoft, fontWeight = FontWeight.SemiBold, fontSize = 13.sp) } }
    }
}

private fun <T> List<T>.replaceOrAppend(item: T, key: (T) -> Int): List<T> {
    val index = indexOfFirst { key(it) == key(item) }
    return if (index < 0) this + item else toMutableList().also { it[index] = item }
}
