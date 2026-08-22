package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizAmber
import kotlinx.coroutines.delay

/** Sélecteur 10-foot : liste compacte à gauche, aperçu du profil focalisé à
 * droite. Ainsi, les profils restent tous visibles sans tuiles surdimensionnées. */
@Composable
fun ProfilePickerScreen(
    profiles: List<TvProfile>, activeProfile: TvProfile?, notice: String?,
    onNoticeDismissed: () -> Unit, onSelect: (TvProfile) -> Unit, onAdd: () -> Unit,
) {
    val activeId = activeProfile?.id
    val visibleProfiles = remember(profiles, activeProfile) {
        if (activeProfile != null && profiles.none { it.id == activeId }) listOf(activeProfile) + profiles else profiles
    }
    var previewProfile by remember(visibleProfiles, activeProfile) { mutableStateOf(activeProfile ?: visibleProfiles.firstOrNull()) }
    var shownNotice by remember { mutableStateOf(notice) }
    LaunchedEffect(notice) {
        shownNotice = notice
        if (notice != null) { delay(6_000L); onNoticeDismissed() }
    }
    val firstTileFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        repeat(10) { attempt ->
            if (runCatching { firstTileFocus.requestFocus() }.isSuccess) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF090A10))) {
        Box(Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(560.dp)
            .background(Brush.horizontalGradient(listOf(Color(0xFF090A10), Color(0xFF151626), Color(0xFF10111B)))))
        Row(Modifier.fillMaxSize().padding(start = 64.dp, end = 86.dp, top = 44.dp, bottom = 44.dp)) {
            Column(Modifier.width(360.dp).fillMaxHeight()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AnimatedLogo(size = 34.dp)
                    Spacer(Modifier.width(10.dp))
                    Text("MOVVIZ", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                }
                Spacer(Modifier.height(38.dp))
                Text("Choisir un profil", style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, color = Color.White))
                Spacer(Modifier.height(6.dp))
                Text("Continuez là où vous vous êtes arrêté.", color = Color.White.copy(alpha = .56f), fontSize = 14.sp)
                shownNotice?.let { Text(it, color = MovvizAmber, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 14.dp)) }
                Spacer(Modifier.height(22.dp))
                TvLazyColumn(contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(visibleProfiles, key = { it.id }) { profile ->
                        ProfileTile(profile, profile.id == previewProfile?.id, { previewProfile = profile }, { onSelect(profile) }, if (visibleProfiles.firstOrNull()?.id == profile.id) firstTileFocus else null)
                    }
                    item { ProfileAddRow(onAdd, if (visibleProfiles.isEmpty()) firstTileFocus else null) }
                }
            }
            Spacer(Modifier.weight(1f))
            ProfilePreview(previewProfile)
        }
    }
}

@Composable
private fun ProfilePreview(profile: TvProfile?) {
    Column(Modifier.width(410.dp).fillMaxHeight().padding(top = 90.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        profile?.let {
            ProfileAvatar(it, Modifier.size(210.dp), 22.dp)
            Spacer(Modifier.height(22.dp))
            Text(it.name, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(8.dp))
            Text("Votre espace Movviz", color = Color.White.copy(alpha = .60f), fontSize = 15.sp)
            Text("Reprendre vos films, vos séries et vos recommandations personnalisées.", color = Color.White.copy(alpha = .48f), fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.width(300.dp).padding(top = 28.dp))
        } ?: run {
            Text("Ajoutez un utilisateur", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold)
            Text("Connectez un compte local ou Plex pour commencer.", color = Color.White.copy(alpha = .58f), fontSize = 14.sp, modifier = Modifier.padding(top = 8.dp))
        }
    }
}
