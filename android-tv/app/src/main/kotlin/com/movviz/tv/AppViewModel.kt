package com.movviz.tv

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.ApiClient
import com.movviz.tv.data.LibraryMovieDto
import com.movviz.tv.data.LibrarySeriesDto
import com.movviz.tv.data.DashboardHeroSlideDto
import com.movviz.tv.data.MetaDetailDto
import com.movviz.tv.data.MetadataSeasonDto
import com.movviz.tv.data.MetadataRowDto
import com.movviz.tv.data.MovvizRepository
import com.movviz.tv.data.MovvizUserDto
import com.movviz.tv.data.OnDeckEntryDto
import com.movviz.tv.data.PersonDto
import com.movviz.tv.data.PlexPinDto
import com.movviz.tv.data.PlexPollDto
import com.movviz.tv.data.QueueItemDto
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.data.ServerPrefs
import com.movviz.tv.data.ProfilePrefs
import com.movviz.tv.data.TvProfile
import com.movviz.tv.data.SeriesSeasonDto
import com.movviz.tv.data.UserPrefsDto
import com.movviz.tv.data.WatchStatusDto
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
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
    private val profilePrefs = ProfilePrefs(application)

    private val _serverUrl = MutableStateFlow<String?>(null)
    val serverUrl: StateFlow<String?> = _serverUrl.asStateFlow()

    val autoUpdateEnabled: StateFlow<Boolean> = prefs.autoUpdateEnabled.stateIn(
        viewModelScope, SharingStarted.Eagerly, true
    )

    fun setAutoUpdateEnabled(enabled: Boolean) {
        viewModelScope.launch { prefs.setAutoUpdateEnabled(enabled) }
    }

    private val _currentUser = MutableStateFlow<MovvizUserDto?>(null)
    val currentUser: StateFlow<MovvizUserDto?> = _currentUser.asStateFlow()

    private val _profiles = MutableStateFlow<List<TvProfile>>(emptyList())
    val profiles: StateFlow<List<TvProfile>> = _profiles.asStateFlow()

