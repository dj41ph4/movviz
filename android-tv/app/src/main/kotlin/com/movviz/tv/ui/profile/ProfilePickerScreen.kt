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
import androidx.compose.ui.draw.alpha
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

/**
 * Foyer 10-foot : la navigation reste une liste très lisible au D-pad tandis
 * que le profil focalisé compose un vrai écran d'accueil à droite. Aucun
 * profil n'est choisi implicitement : seul l'appui central ouvre sa session.
 */
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

    Box(
        Modifier.fillMaxSize().background(
            Brush.radialGradient(
                colors = listOf(Color(0xFF32205D), Color(0xFF11121D), Color(0xFF07080E)),
                radius = 1_250f,
            ),
        ),
    ) {
        Box(
            Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(690.dp)
                .background(Brush.horizontalGradient(listOf(Color(0xFF0A0B12).copy(.04f), Color(0xFF10111B).copy(.76f), Color(0xFF090A10))))
        )
        Row(Modifier.fillMaxSize().padding(start = 76.dp, end = 94.dp, top = 52.dp, bottom = 48.dp)) {
            Column(Modifier.width(410.dp).fillMaxHeight()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AnimatedLogo(size = 38.dp)
                    Spacer(Modifier.width(12.dp))
                    Text("MOVVIZ", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black, letterSpacing = 1.8.sp)
                }
                Spacer(Modifier.height(50.dp))
                Text("Qui regarde ?", style = TextStyle(fontSize = 38.sp, fontWeight = FontWeight.Black, color = Color.White))
                Spacer(Modifier.height(8.dp))
                Text("Vos reprises, favoris et recommandations restent personnels.", color = Color.White.copy(alpha = .62f), fontSize = 15.sp, lineHeight = 21.sp)
                shownNotice?.let { Text(it, color = MovvizAmber, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 14.dp)) }
                Spacer(Modifier.height(28.dp))
                TvLazyColumn(contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(visibleProfiles, key = { it.id }) { profile ->
                        ProfileTile(
                            profile = profile,
                            selected = profile.id == previewProfile?.id,
                            active = profile.id == activeProfile?.id,
                            onFocus = { previewProfile = profile },
                            onClick = { onSelect(profile) },
                            focusRequester = if (visibleProfiles.firstOrNull()?.id == profile.id) firstTileFocus else null,
                        )
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
    Box(Modifier.width(560.dp).fillMaxHeight()) {
        profile?.let {
            // L'avatar devient l'identité visuelle du foyer. Il reste discret
            // en fond pour ne jamais nuire à la lisibilité 10-foot.
            ProfileAvatar(it, Modifier.align(Alignment.TopEnd).padding(top = 28.dp, end = 22.dp).size(390.dp).alpha(.16f), 42.dp)
            Box(
                Modifier.matchParentSize().background(
                    Brush.verticalGradient(listOf(Color.Transparent, Color(0xFF10111B).copy(.20f), Color(0xFF10111B))),
                ),
            )
            Column(Modifier.align(Alignment.BottomStart).padding(start = 36.dp, bottom = 72.dp).width(430.dp)) {
                Text("PROFIL SÉLECTIONNÉ", color = Color(0xFFC39AFF), fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = 1.8.sp)
                Spacer(Modifier.height(16.dp))
                ProfileAvatar(it, Modifier.size(126.dp), 20.dp)
                Spacer(Modifier.height(20.dp))
                Text(it.name, color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Clip, lineHeight = 42.sp)
                Spacer(Modifier.height(10.dp))
                Text("Reprendre exactement là où vous vous êtes arrêté, avec vos recommandations personnelles.", color = Color.White.copy(alpha = .64f), fontSize = 16.sp, lineHeight = 23.sp)
                Spacer(Modifier.height(24.dp))
                Text("Appuyez sur OK pour continuer", color = Color.White.copy(alpha = .82f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        } ?: Column(Modifier.align(Alignment.Center).width(390.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Ajoutez un utilisateur", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            Text("Connectez un compte local ou Plex pour commencer.", color = Color.White.copy(alpha = .58f), fontSize = 15.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 10.dp))
        }
    }
}
