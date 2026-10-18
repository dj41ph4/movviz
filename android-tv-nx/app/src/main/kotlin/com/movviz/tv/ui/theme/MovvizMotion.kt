package com.movviz.tv.ui.theme

import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.runtime.State
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext

// ────────────────────────────────────────────────────────────────
// Mouvement Bêta : une courbe de sortie forte, une courbe d'aller-retour
// réservée aux volets du splash, deux durées. La navigation D-pad se répète
// des dizaines de fois par jour : anneau et bordures de focus changent donc
// instantanément, seule l'image d'une carte zoome légèrement.
// ────────────────────────────────────────────────────────────────

/** Jetons de mouvement Bêta (courbes, durées, échelles). */
object MovvizMotion {
    /** Sortie forte cubic-bezier(.23, 1, .32, 1) : entrées, zoom d'image, largeur du rail. */
    val EaseOut = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)

    /** Aller-retour fort cubic-bezier(.77, 0, .175, 1) : volets du splash uniquement. */
    val EaseInOut = CubicBezierEasing(0.77f, 0f, 0.175f, 1f)

    /** Retours rapides (fondu réduit, mouvement réduit). */
    const val FAST = 120

    /** Panneaux, zoom d'image de carte, largeur du rail. */
    const val PANEL = 220

    /** Fondu croisé du fond du hero. */
    const val HERO_CROSSFADE = 400

    /** Échelle à l'appui (OK maintenu). */
    const val PRESS_SCALE = 0.98f

    /** Zoom de l'image d'une carte focalisée (la carte elle-même ne grandit pas). */
    const val CARD_IMAGE_ZOOM = 1.035f
}

/**
 * Vrai quand l'utilisateur a coupé les animations système (Options pour
 * les développeurs / Accessibilité « Supprimer les animations »). Fourni par
 * [MovvizTvTheme] et tenu à jour en direct ; lire via `MovvizTheme.reduceMotion`.
 * Compose raccourcit déjà les durées tout seul : ce drapeau sert à basculer
 * vers des variantes statiques (aucune boucle infinie, aucun zoom, aucune
 * translation).
 */
val LocalMovvizReduceMotion = staticCompositionLocalOf { false }

/** Mouvement réduit dès qu'une des deux échelles système vaut 0. */
internal fun isReducedMotion(animatorScale: Float, transitionScale: Float): Boolean =
    animatorScale == 0f || transitionScale == 0f

/**
 * Lit `ANIMATOR_DURATION_SCALE` / `TRANSITION_ANIMATION_SCALE` et suit leurs
 * changements via un ContentObserver (un changement dans les réglages prend
 * effet sans relancer l'application). Appelé une seule fois par
 * [MovvizTvTheme] ; les écrans lisent `MovvizTheme.reduceMotion`.
 */
@Composable
internal fun rememberSystemReduceMotion(): Boolean {
    val context = LocalContext.current
    val resolver = context.contentResolver
    var reduced by remember(resolver) { mutableStateOf(readReducedMotion(resolver)) }
    DisposableEffect(resolver) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                reduced = readReducedMotion(resolver)
            }
        }
        listOf(Settings.Global.ANIMATOR_DURATION_SCALE, Settings.Global.TRANSITION_ANIMATION_SCALE).forEach {
            resolver.registerContentObserver(Settings.Global.getUriFor(it), false, observer)
        }
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return reduced
}

private fun readReducedMotion(resolver: android.content.ContentResolver): Boolean = isReducedMotion(
    animatorScale = Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f),
    transitionScale = Settings.Global.getFloat(resolver, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f),
)

/**
 * Zoom d'image d'une carte Bêta : 1.035 en 220 ms EaseOut quand `focused`,
 * 1 sinon ; toujours 1 en Stable ou en mouvement réduit. Lire la valeur
 * uniquement dans [movvizImageZoom] (phase de dessin), jamais en composition.
 *
 * Usage : `val zoom = animateMovvizImageZoom(focused)` puis
 * `AsyncImage(..., modifier = Modifier.fillMaxSize().movvizImageZoom(zoom))`
 * — la Surface parente rogne déjà à sa forme.
 */
@Composable
fun animateMovvizImageZoom(focused: Boolean): State<Float> {
    val active = LocalMovvizBeta.current && !LocalMovvizReduceMotion.current
    return animateFloatAsState(
        targetValue = if (focused && active) MovvizMotion.CARD_IMAGE_ZOOM else 1f,
        animationSpec = if (active) tween(MovvizMotion.PANEL, easing = MovvizMotion.EaseOut) else snap(),
        label = "movvizImageZoom",
    )
}

/** Applique une échelle animée dans graphicsLayer (lecture différée au dessin). */
fun Modifier.movvizImageZoom(scale: State<Float>): Modifier = graphicsLayer {
    val value = scale.value
    scaleX = value
    scaleY = value
}