private val _activeProfile = MutableStateFlow<TvProfile?>(null)
    val activeProfile: StateFlow<TvProfile?> = _activeProfile.asStateFlow()

    // Message d'info affiché sur l'écran profil (« Qui est-ce ? ») après un
    // ajout via le login — « compte déjà présent » ou « ajouté au foyer ».
    private val _foyerNotice = MutableStateFlow<String?>(null)
    val foyerNotice: StateFlow<String?> = _foyerNotice.asStateFlow()

    fun setFoyerNotice(message: String?) {
        _foyerNotice.value = message
    }

    fun consumeFoyerNotice() {
        _foyerNotice.value = null
    }

    private val _movies = MutableStateFlow<List<LibraryMovieDto>>(emptyList())
    val movies: StateFlow<List<LibraryMovieDto>> = _movies.asStateFlow()

    private val _series = MutableStateFlow<List<LibrarySeriesDto>>(emptyList())
    val series: StateFlow<List<LibrarySeriesDto>> = _series.asStateFlow()

    private val _dashboardHero = MutableStateFlow<List<DashboardHeroSlideDto>>(emptyList())
    val dashboardHero: StateFlow<List<DashboardHeroSlideDto>> = _dashboardHero.asStateFlow()

    private val _heroLogos = MutableStateFlow<Map<String, String>>(emptyMap())
    val heroLogos: StateFlow<Map<String, String>> = _heroLogos.asStateFlow()

    private val _detail = MutableStateFlow<MetaDetailDto?>(null)
    val detail: StateFlow<MetaDetailDto?> = _detail.asStateFlow()

    private val _person = MutableStateFlow<PersonDto?>(null)
    val person: StateFlow<PersonDto?> = _person.asStateFlow()

    private val _addingToLibrary = MutableStateFlow(false)
    val addingToLibrary: StateFlow<Boolean> = _addingToLibrary.asStateFlow()

    private val _seriesSeasons = MutableStateFlow<List<SeriesSeasonDto>>(emptyList())
    val seriesSeasons: StateFlow<List<SeriesSeasonDto>> = _seriesSeasons.asStateFlow()

    private val _seasonMetadata = MutableStateFlow<Map<String, MetadataSeasonDto>>(emptyMap())
    val seasonMetadata: StateFlow<Map<String, MetadataSeasonDto>> = _seasonMetadata.asStateFlow()

    private val _searchingSeason = MutableStateFlow<Int?>(null)
    val searchingSeason: StateFlow<Int?> = _searchingSeason.asStateFlow()

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

    private val _movieRows = MutableStateFlow<List<MetadataRowDto>>(emptyList())
    val movieRows: StateFlow<List<MetadataRowDto>> = _movieRows.asStateFlow()

    private val _seriesRows = MutableStateFlow<List<MetadataRowDto>>(emptyList())
    val seriesRows: StateFlow<List<MetadataRowDto>> = _seriesRows.asStateFlow()

    // Genres TMDb réels pour le sélecteur Genres du Discover TV (voir
    // CatalogScreen) — même route que le dropdown Genres desktop. Les deux
    // synthétiques (Anime/Romance ado) sont ajoutés côté écran, jamais ici.
    private val _movieGenres = MutableStateFlow<List<com.movviz.tv.data.GenreDto>>(emptyList())
    val movieGenres: StateFlow<List<com.movviz.tv.data.GenreDto>> = _movieGenres.asStateFlow()

    private val _seriesGenres = MutableStateFlow<List<com.movviz.tv.data.GenreDto>>(emptyList())
    val seriesGenres: StateFlow<List<com.movviz.tv.data.GenreDto>> = _seriesGenres.asStateFlow()

    fun loadGenres(type: String) {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val r = repo.genres(type)) {
                is ApiResult.Success -> if (type == "series") _seriesGenres.value = r.data else _movieGenres.value = r.data
                else -> Unit
            }
        }
    }

    // Rangée "Continuer à regarder" de l'accueil — ordre Netflix (Continuer
    // → Bibliothèque → Découverte). Réutilise le même /api/plex/on-deck que
    // resumeOffsetMs, mais garde la liste entière plutôt qu'une seule entrée.
    private val _continueWatching = MutableStateFlow<List<OnDeckEntryDto>>(emptyList())
    val continueWatching: StateFlow<List<OnDeckEntryDto>> = _continueWatching.asStateFlow()

    // Statut "vu" manuel par utilisateur (distinct de LibraryStatus, qui dit
    // si le FICHIER existe, pas si on l'a regardé) — voir WatchStatusDto.
    // Chargé une fois par entrée sur la fiche titre, comme le reste des
    // données de fiche.
    private val _watchStatus = MutableStateFlow<WatchStatusDto?>(null)
    val watchStatus: StateFlow<WatchStatusDto?> = _watchStatus.asStateFlow()

    // Signal générique "la session a expiré/est invalide" — un 401 en cours
    // d'usage (pas au lancement) ne doit jamais se traduire par un écran
    // qui a l'air normal mais vide ("aucun résultat" alors que le vrai
    // problème est qu'on n'est plus authentifié, confirmé en live sur la
    // recherche). MainActivity observe ce flag pour renvoyer au login.
    private val _sessionExpired = MutableStateFlow(false)
    val sessionExpired: StateFlow<Boolean> = _sessionExpired.asStateFlow()

    // Déclenchement manuel d'une vérification de mise à jour (écran
    // Paramètres → À propos) — l'auto-update ne se vérifie sinon qu'une
    // seule fois au lancement, aucun moyen de relancer/diagnostiquer sans
    // redémarrer l'appli. AutoUpdateOverlay observe ce compteur ; toute
    // incrémentation relance un check. updateCheckStatus reflète le
    // résultat côté écran Paramètres (à jour / vérification / erreur).
    private val _updateCheckTrigger = MutableStateFlow(0)
    val updateCheckTrigger: StateFlow<Int> = _updateCheckTrigger.asStateFlow()
    private val _updateCheckStatus = MutableStateFlow<String?>(null)
    val updateCheckStatus: StateFlow<String?> = _updateCheckStatus.asStateFlow()

    fun requestUpdateCheck() {
        _updateCheckTrigger.value += 1
    }

    fun setUpdateCheckStatus(message: String?) {
        _updateCheckStatus.value = message
    }

    // Préférences de compte persistées côté serveur (voir UserPrefsDto) —
    // écran Paramètres, section Lecture. null = pas encore chargées.
    private val _userPrefs = MutableStateFlow<UserPrefsDto?>(null)
    val userPrefs: StateFlow<UserPrefsDto?> = _userPrefs.asStateFlow()

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

    /** Série dont les saisons sont affichées — permet de ne vider la liste
     * que lors d'un CHANGEMENT de série, jamais pendant un simple
     * rafraîchissement (sinon l'écran clignote et le choix de saison est
     * réinitialisé toutes les 3 secondes). */
    private var seasonsTmdbId: Int? = null

    fun loadSeriesSeasons(tmdbId: Int) {
        val repo = repository ?: return
        val seriesId = seriesLibraryId(tmdbId) ?: return
        if (seasonsTmdbId != tmdbId) {
            seasonsTmdbId = tmdbId
            _seriesSeasons.value = emptyList()
        }
        viewModelScope.launch {
            when (val s = repo.seriesSeasons(seriesId)) {
                // Garde anti-course : ouvrir A puis B vite fait renvoyer les
                // deux réponses dans n'importe quel ordre — sans ce test,
                // les saisons de A venaient écraser celles de B à l'écran
                // (« la saison n'est pas celle de la série choisie »,
                // constaté en direct).
                is ApiResult.Success -> if (seasonsTmdbId == tmdbId) _seriesSeasons.value = s.data
                else -> Unit
            }
        }
    }

    /** Visuels et synopsis TMDb d'UNE saison ouverte. Le statut de chaque
     *  épisode reste celui de la bibliothèque/Plex chargé ci-dessus.
     *  Clé "tmdbId-saison" (PAS la saison seule) : deux séries ont toutes
     *  les deux une saison 1 — l'ancien cache clé par numéro servait les
     *  épisodes de la première série ouverte à la seconde. */
    fun seasonMetadataKey(tmdbId: Int, seasonNumber: Int): String = "${tmdbId}-${seasonNumber}"

    fun loadSeasonMetadata(tmdbId: Int, seasonNumber: Int) {
        val key = seasonMetadataKey(tmdbId, seasonNumber)
        if (_seasonMetadata.value.containsKey(key)) return
        val repo = repository ?: return
        viewModelScope.launch {
            when (val result = repo.metadataSeason(tmdbId, seasonNumber)) {
                is ApiResult.Success -> _seasonMetadata.value = _seasonMetadata.value + (key to result.data)
                else -> Unit
            }
        }
    }

    /** Déclenche la même recherche de saison que le bouton desktop, mais ne
     * bloque pas la TV : le serveur répond immédiatement après mise en file. */
    fun downloadSeason(tmdbId: Int, seasonNumber: Int) {
        val repo = repository ?: return
        val seriesId = seriesLibraryId(tmdbId) ?: return
        if (_searchingSeason.value != null) return
        _searchingSeason.value = seasonNumber
        viewModelScope.launch {
            when (repo.searchSeriesSeasonNow(seriesId, seasonNumber)) {
                is ApiResult.Success -> loadSeriesSeasons(tmdbId)
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
            _searchingSeason.value = null
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

    fun loadPerson(id: Int) {
        val repo = repository ?: return
        _person.value = null
        viewModelScope.launch {
            when (val p = repo.person(id)) {
                is ApiResult.Success -> _person.value = p.data
                else -> Unit
            }
        }
    }

    suspend fun addCurrentToLibrary(type: String, tmdbId: Int): ApiResult<Unit> {
        val repo = repository ?: return ApiResult.Failure("Aucun serveur configuré")
        _addingToLibrary.value = true
        try {
            val result = repo.addToLibrary(type, tmdbId)
            // Handle 401 explicitly -- do not silently swallow it as Success.
            if (result is ApiResult.Unauthorized) {
                _sessionExpired.value = true
                return result
            }
            // Le parcours serveur crée d'abord l'entrée Movviz puis lance la
            // recherche automatique. Une erreur d'indexeur peut donc faire
            // remonter un 500 APRES création. Le web se réconcilie aussitôt
            // avec /api/library; la TV doit faire exactement la même chose,
            // sans faire croire que l'ajout a échoué ni proposer un doublon.
            refreshLibraryNow()
            var attempt = 0
            while (attempt < 2 && !isInLibrary(type, tmdbId)) {
                delay(500)
                refreshLibraryNow()
                attempt++
            }
            // Safety net: if the POST succeeded but the library refresh hasn't
            // caught up yet (server propagation delay), insert an optimistic
            // placeholder so isInLibrary() returns true and the button doesn't
            // revert. The polling LaunchedEffect (refreshTitleLibraryEntry)
            // will replace it with real data within seconds.
            if (!isInLibrary(type, tmdbId)) {
                addOptimisticEntry(type, tmdbId)
            }
            return if (result is ApiResult.Failure && !isInLibrary(type, tmdbId)) result else ApiResult.Success(Unit)
        } finally {
            _addingToLibrary.value = false
        }
    }

    /** Insert a minimal placeholder into _movies/_series so that isInLibrary()
     *  returns true immediately after a successful POST, preventing the button
     *  from reverting while the server propagates the new entry. The polling
     *  LaunchedEffect will replace it with real data via refreshTitleLibraryEntry(). */
    private fun addOptimisticEntry(type: String, tmdbId: Int) {
        val d = _detail.value
        if (type == "movie") {
            _movies.value = _movies.value.filter { it.tmdbId != tmdbId } + LibraryMovieDto(
                id = "optimistic-$tmdbId",
                tmdbId = tmdbId,
                title = d?.title ?: "",
                year = d?.year,
                overview = d?.overview ?: "",
                posterPath = d?.posterPath,
                backdropPath = d?.backdropPath,
                rating = d?.rating ?: 0.0,
                genres = d?.genres ?: emptyList(),
                status = "searching",
                file = null,
                plexRatingKey = null,
            )
        } else {
            _series.value = _series.value.filter { it.tmdbId != tmdbId } + LibrarySeriesDto(
                id = "optimistic-$tmdbId",
                tmdbId = tmdbId,
                title = d?.title ?: "",
                year = d?.year,
                overview = d?.overview ?: "",
                posterPath = d?.posterPath,
                backdropPath = d?.backdropPath,
                rating = d?.rating ?: 0.0,
                genres = d?.genres ?: emptyList(),
            )
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
        // Pas de picker local : sur un nouvel appareil l'écran de départ est
        // le login, jamais la liste des profils — ceux-ci ne reviennent
        // qu'après un login admin (voir loadProfilesFromServer).
        _profiles.value = emptyList()
        _activeProfile.value = null
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
            _profiles.value = emptyList()
            _activeProfile.value = null
        }
        return result
    }

suspend fun login(username: String, password: String): ApiResult<MovvizUserDto> {
        val repo = repository ?: return ApiResult.Failure("Aucun serveur configuré")
        val result = repo.login(username, password)
        if (result is ApiResult.Success) {
            _currentUser.value = result.data
            saveCurrentProfile(result.data)
            // L'admin retrouve les profils du foyer encrés côté serveur.
            if (result.data.role == "admin") loadProfilesFromServer()
        }
        return result
    }

    /** Identité du compte actuellement connecté (session cookie locale),
     *  sans en passer par le ViewModel — décision d'écran de départ. */
    suspend fun refreshCurrentUser(): MovvizUserDto? {
        val url = _serverUrl.value ?: return null
        val result = MovvizRepository(url).me()
        val user = (result as? ApiResult.Success)?.data
        _currentUser.value = user
        // Le profil actif doit toujours être visible (nom dans le menu de la
        // pastille, tuile en tête de l'écran profil) — même quand l'app
        // redémarre sur une session persistée sans passer par un login.
        if (user != null && _activeProfile.value == null) {
            _activeProfile.value = TvProfile(
                id = user.id,
                serverUrl = url,
                name = user.username,
                avatar = user.plexAvatar,
                cookieSnapshot = ApiClient.sessionSnapshot(url),
            )
        }
        return user
    }

    suspend fun forgetServer() {
        val url = _serverUrl.value
        prefs.clearServerUrl()
        com.movviz.tv.data.ApiClient.clearSession()
        _serverUrl.value = null
        _profiles.value = emptyList()
        _activeProfile.value = null
        if (url != null) profilePrefs.clearServer(url)
    }

    suspend fun createPlexPin(): ApiResult<PlexPinDto> =
        repository?.createPlexPin() ?: ApiResult.Failure("Aucun serveur configuré")

    suspend fun pollPlexPin(id: Long): ApiResult<PlexPollDto> {
        val result = repository?.pollPlexPin(id) ?: return ApiResult.Failure("Aucun serveur configuré")
        if (result is ApiResult.Success && result.data.done && result.data.user != null) {
            _currentUser.value = result.data.user
            saveCurrentProfile(result.data.user)
            if (result.data.user.role == "admin") loadProfilesFromServer()
        }
        return result
    }

    /** Profils du foyer depuis le serveur (GET admin-only) — un compte invité
     *  reçoit un 403 et n'obtient donc qu'une liste vide. Les sessions
     *  locales (si cet appareil a déjà servi) sont fusionnées pour permettre
     *  le changement de profil sans mot de passe. */
    suspend fun loadProfilesFromServer(): List<TvProfile> {
        val url = _serverUrl.value ?: return emptyList()
        val repo = MovvizRepository(url)
        var result = repo.tvProfiles()
        // Foyer vide + admin : le compte qui a fait la liaison initiale ne se
        // voyait jamais lui-même dans "Qui est-ce ?" tant qu'il ne s'ajoutait
        // pas manuellement à son propre foyer — contre-intuitif (signalé en
        // direct : "j'ai pas d'utilisateur d'inscrit"). Comme Netflix/Plex où
        // le compte propriétaire est toujours le premier profil, on l'y
        // ajoute nous-mêmes une fois, silencieusement, via la même route que
        // la tuile "+". Un compte invité n'a de toute façon pas accès à cette
        // route (admin-only côté serveur), donc jamais déclenché pour lui.
        val me = _currentUser.value
        if (result is ApiResult.Success && result.data.isEmpty() && me?.role == "admin") {
            repo.addTvProfile(me.id)
            result = repo.tvProfiles()
        }
        val profiles = if (result is ApiResult.Success) {
            result.data.map { dto ->
                TvProfile(
                    id = dto.id,
                    serverUrl = url,
                    name = dto.name,
                    avatar = dto.avatar,
                    cookieSnapshot = profilePrefs.getSession(url, dto.id),
                )
            }
        } else emptyList()
        _profiles.value = profiles
        _activeProfile.value = profiles.firstOrNull { it.id == _currentUser.value?.id }
        return profiles
    }

    /** Active un profil déjà authentifié sans redemander ses identifiants —
     *  uniquement si cet appareil détient déjà une session locale pour lui. */
    suspend fun selectProfile(profile: TvProfile): ApiResult<MovvizUserDto> {
        val url = _serverUrl.value ?: profile.serverUrl
        if (profile.cookieSnapshot.isNullOrBlank()) {
            return ApiResult.Failure("session_manquante")
        }
        ApiClient.restoreSession(url, profile.cookieSnapshot)
        val result = MovvizRepository(url).me()
        return when (result) {
            is ApiResult.Success -> {
                val user = result.data
                if (user != null) {
                    _currentUser.value = user
                    val refreshed = profile.copy(
                        cookieSnapshot = ApiClient.sessionSnapshot(url),
                        avatar = user.plexAvatar ?: profile.avatar,
                        name = user.username,
                    )
                    refreshed.cookieSnapshot?.let { profilePrefs.saveSession(url, user.id, it) }
                    _activeProfile.value = refreshed
                    if (user.role == "admin") loadProfilesFromServer()
                    ApiResult.Success(user)
                } else ApiResult.Failure("Session du profil expirée")
            }
            is ApiResult.Failure -> result
            ApiResult.Unauthorized -> ApiResult.Unauthorized
        }
    }

    /** Migration transparente de la session unique des anciennes versions
     *  vers le premier profil TV, sans redemander les identifiants. */
    suspend fun bootstrapCurrentProfile(): Boolean {
        val url = _serverUrl.value ?: return false
        val result = MovvizRepository(url).me()
        val user = (result as? ApiResult.Success)?.data ?: return false
        saveCurrentProfile(user)
        if (user.role == "admin") loadProfilesFromServer()
        return true
    }

    /** Mémoire locale de la session (par serveur+compte) + profil actif.
     *  AUCUN appel serveur ici : le foyer côté serveur n'est alimenté que
     *  par l'admin via addProfileToFoyer() — un compte invité qui se
     *  connecte depuis un APK ne pollue jamais la liste du foyer. */
    private suspend fun saveCurrentProfile(user: MovvizUserDto) {
        val url = _serverUrl.value ?: return
        val cookie = ApiClient.sessionSnapshot(url)
        if (!cookie.isNullOrBlank()) profilePrefs.saveSession(url, user.id, cookie)
        _activeProfile.value = TvProfile(
            id = user.id,
            serverUrl = url,
            name = user.username,
            avatar = user.plexAvatar,
            cookieSnapshot = cookie,
        )
    }

    /** L'admin ajoute un compte existant au foyer TV (sans son mot de
     *  passe), puis recharge la liste. Retourne le résultat du POST — le
     *  serveur fait un UPSERT (jamais de doublon). */
    suspend fun addProfileToFoyer(userId: String): ApiResult<Unit> {
        val url = _serverUrl.value ?: return ApiResult.Failure("Aucun serveur configuré")
        val result = MovvizRepository(url).addTvProfile(userId)
        loadProfilesFromServer()
        return result
    }

    fun loadLibrary() {
        viewModelScope.launch {
            refreshLibraryNow()
        }
    }

    private suspend fun refreshLibraryNow() = coroutineScope {
        val repo = repository ?: return@coroutineScope
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

    /** Même sélection éditoriale personnalisée que le dashboard web. En cas
     * d'indisponibilité, HomeScreen conserve son hero issu de la bibliothèque. */
    fun loadDashboardHero() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val result = repo.dashboardHero()) {
                is ApiResult.Success -> _dashboardHero.value = result.data
                ApiResult.Unauthorized -> _sessionExpired.value = true
                is ApiResult.Failure -> Unit
            }
        }
    }

    /** Équivalent TV du mutateLibrary ciblé de TitleContent : la fiche
     * reflète recherche → téléchargement → disponibilité en direct, sans
     * polling de toutes les bibliothèques. */
    fun refreshTitleLibraryEntry(type: String, tmdbId: Int) {
        val repo = repository ?: return
        viewModelScope.launch {
            if (type == "movie") {
                when (val result = repo.movieByTmdbId(tmdbId)) {
                    is ApiResult.Success -> result.data?.let { updated ->
                        _movies.value = _movies.value.replaceOrAppend(updated) { it.tmdbId }
                    }
                    ApiResult.Unauthorized -> _sessionExpired.value = true
                    is ApiResult.Failure -> Unit
                }
            } else {
                when (val result = repo.seriesByTmdbId(tmdbId)) {
                    is ApiResult.Success -> result.data?.let { updated ->
                        _series.value = _series.value.replaceOrAppend(updated) { it.tmdbId }
                        loadSeriesSeasons(tmdbId)
                    }
                    ApiResult.Unauthorized -> _sessionExpired.value = true
                    is ApiResult.Failure -> Unit
                }
            }
        }
    }

    /** Charge et mémorise le meilleur logo officiel TMDb pour une vedette.
     * Une absence de logo reste un résultat valide : HomeScreen affiche alors
     * le titre texte, comme le desktop. Un échec réseau ponctuel (timeout,
     * DNS) déclenche UN retry après 1 s — les images TMDb sont en cache
     * CDN, donc un second essai quasi immédiat résout la majorité des
     * interruptions transitoires sans surcharger le serveur. */
    suspend fun loadHeroLogo(type: String, tmdbId: Int) {
        val key = "$type-$tmdbId"
        if (_heroLogos.value.containsKey(key)) return
        val repo = repository ?: return
        var result = repo.metadataImages(type, tmdbId)
        if (result is ApiResult.Failure) {
            android.util.Log.w("HeroLogo", "1st attempt failed for $key: ${(result as ApiResult.Failure).message}, retrying in 1s")
            delay(1_000)
            result = repo.metadataImages(type, tmdbId)
        }
        when (result) {
            is ApiResult.Success -> {
                val path = result.data.logos.firstOrNull()?.filePath
                if (path != null) {
                    _heroLogos.value = _heroLogos.value + (key to path)
                } else {
                    android.util.Log.d("HeroLogo", "No logo available for $key (empty logos list)")
                }
            }
            is ApiResult.Failure -> {
                android.util.Log.w("HeroLogo", "Failed to load hero logo for $key after retry: ${result.message}")
            }
            ApiResult.Unauthorized -> {
                android.util.Log.w("HeroLogo", "Unauthorized loading hero logo for $key")
            }
        }
    }

    /** Précharge les logos de TOUTES les vedettes du hero d'un coup — au
     * lieu de les charger une par une au fil des rotations (8 s chacune),
     * ce qui laissait les 4 autres sans logo pendant le premier cycle
     * complet (40 s). Les images TMDb sont légères (< 50 KB) et le CDN
     * accepte 5 requêtes en parallèle sans throttle. */
    fun loadHeroLogos(type: String, tmdbIds: List<Int>) {
        viewModelScope.launch {
            tmdbIds.forEach { tmdbId ->
                loadHeroLogo(type, tmdbId)
                delay(100)
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
                is ApiResult.Success -> {
                    _continueWatching.value = r.data
                    // Rangée "Continuer à regarder" du dashboard Android TV :
                    // la chaîne TvProvider est resynchronisée à chaque
                    // chargement réussi du on-deck (accueil ET fiche titre) —
                    // en arrière-plan, jamais bloquant pour l'UI.
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                        com.movviz.tv.tvchannel.TvChannelProvider.sync(getApplication(), r.data)
                    }
                }
                else -> Unit
            }
        }
    }

    /** Charge le statut "vu" manuel de l'utilisateur — best-effort comme le
     *  reste des données secondaires de la fiche : un échec laisse
     *  simplement l'état vu/pas-vu indéterminé plutôt que de bloquer
     *  l'affichage de la fiche. */
    fun loadWatchStatus() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val r = repo.watchStatus()) {
                is ApiResult.Success -> _watchStatus.value = r.data
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

    /** Fichier réel (résolution/codecs/HDR/source) du film déjà en
     *  bibliothèque, pour la zone technique secondaire de la fiche titre —
     *  déjà chargé via loadLibrary(), aucun appel réseau dédié. */
    fun libraryMovieFile(tmdbId: Int): com.movviz.tv.data.LibraryFileDto? =
        _movies.value.firstOrNull { it.tmdbId == tmdbId }?.file

    /** Charge les tendances TMDb film + série pour la rangée Découverte —
     *  une seule fois par entrée sur l'accueil (pas de polling, contrairement
     *  à la file : le contenu tendance ne change pas seconde par seconde). */
    fun loadDiscovery() {
        val repo = repository ?: return
        viewModelScope.launch {
            coroutineScope {
                val movies = async { repo.trending("movie") }
                val series = async { repo.trending("series") }
                val movieRows = async { repo.metadataRows("movie") }
                val seriesRows = async { repo.metadataRows("series") }
                when (val m = movies.await()) { is ApiResult.Success -> _trendingMovies.value = m.data; else -> Unit }
                when (val s = series.await()) { is ApiResult.Success -> _trendingSeries.value = s.data; else -> Unit }
                when (val rows = movieRows.await()) { is ApiResult.Success -> _movieRows.value = rows.data; else -> Unit }
                when (val rows = seriesRows.await()) { is ApiResult.Success -> _seriesRows.value = rows.data; else -> Unit }
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

    /** Recharge l'utilisateur connecté — nécessaire après un redémarrage sur
     *  session persistée : login() est le seul autre endroit qui remplit
     *  currentUser, et il ne tourne jamais dans ce cas (hasValidSession()
     *  saute directement à l'accueil). Appelé par SettingsScreen, section
     *  Compte. */
    fun loadCurrentUser() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val r = repo.me()) {
                is ApiResult.Success -> if (r.data != null) _currentUser.value = r.data
                else -> Unit
            }
        }
    }

    /** Charge les préférences de compte (langue audio par défaut) — écran
     *  Paramètres, section Lecture. Best-effort comme le reste des lectures
     *  de préférences : un échec laisse le sélecteur sur "Auto" plutôt que
     *  de bloquer l'écran. */
    fun loadUserPrefs() {
        val repo = repository ?: return
        viewModelScope.launch {
            when (val r = repo.preferences()) {
                is ApiResult.Success -> _userPrefs.value = r.data
                else -> Unit
            }
        }
    }

    fun setPreferredAudioLanguage(language: String) {
        val repo = repository ?: return
        // Optimiste — l'écran reflète le choix immédiatement (pas d'attente
        // réseau perceptible sur un simple bouton radio), la vraie réponse
        // serveur écrase ensuite avec la valeur confirmée.
        _userPrefs.value = (_userPrefs.value ?: UserPrefsDto()).copy(preferredAudioLanguage = language)
        viewModelScope.launch {
            when (val r = repo.savePreferredAudioLanguage(language)) {
                is ApiResult.Success -> _userPrefs.value = r.data
                else -> Unit
            }
        }
    }

    fun logout() {
        val repo = repository
        // Best-effort côté serveur (voir MovvizRepository.logoutServer) puis
        // nettoyage local systématique, même si l'appel serveur échoue (pas
        // de réseau, serveur down...) — jamais bloquer la déconnexion locale
        // sur un aller-retour réseau.
        viewModelScope.launch {
            repo?.logoutServer()
            com.movviz.tv.data.ApiClient.clearSession()
            _currentUser.value = null
            _userPrefs.value = null
        }
    }
}

private fun <T> List<T>.replaceOrAppend(item: T, key: (T) -> Int): List<T> {
    val index = indexOfFirst { key(it) == key(item) }
    return if (index < 0) this + item else toMutableList().also { it[index] = item }
}
