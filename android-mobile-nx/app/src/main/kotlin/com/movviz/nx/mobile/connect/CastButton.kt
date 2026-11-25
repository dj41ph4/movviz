package com.movviz.nx.mobile.connect

import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Toast
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.foundation.Canvas
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizIconCast
import com.movviz.nx.mobile.ui.theme.MovvizIconClose
import com.movviz.nx.mobile.ui.theme.MovvizIconFilm
import com.movviz.nx.mobile.ui.theme.MovvizIconForward
import com.movviz.nx.mobile.ui.theme.MovvizIconGoogleCast
import com.movviz.nx.mobile.ui.theme.MovvizIconPause
import com.movviz.nx.mobile.ui.theme.MovvizIconPlay
import com.movviz.nx.mobile.ui.theme.MovvizIconRewind
import com.movviz.nx.mobile.ui.theme.MovvizIconTvScreen
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val SheetColor = Color(0xFF0B1230)

/**
 * Bouton « Lire sur… » de la fiche : toujours visible ; il ouvre la liste des
 * appareils du compte (TV, navigateur, écrans du réseau) — ou explique comment
 * en faire apparaître un — puis sert de télécommande.
 */
@Composable
fun CastButton(baseUrl: String?, payload: CastPayload?, containerColor: Color = Color.Black.copy(alpha = 0.35f)) {
    val context = LocalContext.current
    val devices by ConnectRemote.devices.collectAsState()
    val controlledId by ConnectRemote.controlledId.collectAsState()
    val localCast by LocalCast.device.collectAsState()
    var open by remember { mutableStateOf(false) }

    // Liste à jour : toutes les 8 s sur la fiche, toutes les 2 s panneau ouvert (télécommande vivante).
    LaunchedEffect(baseUrl) { baseUrl?.let { LocalCast.syncReceiverId(context, it) } }
    LaunchedEffect(baseUrl, open) {
        val url = baseUrl ?: return@LaunchedEffect
        while (true) {
            ConnectRemote.refresh(context, url)
            delay(if (open) 2_000L else 8_000L)
        }
    }
    // Toujours visible sur la fiche : sans appareil, le panneau explique comment en faire apparaître un.
    if (baseUrl == null) return

    val playing = localCast?.state?.active == true || devices.any { it.state?.active == true && (controlledId == null || it.id == controlledId) }
    val tint = if (playing) MovvizBrand2 else Color.White
    Box {
        Surface(
            onClick = { open = true },
            modifier = Modifier.size(40.dp).tvPointerClick { open = true },
            shape = ClickableSurfaceDefaults.shape(CircleShape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = containerColor,
                focusedContainerColor = Color.White.copy(alpha = 0.18f),
                contentColor = tint,
                focusedContentColor = tint,
            ),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(MovvizIconCast, contentDescription = "Lire sur un autre appareil", tint = tint, modifier = Modifier.size(19.dp))
            }
        }
        if (playing) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 7.dp, end = 7.dp)
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(MovvizBrand2),
            )
        }
    }
    if (open) CastSheet(baseUrl = baseUrl, payload = payload, onDismiss = { open = false })
}

/**
 * Panneau « Lire sur… » ouvert depuis le lecteur : [payload] porte la position
 * exacte de la lecture en cours (transfert au même instant). [onSent] est appelé
 * dès que l'écran choisi a accepté la lecture.
 */
@Composable
fun CastTransferSheet(baseUrl: String, payload: CastPayload, onDismiss: () -> Unit, onSent: (deviceName: String) -> Unit) {
    CastSheet(baseUrl = baseUrl, payload = payload, onDismiss = onDismiss, onSent = onSent)
}

