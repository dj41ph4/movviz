package com.movviz.nx.mobile.connect

import android.widget.Toast
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
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
 * Bouton « Caster » de la fiche : n'apparaît que si un appareil du compte
 * (TV, navigateur) peut recevoir la lecture. Ouvre la liste des appareils, qui
 * sert ensuite de télécommande.
 */
@Composable
fun CastButton(baseUrl: String?, payload: CastPayload?) {
    val context = LocalContext.current
    val devices by ConnectRemote.devices.collectAsState()
    val controlledId by ConnectRemote.controlledId.collectAsState()
    var open by remember { mutableStateOf(false) }

    // Liste à jour : toutes les 8 s sur la fiche, toutes les 2 s panneau ouvert (télécommande vivante).
    LaunchedEffect(baseUrl, open) {
        val url = baseUrl ?: return@LaunchedEffect
        while (true) {
            ConnectRemote.refresh(context, url)
            delay(if (open) 2_000L else 8_000L)
        }
    }
    if (baseUrl == null || devices.isEmpty()) return

    val playing = devices.any { it.state?.active == true && (controlledId == null || it.id == controlledId) }
    val tint = if (playing) MovvizBrand2 else Color.White
    Box {
        Surface(
            onClick = { open = true },
            modifier = Modifier.size(40.dp).tvPointerClick { open = true },
            shape = ClickableSurfaceDefaults.shape(CircleShape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.Black.copy(alpha = 0.35f),
                focusedContainerColor = Color.Black.copy(alpha = 0.5f),
                contentColor = tint,
                focusedContentColor = tint,
            ),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(MovvizIconCast, contentDescription = "Caster", tint = tint, modifier = Modifier.size(19.dp))
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

@Composable
private fun CastSheet(baseUrl: String, payload: CastPayload?, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val devices by ConnectRemote.devices.collectAsState()
    var busyId by remember { mutableStateOf<String?>(null) }
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
                        Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()).padding(horizontal = 8.dp),
                    ) {
                        devices.forEach { device ->
                            DeviceRow(
                                device = device,
                                now = now,
                                busy = busyId == device.id,
                                canCast = payload != null,
                                onCast = {
                                    val p = payload ?: return@DeviceRow
                                    if (busyId != null) return@DeviceRow
                                    busyId = device.id
                                    scope.launch {
                                        val ok = ConnectRemote.play(context, baseUrl, device, p)
                                        busyId = null
                                        Toast.makeText(context, if (ok) "Lecture envoyée à ${device.name}" else "${device.name} n'est plus disponible", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                onControl = { kind, seconds ->
                                    scope.launch {
                                        if (!ConnectRemote.control(context, baseUrl, device, kind, seconds)) {
                                            Toast.makeText(context, "${device.name} ne répond pas", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                },
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
    canCast: Boolean,
    onCast: () -> Unit,
    onControl: (kind: String, seconds: Double?) -> Unit,
) {
    val state = device.state
    val active = state?.active == true
    val position = state?.livePosition(now) ?: 0.0
    val duration = state?.durationSec ?: 0.0
    val subtitle = when {
        active && state?.title != null && state.season != null && state.episode != null -> "${state.title} · S${state.season} E${state.episode}"
        active && state?.title != null -> state.title
        else -> "${kindLabel(device.kind)} · ${statusLabel(state)}"
    }
    Column(
        Modifier
            .fillMaxWidth()
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
                    imageVector = deviceIcon(device.kind),
                    contentDescription = null,
                    tint = if (active) MovvizBrand2 else Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(device.name, style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(subtitle, style = TextStyle(fontSize = 12.5.sp, color = MovvizInkSoft), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (busy) Text("…", style = TextStyle(fontSize = 18.sp, color = MovvizInkSoft))
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
    "tv", "tizen" -> MovvizIconTvScreen
    else -> MovvizIconFilm
}

private fun kindLabel(kind: String): String = when (kind) {
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
