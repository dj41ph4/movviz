package com.movviz.tv

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.movviz.tv.ui.home.MainScreen
import com.movviz.tv.ui.login.LoginScreen
import com.movviz.tv.ui.profile.ProfilePickerScreen
import com.movviz.tv.ui.player.PlayerActivity
import com.movviz.tv.ui.player.QueueItem
import com.movviz.tv.ui.theme.MovvizTvTheme
import com.movviz.tv.ui.title.TitleDetailScreen
import com.movviz.tv.ui.update.AutoUpdateOverlay
import com.movviz.tv.ui.wizard.WizardScreen
import kotlinx.coroutines.launch

private const val ROUTE_WIZARD = "wizard"
private const val ROUTE_LOGIN = "login"
private const val ROUTE_PROFILES = "profiles"
private const val ROUTE_HOME = "home"
private const val ROUTE_DETAIL = "detail/{type}/{tmdbId}"

/** Login ouvert en mode « ajouter un utilisateur au foyer » : après la
 *  connexion, le compte rejoint le foyer (ou est détecté déjà présent)
 *  et on revient sur l'écran profil au lieu d'aller à l'accueil. */
private const val ROUTE_LOGIN_ADD = "login?add=true"

fun detailRoute(type: String, tmdbId: Int) = "detail/$type/$tmdbId"

class MainActivity : ComponentActivity() {
    private val appViewModel: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MovvizTvTheme {
                MovvizNavHost(appViewModel)
            }
        }
    }
}

@Composable
private fun MovvizNavHost(viewModel: AppViewModel) {
    val navController = rememberNavController()
    val scope = androidx.compose.runtime.rememberCoroutineScope()

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

    // L'overlay d'auto-update (variante AU uniquement, jamais en retail) se
    // pose PAR-DESSUS la navigation : il bloque l'interaction pendant le
    // téléchargement/installation, et disparaît en cas de souci.
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
                onLoggedOut = {
                    navController.navigate(ROUTE_LOGIN) {
                        popUpTo(ROUTE_HOME) { inclusive = true }
                    }
                },
                onProfileSelected = { profile ->
                    scope.launch {
                        if (viewModel.selectProfile(profile) is com.movviz.tv.data.ApiResult.Success) {
                            navController.navigate(ROUTE_HOME) {
                                popUpTo(ROUTE_HOME) { inclusive = true }
                            }
                        }
                    }
                },
                onAddProfile = { navController.navigate(ROUTE_LOGIN_ADD) },
                onSwitchProfile = {
                    // "Mon profil" / "Changer d'utilisateur" : l'écran profil
                    // — profil actif en tête, membres du foyer, et tuile « + »
                    // qui mène au login pour ajouter un utilisateur. Jamais le
                    // login directement.
                    navController.navigate(ROUTE_PROFILES) {
                        popUpTo(ROUTE_HOME)
                    }
                },
            )
        }
        composable(
            route = ROUTE_DETAIL,
            arguments = listOf(
                navArgument("type") { type = NavType.StringType },
                navArgument("tmdbId") { type = NavType.IntType },
            ),
        ) { backStackEntry ->
            val context = androidx.compose.ui.platform.LocalContext.current
            val type = backStackEntry.arguments?.getString("type") ?: "movie"
            val tmdbId = backStackEntry.arguments?.getInt("tmdbId") ?: 0
            val baseUrl by viewModel.serverUrl.collectAsState()
            TitleDetailScreen(
                viewModel = viewModel,
                type = type,
                tmdbId = tmdbId,
                onPlay = { title, queue, startIndex ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex),
                    )
                },
                onPlayFromStart = { title, queue, startIndex ->
                    val url = baseUrl ?: return@TitleDetailScreen
                    context.startActivity(
                        PlayerActivity.forQueue(context, url, type, tmdbId, title, queue, startIndex, startFromBeginning = true),
                    )
                },
                // Rangée "Titres similaires" — pousse une nouvelle fiche sur
                // la pile de nav (même écran, nouveau tmdbId), exactement
                // comme un clic sur une carte de l'accueil.
                onOpenTitle = { newType, newTmdbId ->
                    navController.navigate(detailRoute(newType, newTmdbId))
                },
            )
        }
        }
        AutoUpdateOverlay()
    }
}
