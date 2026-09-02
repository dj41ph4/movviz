from pathlib import Path
import json, re

ROOT = Path(".")
VERSION = "1.24.42"
VERSION_CODE = 12442


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# --- version bump, all platforms ------------------------------------------
pkg = json.loads(read("package.json"))
pkg["version"] = VERSION
write("package.json", json.dumps(pkg, ensure_ascii=False, indent=2) + "\n")

lock = json.loads(read("package-lock.json"))
lock["version"] = VERSION
if "" in lock.get("packages", {}):
    lock["packages"][""]["version"] = VERSION
write("package-lock.json", json.dumps(lock, ensure_ascii=False, indent=2) + "\n")

for gradle in ["android-tv/app/build.gradle.kts", "android-mobile/app/build.gradle.kts"]:
    text = read(gradle)
    text, n_code = re.subn(
        r'(versionCode\s*=\s*\(\(project\.findProperty\("movvizVersionCode"\).*?\?:\s*)\d+',
        rf"\g<1>{VERSION_CODE}",
        text,
        count=1,
    )
    text, n_name = re.subn(
        r'(versionName\s*=\s*\(project\.findProperty\("movvizVersionName"\).*?\?:\s*")[^"]+("\s*)',
        rf"\g<1>{VERSION}\2",
        text,
        count=1,
    )
    if n_code != 1 or n_name != 1:
        raise RuntimeError(f"could not bump {gradle}: code={n_code} name={n_name}")
    write(gradle, text)

readme = read("README.md")
readme, n = re.subn(r"Movviz-\d+\.\d+\.\d+-7c3aed", f"Movviz-{VERSION}-7c3aed", readme, count=1)
if n != 1:
    raise RuntimeError("README current version badge not found")
write("README.md", readme)

changelog = read("CHANGELOG.md")
if f"## v{VERSION} " not in changelog:
    entry = f'''## v{VERSION} — September 2026

### Android TV — UX, lecture et mises à jour

- Les sous-titres sont désormais désactivés par défaut et leur état actif/inactif est mémorisé par profil et par titre pour les reprises de lecture.
- La fiche titre rafraîchit la progression au retour du lecteur : le CTA devient immédiatement **Reprendre à HH:MM:SS** au lieu de rester figé sur « Lire ».
- Les filtres de catégories du catalogue TV comparent enfin les vrais noms de genres de la bibliothèque au lieu des identifiants TMDb, avec prise en charge d'Anime et Romance ado.
- Les données de découverte, recommandations, hero et reprise sont purgées lors d'un changement de profil afin d'éviter tout mélange entre comptes.
- Le focus TV gagne un micro-zoom GPU et un halo renforcé pour une interface plus vivante sans déplacer les rangées.
- Une flèche de téléchargement animée apparaît dans la barre latérale lorsqu'une mise à jour est disponible. L'installation automatique est strictement limitée au démarrage ; pendant l'utilisation, une mise à jour est seulement signalée et ne démarre qu'après une action explicite.

'''
    changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n" + entry, 1)
    write("CHANGELOG.md", changelog)

