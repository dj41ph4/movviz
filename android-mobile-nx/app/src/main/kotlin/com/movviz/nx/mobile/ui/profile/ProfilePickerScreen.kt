package com.movviz.nx.mobile.ui.profile

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.wizard.OnboardingBackground
import com.movviz.nx.mobile.ui.wizard.OnboardingCard
import com.movviz.nx.mobile.ui.wizard.OnboardingHeader
import com.movviz.nx.mobile.ui.wizard.OnboardingTitles

/**
 * Étape 3/5 — "Qui regarde ?".
 * Maquette : tuile profil dégradé violet (initiales + nom en dessous),
 * tuile "Ajouter" sombre avec pastille "+" violette, hint en bas.
 * C'est aussi l'écran de retour à chaque lancement (3) et après un ajout (3 → 2 → 3).
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
    val activeId = activeProfile?.id
    val visibleProfiles = remember(profiles, activeProfile) {
        if (activeProfile != null && profiles.none { it.id == activeId }) listOf(activeProfile) + profiles else profiles
    }
    var shownNotice by remember { mutableStateOf(notice) }
    val firstTileFocus = remember { FocusRequester() }

    LaunchedEffect(notice) {
        shownNotice = notice
        if (notice != null) {
            kotlinx.coroutines.delay(5_000L)
            onNoticeDismissed()
        }
    }
    LaunchedEffect(visibleProfiles) {
        repeat(10) { attempt ->
            if (runCatching { firstTileFocus.requestFocus() }.isSuccess) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    OnboardingBackground {
        OnboardingCard {
            OnboardingHeader()
            Spacer(Modifier.height(16.dp))
            OnboardingTitles(
                title = "Qui regarde ?",
                subtitle = "Chaque profil garde ses reprises, ses goûts\net ses suggestions.",
            )

            AnimatedVisibility(visible = shownNotice != null, enter = fadeIn(), exit = fadeOut()) {
                Text(
                    text = shownNotice ?: "",
                    color = MovvizAmber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                )
            }

            Spacer(Modifier.height(22.dp))

            // Grille 2 colonnes façon maquette (profil + ajouter côte à côte).
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.Top,
            ) {
                val first = visibleProfiles.firstOrNull()
                if (first != null) {
                    MaquetteProfileTile(
                        initials = first.initials(),
                        name = first.displayName(),
                        focusRequester = firstTileFocus,
                        onClick = { onSelect(first) },
                    )
                    // Profils suivants éventuels : tuiles compactes en dessous du premier.
                    visibleProfiles.drop(1).forEach { profile ->
                        MaquetteProfileTile(
                            initials = profile.initials(),
                            name = profile.displayName(),
                            focusRequester = null,
                            onClick = { onSelect(profile) },
                        )
                    }
                }
                MaquetteAddTile(
                    focusRequester = if (first == null) firstTileFocus else null,
                    onClick = onAdd,
                )
            }

            Spacer(Modifier.height(20.dp))
            Text(
                text = "Appuyez sur un profil pour continuer",
                style = TextStyle(fontSize = 12.sp, color = Color.White.copy(alpha = 0.45f), textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

private fun TvProfile.displayName(): String = name.ifBlank { id.take(8) }

private fun TvProfile.initials(): String {
    val n = displayName().trim()
    if (n.isEmpty()) return "?"
    val parts = n.split(" ").filter { it.isNotEmpty() }
    return if (parts.size >= 2) "${parts[0].first().uppercase()}${parts[1].first().uppercase()}"
    else n.take(2).uppercase()
}

@Composable
private fun MaquetteProfileTile(initials: String, name: String, focusRequester: FocusRequester?, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(118.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF9D5CFF), Color(0xFF6D28D9))), )
                .border(
                    width = if (focused) 3.dp else 0.dp,
                    color = Color.White.copy(alpha = if (focused) 0.95f else 0f),
                    shape = RoundedCornerShape(20.dp),
                )
                .onFocusChanged { focused = it.isFocused }
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .clickable(onClick = onClick)
                .tvPointerClick(onClick),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initials.uppercase(),
                style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = Color.White),
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = name,
            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White, textAlign = TextAlign.Center),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(118.dp),
        )
    }
}

@Composable
private fun MaquetteAddTile(focusRequester: FocusRequester?, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(118.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xFF171B38))
                .border(
                    width = if (focused) 3.dp else 1.dp,
                    color = if (focused) Color.White else Color.White.copy(alpha = 0.10f),
                    shape = RoundedCornerShape(20.dp),
                )
                .onFocusChanged { focused = it.isFocused }
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .clickable(onClick = onClick)
                .tvPointerClick(onClick),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2))),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "+", style = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Bold, color = Color.White))
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Ajouter",
            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.75f), textAlign = TextAlign.Center),
            modifier = Modifier.width(118.dp),
        )
    }
}
