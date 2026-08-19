package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizBrand2

/** « Qui est-ce ? » — choisir un profil du foyer, ou en ajouter un. */
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

/** Tuile « + » — propre à l'écran de sélection, mène à l'écran d'ajout. */
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