# --- AppViewModel: profile-scoped caches + update state -------------------
vm = "android-tv/app/src/main/kotlin/com/movviz/tv/AppViewModel.kt"
replace_once(vm, "import com.movviz.tv.data.UserPrefsDto\n", "import com.movviz.tv.data.UserPrefsDto\nimport com.movviz.tv.data.UpdateInfo\n")
replace_once(
    vm,
    '''    private val _updateCheckStatus = MutableStateFlow<String?>(null)
    val updateCheckStatus: StateFlow<String?> = _updateCheckStatus.asStateFlow()

    fun requestUpdateCheck() {
''',
    '''    private val _updateCheckStatus = MutableStateFlow<String?>(null)
    val updateCheckStatus: StateFlow<String?> = _updateCheckStatus.asStateFlow()

    // Runtime update state. During normal use this is notification-only;
    // installation requires an explicit user action from the sidebar.
    private val _availableUpdate = MutableStateFlow<UpdateInfo?>(null)
    val availableUpdate: StateFlow<UpdateInfo?> = _availableUpdate.asStateFlow()
    private val _updateInstallTrigger = MutableStateFlow(0)
    val updateInstallTrigger: StateFlow<Int> = _updateInstallTrigger.asStateFlow()

    fun setAvailableUpdate(info: UpdateInfo?) {
        _availableUpdate.value = info
    }

    fun requestAvailableUpdateInstall() {
        if (_availableUpdate.value != null) _updateInstallTrigger.value += 1
    }

    fun requestUpdateCheck() {
''',
)
replace_once(
    vm,
    '''    suspend fun selectProfile(profile: TvProfile): ApiResult<MovvizUserDto> {
        val url = _serverUrl.value ?: profile.serverUrl
''',
    '''    /** Purge les caches propres à l'utilisateur AVANT de restaurer le
     * cookie d'un autre profil. Un même serveur ne doit jamais réutiliser le
     * hero, les recommandations ou la reprise du profil précédent. */
    private fun clearProfileScopedState() {
        _currentUser.value = null
        _movies.value = emptyList()
        _series.value = emptyList()
        _dashboardHero.value = emptyList()
        _heroLogos.value = emptyMap()
        _detail.value = null
        _person.value = null
        _seriesSeasons.value = emptyList()
        _seasonMetadata.value = emptyMap()
        _searchResults.value = emptyList()
        _queue.value = emptyList()
        _trendingMovies.value = emptyList()
        _trendingSeries.value = emptyList()
        _movieRows.value = emptyList()
        _seriesRows.value = emptyList()
        _movieLibraryRecommendations.value = emptyList()
        _seriesLibraryRecommendations.value = emptyList()
        _continueWatching.value = emptyList()
        _watchStatus.value = null
        _userPrefs.value = null
        seasonsTmdbId = null
    }

    suspend fun selectProfile(profile: TvProfile): ApiResult<MovvizUserDto> {
        val url = _serverUrl.value ?: profile.serverUrl
        clearProfileScopedState()
''',
)

# --- MainActivity: startup update gate + profile id to player -------------
main = "android-tv/app/src/main/kotlin/com/movviz/tv/MainActivity.kt"
replace_once(
    main,
    '''        setContent {
            MovvizTvTheme {
                MovvizNavHost(appViewModel)
            }
        }
''',
    '''        setContent {
            MovvizTvTheme {
                var startupUpdateResolved by remember { mutableStateOf(false) }
                if (!startupUpdateResolved) {
                    AutoUpdateOverlay(
                        viewModel = appViewModel,
                        startupMode = true,
                        onStartupFinished = { startupUpdateResolved = true },
                    )
                } else {
                    MovvizNavHost(appViewModel)
                    // Une fois l'app ouverte : détection seulement. Le clic
                    // explicite sur la flèche de la sidebar lance l'installation.
                    AutoUpdateOverlay(viewModel = appViewModel, startupMode = false)
                }
            }
        }
''',
)
replace_once(
    main,
    '''                    navRailFocusRequester = navRailFocusRequester,
                    // Plus de largeur fixe ici : NavRail gère elle-même son
''',
    '''                    navRailFocusRequester = navRailFocusRequester,
                    updateAvailable = viewModel.availableUpdate.collectAsState().value != null,
                    onUpdateClick = { viewModel.requestAvailableUpdateInstall() },
                    // Plus de largeur fixe ici : NavRail gère elle-même son
''',
)
replace_once(
    main,
    '''                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, posterPath = posterPath),
''',
    '''                        PlayerActivity.forQueue(
                            context, url, type, tmdbId, title, queue, startIndex,
                            posterPath = posterPath,
                            profileId = viewModel.activeProfile.value?.id ?: viewModel.currentUser.value?.id,
                        ),
''',
)
replace_once(
    main,
    '''                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, startFromBeginning = true, posterPath = posterPath),
''',
    '''                        PlayerActivity.forQueue(
                            context, url, type, tmdbId, title, queue, startIndex,
                            startFromBeginning = true,
                            posterPath = posterPath,
                            profileId = viewModel.activeProfile.value?.id ?: viewModel.currentUser.value?.id,
                        ),
''',
)

