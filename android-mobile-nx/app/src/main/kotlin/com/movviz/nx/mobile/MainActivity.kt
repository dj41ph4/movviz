package com.movviz.nx.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.Brush
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.zIndex
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import androidx.tv.material3.Icon
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.movviz.nx.mobile.ui.discover.RowDetailScreen
import com.movviz.nx.mobile.ui.home.HomeTab
import com.movviz.nx.mobile.ui.home.MainScreen
import com.movviz.nx.mobile.ui.home.UnfoldedRouteScaffold
import com.movviz.nx.mobile.ui.home.rememberUnfoldedLandscape
import com.movviz.nx.mobile.ui.home.NxTopNav
import com.movviz.nx.mobile.ui.home.PortraitTopHeader
import com.movviz.nx.mobile.ui.login.LoginScreen
import com.movviz.nx.mobile.ui.person.PersonScreen
import com.movviz.nx.mobile.ui.profile.ProfilePickerScreen
import com.movviz.nx.mobile.ui.player.PlayerActivity
import com.movviz.nx.mobile.ui.player.QueueItem
import com.movviz.nx.mobile.ui.theme.MovvizTvTheme
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.MovvizIconHome
import com.movviz.nx.mobile.ui.theme.MovvizIconFilm
import com.movviz.nx.mobile.ui.theme.MovvizIconTvScreen
import com.movviz.nx.mobile.ui.theme.MovvizIconDotCircle
import com.movviz.nx.mobile.ui.theme.MovvizIconStar
import com.movviz.nx.mobile.ui.theme.MovvizIconCheck
import com.movviz.nx.mobile.ui.theme.MovvizIconDownload
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.title.TitleDetailScreen
import com.movviz.nx.mobile.ui.update.AutoUpdateOverlay
import com.movviz.nx.mobile.ui.wizard.WizardScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val ROUTE_WIZARD = "wizard"
private const val ROUTE_LOGIN = "login"
private const val ROUTE_PROFILES = "profiles"
private const val ROUTE_HOME = "home"
private const val ROUTE_DOWNLOADS = "downloads"
private const val ROUTE_DETAIL = "detail/{type}/{tmdbId}?season={season}&episode={episode}"
private const val ROUTE_PERSON = "person/{id}"
// "Voir tout" d'une rangée éditoriale ("row") ou grille filtrée par genre
// ("genre") — voir RowDetailScreen. `key` porte soit la clé de rangée
// (ex. "acclaimed", "becauseYouWatched:123456"), soit l'id de genre (TMDb
// numérique en string, ou l'un des deux synthétiques "anime"/"teen").
private const val ROUTE_ROW = "row/{mode}/{mediaType}/{key}?label={label}"

/** Login ouvert en mode « ajouter un utilisateur au foyer » : après la
 *  connexion, le compte rejoint le foyer (ou est détecté déjà présent)
 *  et on revient sur l'écran profil au lieu d'aller à l'accueil. */
private const val ROUTE_LOGIN_ADD = "login?add=true"

/** Écrans où la NavRail reste affichée en permanence — accueil, fiche
 *  titre, fiche acteur. Absente sur wizard/login/profils (avant qu'il y
 *  ait quoi que ce soit à naviguer). */
private fun routeShowsNavRail(route: String?): Boolean =
    route != null && (route.startsWith("home") || route.startsWith("detail/") || route.startsWith("person/") || route.startsWith("row/"))

fun detailRoute(type: String, tmdbId: Int, season: Int? = null, episode: Int? = null): String {
    val base = "detail/$type/$tmdbId"
    if (season == null || episode == null) return base
    return "$base?season=$season&episode=$episode"
}

fun personRoute(id: Int): String = "person/$id"

/** `key`/`label` sont pourcentage-encodés explicitement : `key` peut contenir
 *  ':' ("becauseYouWatched:123456") et `label` du texte libre (accents,
 *  apostrophes) — Navigation Compose décode déjà les arguments de route,
 *  mais l'encodage à l'écriture reste la seule garantie que ces caractères
 *  ne perturbent jamais le découpage de la route par '/'/'?'/'&'. */
fun rowDetailRoute(mode: String, mediaType: String, key: String, label: String): String =
    "row/$mode/$mediaType/${android.net.Uri.encode(key)}?label=${android.net.Uri.encode(label)}"

class MainActivity : ComponentActivity() {
    private val appViewModel: AppViewModel by viewModels()

