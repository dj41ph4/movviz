package com.movviz.nx.mobile.ui.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Text
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizWordmark
import kotlinx.coroutines.delay

/**
 * Écran "Qui regarde ?" 10-foot. La reconnaissance prime sur l'information :
 * une rangée de profils grands et symétriques, l'ajout au même niveau, aucune
 * prévisualisation latérale ni liste verticale à parcourir. Le foyer reste
 * strictement personnel côté serveur ; cet écran ne fait que choisir la
 * session locale déjà autorisée.
 */
@Composable
fun ProfilePickerScreen(
    profiles: List<TvProfile>,
    activeProfile: TvProfile?,
    notice: String?,
    onNoticeDismissed: () -> Unit,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
) {
    val compactPortrait = LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }
    val activeId = activeProfile?.id
    val visibleProfiles = remember(profiles, activeProfile) {
        if (activeProfile != null && profiles.none { it.id == activeId }) listOf(activeProfile) + profiles else profiles
    }
    var focusedId by remember(visibleProfiles, activeProfile) {
        mutableStateOf(activeProfile?.id ?: visibleProfiles.firstOrNull()?.id)
    }
    var shownNotice by remember { mutableStateOf(notice) }
    val firstTileFocus = remember { FocusRequester() }

    LaunchedEffect(notice) {
        shownNotice = notice
        if (notice != null) {
            delay(5_000L)
            onNoticeDismissed()
        }
    }
    LaunchedEffect(visibleProfiles) {
        repeat(10) { attempt ->
            if (runCatching { firstTileFocus.requestFocus() }.isSuccess) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        MovvizBrand.copy(alpha = .17f),
                        Color(0xFF10101A),
                        Color(0xFF05060B),
                    ),
                    radius = 1_150f,
                ),
            ),
    ) {
        // Halo secondaire très léger : conserve l'identité Movviz sans faire
        // de l'écran profil une page de réglages violette.
        Box(
            Modifier
                .align(Alignment.BottomEnd)
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(MovvizBrand2.copy(alpha = .08f), Color.Transparent),
                        center = androidx.compose.ui.geometry.Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                        radius = 920f,
                    ),
                ),
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(top = if (compactPortrait) 28.dp else 46.dp, bottom = if (compactPortrait) 24.dp else 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "ÉTAPE 3 / 5 · CHOISIR UN PROFIL",
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MovvizAmber, letterSpacing = 2.sp),
            )
            Spacer(Modifier.height(10.dp))
            Box(contentAlignment = Alignment.Center) {
                AnimatedLogo(size = 38.dp)
            }
            Spacer(Modifier.height(7.dp))
            MovvizWordmark(fontSize = 18.sp)

            Spacer(Modifier.height(if (compactPortrait) 28.dp else 48.dp))
            Text(
                text = "Qui regarde ?",
                style = TextStyle(fontSize = if (compactPortrait) 30.sp else 38.sp, fontWeight = FontWeight.Black, color = Color.White, textAlign = TextAlign.Center),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(9.dp))
            Text(
                text = "Chaque profil garde ses reprises, ses goûts et ses suggestions.",
                style = TextStyle(fontSize = if (compactPortrait) 14.sp else 15.sp, color = Color.White.copy(alpha = .58f), textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
            )

            AnimatedVisibility(
                visible = shownNotice != null,
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                Text(
                    text = shownNotice ?: "",
                    color = MovvizAmber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }

            Spacer(Modifier.height(if (compactPortrait) 24.dp else 38.dp))

            TvLazyRow(
                modifier = Modifier.widthIn(max = 1040.dp),
                contentPadding = PaddingValues(horizontal = if (compactPortrait) 16.dp else 28.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(if (compactPortrait) 14.dp else 26.dp),
                verticalAlignment = Alignment.Top,
            ) {
                items(visibleProfiles, key = { it.id }) { profile ->
                    ProfileTile(
                        profile = profile,
                        selected = focusedId == profile.id,
                        active = activeId == profile.id,
                        onFocus = { focusedId = profile.id },
                        onClick = { onSelect(profile) },
                        focusRequester = if (visibleProfiles.firstOrNull()?.id == profile.id) firstTileFocus else null,
                    )
                }
                item(key = "add-profile") {
                    ProfileAddRow(
                        onClick = onAdd,
                        focusRequester = if (visibleProfiles.isEmpty()) firstTileFocus else null,
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                text = if (visibleProfiles.isEmpty()) "Ajoutez le premier utilisateur de cette TV" else "OK pour continuer  •  + pour ajouter un utilisateur",
                color = Color.White.copy(alpha = .42f),
                fontSize = 12.sp,
                letterSpacing = .2.sp,
            )
        }
    }
}
