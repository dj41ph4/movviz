package com.movviz.tv.ui.profile

import androidx.compose.animation.core.animateFloatAsState
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
    val scale by animateFloatAsState(if (focused) 1.055f else 1f, label = "profile_scale")
    val shape = RoundedCornerShape(22.dp)

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(154.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(140.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    shadowElevation = if (focused) 28f else 0f
                }
                .onFocusChanged {
                    focused = it.isFocused
                    if (it.isFocused) onFocus()
                }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.White.copy(alpha = if (selected) .10f else .045f),
                focusedContainerColor = Color.White.copy(alpha = .12f),
                contentColor = Color.White,
            ),
            border = ClickableSurfaceDefaults.border(
                border = if (active) Border(BorderStroke(1.dp, MovvizBrand2.copy(alpha = .55f))) else Border.None,
                focusedBorder = Border(BorderStroke(3.dp, Color.White)),
            ),
        ) {
            Box(Modifier.fillMaxSize()) {
                ProfileAvatar(profile, Modifier.fillMaxSize(), 22.dp)
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
                            .size(18.dp)
                            .background(MovvizBrand2, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("✓", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
        Spacer(Modifier.height(13.dp))
        Text(
            text = profile.name,
            color = if (focused || selected) Color.White else Color.White.copy(alpha = .68f),
            fontSize = 17.sp,
            fontWeight = if (focused) FontWeight.Bold else FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (active) {
            Spacer(Modifier.height(3.dp))
            Text("Profil actif", color = MovvizBrand2, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        } else {
            Spacer(Modifier.height(15.dp))
        }
    }
}

/** Tuile + exactement au même gabarit que les profils : aucun parcours D-pad spécial. */
@Composable
fun ProfileAddRow(onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.055f else 1f, label = "profile_add_scale")
    val shape = RoundedCornerShape(22.dp)

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(154.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(140.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    shadowElevation = if (focused) 24f else 0f
                }
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.White.copy(alpha = .055f),
                focusedContainerColor = Color.White.copy(alpha = .10f),
                contentColor = MovvizBrand2,
            ),
            border = ClickableSurfaceDefaults.border(
                border = Border(BorderStroke(1.dp, Color.White.copy(alpha = .12f))),
                focusedBorder = Border(BorderStroke(3.dp, MovvizBrand2)),
            ),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Box(
                    Modifier.size(58.dp).background(
                        Brush.linearGradient(listOf(MovvizBrand.copy(alpha = .20f), MovvizBrand2.copy(alpha = .24f))),
                        CircleShape,
                    ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("+", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Light)
                }
            }
        }
        Spacer(Modifier.height(13.dp))
        Text(
            "Ajouter",
            color = if (focused) Color.White else Color.White.copy(alpha = .68f),
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Spacer(Modifier.height(15.dp))
    }
}

@Composable
fun ProfileAvatar(profile: TvProfile, modifier: Modifier = Modifier, cornerRadius: Dp = 10.dp) {
    val shape = RoundedCornerShape(cornerRadius)
    val url = profile.avatar
    if (!url.isNullOrBlank() && url.startsWith("http")) {
        AsyncImage(model = url, contentDescription = profile.name, modifier = modifier.clip(shape))
    } else {
        Box(
            modifier.clip(shape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))),
            contentAlignment = Alignment.Center,
        ) {
            Text(profile.name.take(2).uppercase(), color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Black)
        }
    }
}