    // Deep link reçu (carte du dashboard TvProvider, movviz://title/...) —
    // consommé par le NavHost une fois la navigation prête.
    private var pendingDeepLink: Intent? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Barres système teintées page (#0F142F = MovvizPage) : jamais de
        // bandeau noir sous le contenu, y compris hors immersif (login…).
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.parseColor("#0F142F")
        pendingDeepLink = intent
        setContent {
            MovvizTvTheme {
                MovvizNavHost(appViewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        pendingDeepLink = intent
    }

    /** Récupère (et vide) le deep link en attente, s'il y en a un. */
    fun consumeDeepLink(): Intent? {
        val link = pendingDeepLink
        pendingDeepLink = null
        return link
    }
}

@Composable
private fun MovvizNavHost(viewModel: AppViewModel) {
    val navController = rememberNavController()
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    // État de la NavRail hoisté ici (pas dans MainScreen) : elle doit rester
    // visible et fonctionnelle même sur la fiche titre/acteur, qui vivent en
    // dehors de MainScreen sur la pile de navigation (demandé explicitement
    // après le premier jet qui la masquait sur la fiche, façon Netflix).
    // Accueil est désormais le premier onglet de la capsule basse portrait
    // (esquisse mobile 2026-09 : Accueil/Découverte/Bibliothèque/
    // Téléchargements), donc démarrer sur HOME est correct dans les deux
    // orientations — plus besoin du repli vers Découverte qu'imposait
    // l'ancienne barre sans entrée Accueil.
    var tab by remember { mutableStateOf(HomeTab.HOME) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var headerHasScrolled by remember { mutableStateOf(false) }
    // Cible D-pad « premier élément réel du contenu affiché » — la NavRail
    // tente de viser ceci en premier pour que la flèche bas depuis N'IMPORTE
    // quel item de la barre y descende directement (au lieu de compter sur
    // la recherche spatiale par défaut de Compose, qui ne trouve jamais de
    // cible à travers deux frères superposés dans un Box — nav + contenu,
    // zIndex ne joue que sur le dessin). N'est attachée que si l'écran a
    // déjà un vrai premier élément (pas pendant le chargement, pas sur une
    // liste vide) : viser une cible non attachée plante Compose si ce n'est
    // pas protégé. La barre reste donc branchée uniquement sur une première
    // cible réelle : aucune ancre minuscule ne peut recevoir le focus.
    val contentFocusRequester = remember { FocusRequester() }
    // Cible HAUT depuis le contenu : onglet sélectionné de la NavRail.
    val navRailFocusRequester = remember { FocusRequester() }
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route

    // Une fiche/grille doit toujours revenir dans Movviz avant de laisser
    // Android quitter l'app. Un deep-link peut ouvrir une fiche SANS accueil
    // dans sa pile : popBackStack() échoue alors et l'ancien comportement
    // revenait directement au launcher.
    val isStandaloneContentRoute = currentRoute?.startsWith("detail") == true ||
        currentRoute?.startsWith("person") == true ||
        currentRoute?.startsWith("row") == true
    BackHandler(enabled = navController.previousBackStackEntry != null || isStandaloneContentRoute) {
        if (!navController.popBackStack()) {
            navController.navigate(ROUTE_HOME) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // Restauration du focus au retour d'un écran détail : quand on revient
    // à l'accueil depuis une fiche, le focus doit revenir sur la NavRail
    // pour que la télécommande réagisse immédiatement — sans ceci, le
    // focus reste « nulle part » et l'utilisateur croit que l'app a gelé.
    var previousRoute by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(currentRoute) {
        if (currentRoute?.startsWith("home") == true &&
            previousRoute != null &&
            previousRoute?.startsWith("home") != true
        ) {
            // Attendre la composition complète de l'écran contenu avant de
            // demander le focus — le FocusRequester doit être attaché à un
            // noeud composé vivant, sinon requestFocus() lève une exception
            // (constaté en direct sur TV : 200 ms trop court, 300 ms OK).
            delay(300)
            runCatching { navRailFocusRequester.requestFocus() }
        }
        previousRoute = currentRoute
    }

// Démarrage façon Netflix : URL inconnue → wizard ; sinon, on vérifie
    // la session locale. Un APK fraîchement installé n'affiche JAMAIS le
    // picker de profils (liste vide) : on passe par le login, et ce n'est
    // qu'après un login admin que les profils du foyer reviennent du
    // serveur. Un compte invité (user) va directement à l'accueil — il ne
    // voit pas la liste du foyer.
    var startDestination by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        // viewModel.serverUrl.first() renverrait la valeur COURANTE du
        // StateFlow sans attendre — potentiellement `null` si le init{} du
        // ViewModel n'a pas fini de lire le DataStore (course confirmée en
        // testant : wizard réaffiché après un force-stop alors que l'URL
        // venait d'être sauvegardée avec succès). loadPersistedServerUrl()
        // lit le DataStore lui-même, pas de course possible.
        val url = viewModel.loadPersistedServerUrl()
        if (url == null) {
            startDestination = ROUTE_WIZARD
            return@LaunchedEffect
        }
        // Le picker ne dépend plus du réseau : les profils et sessions de
        // cette TV sont déjà cloisonnés localement. La validation /me arrive
        // seulement après le choix du profil, avant l'accès à l'accueil.
        val cachedProfiles = viewModel.loadCachedProfiles()
        if (cachedProfiles.isNotEmpty()) {
            startDestination = ROUTE_PROFILES
            return@LaunchedEffect
        }
        val user = viewModel.refreshCurrentUser()
        // L'écran TV est partagé : dès que le serveur connaît des profils,
        // on les propose à CHAQUE lancement. Le rôle du dernier compte
        // connecté ne doit jamais court-circuiter ce choix foyer.
        val availableProfiles = if (user != null) viewModel.loadProfilesFromServer() else emptyList()
        startDestination = when {
            user == null -> ROUTE_LOGIN
            availableProfiles.isNotEmpty() -> ROUTE_PROFILES
            else -> ROUTE_HOME
        }
    }

    // Un 401 en cours d'usage (pas seulement au lancement) doit renvoyer au
    // login au lieu de laisser l'écran courant afficher un état trompeur
    // ("aucun résultat", bibliothèque vide) qui a l'air normal mais cache en
    // réalité une session expirée — confirmé en live sur la recherche.
    val sessionExpired by viewModel.sessionExpired.collectAsState()
    LaunchedEffect(sessionExpired) {
        if (sessionExpired) {
            viewModel.consumeSessionExpired()
            navController.navigate(ROUTE_LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // Deep link movviz://title/{type}/{tmdbId} (carte du dashboard TvProvider
    // ou tout autre point d'entrée) : consommé dès que la navigation est
    // prête ET que le serveur est connu — sinon on laisse le flux de
    // démarrage normal (wizard/login) faire son chemin. handleDeepLink
    // navigue vers la route detail/{type}/{tmdbId} grâce au navDeepLink
    // déclaré sur cette route.
    val activity = androidx.compose.ui.platform.LocalContext.current as MainActivity
    val serverUrl by viewModel.serverUrl.collectAsState()
    LaunchedEffect(startDestination, serverUrl) {
        val link = activity.consumeDeepLink()?.takeIf { it.data?.scheme == "movviz" } ?: return@LaunchedEffect
        if (startDestination != null && serverUrl != null) {
            navController.handleDeepLink(link)
        }
    }

    val resolvedStart = startDestination
    if (resolvedStart == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(com.movviz.nx.mobile.ui.theme.MovvizPage),
            contentAlignment = Alignment.Center,
        ) {
            // Entrée pro et sobre : fondu + léger scale-in du lockup officiel
            // (asset réel R.drawable.movviz_lockup, jamais redessiné) — pas
            // d'étirement ni de déformation. Même langage que le splash
            // desktop (DashboardSplash.tsx).
            AnimatedVisibility(
                visible = true,
                enter = fadeIn(tween(500)) + scaleIn(initialScale = 0.92f, animationSpec = tween(500)),
            ) {
                Image(
                    painter = painterResource(R.drawable.movviz_lockup),
                    contentDescription = "Movviz",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.width(180.dp),
                )
            }
        }
        return
    }

    val compactPortrait = LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }
    // En-tête portrait persistant (mark + wordmark + avatar) — esquisse
    // mobile fournie 2026-09. Il ne remplace jamais NxTopNav (barre TV,
    // jamais affichée en portrait téléphone : voir la condition
    // !compactPortrait ci-dessous), et couvre les onglets de la barre basse
    // + Profil (Accueil/Découverte/Bibliothèque/Téléchargements affichent
    // recherche ou titre ; Profil n'a ni l'un ni l'autre — voir showSearchRow
    // ci-dessous). Masqué pendant la recherche plein écran,
    // qui porte sa propre barre persistante (voir SearchScreen).
    val showPortraitHeader = compactPortrait &&
        currentRoute?.startsWith("home") == true &&
        !searchOpen &&
        tab in setOf(HomeTab.HOME, HomeTab.DISCOVER, HomeTab.MOVIES, HomeTab.SERIES, HomeTab.LIBRARY, HomeTab.DOWNLOADS, HomeTab.PROFILE)
    // Téléchargements affiche son titre à la place du champ recherche
    // (esquisse section 3 : pas de champ recherche sous cet écran).
    val portraitHeaderTitle = if (tab == HomeTab.DOWNLOADS) "Téléchargements" else null
    val portraitActiveProfile by viewModel.activeProfile.collectAsState()
    val railUpdateTag by viewModel.availableUpdateTag.collectAsState()
    val railUsername = viewModel.currentUser.collectAsState().value?.username
    // Routes avec rail tactile en déplié : onglets + fiche titre/acteur +
    // grille "Tout voir" (même châssis partout, pas de barre TV haute).
    val unfoldedRailRoute = rememberUnfoldedLandscape() && (
        currentRoute?.startsWith("home") == true ||
            currentRoute?.startsWith("detail/") == true ||
            currentRoute?.startsWith("person/") == true ||
            currentRoute?.startsWith("row/") == true
        )
    // Retour à l'accueil depuis le rail (fiches/grilles vivent hors
    // MainScreen, sur la pile de navigation).
    val goHomeTab: (HomeTab) -> Unit = { newTab ->
        tab = newTab
        searchOpen = false
        headerHasScrolled = false
        if (currentRoute?.startsWith("home") != true) {
            if (!navController.popBackStack(ROUTE_HOME, false)) {
                navController.navigate(ROUTE_HOME)
            }
        }
    }
    // Châssis rail des fiches/grilles en déplié (même rail que les onglets).
    @Composable
    fun RailFrame(content: @Composable () -> Unit) {
        if (unfoldedRailRoute) {
            UnfoldedRouteScaffold(
                selected = tab,
                onSelectTab = goHomeTab,
                onOpenSearch = { goHomeTab(HomeTab.HOME); searchOpen = true },
                activeProfile = portraitActiveProfile,
                onAvatarClick = { goHomeTab(HomeTab.PROFILE) },
                updateTag = railUpdateTag,
                onUpdateClick = { viewModel.requestUpdateInstall() },
                fallbackName = railUsername,
            ) {
                content()
            }
        } else {
            content()
        }
    }
    // Immersif type jeu vidéo (portrait + déplié/paysage, accueil comme
    // fiches) : boutons système masqués, retour temporaire au swipe de bord.
    // Login/wizard/profils et TV gardent les barres système normales.
    val immersivePortrait = (compactPortrait && currentRoute?.startsWith("home") == true) ||
        unfoldedRailRoute
    LaunchedEffect(immersivePortrait) {
        val window = activity.window
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, !immersivePortrait)
        val controller = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)
        if (immersivePortrait) {
            controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            controller.show(androidx.core.view.WindowInsetsCompat.Type.systemBars())
        }
    }
    // NX: la navigation est une surcouche haute. Le contenu garde la pleine
    // largeur 16:9, comme Netflix, plutôt que de perdre une colonne à gauche.
    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            if (showPortraitHeader) {
                PortraitTopHeader(
                    activeProfile = portraitActiveProfile,
                    // Ne touche pas `tab` : l'onglet sous-jacent reste actif
                    // dans la barre basse pendant la recherche, qui s'affiche
                    // simplement par-dessus (et se referme dessus).
                    onSearchClick = { searchOpen = true },
                    // Sur Profil, retapper l'avatar ouvre le sélecteur de
                    // profils (changer de compte) — ailleurs, ouvre l'onglet
                    // Profil lui-même (esquisse section 8). Sans profil actif
                    // (session sans choix), l'avatar mène au sélecteur pour
                    // garantir une porte de sortie (jamais d'impasse "MO").
                    onAvatarClick = {
                        if (tab == HomeTab.PROFILE || portraitActiveProfile == null) {
                            navController.navigate(ROUTE_PROFILES) { popUpTo(ROUTE_HOME) }
                        } else {
                            tab = HomeTab.PROFILE
                        }
                    },
                    title = portraitHeaderTitle,
                    showSearchRow = tab != HomeTab.PROFILE,
                    updateTag = viewModel.availableUpdateTag.collectAsState().value,
                    onUpdateClick = { viewModel.requestUpdateInstall() },
                    fallbackName = viewModel.currentUser.collectAsState().value?.username,
                )
            }
        // En déplié, le rail tactile remplace la barre TV haute partout où
        // il est affiché (onglets + fiches/grilles, voir unfoldedRailRoute).
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            if (routeShowsNavRail(currentRoute) && !compactPortrait && !unfoldedRailRoute) {
                NxTopNav(
                    selected = tab,
                    hasScrolled = headerHasScrolled,
                    onSelect = { newTab ->
                        if (currentRoute?.startsWith("home") != true) {
                            navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                        }
                        tab = newTab
                        searchOpen = false
                        headerHasScrolled = false
                    },
                    searchOpen = searchOpen,
                    searchQuery = searchQuery,
                    onSearchToggle = {
                        if (currentRoute?.startsWith("home") != true) {
                            navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                        }
                        searchOpen = !searchOpen
                        if (searchOpen) tab = HomeTab.HOME else searchQuery = ""
                    },
                    onSearchQueryChange = { searchQuery = it },
                    profiles = viewModel.profiles.collectAsState().value,
                    activeProfile = viewModel.activeProfile.collectAsState().value,
                    onProfileSelected = { profile ->
                        scope.launch {
                            if (viewModel.selectProfile(profile) is com.movviz.nx.mobile.data.ApiResult.Success) {
                                navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                            }
                        }
                    },
                    onAddProfile = { navController.navigate(ROUTE_LOGIN_ADD) },
                    onOpenProfile = {
                        if (currentRoute?.startsWith("home") != true) {
                            navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                        }
                        tab = HomeTab.PROFILE
                        searchOpen = false
                        headerHasScrolled = false
                    },
                    onOpenSettings = {
                        if (currentRoute?.startsWith("home") != true) {
                            navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                        }
                        tab = HomeTab.SETTINGS
                        searchOpen = false
                        headerHasScrolled = false
                    },
                    onSwitchProfile = {
                        navController.navigate(ROUTE_PROFILES) { popUpTo(ROUTE_HOME) }
                    },
                    onOpenDownloads = { navController.navigate(ROUTE_DOWNLOADS) },
                    updateAvailableTag = viewModel.availableUpdateTag.collectAsState().value,
                    onUpdateClick = { viewModel.requestUpdateInstall() },
                    contentFocusRequester = contentFocusRequester,
                    navRailFocusRequester = navRailFocusRequester,
                    modifier = Modifier.align(Alignment.TopCenter).zIndex(10f),
                )
            }
            Box(modifier = Modifier.fillMaxSize()) {
        NavHost(navController = navController, startDestination = resolvedStart) {
composable(ROUTE_WIZARD) {
            WizardScreen(
                viewModel = viewModel,
                onConnected = {
                    // Nouvel appareil : le picker est vide par design — on
                    // passe directement par le login.
                    navController.navigate(ROUTE_LOGIN) {
                        popUpTo(ROUTE_WIZARD) { inclusive = true }
                    }
                },
            )
        }
composable(ROUTE_PROFILES) {
            val profiles by viewModel.profiles.collectAsState()
            val activeProfile by viewModel.activeProfile.collectAsState()
            val notice by viewModel.foyerNotice.collectAsState()
            ProfilePickerScreen(
                profiles = profiles,
                activeProfile = activeProfile,
                notice = notice,
                onNoticeDismissed = { viewModel.consumeFoyerNotice() },
                onSelect = { profile ->
                    scope.launch {
                        when (viewModel.selectProfile(profile)) {
                            is com.movviz.nx.mobile.data.ApiResult.Success -> navController.navigate(ROUTE_HOME) {
                                popUpTo(ROUTE_PROFILES) { inclusive = true }
                            }
                            else -> navController.navigate(ROUTE_LOGIN)
                        }
                    }
                },
                onAdd = {
                    // Ajouter un utilisateur → login : on se connecte avec le
                    // compte à ajouter, pas une simple liste de comptes.
                    navController.navigate(ROUTE_LOGIN_ADD)
                },
            )
        }
        composable(
            route = "login?add={add}",
            arguments = listOf(navArgument("add") { type = NavType.BoolType; defaultValue = false }),
        ) { backStackEntry ->
            val addMode = backStackEntry.arguments?.getBoolean("add") ?: false
            LoginScreen(
                viewModel = viewModel,
                addMode = addMode,
                onLoggedIn = {
                    if (addMode) {
                        // L'ajout est local à cette installation : le compte
                        // vient d'être authentifié et sa session est stockée
                        // sous son propre userId, jamais dans un foyer serveur.
                        scope.launch {
                            val user = viewModel.currentUser.value
                            if (user != null) {
                                viewModel.loadProfilesFromServer()
                                val already = viewModel.profiles.value.any { it.id == user.id }
                                viewModel.setFoyerNotice(
                                    when {
                                        already -> "« ${user.username} » est disponible sur cet appareil"
                                        else -> "Connecté avec « ${user.username} »"
                                    }
                                )
                            }
                            navController.navigate(ROUTE_PROFILES) {
                                popUpTo(ROUTE_LOGIN) { inclusive = true }
                            }
                        }
                    } else {
                        // Après login : l'admin retrouve les profils du foyer
                        // (déjà chargés par viewModel.login), un compte invité va
                        // directement à l'accueil — il ne voit jamais le picker.
                        val target =
                            if (viewModel.currentUser.value?.role == "admin" && viewModel.profiles.value.isNotEmpty()) ROUTE_PROFILES
                            else ROUTE_HOME
                        navController.navigate(target) {
                            popUpTo(ROUTE_LOGIN) { inclusive = true }
                        }
                    }
                },
                onChangeServer = {
                    scope.launch {
                        viewModel.forgetServer()
                        navController.navigate(ROUTE_WIZARD) {
                            popUpTo(ROUTE_LOGIN) { inclusive = true }
                        }
                    }
                },
            )
        }
        composable(ROUTE_HOME) {
            MainScreen(
                viewModel = viewModel,
                onOpenTitle = { type, tmdbId ->
                    navController.navigate(detailRoute(type, tmdbId))
                },
                onOpenEpisode = { tmdbId, season, episode ->
                    navController.navigate(detailRoute("series", tmdbId, season, episode))
                },
                onSeeAllRow = { mediaType, key, label ->
                    navController.navigate(rowDetailRoute("row", mediaType, key, label))
                },
                onOpenGenre = { mediaType, genreId, label ->
                    navController.navigate(rowDetailRoute("genre", mediaType, genreId, label))
                },
                onLoggedOut = {
                    navController.navigate(ROUTE_LOGIN) {
                        popUpTo(ROUTE_HOME) { inclusive = true }
                    }
                },
                tab = tab,
                onSelectTab = { newTab -> tab = newTab; searchOpen = false; headerHasScrolled = false },
                searchOpen = searchOpen,
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                onSearchCancel = { searchOpen = false; searchQuery = "" },
                contentFocusRequester = contentFocusRequester,
                navRailFocusRequester = navRailFocusRequester,
                onHomeScrollChanged = { headerHasScrolled = it },
                onSwitchProfile = { navController.navigate(ROUTE_PROFILES) { popUpTo(ROUTE_HOME) } },
                onOpenSearch = { searchOpen = true },
                updateTag = viewModel.availableUpdateTag.collectAsState().value,
                onUpdateClick = { viewModel.requestUpdateInstall() },
            )
        }
        composable(ROUTE_DOWNLOADS) {
            com.movviz.nx.mobile.ui.downloads.DownloadsScreen(
                viewModel = viewModel,
                onBack = { navController.popBackStack() },
                onOpenTitle = { type, tmdbId -> navController.navigate(detailRoute(type, tmdbId)) },
            )
        }
        composable(
            route = ROUTE_DETAIL,
            arguments = listOf(
                navArgument("type") { type = NavType.StringType },
                navArgument("tmdbId") { type = NavType.IntType },
                navArgument("season") { type = NavType.IntType; defaultValue = -1 },
                navArgument("episode") { type = NavType.IntType; defaultValue = -1 },
            ),
            deepLinks = listOf(
                // movviz://title/movie/27205 (carte dashboard TvProvider) →
                // fiche détail. La fiche série rouvre elle-même le bon
                // épisode en cours via le on-deck.
                navDeepLink { uriPattern = "movviz://title/{type}/{tmdbId}" },
            ),
        ) { backStackEntry ->
            val context = androidx.compose.ui.platform.LocalContext.current
            val type = backStackEntry.arguments?.getString("type") ?: "movie"
            val tmdbId = backStackEntry.arguments?.getInt("tmdbId") ?: 0
            val season = backStackEntry.arguments?.getInt("season")?.takeIf { it >= 0 }
            val episode = backStackEntry.arguments?.getInt("episode")?.takeIf { it >= 0 }
            val baseUrl by viewModel.serverUrl.collectAsState()
            // HAUT depuis la fiche titre : même symétrie que MainScreen —
            // monter d'abord À L'INTÉRIEUR de la fiche (CTA → logo/backdrop,
            // épisodes → saison), puis l'onglet actif de la NavRail. Sans
            // ceci, la fiche (hors MainScreen) n'avait AUCUN chemin vers la
            // barre : le focus restait piégé dans le contenu.
            DetailUpToNavHandler(navRailFocusRequester = navRailFocusRequester) {
                RailFrame {
                TitleDetailScreen(
                viewModel = viewModel,
                type = type,
                tmdbId = tmdbId,
                initialSeasonNumber = season,
                initialEpisodeNumber = episode,
                onPlay = { title, queue, startIndex, posterPath ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, posterPath = posterPath, profileId = viewModel.currentUser.value?.id),
                    )
                },
                onPlayFromStart = { title, queue, startIndex, posterPath ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, startFromBeginning = true, posterPath = posterPath, profileId = viewModel.currentUser.value?.id),
                    )
                },
                // Rangée "Titres similaires" — pousse une nouvelle fiche sur
                // la pile de nav (même écran, nouveau tmdbId), exactement
                // comme un clic sur une carte de l'accueil.
                onOpenTitle = { newType, newTmdbId ->
                    navController.navigate(detailRoute(newType, newTmdbId))
                },
                // Distribution → fiche acteur avec sa filmographie complète.
                onOpenPerson = { personId ->
                    navController.navigate(personRoute(personId))
                },
                entryFocusRequester = contentFocusRequester,
                onBack = { navController.popBackStack() },
                )
                }
            }
        }
        composable(
            route = ROUTE_PERSON,
            arguments = listOf(navArgument("id") { type = NavType.IntType }),
        ) { backStackEntry ->
            val personId = backStackEntry.arguments?.getInt("id") ?: 0
            // Même symétrie HAUT que la fiche titre (voir DetailUpToNavHandler).
            DetailUpToNavHandler(navRailFocusRequester = navRailFocusRequester) {
                RailFrame {
                PersonScreen(
                    viewModel = viewModel,
                    personId = personId,
                    onOpenTitle = { newType, newTmdbId ->
                        navController.navigate(detailRoute(newType, newTmdbId))
                    },
                    entryFocusRequester = contentFocusRequester,
                    onBack = { navController.popBackStack() },
                )
                }
            }
        }
        composable(
            route = ROUTE_ROW,
            arguments = listOf(
                navArgument("mode") { type = NavType.StringType },
                navArgument("mediaType") { type = NavType.StringType },
                navArgument("key") { type = NavType.StringType },
                navArgument("label") { type = NavType.StringType; defaultValue = "" },
            ),
        ) { backStackEntry ->
            val mode = backStackEntry.arguments?.getString("mode") ?: "row"
            val mediaType = backStackEntry.arguments?.getString("mediaType") ?: "movie"
            // Navigation Compose décode déjà l'argument extrait de la route —
            // un second Uri.decode() est un no-op inoffensif s'il n'y a plus
            // rien à décoder, et une garantie si jamais ce n'était pas déjà
            // fait (voir le commentaire sur rowDetailRoute()).
            val key = android.net.Uri.decode(backStackEntry.arguments?.getString("key") ?: "")
            val label = android.net.Uri.decode(backStackEntry.arguments?.getString("label") ?: "")
            // Même symétrie HAUT que la fiche titre/acteur (voir DetailUpToNavHandler).
            DetailUpToNavHandler(navRailFocusRequester = navRailFocusRequester) {
                RailFrame {
                RowDetailScreen(
                    viewModel = viewModel,
                    mode = mode,
                    mediaType = mediaType,
                    rowKey = key,
                    label = label,
                    onOpenTitle = { newType, newTmdbId ->
                        navController.navigate(detailRoute(newType, newTmdbId))
                    },
                    entryFocusRequester = contentFocusRequester,
                    onBack = { navController.popBackStack() },
                )
                }
            }
        }
        }
            }
        }
        }
        // Le téléphone ne réutilise pas une barre TV réduite : sur portrait,
        // l'accès principal est une capsule basse tactile. En paysage, cette
        // branche n'existe pas et NxTopNav reste intacte.
        if (compactPortrait && currentRoute?.startsWith("home") == true) {
            PortraitBottomNav(
                selected = tab,
                onSelect = { newTab -> tab = newTab; searchOpen = false; headerHasScrolled = false },
                modifier = Modifier.align(Alignment.BottomCenter).zIndex(10f),
            )
        }
        AutoUpdateOverlay(viewModel)
    }
}

