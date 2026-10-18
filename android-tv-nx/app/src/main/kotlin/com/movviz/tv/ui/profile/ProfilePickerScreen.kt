package com.movviz.tv.ui.profile

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizAmber
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import com.movviz.tv.ui.home.requestFocusSafely
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizTheme
import kotlinx.coroutines.delay

/**
 * Écran "Qui regarde ?" 10-foot. La reconnaissance prime sur l'information :
 * une rangée de profils grands et symétriques, l'ajout au même niveau, aucune
 * prévisualisation latérale ni liste verticale à parcourir. Le foyer reste
 * strictement personnel côté serveur ; cet écran ne fait que choisir la
 * session locale déjà autorisée.
 */
/** Tuile d'atterrissage du sélecteur : le profil actif s'il est affiché,
 *  sinon le premier ; null = aucun profil, la tuile « Ajouter » prend le focus. */
internal fun profileLandingId(profileIds: List<String>, activeId: String?): String? =
    activeId?.takeIf { it in profileIds } ?: profileIds.firstOrNull()

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
        if (activeProfile != null && profiles.none { it.id == activeId }) listOf(activeProfile) + profiles else profiles
    }
    var focusedId by remember(visibleProfiles, activeProfile) {
        mutableStateOf(activeProfile?.id ?: visibleProfiles.firstOrNull()?.id)
    }
    var shownNotice by remember { mutableStateOf(notice) }
    // Une seule cible d'atterrissage : la tuile du profil ACTIF (celle qui
    // est mise en avant), sinon la première, sinon « Ajouter ».
    val landingFocus = remember { FocusRequester() }
    val landingId = profileLandingId(visibleProfiles.map { it.id }, activeId)
    val beta = LocalMovvizBeta.current

    LaunchedEffect(notice) {
        shownNotice = notice
        if (notice != null) {
            delay(5_000L)
            onNoticeDismissed()
        }
    }
    // Focus initial UNE fois : la liste se rafraîchit en arrière-plan
    // (réconciliation serveur) et chaque rafraîchissement ramenait le focus
    // sur la première tuile pendant que l'utilisateur naviguait.
    var initialFocusDone by remember { mutableStateOf(false) }
    LaunchedEffect(landingId) {
        if (initialFocusDone) return@LaunchedEffect
        repeat(20) { attempt ->
            if (landingFocus.requestFocusSafely()) {
                initialFocusDone = true
                return@LaunchedEffect
            }
            if (attempt < 19) withFrameNanos { }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    // Bêta : fond graphite et lueur violette à 10 %.
                    colors = if (beta) listOf(
                        Color(0xFF7C3AED).copy(alpha = .10f),
                        MovvizTheme.palette.background,
                        MovvizTheme.palette.background,
                    ) else listOf(
                        MovvizBrand.copy(alpha = .17f),
                        Color(0xFF10101A),
                        Color(0xFF05060B),
                    ),
                    radius = 862f,
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
                        radius = 690f,
                    ),
                ),
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(top = 35.dp, bottom = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(contentAlignment = Alignment.Center) {
                AnimatedLogo(size = 29.dp)
            }
            Spacer(Modifier.height(5.dp))
            MovvizWordmark(fontSize = 14.sp)

            Spacer(Modifier.height(36.dp))
            Text(
                text = "Qui regarde ?",
                style = if (beta) MaterialTheme.typography.displayMedium.copy(color = MovvizTheme.palette.ink)
                else TextStyle(fontSize = 29.sp, fontWeight = FontWeight.Black, color = Color.White),
            )
            Spacer(Modifier.height(7.dp))
            Text(
                text = "Chaque profil garde ses reprises, ses goûts et ses suggestions.",
                style = if (beta) MaterialTheme.typography.bodyLarge.copy(color = MovvizTheme.palette.inkSoft, textAlign = TextAlign.Center)
                else TextStyle(fontSize = 11.sp, color = Color.White.copy(alpha = .58f), textAlign = TextAlign.Center),
            )

            AnimatedVisibility(
                visible = shownNotice != null,
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                Text(
                    text = shownNotice ?: "",
                    color = MovvizAmber,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 11.dp),
                )
            }

            Spacer(Modifier.height(29.dp))

            TvLazyRow(
                state = rememberTvLazyListState().withTvPrefetchDisabled(),
                modifier = Modifier.widthIn(max = 780.dp),
                contentPadding = PaddingValues(horizontal = 21.dp, vertical = if (beta) 12.dp else 9.dp),
                horizontalArrangement = Arrangement.spacedBy(20.dp),
                verticalAlignment = Alignment.Top,
            ) {
                items(visibleProfiles, key = { it.id }) { profile ->
                    ProfileTile(
                        profile = profile,
                        selected = focusedId == profile.id,
                        active = activeId == profile.id,
                        onFocus = { focusedId = profile.id },
                        onClick = { onSelect(profile) },
                        focusRequester = if (landingId == profile.id) landingFocus else null,
                    )
                }
                item(key = "add-profile") {
                    ProfileAddRow(
                        onClick = onAdd,
                        focusRequester = if (landingId == null) landingFocus else null,
                    )
                }
            }

            Spacer(Modifier.height(18.dp))
            Text(
                text = if (visibleProfiles.isEmpty()) "Ajoutez le premier utilisateur de cette TV" else "OK pour continuer  •  + pour ajouter un utilisateur",
                color = Color.White.copy(alpha = .42f),
                fontSize = 9.sp,
                letterSpacing = .2.sp,
            )
        }
    }
}