@Composable
private fun CastSheet(baseUrl: String, payload: CastPayload?, onDismiss: () -> Unit, onSent: (deviceName: String) -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val serverDevices by ConnectRemote.devices.collectAsState()
    val localCast by LocalCast.device.collectAsState()
    val nearby by LocalCast.screens.collectAsState()
    val localDlna by LocalDlna.device.collectAsState()
    val nearbyDlna by LocalDlna.screens.collectAsState()
    val miracast = rememberWirelessDisplay()
    // Écrans du réseau du TÉLÉPHONE (Google Cast par le SDK officiel, DLNA par SSDP) : recherche seulement panneau ouvert.
    DisposableEffect(Unit) {
        LocalCast.startDiscovery(context)
        LocalDlna.startDiscovery(context)
        onDispose { LocalCast.stopDiscovery(); LocalDlna.stopDiscovery() }
    }
    // Le même écran vu par le serveur et par le téléphone : une seule ligne, celle pilotée d'ici.
    val locals = listOfNotNull(localCast, localDlna)
    val devices = locals + serverDevices.filter { d -> locals.none { it.name.equals(d.name, ignoreCase = true) } }
    val nearbyFree = if (payload == null) emptyList() else nearby.filter { s -> devices.none { it.name.equals(s.name, ignoreCase = true) } }
    // Un téléviseur à la fois Google Cast et DLNA : une seule ligne, la voie Cast (pilotage plus fiable).
    val dlnaFree = if (payload == null) emptyList() else nearbyDlna.filter { s ->
        devices.none { sameScreen(it.name, s.name) } && nearby.none { sameScreen(it.name, s.name) }
    }
    val job by CastProgress.job.collectAsState()
    val busyId = job?.screenId
    val stage = job?.stage
    val dlnaSearching by LocalDlna.searching.collectAsState()
    val castDlna: (DlnaScreen) -> Unit = { screen ->
        val p = payload
        if (p != null) {
            val started = CastProgress.start(context, screen.id, screen.name, "Préparation…", onSent) { setStage ->
                when (LocalDlna.castTo(baseUrl, screen, p, setStage)) {
                    LocalDlna.Result.OK -> true to "Lecture envoyée à ${screen.name}"
                    LocalDlna.Result.LOCAL_FILE_REQUIRED -> false to "Ce titre doit être dans les fichiers Movviz pour cet écran"
                    LocalDlna.Result.REFUSED -> false to "${screen.name} ne lit pas cette vidéo"
                    LocalDlna.Result.FAILED -> false to "Impossible de joindre le serveur Movviz"
                }
            }
            if (!started) busyToast(context, job)
        }
    }
    val castLocal: (String, String) -> Unit = { screenId, screenName ->
        val p = payload
        if (p != null) {
            val started = CastProgress.start(context, screenId, screenName, "Connexion à $screenName…", onSent) { setStage ->
                when (LocalCast.castTo(context, baseUrl, screenId, p, setStage)) {
                    LocalCast.Result.OK -> true to "Lecture envoyée à $screenName"
                    LocalCast.Result.LOCAL_FILE_REQUIRED -> false to "Ce titre doit être dans les fichiers Movviz pour cet écran"
                    LocalCast.Result.NO_SESSION -> false to "$screenName ne répond pas"
                    LocalCast.Result.FAILED -> false to "Impossible de lancer la lecture sur $screenName"
                }
            }
            if (!started) busyToast(context, job)
        }
    }
    // Appareils du compte à jour même ouvert depuis le lecteur (aucun bouton derrière pour rafraîchir).
    LaunchedEffect(baseUrl) {
        while (true) {
            ConnectRemote.refresh(context, baseUrl)
            delay(2_000L)
        }
    }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        shown = true
        while (true) {
            delay(500L)
            now = System.currentTimeMillis()
        }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
            contentAlignment = Alignment.BottomCenter,
        ) {
            AnimatedVisibility(
                visible = shown,
                enter = slideInVertically(animationSpec = tween(260)) { it } + fadeIn(tween(160)),
            ) {
                Column(
                    Modifier
                        .widthIn(max = 560.dp)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                        .background(SheetColor)
                        // Le panneau garde les touches pour lui (un tap à l'intérieur ne ferme pas).
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                        .navigationBarsPadding()
                        .padding(bottom = 12.dp),
                ) {
                    Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                        Box(Modifier.width(40.dp).height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)))
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 12.dp, bottom = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(MovvizIconCast, contentDescription = null, tint = MovvizBrand2, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = "Lire sur…",
                            style = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                            modifier = Modifier.weight(1f),
                        )
                        SheetIconButton(icon = MovvizIconClose, description = "Fermer", onClick = onDismiss)
                    }
                    Column(
                        Modifier.heightIn(max = minOf(460, (LocalConfiguration.current.screenHeightDp * 0.62f).toInt()).dp).verticalScroll(rememberScrollState()).padding(horizontal = 8.dp),
                    ) {
                        if (devices.isEmpty() && nearbyFree.isEmpty() && dlnaFree.isEmpty() && payload == null) {
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 8.dp)
                                    .clip(RoundedCornerShape(18.dp))
                                    .background(Color.White.copy(alpha = 0.04f))
                                    .padding(horizontal = 18.dp, vertical = 22.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Icon(MovvizIconTvScreen, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(28.dp))
                                Spacer(Modifier.height(10.dp))
                                Text("Aucun appareil disponible", style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk))
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Ouvrez Movviz sur votre TV (Android TV ou Samsung) avec ce même compte, ou activez « Recevoir sur cet appareil » dans un navigateur. Les Chromecast et téléviseurs DLNA du réseau du serveur apparaissent aussi ici.",
                                    style = TextStyle(fontSize = 12.5.sp, color = MovvizInkSoft, textAlign = androidx.compose.ui.text.style.TextAlign.Center),
                                )
                            }
                        }
                        devices.forEach { device -> key(device.id) {
                            DeviceRow(
                                device = device,
                                now = now,
                                busy = busyId == device.id || (busyId != null && busyName(busyId, nearby, nearbyDlna).equals(device.name, ignoreCase = true)),
                                stage = stage.takeIf { busyId == device.id || (busyId != null && busyName(busyId, nearby, nearbyDlna).equals(device.name, ignoreCase = true)) },
                                canCast = payload != null,
                                onCast = {
                                    if (device.id == LocalCast.DEVICE_ID) {
                                        val screen = nearby.firstOrNull { it.name.equals(device.name, ignoreCase = true) }
                                        if (screen != null) castLocal(screen.id, device.name)
                                        return@DeviceRow
                                    }
                                    if (device.id == LocalDlna.DEVICE_ID) {
                                        nearbyDlna.firstOrNull { it.name.equals(device.name, ignoreCase = true) }?.let(castDlna)
                                        return@DeviceRow
                                    }
                                    val p = payload ?: return@DeviceRow
                                    val started = CastProgress.start(context, device.id, device.name, "Envoi à ${device.name}…", onSent) {
                                        val ok = ConnectRemote.play(context, baseUrl, device, p)
                                        ok to (if (ok) "Lecture envoyée à ${device.name}" else "${device.name} n'est plus disponible")
                                    }
                                    if (!started) busyToast(context, job)
                                },
                                onControl = { kind, seconds ->
                                    scope.launch {
                                        val ok = when (device.id) {
                                            LocalCast.DEVICE_ID -> LocalCast.control(kind, seconds)
                                            LocalDlna.DEVICE_ID -> LocalDlna.control(kind, seconds)
                                            else -> ConnectRemote.control(context, baseUrl, device, kind, seconds)
                                        }
                                        if (!ok) {
                                            Toast.makeText(context, "${device.name} ne répond pas", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
                            )
                        } }
                        if (nearbyFree.isNotEmpty()) {
                            SectionLabel("À proximité · Google Cast", first = devices.isEmpty())
                            nearbyFree.forEach { screen -> key(screen.id) {
                                DeviceRow(
                                    device = ConnectDevice(screen.id, screen.name, "network", "nearby", null),
                                    now = now,
                                    busy = busyId == screen.id,
                                    stage = stage.takeIf { busyId == screen.id },
                                    canCast = true,
                                    onCast = { castLocal(screen.id, screen.name) },
                                    onControl = { _, _ -> },
                                )
                            } }
                        }
                        if (dlnaFree.isNotEmpty()) {
                            SectionLabel("À proximité · Téléviseurs DLNA", first = devices.isEmpty() && nearbyFree.isEmpty())
                            dlnaFree.forEach { screen -> key(screen.id) {
                                DeviceRow(
                                    device = ConnectDevice(screen.id, screen.name, "network", "nearby-dlna", null),
                                    now = now,
                                    busy = busyId == screen.id,
                                    stage = stage.takeIf { busyId == screen.id },
                                    canCast = true,
                                    onCast = { castDlna(screen) },
                                    onControl = { _, _ -> },
                                )
                            } }
                        }
                        // Recherche en cours et rien encore trouvé : on le dit, plutôt qu'une liste vide.
                        if (payload != null && nearbyFree.isEmpty() && dlnaFree.isEmpty() && dlnaSearching) {
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                CastSpinner()
                                Spacer(Modifier.width(12.dp))
                                Text("Recherche des écrans à proximité…", style = TextStyle(fontSize = 13.sp, color = MovvizInkSoft))
                            }
                        }
                        if (payload != null && (miracast != null || wirelessDisplayAvailable(context))) {
                            // Miracast (Smart View, « Caster l'écran ») : Android réserve la connexion au système ;
                            // une fois l'écran connecté, la lecture Movviz s'y affiche en plein écran.
                            SectionLabel("Écran sans fil", first = devices.isEmpty() && nearbyFree.isEmpty() && dlnaFree.isEmpty())
                            DeviceRow(
                                device = ConnectDevice("miracast", miracast ?: wirelessDisplayLabel(), "network", "miracast", null),
                                now = now,
                                busy = false,
                                canCast = true,
                                subtitleOverride = if (miracast != null) "Connecté · lancez la lecture, elle s'affiche ici" else "Dupliquer l'écran du téléphone sur une TV",
                                onCast = {
                                    if (miracast != null) {
                                        Toast.makeText(context, "Appuyez sur Lecture : le film s'affiche sur $miracast", Toast.LENGTH_LONG).show()
                                        onDismiss()
                                    } else openWirelessDisplaySettings(context)
                                },
                                onControl = { _, _ -> },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DeviceRow(
    device: ConnectDevice,
    now: Long,
    busy: Boolean,
    stage: String? = null,
    canCast: Boolean,
    subtitleOverride: String? = null,
    onCast: () -> Unit,
    onControl: (kind: String, seconds: Double?) -> Unit,
) {
    val state = device.state
    val active = state?.active == true
    val position = state?.livePosition(now) ?: 0.0
    val duration = state?.durationSec ?: 0.0
    val subtitle = when {
        stage != null -> stage
        subtitleOverride != null -> subtitleOverride
        active && state?.title != null && state.season != null && state.episode != null -> "${state.title} · S${state.season} E${state.episode}"
        active && state?.title != null -> state.title
        else -> "${kindLabel(device.kind, device.via)} · ${statusLabel(state)}"
    }
    val otherBusy = CastProgress.job.collectAsState().value.let { it != null && !busy }
    Column(
        Modifier
            .fillMaxWidth()
            .alpha(if (otherBusy && !active) 0.5f else 1f)
            .clip(RoundedCornerShape(18.dp))
            .background(if (active) Color.White.copy(alpha = 0.035f) else Color.Transparent),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .then(if (canCast) Modifier.clickable(enabled = !busy, onClick = onCast) else Modifier)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (active) MovvizBrand.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.07f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = when {
                        device.via == "nearby" || device.id == LocalCast.DEVICE_ID -> MovvizIconGoogleCast
                        device.via == "miracast" -> MovvizIconCast
                        else -> deviceIcon(device.kind)
                    },
                    contentDescription = null,
                    tint = if (active) MovvizBrand2 else Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(device.name, style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(subtitle, style = TextStyle(fontSize = 12.5.sp, color = if (stage != null) MovvizBrand2 else MovvizInkSoft), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (busy) CastSpinner()
        }
        if (active && state != null) {
            Column(Modifier.padding(start = 14.dp, end = 14.dp, bottom = 12.dp)) {
                val progress = if (duration > 0) (position / duration).toFloat().coerceIn(0f, 1f) else 0f
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                        .pointerInput(duration) {
                            detectTapGestures { offset ->
                                if (duration > 0) onControl("seek", (offset.x / size.width).coerceIn(0f, 1f) * duration)
                            }
                        },
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)))
                    Box(Modifier.fillMaxWidth(progress).height(4.dp).clip(CircleShape).background(MovvizBrand2))
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(formatTime(position), style = TextStyle(fontSize = 11.sp, color = MovvizInkDim), modifier = Modifier.width(56.dp))
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        SheetIconButton(MovvizIconRewind, "Reculer de 10 secondes") { onControl("seek", (position - 10).coerceAtLeast(0.0)) }
                        Spacer(Modifier.width(6.dp))
                        val paused = state.status == "paused"
                        SheetIconButton(if (paused) MovvizIconPlay else MovvizIconPause, if (paused) "Reprendre" else "Pause", primary = true) {
                            onControl(if (paused) "resume" else "pause", null)
                        }
                        Spacer(Modifier.width(6.dp))
                        SheetIconButton(MovvizIconForward, "Avancer de 10 secondes") {
                            onControl("seek", if (duration > 0) (position + 10).coerceAtMost(duration) else position + 10)
                        }
                        Spacer(Modifier.width(6.dp))
                        SheetIconButton(MovvizIconClose, "Arrêter") { onControl("stop", null) }
                    }
                    Text(if (duration > 0) formatTime(duration) else "", style = TextStyle(fontSize = 11.sp, color = MovvizInkDim), modifier = Modifier.width(56.dp))
                }
            }
        }
    }
}

/** Règle du bouton blanc : gris + icône blanche au repos, blanc + icône noire seulement au focus. */
@Composable
private fun SheetIconButton(icon: ImageVector, description: String, primary: Boolean = false, onClick: () -> Unit) {
    val size = if (primary) 46.dp else 40.dp
    Surface(
        onClick = onClick,
        modifier = Modifier.size(size).tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(CircleShape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (primary) Color.White.copy(alpha = 0.14f) else Color.Transparent,
            focusedContainerColor = Color.White,
            contentColor = Color.White,
            focusedContentColor = Color.Black,
        ),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = description, modifier = Modifier.size(if (primary) 22.dp else 19.dp))
        }
    }
}

