package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2

@Composable
fun ProfilePickerScreen(
    profiles: List<TvProfile>,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
) {
    Box(
        Modifier.fillMaxSize().background(Color(0xFF101010)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Qui est-ce ?", style = TextStyle(fontSize = 44.sp, fontWeight = FontWeight.Bold, color = Color.White))
            Spacer(Modifier.height(42.dp))
            TvLazyRow(horizontalArrangement = Arrangement.spacedBy(28.dp), contentPadding = PaddingValues(horizontal = 48.dp)) {
                items(profiles, key = { it.id }) { profile ->
                    ProfileTile(profile = profile, onClick = { onSelect(profile) })
                }
                item { AddProfileTile(onClick = onAdd) }
            }
        }
    }
}

@Composable
private fun ProfileTile(profile: TvProfile, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(170.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier.size(160.dp).onFocusChanged { focused = it.isFocused },
            shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(10.dp)),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color(0xFF242424),
                focusedContainerColor = Color(0xFF383838),
            ),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = androidx.tv.material3.Border(
                    border = androidx.compose.foundation.BorderStroke(4.dp, MovvizBrand2),
                    shape = RoundedCornerShape(10.dp),
                ),
            ),
        ) {
            Avatar(profile, Modifier.fillMaxSize())
        }
        Spacer(Modifier.height(12.dp))
        Text(profile.name, color = if (focused) Color.White else Color(0xFF999999), fontSize = 18.sp)
    }
}

@Composable
private fun AddProfileTile(onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(170.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier.size(160.dp),
            shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(10.dp)),
            colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF242424), focusedContainerColor = Color(0xFF383838)),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("+", color = MovvizBrand2, fontSize = 64.sp, fontWeight = FontWeight.Light)
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("Ajouter utilisateur", color = Color(0xFF999999), fontSize = 18.sp)
    }
}

@Composable
private fun Avatar(profile: TvProfile, modifier: Modifier) {
    val url = profile.avatar
    if (!url.isNullOrBlank() && url.startsWith("http")) {
        AsyncImage(model = url, contentDescription = profile.name, modifier = modifier.clip(RoundedCornerShape(10.dp)))
    } else {
        Box(modifier.background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
            Text(profile.name.take(2).uppercase(), color = Color.White, fontSize = 48.sp, fontWeight = FontWeight.Black)
        }
    }
}
