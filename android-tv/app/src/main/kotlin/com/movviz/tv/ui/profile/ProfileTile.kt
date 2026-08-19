package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
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

/** Tuile de profil TV — partagée par l'écran « Qui est-ce ? » et l'écran
 *  d'ajout d'un membre au foyer (même rendu, une seule implémentation). */
@Composable
fun ProfileTile(profile: TvProfile, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(170.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(160.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .onFocusChanged { focused = it.isFocused },
            shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(10.dp)),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color(0xFF242424),
                focusedContainerColor = Color(0xFF383838),
            ),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(4.dp, MovvizBrand2),
                    shape = RoundedCornerShape(10.dp),
                ),
            ),
        ) {
            ProfileAvatar(profile, Modifier.fillMaxSize())
        }
        Spacer(Modifier.height(12.dp))
        Text(profile.name, color = if (focused) Color.White else Color(0xFF999999), fontSize = 18.sp)
    }
}

/** Avatar d'un profil : image Plex si disponible, sinon initiales sur fond
 *  dégradé de marque. */
@Composable
fun ProfileAvatar(profile: TvProfile, modifier: Modifier = Modifier) {
    val url = profile.avatar
    if (!url.isNullOrBlank() && url.startsWith("http")) {
        AsyncImage(model = url, contentDescription = profile.name, modifier = modifier.clip(RoundedCornerShape(10.dp)))
    } else {
        Box(modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
            Text(profile.name.take(2).uppercase(), color = Color.White, fontSize = 48.sp, fontWeight = FontWeight.Black)
        }
    }
}