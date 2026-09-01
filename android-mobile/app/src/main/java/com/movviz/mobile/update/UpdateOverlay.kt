package com.movviz.mobile.update

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.movviz.mobile.MobileViewModel
import com.movviz.mobile.ui.theme.MovvizBrand
import com.movviz.mobile.ui.theme.MovvizBrand2
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

/** États de l'auto-update, du check GitHub jusqu'à l'installation — mêmes
 *  quatre états que la version TV (UpdateOverlay.kt), affichage adapté au
 *  format tactile (feuille du bas plutôt qu'écran plein). */
private sealed interface UpdateUiState {
    data object Hidden : UpdateUiState
    data object NeedPermission : UpdateUiState
    data class Downloading(val progress: Float) : UpdateUiState
    data class Installing(val progress: Float?) : UpdateUiState
    data object FallbackInstall : UpdateUiState
}

/**
 * Feuille de mise à jour — même flux complet que la TV (check, téléchargement
 * avec progression, vérification SHA-256, PackageInstaller silencieux avec
 * repli installeur système), affiché en bottom sheet plutôt qu'en overlay
 * plein écran D-pad. Câblée sur MobileViewModel.autoUpdateEnabled/
 * updateCheckTrigger, mêmes StateFlow-relais que côté TV (AppViewModel).
 */
@Composable
fun AutoUpdateOverlay(vm: MobileViewModel) {
    val context = LocalContext.current
    val updateManager = remember { UpdateManager(context.applicationContext) }
    var state by remember { mutableStateOf<UpdateUiState>(UpdateUiState.Hidden) }
    var target by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<UpdateInfo?>(null) }
    var dismissed by remember { mutableStateOf(false) }
    var downloadedFile by remember { mutableStateOf<File?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun start(info: UpdateInfo) {
        target = info.tag
        if (!updateManager.canInstallUnknown()) {
            state = UpdateUiState.NeedPermission
            return
        }
        try {
            state = UpdateUiState.Downloading(0f)
            val file = updateManager.download(info) { progress -> state = UpdateUiState.Downloading(progress) }
            state = UpdateUiState.Installing(null)
            updateManager.installInBackground(file) { progress -> state = UpdateUiState.Installing(progress) }
            downloadedFile = file
            delay(30_000L)
            state = UpdateUiState.FallbackInstall
        } catch (e: Exception) {
            android.util.Log.w("MovvizUpdate", "cycle de mise à jour interrompu", e)
            state = if (downloadedFile != null) UpdateUiState.FallbackInstall else UpdateUiState.Hidden
        }
    }

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

    val autoUpdate by vm.autoUpdateEnabled.collectAsState()
    LaunchedEffect(Unit) {
        if (!autoUpdate || dismissed) return@LaunchedEffect
        delay(5_000)
        val info = updateManager.checkForUpdate() ?: return@LaunchedEffect
        pending = info
        start(info)
    }

    val manualTrigger by vm.updateCheckTrigger.collectAsState()
    LaunchedEffect(manualTrigger) {
        if (manualTrigger == 0) return@LaunchedEffect
        if (!autoUpdate) {
            vm.setUpdateCheckStatus("Mise à jour automatique désactivée sur cette build")
            return@LaunchedEffect
        }
        dismissed = false
        vm.setUpdateCheckStatus("Vérification…")
        val info = updateManager.checkForUpdate()
        if (info == null) {
            vm.setUpdateCheckStatus("Movviz est à jour (${com.movviz.mobile.BuildConfig.VERSION_NAME})")
            return@LaunchedEffect
        }
        vm.setUpdateCheckStatus(null)
        pending = info
        start(info)
    }

    if (state != UpdateUiState.Hidden) {
        UpdateSheet(
            state = state,
            targetVersion = target,
            onAuthorize = { updateManager.openInstallPermissionSettings() },
            onRetryInstall = { downloadedFile?.let { updateManager.installViaSystemInstaller(it) } },
            onLater = { dismissed = true; state = UpdateUiState.Hidden },
        )
    }
}

@Composable
private fun UpdateSheet(
    state: UpdateUiState,
    targetVersion: String,
    onAuthorize: () -> Unit,
    onRetryInstall: () -> Unit,
    onLater: () -> Unit,
) {
    // Pas de clic pour fermer pendant un téléchargement/installation actifs —
    // seuls NeedPermission/FallbackInstall (qui exposent "Plus tard") le
    // permettent, via leurs propres boutons.
    Box(Modifier.fillMaxSize().background(Color.Black.copy(0.6f)), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                .background(Color(0xFF12121E))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.width(40.dp).height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color.White.copy(0.15f)))
            Spacer(Modifier.height(18.dp))
            Text("Mise à jour Movviz", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(6.dp))
            Text("Nouvelle version : $targetVersion", color = Color.White.copy(0.65f), fontSize = 13.sp)
            Spacer(Modifier.height(22.dp))
            when (state) {
                is UpdateUiState.Downloading -> {
                    ProgressBar(state.progress)
                    Spacer(Modifier.height(10.dp))
                    Text("${(state.progress * 100).toInt()}%", color = Color.White.copy(0.8f), fontSize = 13.sp)
                }
                is UpdateUiState.Installing -> {
                    val progress = state.progress
                    if (progress != null) {
                        ProgressBar(progress)
                        Spacer(Modifier.height(10.dp))
                        Text("Installation… ${(progress * 100).toInt()}%", color = Color.White.copy(0.8f), fontSize = 13.sp)
                    } else {
                        IndeterminateBar()
                        Spacer(Modifier.height(10.dp))
                        Text("Installation…", color = Color.White.copy(0.8f), fontSize = 13.sp)
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("L'application va redémarrer automatiquement", color = Color.White.copy(0.55f), fontSize = 12.sp)
                }
                UpdateUiState.NeedPermission -> {
                    Text(
                        "Autorise l'installation d'applications inconnues pour pouvoir mettre à jour Movviz",
                        color = Color.White.copy(0.85f), fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(20.dp))
                    Row {
                        Button(onAuthorize, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = MovvizBrand)) { Text("Autoriser", fontWeight = FontWeight.Bold) }
                        Spacer(Modifier.width(14.dp))
                        OutlinedButton(onLater, shape = RoundedCornerShape(12.dp)) { Text("Plus tard", color = Color.White) }
                    }
                }
                UpdateUiState.FallbackInstall -> {
                    Text(
                        "L'installation automatique n'a pas abouti sur cet appareil",
                        color = Color.White.copy(0.85f), fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "L'APK est téléchargé et vérifié : ouvre l'installeur système pour terminer.",
                        color = Color.White.copy(0.6f), fontSize = 12.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    Spacer(Modifier.height(20.dp))
                    Row {
                        Button(onRetryInstall, shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = MovvizBrand)) { Text("Installer", fontWeight = FontWeight.Bold) }
                        Spacer(Modifier.width(14.dp))
                        OutlinedButton(onLater, shape = RoundedCornerShape(12.dp)) { Text("Plus tard", color = Color.White) }
                    }
                }
                UpdateUiState.Hidden -> Unit
            }
        }
    }
}

@Composable
private fun ProgressBar(fraction: Float) {
    val shape = RoundedCornerShape(50)
    Box(Modifier.fillMaxWidth().height(8.dp).background(Color.White.copy(0.15f), shape)) {
        Box(
            Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(8.dp)
                .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), shape),
        )
    }
}

@Composable
private fun IndeterminateBar() {
    val transition = rememberInfiniteTransition(label = "update")
    val fraction by transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Reverse),
        label = "updateFraction",
    )
    ProgressBar(fraction)
}