/**
 * Barre basse portrait — exactement Accueil/Découverte/Bibliothèque/
 * Téléchargements (esquisse mobile section 4/15, esquisse 01) : icône +
 * libellé TOUJOURS visibles pour les 4 onglets (nav bar classique). La
 * pastille mise à jour ne vit plus ici : elle est dans l'en-tête, à gauche
 * de l'avatar (voir PortraitUpdateButton).
 */
@Composable
private fun PortraitBottomNav(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    // "Téléchargements" (15 lettres) reçoit plus de poids : à poids égal il
    // tronquait en "Téléchargeme…" dès 360dp (constaté sur capture).
    data class Item(val tab: HomeTab, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val weight: Float = 1f)
    val items = listOf(
        Item(HomeTab.HOME, "Accueil", MovvizIconHome),
        Item(HomeTab.DISCOVER, "Découverte", com.movviz.nx.mobile.ui.theme.MovvizIconCompass),
        Item(HomeTab.LIBRARY, "Bibliothèque", com.movviz.nx.mobile.ui.theme.MovvizIconBookmark),
        Item(HomeTab.DOWNLOADS, "Téléchargements", MovvizIconDownload, weight = 1.3f),
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 16.dp, end = 16.dp, bottom = 12.dp)
            .shadow(14.dp, RoundedCornerShape(24.dp), clip = false)
            // Dock teinté violet-nuit (MovvizSurfaceStrong), pas un gris
            // neutre : cohérent avec le fond général de l'app et la charte
            // mobile (esquisse fournie 2026-09).
            .background(MovvizSurfaceStrong.copy(alpha = .96f), RoundedCornerShape(24.dp))
            .border(1.dp, MovvizBrand.copy(alpha = .22f), RoundedCornerShape(24.dp))
            .padding(horizontal = 6.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        items.forEach { item ->
            val active = selected == item.tab
            Surface(
                onClick = { onSelect(item.tab) },
                modifier = Modifier
                    .weight(item.weight)
                    .height(60.dp)
                    .tvPointerClick { onSelect(item.tab) },
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(16.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = Color.Transparent,
                    focusedContainerColor = Color.White.copy(alpha = .10f),
                    contentColor = Color.White,
                    focusedContentColor = Color.White,
                ),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .then(
                            if (active) {
                                Modifier.background(
                                    Brush.linearGradient(listOf(MovvizBrand.copy(alpha = .85f), MovvizBrand2.copy(alpha = .85f))),
                                    RoundedCornerShape(16.dp),
                                )
                            } else {
                                Modifier
                            },
                        ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        item.icon,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = if (active) Color.White else Color(0xFFC3C3CB),
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        item.label,
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = if (active) Color.White else Color(0xFFC3C3CB),
                    )
                }
            }
        }
    }
}

/** Conteneur des écrans HORS MainScreen (fiche titre, fiche acteur) avec la
 *  même symétrie D-pad HAUT : monter d'abord À L'INTÉRIEUR du contenu
 *  (moveFocus respecte toute la hiérarchie composée), puis basculer sur
 *  l'onglet actif de la NavRail quand plus rien ne se trouve au-dessus.
 *  Sans ceci, ces écrans n'avaient AUCUN chemin vers la barre de nav — le
 *  focus restait piégé dans le contenu (constaté en direct : « on ne peut
 *  pas remonter au menu depuis une fiche »). */
@Composable
private fun DetailUpToNavHandler(
    navRailFocusRequester: FocusRequester,
    content: @Composable () -> Unit,
) {
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    Box(
        modifier = Modifier.fillMaxSize()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionUp) {
                    val movedInside = focusManager.moveFocus(FocusDirection.Up)
                    if (movedInside) true
                    else runCatching { navRailFocusRequester.requestFocus() }.isSuccess
                } else false
            },
    ) {
        content()
    }
}
