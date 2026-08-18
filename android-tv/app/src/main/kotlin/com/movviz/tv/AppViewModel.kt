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
                else -> Unit // best-effort — l'écran affiche une liste vide plutôt que de planter
            }
            when (val s = repo.series()) {
                is ApiResult.Success -> _series.value = s.data
                else -> Unit
            }
        }
    }

    fun streamUrl(plexRatingKey: String): String? =
        repository?.streamUrl(plexRatingKey)

    /** Utilisé une seule fois au lancement (voir MainActivity) pour décider
     *  si l'écran de login peut être sauté — le cookie persistant peut être
     *  encore valide d'une session précédente. */
    suspend fun hasValidSession(): Boolean = repository?.hasValidSession() ?: false

    fun logout() {
        com.movviz.tv.data.ApiClient.clearSession()
        _currentUser.value = null
    }
}
