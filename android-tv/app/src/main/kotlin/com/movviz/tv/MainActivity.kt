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
import com.movviz.tv.ui.player.PlayerActivity
import com.movviz.tv.ui.theme.MovvizTvTheme
import com.movviz.tv.ui.title.TitleDetailScreen
import com.movviz.tv.ui.wizard.WizardScreen
import kotlinx.coroutines.flow.first

private const val ROUTE_WIZARD = "wizard"
private const val ROUTE_LOGIN = "login"
private const val ROUTE_HOME = "home"
private const val ROUTE_DETAIL = "detail/{type}/{tmdbId}"

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

    // Décision de l'écran de départ, une seule fois au lancement : pas
    // d'URL connue → wizard ; URL connue mais cookie de session persisté
    // (voir PersistentCookieJar) expiré ou absent → login ; cookie encore
    // valide → accueil direct, sans re-demander les identifiants. Même
    // comportement que l'appli Plex/Netflix, qui ne redemandent jamais un
    // login tant que la session tient.
    var startDestination by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        val url = viewModel.serverUrl.first()
        startDestination = when {
            url == null -> ROUTE_WIZARD
            viewModel.hasValidSession() -> ROUTE_HOME
            else -> ROUTE_LOGIN
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

    NavHost(navController = navController, startDestination = resolvedStart) {
        composable(ROUTE_WIZARD) {
            WizardScreen(
                viewModel = viewModel,
                onConnected = {
                    navController.navigate(ROUTE_LOGIN) {
                        popUpTo(ROUTE_WIZARD) { inclusive = true }
                    }
                },
            )
        }
        composable(ROUTE_LOGIN) {
            LoginScreen(
                viewModel = viewModel,
                onLoggedIn = {
                    navController.navigate(ROUTE_HOME) {
                        popUpTo(ROUTE_LOGIN) { inclusive = true }
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
            TitleDetailScreen(
                viewModel = viewModel,
                type = type,
                tmdbId = tmdbId,
                onPlay = { streamUrl ->
                    val intent = Intent(context, PlayerActivity::class.java)
                        .putExtra(PlayerActivity.extraStreamUrl(), streamUrl)
                    context.startActivity(intent)
                },
            )
        }
    }
}