private fun deviceIcon(kind: String): ImageVector = when (kind) {
    "tv", "tizen", "network" -> MovvizIconTvScreen
    else -> MovvizIconFilm
}

private fun kindLabel(kind: String, via: String): String = when {
    via == "nearby" -> "Écran Google Cast de ce réseau"
    via == "nearby-dlna" -> "Téléviseur DLNA de ce réseau"
    via == "chromecast" -> "Écran Google Cast"
    via == "dlna" -> "Écran DLNA"
    else -> kindLabelFor(kind)
}

private fun kindLabelFor(kind: String): String = when (kind) {
    "tv" -> "Télévision"
    "tizen" -> "TV Samsung"
    "mobile" -> "Téléphone"
    else -> "Navigateur"
}

private fun statusLabel(state: ConnectState?): String = when (state?.status) {
    "playing" -> "En lecture"
    "paused" -> "En pause"
    "buffering", "loading" -> "Chargement…"
    else -> "Prêt"
}

private fun formatTime(seconds: Double): String {
    val s = seconds.toLong().coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = (s % 60).toString().padStart(2, '0')
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:$sec" else "$m:$sec"
}

@Composable
private fun SectionLabel(text: String, first: Boolean) {
    Text(
        text,
        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkDim),
        modifier = Modifier.padding(start = 14.dp, top = if (first) 4.dp else 12.dp, bottom = 4.dp),
    )
}

