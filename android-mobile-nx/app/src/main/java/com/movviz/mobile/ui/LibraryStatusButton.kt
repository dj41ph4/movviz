package com.movviz.mobile.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.EventAvailable
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.movviz.mobile.MobileViewModel
import com.movviz.mobile.ui.theme.MovvizAmber
import com.movviz.mobile.ui.theme.MovvizBrand
import com.movviz.mobile.ui.theme.MovvizBrand2
import com.movviz.mobile.ui.theme.MovvizBrandGlow
import com.movviz.mobile.ui.theme.MovvizCyan
import com.movviz.mobile.ui.theme.MovvizDown
import com.movviz.mobile.ui.theme.MovvizInkDim
import com.movviz.tv.data.LibraryMovieDto
import com.movviz.tv.data.LibrarySeriesDto
import kotlinx.coroutines.launch

/** Per-title library state — used everywhere a poster/row can be added in
 *  one tap (Découverte, Recherche, la Hero card d'Accueil). Movies carry a
 *  real server status; series only ever expose in-library or not (aucun
 *  champ de statut par série côté serveur — voir LibrarySeriesDto). */
sealed interface CardLibState {
    data object NotInLibrary : CardLibState
    data class Movie(val status: String) : CardLibState
    data object SeriesInLibrary : CardLibState
}

fun cardLibState(type: String, tmdbId: Int, movies: List<LibraryMovieDto>, series: List<LibrarySeriesDto>): CardLibState {
    return if (type == "movie") {
        movies.firstOrNull { it.tmdbId == tmdbId }?.let { CardLibState.Movie(it.status) } ?: CardLibState.NotInLibrary
    } else {
        if (series.any { it.tmdbId == tmdbId }) CardLibState.SeriesInLibrary else CardLibState.NotInLibrary
    }
}

/** Le seul "bouton dynamique" qu'un titre porte partout dans l'app —
 *  reflète l'état réel de la bibliothèque en direct (StateFlow-driven) et se
 *  met à jour dès que vm.addToLibrary() change cet état, jamais une icône
 *  statique. Un seul tap sur une carte NotInLibrary suffit à l'ajouter — pas
 *  besoin de passer par la fiche détail. */
@Composable
internal fun StatusButton(libState: CardLibState, size: Dp, type: String, tmdbId: Int, vm: MobileViewModel) {
    val scope = rememberCoroutineScope()
    var addingLocal by remember(tmdbId, type) { mutableStateOf(false) }
    val haptic = LocalHapticFeedback.current

    val (bg, icon, spin) = when (libState) {
        CardLibState.NotInLibrary -> Triple(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), Icons.Rounded.Add, false)
        is CardLibState.Movie -> when (libState.status) {
            "available" -> Triple(SolidColor(MovvizCyan.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
            "downloading", "searching" -> Triple(SolidColor(MovvizBrandGlow.copy(alpha = 0.9f)), Icons.Rounded.Refresh, true)
            "missing" -> Triple(SolidColor(MovvizDown.copy(alpha = 0.9f)), Icons.Rounded.Schedule, false)
            "upcoming" -> Triple(SolidColor(MovvizAmber.copy(alpha = 0.9f)), Icons.Rounded.EventAvailable, false)
            else -> Triple(SolidColor(MovvizInkDim.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
        }
        CardLibState.SeriesInLibrary -> Triple(SolidColor(MovvizCyan.copy(alpha = 0.9f)), Icons.Rounded.Check, false)
    }
    val clickable = libState is CardLibState.NotInLibrary && !addingLocal
    val scale by animateFloatAsState(if (addingLocal) 0.9f else 1f, spring(dampingRatio = 0.6f, stiffness = 500f), label = "statusBtn")

    Box(
        Modifier.size(size).scale(scale).clip(CircleShape)
            .background(bg)
            .clickable(enabled = clickable) {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                addingLocal = true
                scope.launch { vm.addToLibrary(type, tmdbId); addingLocal = false }
            },
        contentAlignment = Alignment.Center,
    ) {
        if (addingLocal || spin) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(size * 0.5f), strokeWidth = 2.dp)
        } else {
            Icon(icon, null, tint = Color.White, modifier = Modifier.size(size * 0.55f))
        }
    }
}
