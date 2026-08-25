package com.movviz.tv.ui.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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

/** Ligne profil compacte ; le halo et le contour ne s'affichent qu'au focus. */
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
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier.width(390.dp).height(86.dp)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused; if (it.isFocused) onFocus() }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selected) Color.White.copy(alpha = .08f) else Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = .14f), contentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = BorderStroke(2.dp, Color.White.copy(alpha = .92f)), shape = shape),
        ),
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            ProfileAvatar(profile, Modifier.size(62.dp), 12.dp)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(profile.name, color = if (focused || selected) Color.White else Color.White.copy(alpha = .72f), fontSize = 18.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Clip, lineHeight = 21.sp)
                if (active) Text("Profil actif", color = MovvizBrand2, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}

@Composable
fun ProfileAddRow(onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier.width(390.dp).height(72.dp)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = Color.White.copy(alpha = .12f), contentColor = MovvizBrand2),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = BorderStroke(2.dp, MovvizBrand2), shape = shape),
        ),
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(28.dp).background(MovvizBrand2.copy(alpha = .18f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
                Text("+", color = MovvizBrand2, fontSize = 24.sp, fontWeight = FontWeight.Medium)
            }
            Text("Ajouter un utilisateur", color = MovvizBrand2, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun ProfileAvatar(profile: TvProfile, modifier: Modifier = Modifier, cornerRadius: Dp = 10.dp) {
    val shape = RoundedCornerShape(cornerRadius)
    val url = profile.avatar
    if (!url.isNullOrBlank() && url.startsWith("http")) {
        AsyncImage(model = url, contentDescription = profile.name, modifier = modifier.clip(shape))
    } else {
        Box(modifier.clip(shape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
            Text(profile.name.take(2).uppercase(), color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
        }
    }
}
