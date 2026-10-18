package com.movviz.tv.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizBetaShapes
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.MovvizUiFonts
import com.movviz.tv.ui.theme.movvizFocusRing
import com.movviz.tv.ui.theme.tvPointerClick

/**
 * Tuile de profil pensée pour la distance TV : avatar dominant, nom toujours
 * lisible et focus évident sans déplacer les voisins. La taille reste fixe ;
 * seul le contenu visuel prend légèrement de la profondeur au focus.
 */
@Composable
fun ProfileTile(
    profile: TvProfile,
    selected: Boolean,
    active: Boolean,
    onFocus: () -> Unit,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val beta = LocalMovvizBeta.current
    val palette = MovvizTheme.palette
    val shape = if (beta) MovvizBetaShapes.Avatar else RoundedCornerShape(17.dp)

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(116.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(105.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                // Ombre seule au focus, jamais de scale : un avatar ou une
                // initiale incrustée se rééchantillonne mal pendant le zoom.
                // Bêta : ni ombre ni zoom, l'anneau extérieur blanc suffit.
                .graphicsLayer { shadowElevation = if (focused && !beta) 28f else 0f }
                .movvizFocusRing(shape, enabled = beta)
                .onFocusChanged {
                    focused = it.isFocused
                    if (it.isFocused) onFocus()
                }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.White.copy(alpha = if (selected) .10f else .045f),
                focusedContainerColor = Color.White.copy(alpha = .12f),
                contentColor = Color.White,
            ),
            border = if (beta) {
                val line = Border(BorderStroke(1.dp, if (active) palette.accent.copy(alpha = .7f) else palette.line), shape = shape)
                ClickableSurfaceDefaults.border(border = line, focusedBorder = line)
            } else ClickableSurfaceDefaults.border(
                border = if (active) Border(BorderStroke(1.dp, MovvizBrand2.copy(alpha = .55f))) else Border.None,
                focusedBorder = Border(BorderStroke(2.dp, Color.White)),
            ),
        ) {
            Box(Modifier.fillMaxSize()) {
                ProfileAvatar(profile, Modifier.fillMaxSize(), if (beta) 20.dp else 17.dp)
                Box(
                    Modifier.fillMaxSize().background(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, Color.Transparent, Color.Black.copy(alpha = .28f)),
                        ),
                    ),
                )
                if (active) {
                    Box(
                        Modifier
                            .align(Alignment.BottomEnd)
                            .size(14.dp)
                            .background(if (beta) palette.accent else MovvizBrand2, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("✓", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = profile.name,
            color = if (beta) (if (focused || selected) palette.ink else palette.inkSoft)
            else if (focused || selected) Color.White else Color.White.copy(alpha = .68f),
            fontSize = if (beta) 16.sp else 13.sp,
            fontFamily = if (beta) MovvizUiFonts else null,
            fontWeight = if (beta) FontWeight.SemiBold else if (focused) FontWeight.Bold else FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (active) {
            Spacer(Modifier.height(2.dp))
            if (beta) Text("Profil actif", color = palette.accent, fontSize = 12.sp, fontFamily = MovvizUiFonts, fontWeight = FontWeight.Medium)
            else Text("Profil actif", color = MovvizBrand2, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        } else {
            Spacer(Modifier.height(11.dp))
        }
    }
}

/** Tuile + exactement au même gabarit que les profils : aucun parcours D-pad spécial. */
@Composable
fun ProfileAddRow(onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val beta = LocalMovvizBeta.current
    val palette = MovvizTheme.palette
    val shape = if (beta) MovvizBetaShapes.Avatar else RoundedCornerShape(17.dp)

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(116.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(105.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                // Même règle que la tuile de profil : ombre, pas de zoom.
                .graphicsLayer { shadowElevation = if (focused && !beta) 24f else 0f }
                .movvizFocusRing(shape, enabled = beta)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.White.copy(alpha = .055f),
                focusedContainerColor = Color.White.copy(alpha = .10f),
                contentColor = MovvizBrand2,
            ),
            border = if (beta) {
                val line = Border(BorderStroke(1.dp, palette.lineStrong), shape = shape)
                ClickableSurfaceDefaults.border(border = line, focusedBorder = line)
            } else ClickableSurfaceDefaults.border(
                border = Border(BorderStroke(1.dp, Color.White.copy(alpha = .12f))),
                focusedBorder = Border(BorderStroke(2.dp, MovvizBrand2)),
            ),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Box(
                    Modifier.size(44.dp).background(
                        Brush.linearGradient(listOf(MovvizBrand.copy(alpha = .20f), MovvizBrand2.copy(alpha = .24f))),
                        CircleShape,
                    ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("+", color = Color.White, fontSize = 29.sp, fontWeight = FontWeight.Light)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            "Ajouter",
            color = if (beta) (if (focused) palette.ink else palette.inkSoft) else if (focused) Color.White else Color.White.copy(alpha = .68f),
            fontSize = if (beta) 16.sp else 13.sp,
            fontFamily = if (beta) MovvizUiFonts else null,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(11.dp))
    }
}

/** URL d'avatar exploitable par Coil : absolue telle quelle, URL Movviz
 * relative résolue contre le serveur du profil, null pour les schémas non
 * chargeables. Même règle que le client Android mobile NX. */
fun resolveAvatarUrl(avatar: String?, serverUrl: String?): String? {
    if (avatar.isNullOrBlank()) return null
    if (avatar.startsWith("http")) return avatar
    val base = serverUrl?.trim()?.trimEnd('/')?.takeIf { it.isNotBlank() } ?: return null
    if (avatar.startsWith("/")) return base + avatar
    return null
}

/** Photo de profil unique de l'app (picker, fiche profil, rail) : image
 *  chargée via Coil, repli initiales en cas d'URL absente OU d'échec réseau
 *  (401 avatar Plex expiré → initiales, jamais un rond vide). Copie conforme
 *  du composant du client mobile NX, dont le rendu est celui qui marche. */
@Composable
fun AvatarImage(
    profile: TvProfile,
    modifier: Modifier = Modifier,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(8.dp),
    initialsFontSize: androidx.compose.ui.unit.TextUnit = 26.sp,
    contentDescription: String? = null,
) {
    val url = resolveAvatarUrl(profile.avatar, profile.serverUrl)
    var failed by remember(url) { mutableStateOf(false) }
    if (url != null && !failed) {
        AsyncImage(
            model = url,
            contentDescription = contentDescription ?: profile.name,
            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            onError = { failed = true },
            modifier = modifier.clip(shape),
        )
    } else {
        Box(
            modifier.clip(shape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                profile.name.take(2).uppercase(),
                color = Color.White,
                fontSize = initialsFontSize,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

@Composable
fun ProfileAvatar(profile: TvProfile, modifier: Modifier = Modifier, cornerRadius: Dp = 8.dp) {
    AvatarImage(
        profile = profile,
        modifier = modifier,
        shape = RoundedCornerShape(cornerRadius),
        initialsFontSize = 26.sp,
    )
}
