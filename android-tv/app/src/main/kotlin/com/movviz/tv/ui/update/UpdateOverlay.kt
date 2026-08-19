package com.movviz.tv.ui.update

import android.os.Build
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.movviz.tv.BuildConfig
import com.movviz.tv.data.UpdateInfo
import com.movviz.tv.data.UpdateManager
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.launch

/** États de l'auto-update, du check GitHub jusqu'à l'installation. */
sealed interface UpdateUiState {
    data object Hidden : UpdateUiState
    data object NeedPermission : UpdateUiState
    data class Downloading(val progress: Float) : UpdateUiState
    data object Installing : UpdateUiState
}

/**
 * Overlay plein écran « Mise à jour, veuillez patienter… » — affiché au
 * lancement de la variante AU (BuildConfig.AUTO_UPDATE) quand une nouvelle
 * release existe sur GitHub. Le flux complet vit ici : check de version,
 * téléchargement avec progression, vérification SHA-256, installeur système.
 * Jamais affiché dans la variante retail.
 */
@Composable
fun AutoUpdateOverlay() {
    val context = LocalContext.current
    val updateManager = remember { UpdateManager(context.applicationContext) }
    var state by remember { mutableStateOf<UpdateUiState>(UpdateUiState.Hidden) }
    var target by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<UpdateInfo?>(null) }
    var dismissed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

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
            state = UpdateUiState.Installing
            updateManager.launchInstaller(file)
            // L'installeur système recouvre l'appli ; au retour (installation
            // terminée ou annulée) on revient proprement à l'écran d'accueil.
            state = UpdateUiState.Hidden
        } catch (e: Exception) {
            // Réseau, HTTP, SHA-256… l'appli démarre normalement, on ne
            // bloque jamais l'utilisation sur un souci de mise à jour.
            state = UpdateUiState.Hidden
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

    // Check GitHub au lancement — une seule fois par démarrage de l'appli.
    LaunchedEffect(Unit) {
        if (!BuildConfig.AUTO_UPDATE || dismissed) return@LaunchedEffect
        val info = updateManager.checkForUpdate() ?: return@LaunchedEffect
        pending = info
        start(info)
    }

    if (state != UpdateUiState.Hidden) {
        UpdateOverlay(
            state = state,
            targetVersion = target,
            onAuthorize = { updateManager.openInstallPermissionSettings() },
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
    onLater: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MovvizBackground),
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
                UpdateUiState.Installing -> {
                    IndeterminateBar()
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = "Installation…",
                        style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f)),
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
                        ActionButton(text = "Autoriser", onClick = onAuthorize)
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
    val shape = RoundedCornerShape(5.dp)
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
private fun ActionButton(text: String, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .tvFocusLift(focused, shape = shape)
            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
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
