package com.movviz.tv.ui.update

import android.os.Build
import android.os.SystemClock
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.focusable
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.BuildConfig
import com.movviz.tv.data.UpdateInfo
import com.movviz.tv.data.UpdateManager
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

private const val STARTUP_AUTO_UPDATE_WINDOW_MS = 3_000L
private const val BACKGROUND_UPDATE_CHECK_MS = 30L * 60L * 1_000L

/** États de l'auto-update, du check GitHub jusqu'à l'installation. */
sealed interface UpdateUiState {
    data object Hidden : UpdateUiState
    data object NeedPermission : UpdateUiState
    data class Downloading(val progress: Float) : UpdateUiState
    data class Installing(val progress: Float?) : UpdateUiState

    /** Le commit PackageInstaller n'a pas abouti (refusé en silence par
     *  certains Google TV) : l'APK est prêt, on propose l'installeur
     *  système via le bouton « Installer » (voir onRetryInstall). */
    data object FallbackInstall : UpdateUiState
}

/**
 * Overlay plein écran « Mise à jour, veuillez patienter… » — affiché au
 * lancement (BuildConfig.AUTO_UPDATE) quand une nouvelle release existe sur
 * GitHub. Le flux complet vit ici : check de version, téléchargement avec
 * progression, vérification SHA-256, installeur système.
 */
