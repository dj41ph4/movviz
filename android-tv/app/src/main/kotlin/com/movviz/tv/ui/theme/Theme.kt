package com.movviz.tv.ui.theme

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

/**
 * androidx.tv.material3.Surface(onClick = ...) ne déclenche l'action que sur
 * DPAD_CENTER/ENTER (focus + touche) — confirmé sur émulateur en injectant
 * des taps synthétiques (touchscreen ET mouse via `adb shell input`) qui
 * n'ont produit aucun effet malgré des coordonnées correctes. Android TV
 * doit pourtant fonctionner à la souris/tactile en plus de la télécommande
 * (souris Bluetooth, trackpad de télécommande, etc.). Ce modifier ajoute un
 * détecteur de tap explicite en plus du onClick natif de Surface, posé sur
 * le modifier externe donc évalué avant le clickable interne de Surface —
 * aucun double-déclenchement possible, DPAD et pointeur restent tous deux
 * fonctionnels.
 */
fun Modifier.tvPointerClick(onClick: () -> Unit): Modifier =
    this.pointerInput(onClick) {
        detectTapGestures(onTap = { onClick() })
    }

/**
 * "Lift" façon Apple TV : une carte au focus ne fait pas que grossir, elle
 * se détache visuellement de la grille avec une ombre portée douce en
 * dessous — c'est cette ombre (pas le scale seul) qui donne l'impression de
 * profondeur/qualité. `scale()` seul (ce que faisait chaque carte TV avant)
 * ne produit qu'un zoom plat, sans lecture de profondeur. Spring plutôt
 * qu'un tween linéaire pour le petit rebond naturel du lift, même sensation
 * que les grilles tvOS.
 */
@Composable
fun Modifier.tvFocusLift(
    focused: Boolean,
    shape: Shape = RoundedCornerShape(10.dp),
    maxScale: Float = 1.08f,
    maxElevation: androidx.compose.ui.unit.Dp = 24.dp,
): Modifier {
    val scale by animateFloatAsState(
        targetValue = if (focused) maxScale else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "tvFocusLiftScale",
    )
    val elevation by animateDpAsState(
        targetValue = if (focused) maxElevation else 0.dp,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "tvFocusLiftElevation",
    )
    // graphicsLayer (pas .scale(scale)) : .scale() avec une valeur lue
    // depuis un State (animateFloatAsState) recompose le composable appelant
    // — Surface/PosterCard entière, tv-material3 compris — à chaque frame de
    // l'animation spring, sur CHAQUE carte focusable de l'app (usage quasi
    // partout). graphicsLayer{} lit le State en phase de dessin uniquement,
    // sans recomposition ; seule la carte réellement focusée anime, les
    // autres restent à elevation 0 sans repasser par la composition.
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(elevation = elevation, shape = shape, ambientColor = androidx.compose.ui.graphics.Color.Black, spotColor = androidx.compose.ui.graphics.Color.Black)
}

// Un seul schéma de couleurs, volontairement sombre — pas de switch clair/
// sombre sur TV, une pièce de salon vise toujours l'immersion (même choix
// qu'Apple TV/Netflix).
private val MovvizColorScheme = darkColorScheme(
    primary = MovvizBrand,
    secondary = MovvizBrand2,
    tertiary = MovvizBrandGlow,
    background = MovvizBackground,
    surface = MovvizSurface,
    onBackground = MovvizInk,
    onSurface = MovvizInk,
)

@Composable
fun MovvizTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MovvizColorScheme,
        content = content,
    )
}
