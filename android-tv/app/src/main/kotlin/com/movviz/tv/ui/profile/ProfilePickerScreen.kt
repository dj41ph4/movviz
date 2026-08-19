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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.withFrameNanos
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBrand2
import kotlinx.coroutines.delay

/** Page profil — « Qui est-ce ? » : le profil ACTIF en tête (toujours
 *  visible, même hors foyer), les membres du foyer, puis la tuile « + »
 *  qui mène au login pour ajouter un utilisateur. Une notice d'info
 *  (« compte déjà présent », « ajouté au foyer ») s'affiche sous le titre. */
@Composable
fun ProfilePickerScreen(
    profiles: List<TvProfile>,
    activeProfile: TvProfile?,
    notice: String?,
    onNoticeDismissed: () -> Unit,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
) {
    val activeId = activeProfile?.id
    val visibleProfiles = remember(profiles, activeProfile) {
        if (activeProfile != null && profiles.none { it.id == activeId }) listOf(activeProfile) + profiles
        else profiles
    }
    var shownNotice by remember { mutableStateOf(notice) }
    LaunchedEffect(notice) {
        shownNotice = notice
        if (notice != null) {
            delay(6_000L)
            onNoticeDismissed()
        }
    }
    // Focus D-pad initial : rien ne réclame le focus à l'arrivée sur cet
    // écran (constaté ailleurs dans l'app : premier appui de flèche sans
    // effet). On vise la première tuile — ou la tuile « + » si le foyer
    // est vide — en retentant sur quelques frames le temps que la
    // TvLazyRow compose l'item.
    val firstTileFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        repeat(10) { attempt ->
            val focused = runCatching { firstTileFocus.requestFocus() }.isSuccess
            if (focused) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }
    Box(
        Modifier.fillMaxSize().background(Color(0xFF101010)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Qui est-ce ?", style = TextStyle(fontSize = 44.sp, fontWeight = FontWeight.Bold, color = Color.White))
            if (shownNotice != null) {
                Spacer(Modifier.height(14.dp))
                Text(shownNotice!!, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = MovvizAmber))
            }
            Spacer(Modifier.height(42.dp))
            TvLazyRow(horizontalArrangement = Arrangement.spacedBy(28.dp), contentPadding = PaddingValues(horizontal = 48.dp)) {
                items(visibleProfiles, key = { it.id }) { profile ->
                    ProfileTile(
                        profile = profile,
                        onClick = { onSelect(profile) },
                        focusRequester = if (visibleProfiles.firstOrNull()?.id == profile.id) firstTileFocus else null,
                    )
                }
                item {
                    AddProfileTile(
                        onClick = onAdd,
                        focusRequester = if (visibleProfiles.isEmpty()) firstTileFocus else null,
                    )
                }
            }
        }
    }
}

/** Tuile « + » — propre à l'écran de sélection, mène au login d'ajout. */
@Composable
private fun AddProfileTile(onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(170.dp)) {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .size(160.dp)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it },
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