/** Anneau qui tourne pendant l'envoi : retour visuel dès le toucher, jusqu'à la réponse de l'écran. */
@Composable
private fun CastSpinner() {
    val transition = rememberInfiniteTransition(label = "cast-spinner")
    val angle by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "cast-spinner-angle",
    )
    Canvas(Modifier.size(22.dp)) {
        val stroke = 2.5.dp.toPx()
        drawArc(Color.White.copy(alpha = 0.12f), 0f, 360f, useCenter = false, style = Stroke(stroke))
        drawArc(MovvizBrand2, angle, 100f, useCenter = false, style = Stroke(stroke, cap = StrokeCap.Round))
    }
}

/** Même téléviseur sous deux noms (« [TV] Samsung Q60 » en DLNA, « Samsung Q60 » en Cast). */
private fun sameScreen(a: String, b: String): Boolean {
    val n = { s: String -> s.lowercase().replace("[tv]", "").replace(Regex("[^a-z0-9]"), "") }
    val x = n(a)
    val y = n(b)
    return x.isNotEmpty() && y.isNotEmpty() && (x == y || x.contains(y) || y.contains(x))
}

/** Nom de l'écran en cours d'envoi (pour animer aussi sa ligne déjà listée). */
private fun busyName(id: String?, cast: List<NearbyScreen>, dlna: List<DlnaScreen>): String =
    cast.firstOrNull { it.id == id }?.name ?: dlna.firstOrNull { it.id == id }?.name ?: "\u0000"