# --- NavRail update indicator ---------------------------------------------
nav = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/home/NavRail.kt"
replace_once(nav, "import androidx.compose.ui.graphics.Color\n", "import androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.graphics.graphicsLayer\n")
replace_once(
    nav,
    "import androidx.compose.animation.core.animateDpAsState\nimport androidx.compose.animation.core.tween\n",
    '''import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
''',
)
replace_once(
    nav,
    '''    activeProfile: TvProfile? = null,
    onProfileSelected: (TvProfile) -> Unit = {},
''',
    '''    activeProfile: TvProfile? = null,
    updateAvailable: Boolean = false,
    onUpdateClick: () -> Unit = {},
    onProfileSelected: (TvProfile) -> Unit = {},
''',
)
replace_once(
    nav,
    '''        Spacer(modifier = Modifier.weight(1f))
        SearchButton(
''',
    '''        Spacer(modifier = Modifier.weight(1f))
        if (updateAvailable) {
            UpdateAvailableButton(expanded = railFocused, onClick = onUpdateClick)
            Spacer(modifier = Modifier.height(12.dp))
        }
        SearchButton(
''',
)
update_button = r'''
@Composable
private fun UpdateArrowIcon(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val stroke = 2.4.dp.toPx()
        val cx = size.width / 2f
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(cx, size.height * 0.14f),
            end = androidx.compose.ui.geometry.Offset(cx, size.height * 0.67f),
            strokeWidth = stroke,
            cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(size.width * 0.26f, size.height * 0.49f),
            end = androidx.compose.ui.geometry.Offset(cx, size.height * 0.76f),
            strokeWidth = stroke,
            cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(size.width * 0.74f, size.height * 0.49f),
            end = androidx.compose.ui.geometry.Offset(cx, size.height * 0.76f),
            strokeWidth = stroke,
            cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
    }
}

@Composable
private fun UpdateAvailableButton(expanded: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val pulse = rememberInfiniteTransition(label = "updateAvailablePulse")
    val alpha by pulse.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(animation = tween(700), repeatMode = RepeatMode.Reverse),
        label = "updateAvailableAlpha",
    )
    val bounce by pulse.animateFloat(
        initialValue = -1.5f,
        targetValue = 2.5f,
        animationSpec = infiniteRepeatable(animation = tween(700), repeatMode = RepeatMode.Reverse),
        label = "updateAvailableBounce",
    )
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .height(38.dp)
            .width(if (expanded) 154.dp else 38.dp)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizBrand.copy(alpha = if (focused) 0.30f else 0.18f),
            focusedContainerColor = MovvizBrand.copy(alpha = 0.38f),
            contentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.85f)),
                shape = shape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
        ) {
            UpdateArrowIcon(
                modifier = Modifier
                    .size(21.dp)
                    .graphicsLayer {
                        this.alpha = alpha
                        translationY = bounce
                    },
            )
            if (expanded) {
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Mise à jour",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.92f),
                    maxLines = 1,
                )
            }
        }
    }
}

'''
replace_once(nav, "@Composable\nprivate fun ProfileMenuButton(", update_button + "@Composable\nprivate fun ProfileMenuButton(")

