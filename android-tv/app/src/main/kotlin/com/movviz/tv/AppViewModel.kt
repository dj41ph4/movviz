package com.movviz.tv

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.LibraryMovieDto
import com.movviz.tv.data.LibrarySeriesDto
import com.movviz.tv.data.MetaDetailDto
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.MovvizUserDto
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.data.ServerPrefs
import com.movviz.tv.data.SeriesSeasonDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * État applicatif partagé entre les écrans (URL serveur, utilisateur
 * connecté, bibliothèque) — activity-scoped plutôt que porté par les
 * arguments de navigation, pour éviter d'encoder une URL complète
 * ("http://192.168.1.x:9810") dans une route Compose Navigation.
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = ServerPrefs(application)

    private val _serverUrl = MutableStateFlow<String?>(null)
    val serverUrl: StateFlow<String?> = _serverUrl.asStateFlow()

    private val _currentUser = MutableStateFlow<MovvizUserDto?>(null)
    val currentUser: StateFlow<MovvizUserDto?> = _currentUser.asStateFlow()

    private val _movies = MutableStateFlow<List<LibraryMovieDto>>(emptyList())
    val movies: StateFlow<List<LibraryMovieDto>> = _movies.asStateFlow()

    private val _series = MutableStateFlow<List<LibrarySeriesDto>>(emptyList())
    val series: StateFlow<List<LibrarySeriesDto>> = _series.asStateFlow()

    private val _detail = MutableStateFlow<MetaDetailDto?>(null)
    val detail: StateFlow<MetaDetailDto?> = _detail.asStateFlow()

    private val _addingToLibrary = MutableStateFlow(false)
    val addingToLibrary: StateFlow<Boolean> = _addingToLibrary.asStateFlow()

    private val _seriesSeasons = MutableStateFlow<List<SeriesSeasonDto>>(emptyList())
    val seriesSeasons: StateFlow<List<SeriesSeasonDto>> = _seriesSeasons.asStateFlow()

    private val _searchResults = MutableStateFlow<List<SearchResultDto>>(emptyList())
    val searchResults: StateFlow<List<SearchResultDto>> = _searchResults.asStateFlow()

    private val _searching = MutableStateFlow(false)
    val searching: StateFlow<Boolean> = _searching.asStateFlow()

    // Signal générique "la session a expiré/est invalide" — un 401 en cours
    // d'usage (pas au lancement) ne doit jamais se traduire par un écran
    // qui a l'air normal mais vide ("aucun résultat" alors que le vrai
    // problème est qu'on n'est plus authentifié, confirmé en live sur la
    // recherche). MainActivity observe ce flag pour renvoyer au login.
    private val _sessionExpired = MutableStateFlow(false)
    val sessionExpired: StateFlow<Boolean> = _sessionExpired.asStateFlow()

    fun consumeSessionExpired() {
        _sessionExpired.value = false
    }

    private val repository: MovvizRepository?
        get() = _serverUrl.value?.let { MovvizRepository(it) }

    /** Fiche déjà en bibliothèque pour ce titre — même logique que
     *  TitleContent côté web (croiser tmdbId+type avec les listes déjà
     *  chargées) plutôt qu'un appel réseau dédié. */
    fun libraryPlexRatingKey(type: String, tmdbId: Int): String? =
        if (type == "movie") _movies.value.firstOrNull { it.tmdbId == tmdbId }?.file?.plexRatingKey
        else null // les séries n'ont pas de fichier unique — lecture épisode par épisode, pas encore géré côté TV

    fun isInLibrary(type: String, tmdbId: Int): Boolean =
        if (type == "movie") _movies.value.any { it.tmdbId == tmdbId }
        else _series.value.any { it.tmdbId == tmdbId }

    fun seriesLibraryId(tmdbId: Int): String? =
        _series.value.firstOrNull { it.tmdbId == tmdbId }?.id

    fun loadSeriesSeasons(tmdbId: Int) {
        val repo = repository ?: return
        val seriesId = seriesLibraryId(tmdbId) ?: return
        _seriesSeasons.value = emptyList()
        viewModelScope.launch {
            when (val s = repo.seriesSeasons(seriesId)) {
                is ApiResult.Success -> _seriesSeasons.value = s.data
                else -> Unit
            }
        }
    }

    fun loadDetail(type: String, tmdbId: Int) {
        val repo = repository ?: return
        _detail.value = null
        viewModelScope.launch {
            when (val d = repo.detail(type, tmdbId)) {
                is ApiResult.Success -> _detail.value = d.data
                else -> Unit
            }
        }
    }

    suspend fun addCurrentToLibrary(type: String, tmdbId: Int): ApiResult<Unit> {
        val repo = repository ?: return ApiResult.Failure("Aucun serveur configuré")
        _addingToLibrary.value = true
        try {
            val result = repo.addToLibrary(type, tmdbId)
            if (result is ApiResult.Success) loadLibrary()
            return result
        } finally {
            _addingToLibrary.value = false
        }
    }

    init {
        viewModelScope.launch {
            _serverUrl.value = prefs.serverUrl.first()
        }
    }

    /**
     * Lecture directe (bloquante côté coroutine) de l'URL persistée, à
     * utiliser pour la décision d'écran de départ. `serverUrl.first()` sur
     * un StateFlow renvoie la valeur COURANTE sans attendre — si on
     * l'appelle avant que le init{} ci-dessus ait fini de lire le
     * DataStore, on récupère `null` alors qu'une URL valide existe bel et
     * bien, et l'utilisateur retombe sur le wizard alors qu'il est déjà
     * configuré (bug confirmé : reproductible après un force-stop, la
     * connexion venait pourtant de réussir). Cette fonction lit le
     * DataStore lui-même, sans dépendre du timing du init{}.
     */
    suspend fun loadPersistedServerUrl(): String? {
        val url = prefs.serverUrl.first()
        _serverUrl.value = url
        return url
    }

    /** Étape 1 du wizard — teste la connexion AVANT de sauvegarder l'URL,
     *  pour ne jamais coincer l'utilisateur sur une IP fausse au prochain
     *  lancement. */
    suspend fun testAndSaveServerUrl(url: String): ApiResult<Unit> {
        val result = MovvizRepository(url).ping()
        if (result is ApiResult.Success) {
            prefs.setServerUrl(url)
            _serverUrl.value = url.trim().trimEnd('/')
        }
        return result
    }

    suspend fun login(username: String, password: String): ApiResult<MovvizUserDto> {
        val repo = repository ?: return ApiResult.Failure("Aucun serveur configuré")
        val result = repo.login(username, password)
        if (result is ApiResult.Success) _currentUser.value = result.data
        return result
    }

    fun loadLibrary() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val m = repo.movies()) {
                is ApiResult.Success -> _movies.value = m.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit // best-effort — l'écran affiche une liste vide plutôt que de planter
            }
            when (val s = repo.series()) {
                is ApiResult.Success -> _series.value = s.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun streamUrl(plexRatingKey: String): String? =
        repository?.streamUrl(plexRatingKey)

    /** Recherche déclenchée explicitement (validation clavier), pas en
     *  live-typing — le clavier virtuel Android TV rend la saisie lente et
     *  saccadée, une requête par caractère serait à la fois inutile et
     *  visuellement agaçante (résultats qui sautent en permanence). */
    fun search(query: String) {
        val repo = repository
        if (repo == null || query.isBlank()) {
            _searchResults.value = emptyList()
            return
        }
        _searching.value = true
        viewModelScope.launch {
            when (val r = repo.search(query.trim())) {
                is ApiResult.Success -> _searchResults.value = r.data
                ApiResult.Unauthorized -> {
                    _searchResults.value = emptyList()
                    _sessionExpired.value = true
                }
                is ApiResult.Failure -> _searchResults.value = emptyList()
            }
            _searching.value = false
        }
    }

    /** Utilisé une seule fois au lancement (voir MainActivity) pour décider
     *  si l'écran de login peut être sauté — le cookie persistant peut être
     *  encore valide d'une session précédente. */
    suspend fun hasValidSession(): Boolean = repository?.hasValidSession() ?: false

    fun logout() {
        com.movviz.tv.data.ApiClient.clearSession()
        _currentUser.value = null
    }
}