/** Écran sans fil (Miracast) connecté par le système, ou null. Suivi en direct. */
@Composable
private fun rememberWirelessDisplay(): String? {
    val context = LocalContext.current
    val manager = remember { context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager }
    fun current() = manager?.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)?.firstOrNull()?.name
    var name by remember { mutableStateOf(current()) }
    DisposableEffect(manager) {
        val listener = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) { name = current() }
            override fun onDisplayRemoved(displayId: Int) { name = current() }
            override fun onDisplayChanged(displayId: Int) { name = current() }
        }
        manager?.registerDisplayListener(listener, Handler(Looper.getMainLooper()))
        onDispose { manager?.unregisterDisplayListener(listener) }
    }
    return name
}

/** Ouvre « Caster l'écran » / Smart View : Android réserve la connexion Miracast au système. */
private fun openWirelessDisplaySettings(context: Context) {
    val intents = listOf(
        Intent(Settings.ACTION_CAST_SETTINGS),
        Intent("android.settings.WIFI_DISPLAY_SETTINGS"),
        Intent().setClassName("com.samsung.android.smartmirroring", "com.samsung.android.smartmirroring.CaptureActivity"),
    )
    for (intent in intents) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (runCatching { context.startActivity(intent) }.isSuccess) return
    }
    Toast.makeText(context, "Ouvrez « Caster » ou « Smart View » dans les réglages rapides du téléphone", Toast.LENGTH_LONG).show()
}

private fun busyToast(context: Context, job: CastJob?) {
    Toast.makeText(context, job?.let { "Envoi en cours vers ${it.screenName}…" } ?: "Envoi en cours…", Toast.LENGTH_SHORT).show()
}

/**
 * Miracast n'existe pas partout : absent des Pixel depuis Android 6 (« Caster »
 * n'y liste que des Chromecast). Proposé sur Samsung (Smart View) et sur les
 * marques qui gardent l'affichage sans fil.
 */
private fun wirelessDisplayAvailable(context: Context): Boolean {
    val brand = android.os.Build.MANUFACTURER.lowercase()
    if (brand == "google") return false
    if (brand == "samsung") return true
    return runCatching { Intent("android.settings.WIFI_DISPLAY_SETTINGS").resolveActivity(context.packageManager) != null }.getOrDefault(false)
}

private fun wirelessDisplayLabel(): String =
    if (android.os.Build.MANUFACTURER.equals("samsung", ignoreCase = true)) "Smart View" else "Écran sans fil (Miracast)"