# --- Update overlay --------------------------------------------------------
upd = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/update/UpdateOverlay.kt"
replace_once(upd, "import com.movviz.tv.ui.theme.MovvizBrand2\n", "import com.movviz.tv.ui.theme.MovvizBrand2\nimport com.movviz.tv.ui.theme.AnimatedLogo\n")
text = read(upd)
pattern = r'@Composable\nfun AutoUpdateOverlay\(viewModel: AppViewModel\? = null\) \{.*?\n\}\n\n/\*\* Affichage pur'
new_func = r'''@Composable
fun AutoUpdateOverlay(
    viewModel: AppViewModel? = null,
    startupMode: Boolean = false,
    onStartupFinished: () -> Unit = {},
) {
    val context = LocalContext.current
    val updateManager = remember { UpdateManager(context.applicationContext) }
    var state by remember { mutableStateOf<UpdateUiState>(UpdateUiState.Hidden) }
    var target by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<UpdateInfo?>(null) }
    var downloadedFile by remember { mutableStateOf<File?>(null) }
    var startupResolved by remember { mutableStateOf(!startupMode) }
    val scope = rememberCoroutineScope()
    val autoUpdate by (viewModel?.autoUpdateEnabled?.collectAsState()
        ?: remember { mutableStateOf(BuildConfig.AUTO_UPDATE) })

    fun finishStartup() {
        if (startupMode && !startupResolved) {
            startupResolved = true
            onStartupFinished()
        }
    }

    suspend fun installUpdate(info: UpdateInfo) {
        target = info.tag
        if (!updateManager.canInstallUnknown()) {
            pending = info
            state = UpdateUiState.NeedPermission
            return
        }
        try {
            state = UpdateUiState.Downloading(0f)
            val file = updateManager.download(info) { p -> state = UpdateUiState.Downloading(p) }
            downloadedFile = file
            state = UpdateUiState.Installing(null)
            updateManager.installInBackground(file) { p -> state = UpdateUiState.Installing(p) }
            delay(30_000L)
            state = UpdateUiState.FallbackInstall
        } catch (e: Exception) {
            android.util.Log.w("MovvizUpdate", "Update failed", e)
            state = if (downloadedFile != null) UpdateUiState.FallbackInstall else UpdateUiState.Hidden
            if (state == UpdateUiState.Hidden) finishStartup()
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val info = pending
                if (info != null && state == UpdateUiState.NeedPermission && updateManager.canInstallUnknown()) {
                    pending = null
                    scope.launch { installUpdate(info) }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (startupMode) {
        LaunchedEffect(Unit) {
            val info = updateManager.checkForUpdate()
            viewModel?.setAvailableUpdate(info)
            if (info != null && autoUpdate) installUpdate(info) else finishStartup()
        }
        if (!startupResolved && state == UpdateUiState.Hidden) {
            Box(
                modifier = Modifier.fillMaxSize().background(MovvizBackground),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    AnimatedLogo(size = 56.dp)
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = "Vérification de Movviz…",
                        style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.58f)),
                    )
                }
            }
        }
    } else {
        // Runtime checks never install anything by themselves.
        LaunchedEffect(Unit) {
            while (true) {
                viewModel?.setAvailableUpdate(updateManager.checkForUpdate())
                delay(30L * 60L * 1000L)
            }
        }
        val checkTrigger = viewModel?.updateCheckTrigger?.collectAsState()?.value
        LaunchedEffect(checkTrigger) {
            if (checkTrigger == null || checkTrigger == 0) return@LaunchedEffect
            viewModel.setUpdateCheckStatus("Vérification…")
            val info = updateManager.checkForUpdate()
            viewModel.setAvailableUpdate(info)
            viewModel.setUpdateCheckStatus(
                if (info == null) "Movviz est à jour (${BuildConfig.VERSION_NAME})"
                else "Mise à jour disponible : ${info.tag}"
            )
        }
        val installTrigger = viewModel?.updateInstallTrigger?.collectAsState()?.value
        LaunchedEffect(installTrigger) {
            if (installTrigger == null || installTrigger == 0) return@LaunchedEffect
            viewModel.availableUpdate.value?.let { installUpdate(it) }
        }
    }

    if (state != UpdateUiState.Hidden) {
        UpdateOverlay(
            state = state,
            targetVersion = target,
            onAuthorize = { updateManager.openInstallPermissionSettings() },
            onRetryInstall = { downloadedFile?.let { updateManager.installViaSystemInstaller(it) } },
            onLater = {
                state = UpdateUiState.Hidden
                finishStartup()
            },
        )
    }
}

/** Affichage pur'''
text, count = re.subn(pattern, new_func, text, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("AutoUpdateOverlay function anchor not found")
write(upd, text)

# --- Subtitle prefs: default OFF, remember per profile + title ------------
playback_prefs = r'''package com.movviz.tv.data

import android.content.Context

/** Préférences de lecture locales au client TV. Les sous-titres sont OFF par
 * défaut ; le dernier choix explicite est isolé par serveur, profil et titre. */
class PlaybackPrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("movviz_playback_prefs", Context.MODE_PRIVATE)

    fun subtitlesEnabled(serverUrl: String, profileId: String?, mediaKey: String): Boolean =
        prefs.getBoolean(key(serverUrl, profileId, mediaKey), false)

    fun setSubtitlesEnabled(serverUrl: String, profileId: String?, mediaKey: String, enabled: Boolean) {
        prefs.edit().putBoolean(key(serverUrl, profileId, mediaKey), enabled).apply()
    }

    private fun key(serverUrl: String, profileId: String?, mediaKey: String): String =
        "subtitles|${serverUrl.trim().trimEnd('/')}|${profileId ?: "default"}|$mediaKey"
}
'''
write("android-tv/app/src/main/kotlin/com/movviz/tv/data/PlaybackPrefs.kt", playback_prefs)

player = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/player/PlayerActivity.kt"
replace_once(player, "import com.movviz.tv.data.MovvizRepository\n", "import com.movviz.tv.data.MovvizRepository\nimport com.movviz.tv.data.PlaybackPrefs\n")
replace_once(player, 'private const val EXTRA_LOCAL_KEYS = "extra_local_keys"\n', 'private const val EXTRA_LOCAL_KEYS = "extra_local_keys"\nprivate const val EXTRA_PROFILE_ID = "extra_profile_id"\n')
replace_once(
    player,
    '''        val posterPath = intent.getStringExtra(EXTRA_POSTER_PATH)

        val queue = keys.indices.map { i ->
''',
    '''        val posterPath = intent.getStringExtra(EXTRA_POSTER_PATH)
        val profileId = intent.getStringExtra(EXTRA_PROFILE_ID)

        val queue = keys.indices.map { i ->
''',
)
replace_once(
    player,
    '''                        posterPath = posterPath,
                        onExit = { finish() },
''',
    '''                        posterPath = posterPath,
                        profileId = profileId,
                        onExit = { finish() },
''',
)
replace_once(
    player,
    '''            startFromBeginning: Boolean = false,
            posterPath: String? = null,
        ): Intent = Intent(context, PlayerActivity::class.java).apply {
''',
    '''            startFromBeginning: Boolean = false,
            posterPath: String? = null,
            profileId: String? = null,
        ): Intent = Intent(context, PlayerActivity::class.java).apply {
''',
)
replace_once(player, "            putExtra(EXTRA_POSTER_PATH, posterPath)\n", "            putExtra(EXTRA_POSTER_PATH, posterPath)\n            putExtra(EXTRA_PROFILE_ID, profileId)\n")
replace_once(
    player,
    '''    startFromBeginning: Boolean,
    posterPath: String? = null,
    onExit: () -> Unit,
''',
    '''    startFromBeginning: Boolean,
    posterPath: String? = null,
    profileId: String? = null,
    onExit: () -> Unit,
''',
)
replace_once(
    player,
    '''    val repository = remember(baseUrl) { MovvizRepository(baseUrl) }

    // Anti-veille :
''',
    '''    val repository = remember(baseUrl) { MovvizRepository(baseUrl) }
    val playbackPrefs = remember { PlaybackPrefs(context.applicationContext) }
    val subtitleMediaKey = remember(type, tmdbId) { "$type:$tmdbId" }
    var subtitlesEnabled by remember(baseUrl, profileId, subtitleMediaKey) {
        mutableStateOf(playbackPrefs.subtitlesEnabled(baseUrl, profileId, subtitleMediaKey))
    }

    // Anti-veille :
''',
)
replace_once(
    player,
    '''        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
''',
    '''        // ExoPlayer can auto-select a default/forced text track. Movviz
        // TV enforces OFF unless this profile explicitly enabled subtitles.
        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters.buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, !subtitlesEnabled)
            .apply { if (!subtitlesEnabled) clearOverridesOfType(C.TRACK_TYPE_TEXT) }
            .build()
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
''',
)
replace_once(
    player,
    '''                    if (groupIndex < 0) {
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters.buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                            .build()
                    } else {
                        applyTrackOverride(exoPlayer, C.TRACK_TYPE_TEXT, exoPlayer.currentTracks.groups[groupIndex])
                    }
                    showSubtitleDialog = false
''',
    '''                    if (groupIndex < 0) {
                        subtitlesEnabled = false
                        playbackPrefs.setSubtitlesEnabled(baseUrl, profileId, subtitleMediaKey, false)
                        exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters.buildUpon()
                            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                            .build()
                    } else {
                        subtitlesEnabled = true
                        playbackPrefs.setSubtitlesEnabled(baseUrl, profileId, subtitleMediaKey, true)
                        applyTrackOverride(exoPlayer, C.TRACK_TYPE_TEXT, exoPlayer.currentTracks.groups[groupIndex])
                    }
                    showSubtitleDialog = false
''',
)

# --- Title screen resume CTA ----------------------------------------------
title = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/title/TitleDetailScreen.kt"
text = read(title)
if "import androidx.compose.runtime.DisposableEffect\n" not in text:
    text = text.replace("import androidx.compose.runtime.Composable\n", "import androidx.compose.runtime.Composable\nimport androidx.compose.runtime.DisposableEffect\n", 1)
if "import androidx.lifecycle.LifecycleEventObserver\n" not in text:
    text = text.replace(
        "import androidx.tv.material3.Text\n",
        "import androidx.tv.material3.Text\nimport androidx.lifecycle.Lifecycle\nimport androidx.lifecycle.LifecycleEventObserver\nimport androidx.lifecycle.compose.LocalLifecycleOwner\n",
        1,
    )
write(title, text)
replace_once(
    title,
    '''    val episodeResume = remember(continueWatching, type, tmdbId) {
        if (type != "series") null
        else continueWatching.firstOrNull { it.type == "series" && it.tmdbId == tmdbId && it.offsetMs > 5_000L }
    }

    // Statut "vu" manuel par utilisateur
''',
    '''    val episodeResume = remember(continueWatching, type, tmdbId) {
        if (type != "series") null
        else continueWatching.firstOrNull { it.type == "series" && it.tmdbId == tmdbId && it.offsetMs > 5_000L }
    }

    // PlayerActivity is separate: this screen stays composed underneath it.
    // Refresh on ON_RESUME so the CTA immediately becomes Resume HH:MM:SS.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, type, tmdbId) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadContinueWatching()
                viewModel.loadWatchStatus()
                if (viewModel.isInLibrary(type, tmdbId)) {
                    viewModel.refreshTitleLibraryEntry(type, tmdbId)
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Statut "vu" manuel par utilisateur
''',
)
text = read(title)
text, count = re.subn(
    r'''private fun formatResumeTime\(offsetMs: Long\): String \{\n    val totalSeconds = \(offsetMs / 1000\)\.coerceAtLeast\(0\)\n    val h = totalSeconds / 3600\n    val m = \(totalSeconds % 3600\) / 60\n    val s = totalSeconds % 60\n    return if \(h > 0\) "%d:%02d:%02d"\.format\(h, m, s\) else "%d:%02d"\.format\(m, s\)\n\}''',
    '''private fun formatResumeTime(offsetMs: Long): String {
    val totalSeconds = (offsetMs / 1000).coerceAtLeast(0)
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return "%02d:%02d:%02d".format(h, m, s)
}''',
    text,
    count=1,
)
if count != 1:
    raise RuntimeError("formatResumeTime anchor not found")
write(title, text)

# --- Catalog categories: compare genre NAMES, not TMDb id strings ---------
catalog = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/home/CatalogScreen.kt"
replace_once(
    catalog,
    '''    val filtered = remember(cards, selectedGenre) {
        if (selectedGenre == null) cards else cards.filter { selectedGenre in it.genres }
    }
''',
    '''    val filtered = remember(cards, selectedGenre, type) {
        when (val selected = selectedGenre) {
            null -> cards
            "anime" -> cards.filter { card -> card.genres.any { normalizeGenre(it) == "animation" } }
            "teen" -> cards.filter { card -> matchesTeenLibraryGenre(type, card.genres) }
            else -> cards.filter { card -> card.genres.any { normalizeGenre(it) == normalizeGenre(selected) } }
        }
    }
''',
)
replace_once(
    catalog,
    '''        items(genres, key = { "tmdb-${it.id}" }) { g ->
            CatalogGenreChip(label = g.name, active = selected == g.id.toString(), onClick = { onSelect(g.id.toString()) })
        }
''',
    '''        items(genres, key = { "tmdb-${it.id}" }) { g ->
            // Library DTOs carry genre names, not TMDb numeric ids.
            CatalogGenreChip(label = g.name, active = selected == g.name, onClick = { onSelect(g.name) })
        }
''',
)
replace_once(
    catalog,
    '''private fun resolutionLabelForCatalog(resolution: String?): String? = when {
''',
    '''private fun normalizeGenre(value: String): String =
    java.text.Normalizer.normalize(value.trim().lowercase(), java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")

private fun matchesTeenLibraryGenre(type: HomeTab, genres: List<String>): Boolean {
    val names = genres.map(::normalizeGenre).toSet()
    fun has(vararg values: String) = values.any { normalizeGenre(it) in names }
    return if (type == HomeTab.MOVIES) {
        !has("Familial", "Family") && has("Romance") && has("Comédie", "Comedy", "Drame", "Drama")
    } else {
        !has("Familial", "Family", "Kids") &&
            (has("Soap") || (has("Drame", "Drama") && has("Comédie", "Comedy")))
    }
}

private fun resolutionLabelForCatalog(resolution: String?): String? = when {
''',
)

# --- Focus dynamism: GPU-only micro scale, no list reflow -----------------
theme = "android-tv/app/src/main/kotlin/com/movviz/tv/ui/theme/Theme.kt"
replace_once(
    theme,
    '''    val elevation by animateDpAsState(
        targetValue = if (focused) 20.dp else 0.dp,
        animationSpec = tween(durationMillis = 180),
        label = "tvCardFocusElevation",
    )
    val transition = rememberInfiniteTransition(label = "tvCardFocusPulse")
''',
    '''    val elevation by animateDpAsState(
        targetValue = if (focused) 24.dp else 0.dp,
        animationSpec = tween(durationMillis = 180),
        label = "tvCardFocusElevation",
    )
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.035f else 1f,
        animationSpec = tween(durationMillis = 170),
        label = "tvCardFocusScale",
    )
    val transition = rememberInfiniteTransition(label = "tvCardFocusPulse")
''',
)
text = read(theme)
pos = text.index("fun Modifier.tvCardFocusHalo")
before, after = text[:pos], text[pos:]
old = '''    return this
        .shadow(
            elevation = elevation,
'''
new = '''    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(
            elevation = elevation,
'''
if old not in after:
    raise RuntimeError("tvCardFocusHalo return anchor not found")
after = after.replace(old, new, 1)
write(theme, before + after)

print("v1.24.42 patch applied successfully")
