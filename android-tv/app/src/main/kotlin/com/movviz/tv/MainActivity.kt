package com.movviz.tv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.movviz.tv.ui.discover.RowDetailScreen
import com.movviz.tv.ui.home.HomeTab
import com.movviz.tv.ui.home.MainScreen
import com.movviz.tv.ui.home.NavRail
import com.movviz.tv.ui.login.LoginScreen
import com.movviz.tv.ui.person.PersonScreen
import com.movviz.tv.ui.profile.ProfilePickerScreen
import com.movviz.tv.ui.player.PlayerActivity
import com.movviz.tv.ui.player.QueueItem
import com.movviz.tv.ui.theme.MovvizTvTheme
import com.movviz.tv.ui.title.TitleDetailScreen
import com.movviz.tv.ui.update.AutoUpdateOverlay
import com.movviz.tv.ui.wizard.WizardScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val ROUTE_WIZARD = "wizard"
private const val ROUTE_LOGIN = "login"
private const val ROUTE_PROFILES = "profiles"
private const val ROUTE_HOME = "home"
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
    var tab by remember { mutableStateOf(HomeTab.HOME) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    // Cible D-pad « premier élément réel du contenu affiché » — la NavRail
    // tente de viser ceci en premier pour que la flèche bas depuis N'IMPORTE
    // quel item de la barre y descende directement (au lieu de compter sur
    // la recherche spatiale par défaut de Compose, qui ne trouve jamais de
    // cible à travers deux frères superposés dans un Box — nav + contenu,
    // zIndex ne joue que sur le dessin). N'est attachée que si l'écran a
    // déjà un vrai premier élément (pas pendant le chargement, pas sur une
    // liste vide) : viser une cible non attachée plante Compose si ce n'est
    // pas protégé — d'où fallbackFocusRequester, une ancre TOUJOURS
    // attachée que la NavRail utilise en repli (jamais un simple
    // focusProperties déclaratif, qui ne laisse aucune chance d'intercepter
    // l'échec — voir le onKeyEvent + runCatching de NavRail).
    val contentFocusRequester = remember { FocusRequester() }
    val fallbackFocusRequester = remember { FocusRequester() }
    // Cible HAUT depuis le contenu : onglet sélectionné de la NavRail.
    val navRailFocusRequester = remember { FocusRequester() }
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route

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
        val user = viewModel.refreshCurrentUser()
        startDestination = when {
            user == null -> ROUTE_LOGIN
            user.role == "admin" && viewModel.loadProfilesFromServer().isNotEmpty() -> ROUTE_PROFILES
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
            modifier = Modifier.fillMaxSize().background(com.movviz.tv.ui.theme.MovvizBackground),
            contentAlignment = Alignment.Center,
        ) {
            com.movviz.tv.ui.theme.AnimatedLogo(size = 56.dp)
        }
        return
    }

    // La NavRail occupe une vraie colonne du layout. Le NavHost est rendu
    // dans son frère de droite : aucun écran (et surtout aucun backdrop du
    // hero) ne peut donc passer derrière la navigation.
    Box(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxSize()) {
            if (routeShowsNavRail(currentRoute)) {
                NavRail(
                    selected = tab,
                    onSelect = { newTab ->
                        if (currentRoute?.startsWith("home") != true) {
                            navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                        }
                        tab = newTab
                        searchOpen = false
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
                            if (viewModel.selectProfile(profile) is com.movviz.tv.data.ApiResult.Success) {
                                navController.navigate(ROUTE_HOME) { popUpTo(ROUTE_HOME) { inclusive = true } }
                            }
                        }
                    },
                    onAddProfile = { navController.navigate(ROUTE_LOGIN_ADD) },
                    onSwitchProfile = {
                        navController.navigate(ROUTE_PROFILES) { popUpTo(ROUTE_HOME) }
                    },
                    contentFocusRequester = contentFocusRequester,
                    fallbackFocusRequester = fallbackFocusRequester,
                    navRailFocusRequester = navRailFocusRequester,
                    // 224dp laisse une zone tactile/visuelle confortable aux
                    // libellés et au focus TV, tout en gardant le hero large.
                    modifier = Modifier.fillMaxHeight().width(224.dp),
                )
            }
            Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
        // Ancre de repli TOUJOURS composée, sur TOUTES les routes (accueil,
        // fiche titre, fiche acteur) — la NavRail y retombe quand sa cible
        // principale n'est pas encore composée. Anciennement dans
        // MainScreen : elle disparaissait sur fiche titre/acteur, laissant
        // la flèche bas morte pendant le chargement d'une fiche. Désormais
        // DESSINÉE quand elle prend le focus (petit point blanc) — une ancre
        // invisible donnait l'impression d'un écran gelé (« DOWN ne fait
        // rien », constaté en direct). HAUT depuis l'ancre remonte sur la
        // barre de nav ; BAS laisse la recherche géométrique trouver le
        // contenu en dessous.
        var fallbackFocused by remember { mutableStateOf(false) }
        val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
        Box(
            modifier = Modifier
                .padding(start = 3.dp, top = 3.dp)
                .size(6.dp)
                .focusRequester(fallbackFocusRequester)
                .focusable()
                .onFocusChanged { fallbackFocused = it.isFocused }
                .onPreviewKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    when (event.key) {
                        // L'ancre ne doit jamais être un cul-de-sac : elle
                        // sert uniquement pendant l'instant où l'écran réel
                        // n'est pas encore composé. Dès que l'utilisateur
                        // appuie de nouveau sur BAS, on retente explicitement
                        // la première cible visible du contenu. La version
                        // précédente annulait DOWN avec FocusRequester.Cancel,
                        // ce qui donnait exactement l'impression que le D-pad
                        // restait bloqué dans la NavRail après un UP.
                        Key.DirectionDown -> {
                            val movedToContent = runCatching {
                                contentFocusRequester.requestFocus()
                            }.isSuccess
                            if (movedToContent) true else focusManager.moveFocus(FocusDirection.Down)
                        }
                        Key.DirectionUp -> runCatching {
                            navRailFocusRequester.requestFocus()
                        }.isSuccess
                        else -> false
                    }
                }
                .background(
                    if (fallbackFocused) Color.White.copy(alpha = 0.85f) else Color.Transparent,
                    shape = androidx.compose.foundation.shape.CircleShape,
                ),
        )
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
                            is com.movviz.tv.data.ApiResult.Success -> navController.navigate(ROUTE_HOME) {
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
                        // Ajout au foyer : compte déjà présent → détecté, pas
                        // de doublon ; sinon ajout au foyer. Retour sur
                        // l'écran profil avec la notice correspondante.
                        scope.launch {
                            val user = viewModel.currentUser.value
                            if (user != null) {
                                val already = viewModel.profiles.value.any { it.id == user.id }
                                val ok = already || viewModel.addProfileToFoyer(user.id) is com.movviz.tv.data.ApiResult.Success
                                viewModel.setFoyerNotice(
                                    when {
                                        already -> "Ce compte est déjà dans le foyer"
                                        ok -> "« ${user.username} » a été ajouté au foyer"
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
                searchOpen = searchOpen,
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                contentFocusRequester = contentFocusRequester,
                fallbackFocusRequester = fallbackFocusRequester,
                navRailFocusRequester = navRailFocusRequester,
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
                TitleDetailScreen(
                viewModel = viewModel,
                type = type,
                tmdbId = tmdbId,
                initialSeasonNumber = season,
                initialEpisodeNumber = episode,
                onPlay = { title, queue, startIndex, posterPath ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, posterPath = posterPath),
                    )
                },
                onPlayFromStart = { title, queue, startIndex, posterPath ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, startFromBeginning = true, posterPath = posterPath),
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
            )
            }
        }
        composable(
            route = ROUTE_PERSON,
            arguments = listOf(navArgument("id") { type = NavType.IntType }),
        ) { backStackEntry ->
            val personId = backStackEntry.arguments?.getInt("id") ?: 0
            // Même symétrie HAUT que la fiche titre (voir DetailUpToNavHandler).
            DetailUpToNavHandler(navRailFocusRequester = navRailFocusRequester) {
                PersonScreen(
                    viewModel = viewModel,
                    personId = personId,
                    onOpenTitle = { newType, newTmdbId ->
                        navController.navigate(detailRoute(newType, newTmdbId))
                    },
                    entryFocusRequester = contentFocusRequester,
                )
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
                )
            }
        }
        }
            }
        }
        AutoUpdateOverlay(viewModel)
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