@Composable
fun AutoUpdateOverlay(viewModel: AppViewModel? = null) {
    val context = LocalContext.current
    val updateManager = remember { UpdateManager(context.applicationContext) }
    var state by remember { mutableStateOf<UpdateUiState>(UpdateUiState.Hidden) }
    var target by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<UpdateInfo?>(null) }
    var dismissed by remember { mutableStateOf(false) }

    /** APK téléchargé et vérifié — conservé pour le repli installeur
     *  système quand le commit PackageInstaller est ignoré. */
    var downloadedFile by remember { mutableStateOf<File?>(null) }
    val scope = rememberCoroutineScope()
    val startupStartedAt = remember { SystemClock.elapsedRealtime() }

    suspend fun start(info: UpdateInfo) {
        target = info.tag
        if (!updateManager.canInstallUnknown()) {
            // L'utilisateur doit d'abord autoriser les sources inconnues —
            // l'observateur ON_RESUME relance le flux à son retour des
            // réglages système.
            state = UpdateUiState.NeedPermission
            return
        }
        try {
            state = UpdateUiState.Downloading(0f)
            val file = updateManager.download(info) { progress ->
                state = UpdateUiState.Downloading(progress)
            }
            // Installation en arrière-plan (PackageInstaller) : l'app reste
            // affichée avec la barre de progression. Le commit tue le process
            // à la fin — le receiver MY_PACKAGE_REPLACED relance alors
            // MainActivity automatiquement (reboot façon Netflix).
            state = UpdateUiState.Installing(null)
            updateManager.installInBackground(file) { progress ->
                state = UpdateUiState.Installing(progress)
            }
            // Échec silencieux possible (commit sans erreur mais installation
            // refusée) : si le process est encore là après 30 s, on passe au
            // repli installeur système au lieu de revenir sans rien (l'APK
            // déjà téléchargé permet un « Installer » en un clic). En cas de
            // succès le process est déjà mort, ce délai n'est jamais atteint.
            downloadedFile = file
            kotlinx.coroutines.delay(30_000L)
            state = UpdateUiState.FallbackInstall
        } catch (e: Exception) {
            // Réseau, HTTP, SHA-256… l'appli démarre normalement, on ne
            // bloque jamais l'utilisation sur un souci de mise à jour. Le log
            // manquait ici avant ce correctif — un échec de download() ou
            // d'installInBackground() se refermait sans aucune trace.
            android.util.Log.w("MovvizUpdate", "cycle de mise à jour interrompu", e)
            // L'APK est déjà complet : proposer l'installeur système reste
            // plus utile qu'un retour silencieux à l'écran d'accueil.
            state = if (downloadedFile != null) UpdateUiState.FallbackInstall else UpdateUiState.Hidden
        }
    }

    // Reprise automatique quand l'utilisateur revient des réglages
    // d'installation de sources inconnues.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val info = pending
                if (info != null && state == UpdateUiState.NeedPermission && updateManager.canInstallUnknown()) {
                    pending = null
                    scope.launch { start(info) }
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Check GitHub au lancement. L'installation AUTOMATIQUE n'est autorisée
    // que dans une fenêtre très courte de démarrage et tant que MainActivity
    // est réellement RESUMED. Si le réseau répond trop tard ou si un film a
    // déjà ouvert PlayerActivity, on mémorise seulement la disponibilité :
    // la flèche clignotante de la sidebar laisse alors l'utilisateur décider.
    val autoUpdate by (viewModel?.autoUpdateEnabled?.collectAsState() ?: remember { mutableStateOf(BuildConfig.AUTO_UPDATE) })
    LaunchedEffect(Unit) {
        if (!autoUpdate || dismissed) return@LaunchedEffect
        delay(250)
        val info = updateManager.checkForUpdate()
        if (info == null) {
            viewModel?.setAvailableUpdateTag(null)
            return@LaunchedEffect
        }
        pending = info
        viewModel?.setAvailableUpdateTag(info.tag)
        val stillStartup = SystemClock.elapsedRealtime() - startupStartedAt <= STARTUP_AUTO_UPDATE_WINDOW_MS
        val foreground = lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        if (stillStartup && foreground) start(info)
    }

    // Une session TV peut rester ouverte des heures. On peut découvrir une
    // nouvelle release sans jamais l'installer en douce : toutes les 30 min,
    // simple check réseau → indicateur sidebar, rien de plus.
    LaunchedEffect(autoUpdate) {
        if (!autoUpdate) return@LaunchedEffect
        delay(BACKGROUND_UPDATE_CHECK_MS)
        while (true) {
            if (state == UpdateUiState.Hidden) {
                val info = updateManager.checkForUpdate()
                viewModel?.setAvailableUpdateTag(info?.tag)
            }
            delay(BACKGROUND_UPDATE_CHECK_MS)
        }
    }

    // Vérification manuelle (bouton Paramètres → À propos) — le check
    // automatique ne se déclenche qu'une fois au lancement, sans lui aucun
    // moyen de relancer/diagnostiquer un souci de mise à jour sans
    // redémarrer l'appli entière. Ignore le "Plus tard" précédent
    // (dismissed) puisque l'utilisateur redemande explicitement.
    val manualTrigger = viewModel?.updateCheckTrigger?.collectAsState()?.value
    LaunchedEffect(manualTrigger) {
        if (manualTrigger == null || manualTrigger == 0) return@LaunchedEffect
        if (!autoUpdate) {
            viewModel.setUpdateCheckStatus("Mise à jour automatique désactivée sur cette build")
            return@LaunchedEffect
        }
        dismissed = false
        viewModel.setUpdateCheckStatus("Vérification…")
        val info = updateManager.checkForUpdate()
        if (info == null) {
            viewModel.setAvailableUpdateTag(null)
            viewModel.setUpdateCheckStatus("Movviz est à jour (${BuildConfig.VERSION_NAME})")
            return@LaunchedEffect
        }
        viewModel.setAvailableUpdateTag(info.tag)
        viewModel.setUpdateCheckStatus("Mise à jour ${info.tag.removePrefix("v")} disponible")
        pending = info
        // Vérifier depuis Paramètres ne lance plus une installation en plein
        // usage. L'installation part uniquement depuis la flèche de sidebar.
    }

    val installTrigger = viewModel?.updateInstallTrigger?.collectAsState()?.value
    LaunchedEffect(installTrigger) {
        if (installTrigger == null || installTrigger == 0) return@LaunchedEffect
        val info = pending ?: updateManager.checkForUpdate()
        if (info == null) {
            viewModel.setAvailableUpdateTag(null)
            viewModel.setUpdateCheckStatus("Movviz est à jour (${BuildConfig.VERSION_NAME})")
            return@LaunchedEffect
        }
        pending = info
        viewModel.setAvailableUpdateTag(info.tag)
        start(info)
    }

    if (state != UpdateUiState.Hidden) {
        UpdateOverlay(
            state = state,
            targetVersion = target,
            onAuthorize = { updateManager.openInstallPermissionSettings() },
            onRetryInstall = {
                downloadedFile?.let { updateManager.installViaSystemInstaller(it) }
            },
            onLater = {
                dismissed = true
                state = UpdateUiState.Hidden
            },
        )
    }
}

