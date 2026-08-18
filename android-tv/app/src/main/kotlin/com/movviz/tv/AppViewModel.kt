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
import com.movviz.tv.data.OnDeckEntryDto
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.data.ServerPrefs
import com.movviz.tv.data.SeriesSeasonDto
import kotlinx.coroutines.async
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

    // File de téléchargement en cours (moteur BitTorrent intégré) — le cœur
    // de Movviz n'est pas que la lecture mais aussi le téléchargement, donc
    // l'accueil TV affiche cette file au même titre que les rangées Films
    // /Séries plutôt que de la reléguer à un écran caché.
    private val _queue = MutableStateFlow<List<QueueItemDto>>(emptyList())
    val queue: StateFlow<List<QueueItemDto>> = _queue.asStateFlow()

    // Découverte — titres TMDb tendance pas encore ajoutés à la bibliothèque,
    // pour la rangée "Découverte" de l'accueil. Chargés séparément
    // films/séries puis filtrés contre movies/series une fois affichés (voir
    // HomeScreen), pour rester à jour dès qu'un ajout réussit sans refaire
    // d'appel réseau.
    private val _trendingMovies = MutableStateFlow<List<SearchResultDto>>(emptyList())
    val trendingMovies: StateFlow<List<SearchResultDto>> = _trendingMovies.asStateFlow()

    private val _trendingSeries = MutableStateFlow<List<SearchResultDto>>(emptyList())
    val trendingSeries: StateFlow<List<SearchResultDto>> = _trendingSeries.asStateFlow()

    // Rangée "Continuer à regarder" de l'accueil — ordre Netflix (Continuer
    // → Bibliothèque → Découverte). Réutilise le même /api/plex/on-deck que
    // resumeOffsetMs, mais garde la liste entière plutôt qu'une seule entrée.
    private val _continueWatching = MutableStateFlow<List<OnDeckEntryDto>>(emptyList())
    val continueWatching: StateFlow<List<OnDeckEntryDto>> = _continueWatching.asStateFlow()

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
        // plexRatingKey vit à la racine de LibraryMovieDto, pas dans .file
        // (voir le commentaire sur LibraryMovieDto dans ApiModels.kt — bug
        // corrigé, c'était .file?.plexRatingKey et retournait toujours null).
        if (type == "movie") _movies.value.firstOrNull { it.tmdbId == tmdbId }?.plexRatingKey
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
            // Les deux appels sont indépendants — les lancer en parallèle
            // (async/await) plutôt qu'en séquence coupe en deux le temps
            // avant que l'accueil affiche quoi que ce soit, notable sur un
            // NAS/serveur distant où chaque aller-retour coûte cher.
            val moviesDeferred = async { repo.movies() }
            val seriesDeferred = async { repo.series() }
            when (val m = moviesDeferred.await()) {
                is ApiResult.Success -> _movies.value = m.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit // best-effort — l'écran affiche une liste vide plutôt que de planter
            }
            when (val s = seriesDeferred.await()) {
                is ApiResult.Success -> _series.value = s.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
        }
    }

    /** Rafraîchit la file de téléchargement — appelée en boucle par
     *  HomeScreen (voir polling côté QueueTab desktop) tant que l'accueil
     *  est affiché. Best-effort : un échec ponctuel laisse la dernière
     *  liste connue plutôt que de la vider. */
    fun loadQueue() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val q = repo.queue()) {
                // Comme DownloadQueue.tsx côté desktop : "completed"/"seeding"
                // ne sont plus des téléchargements EN COURS, ce sont des
                // torrents finis qui traînent encore côté moteur en attendant
                // leur tour de nettoyage/partage — ils rejoignent l'historique,
                // pas cette rangée. Sans ce filtre, la rangée affiche des
                // dizaines d'entrées déjà terminées (confirmé en direct sur
                // la vraie file de prod) au lieu des seuls téléchargements
                // réellement actifs.
                is ApiResult.Success -> _queue.value = q.data.filter {
                    it.status != "completed" && it.status != "seeding"
                }
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
        }
    }

    /** Rangée "Continuer à regarder" — chargée une fois par entrée sur
     *  l'accueil, comme la bibliothèque (pas de polling seconde par
     *  seconde, contrairement à la file de téléchargement). */
    fun loadContinueWatching() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val r = repo.onDeckItems()) {
                is ApiResult.Success -> _continueWatching.value = r.data
                else -> Unit
            }
        }
    }

    /** Statut brut du film (voir LibraryStatus côté serveur : upcoming/
     *  missing/searching/downloading/available) — pour afficher un état réel
     *  sur la fiche titre plutôt que le texte générique "En attente de
     *  synchronisation" affiché jusqu'ici pour toute variante autre que
     *  "fichier prêt" ou "pas encore ajouté". */
    fun libraryMovieStatus(tmdbId: Int): String? =
        _movies.value.firstOrNull { it.tmdbId == tmdbId }?.status

    /** Charge les tendances TMDb film + série pour la rangée Découverte —
     *  une seule fois par entrée sur l'accueil (pas de polling, contrairement
     *  à la file : le contenu tendance ne change pas seconde par seconde). */
    fun loadDiscovery() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val m = repo.trending("movie")) {
                is ApiResult.Success -> _trendingMovies.value = m.data
                else -> Unit
            }
            when (val s = repo.trending("series")) {
                is ApiResult.Success -> _trendingSeries.value = s.data
                else -> Unit
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