/** Affichage pur de l'overlay — ne contient aucune logique d'update. */
@Composable
fun UpdateOverlay(
    state: UpdateUiState,
    targetVersion: String,
    onAuthorize: () -> Unit,
    onRetryInstall: () -> Unit,
    onLater: () -> Unit,
) {
    // L'overlay est peint PAR-DESSUS le menu/la fiche en cours, mais rien ne
    // réclamait le focus D-pad avant ce correctif : la télécommande
    // continuait de piloter la NavRail ou l'écran caché EN DESSOUS (visible
    // à l'écran, invisible en réalité, recouvert par ce Box) — d'où
    // "Autoriser" injoignable, et des flèche-bas + OK qui finissaient sur un
    // élément caché de l'écran d'accueil (parfois de quoi fermer l'appli).
    // Le Box racine est rendu focusable en repli général (state == Hidden ne
    // rend rien, donc jamais atteint ici), et le bouton "Autoriser" reçoit
    // le focus en priorité dès qu'il apparaît.
    val rootFocusRequester = remember { FocusRequester() }
    val authorizeFocusRequester = remember { FocusRequester() }
    val retryFocusRequester = remember { FocusRequester() }
    LaunchedEffect(state) {
        if (state is UpdateUiState.NeedPermission) {
            runCatching { authorizeFocusRequester.requestFocus() }
        } else if (state is UpdateUiState.FallbackInstall) {
            runCatching { retryFocusRequester.requestFocus() }
        } else {
            runCatching { rootFocusRequester.requestFocus() }
        }
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MovvizBackground)
            .focusRequester(rootFocusRequester)
            .focusable(),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Mise à jour, veuillez patienter…",
                style = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White),
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "Nouvelle version : $targetVersion",
                style = TextStyle(fontSize = 15.sp, color = Color.White.copy(alpha = 0.7f)),
            )
            Spacer(Modifier.height(32.dp))
            when (state) {
                is UpdateUiState.Downloading -> {
                    ProgressBar(state.progress)
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "${(state.progress * 100).toInt()}%",
                        style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f)),
                    )
                }
                is UpdateUiState.Installing -> {
                    val progress = state.progress
                    if (progress != null) {
                        ProgressBar(progress)
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = "Installation… ${(progress * 100).toInt()}%",
                            style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f)),
                        )
                    } else {
                        IndeterminateBar()
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = "Installation…",
                            style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f)),
                        )
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "L'application va redémarrer automatiquement",
                        style = TextStyle(fontSize = 13.sp, color = Color.White.copy(alpha = 0.6f)),
                    )
                }
                UpdateUiState.NeedPermission -> {
                    Text(
                        text = "Autorise l'installation d'applications inconnues pour pouvoir mettre à jour Movviz",
                        style = TextStyle(fontSize = 16.sp, color = Color.White.copy(alpha = 0.85f)),
                        modifier = Modifier.padding(horizontal = 64.dp),
                    )
                    Spacer(Modifier.height(24.dp))
                    Row {
                        ActionButton(text = "Autoriser", onClick = onAuthorize, focusRequester = authorizeFocusRequester)
                        Spacer(Modifier.width(20.dp))
                        ActionButton(text = "Plus tard", onClick = onLater)
                    }
                }
                UpdateUiState.FallbackInstall -> {
                    Text(
                        text = "L'installation automatique n'a pas abouti sur cet appareil",
                        style = TextStyle(fontSize = 16.sp, color = Color.White.copy(alpha = 0.85f)),
                        modifier = Modifier.padding(horizontal = 64.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "L'APK est téléchargé et vérifié : ouvre l'installeur système pour terminer.",
                        style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.6f)),
                        modifier = Modifier.padding(horizontal = 64.dp),
                    )
                    Spacer(Modifier.height(24.dp))
                    Row {
                        ActionButton(text = "Installer", onClick = onRetryInstall, focusRequester = retryFocusRequester)
                        Spacer(Modifier.width(20.dp))
                        ActionButton(text = "Plus tard", onClick = onLater)
                    }
                }
                UpdateUiState.Hidden -> Unit
            }
        }
    }
}

/** Barre de progression déterminée — dessinée à la main (pas de dépendance
 *  material3 non incluse dans le projet) : fond translucide + remplissage
 *  dégradé de marque. */
@Composable
private fun ProgressBar(fraction: Float) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier = Modifier
            .fillMaxWidth(0.7f)
            .height(10.dp)
            .background(Color.White.copy(alpha = 0.15f), shape),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .height(10.dp)
                .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), shape),
        )
    }
}

/** Barre indéterminée (installation système en cours). */
@Composable
private fun IndeterminateBar() {
    val transition = rememberInfiniteTransition(label = "update")
    val fraction by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Reverse),
        label = "updateFraction",
    )
    ProgressBar(fraction)
}

/** Bouton d'action TV — même traitement que GradientButton (wizard) :
 *  focus-first, lift, dégradé de marque, clic télécommande ET pointeur. */
@Composable
private fun ActionButton(text: String, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .tvFocusLift(focused, shape = shape)
            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.Transparent,
            pressedContainerColor = Color.Transparent,
            contentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = BorderStroke(2.dp, Color.White),
                shape = shape,
            ),
        ),
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 32.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = text, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold))
        }
    }
}
