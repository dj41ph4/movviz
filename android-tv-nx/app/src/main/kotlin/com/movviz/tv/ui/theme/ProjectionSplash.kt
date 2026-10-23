package com.movviz.tv.ui.theme

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.tv.R
import java.util.Locale
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

// ────────────────────────────────────────────────────────────────
// Ouverture « Projection » de l'interface Bêta : allumage du projecteur,
// volets qui s'ouvrent, logo révélé par une fente, orbites lumineuses.
// Une seule horloge (0 → 2200 ms) ; chaque couche dérive sa progression de
// fonctions pures (ProjectionSplashTimeline, testées) lues uniquement au
// dessin / dans graphicsLayer. Aucune durée minimale : le chargement réel
// pilote la disparition, l'écran n'est jamais focalisable.
// ────────────────────────────────────────────────────────────────

/** Fonctions d'images-clés du splash (ms → progression), pures et testables. */
internal object ProjectionSplashTimeline {
    /** Fin de l'horloge principale (la plus longue orbite). */
    const val END_MS = 2200f

    const val SHUTTER_MS = 1400f
    /** Part de la durée des volets pendant laquelle ils restent fermés. */
    const val SHUTTER_HOLD = 0.12f
    const val LOGO_MS = 1500f
    const val LOGO_FADE_END = 0.22f
    const val LOGO_REVEAL_END = 0.75f
    /** Fente initiale : 48 % de la hauteur masqués en haut ET en bas. */
    const val LOGO_CLIP_START = 0.48f
    const val LOGO_SCALE_START = 0.78f
    const val PROJECTOR_MS = 1600f
    const val PROJECTOR_FADE_END = 0.35f
    const val HORIZON_MS = 900f
    const val ORBIT_A_MS = 2000f
    const val ORBIT_B_MS = 2200f
    const val ORBIT_ENTRY_DEGREES = 115f
    const val ORBIT_TILT_DEGREES = 28f
    const val SHEEN_DELAY_MS = 150f
    const val SHEEN_MS = 1100f
    const val TEXT_MS = 700f
    const val EYEBROW_DELAY_MS = 200f
    const val HEADLINE_DELAY_MS = 450f
    const val EXIT_SCALE = 1.06f

    /** Progression linéaire 0..1 d'un segment [delay, delay + duration]. */
    fun phase(timeMs: Float, delayMs: Float, durationMs: Float): Float =
        ((timeMs - delayMs) / durationMs).coerceIn(0f, 1f)

    private fun lerp(from: Float, to: Float, fraction: Float) = from + (to - from) * fraction

    /** Ouverture des volets 0 (fermés) → 1 (sortis) : immobiles pendant les
     *  12 % initiaux, puis glissement EaseInOut. */
    fun shutterOpen(timeMs: Float): Float {
        val p = phase(timeMs, 0f, SHUTTER_MS)
        if (p <= SHUTTER_HOLD) return 0f
        return MovvizMotion.EaseInOut.transform((p - SHUTTER_HOLD) / (1f - SHUTTER_HOLD))
    }

    fun logoAlpha(timeMs: Float): Float =
        MovvizMotion.EaseOut.transform((phase(timeMs, 0f, LOGO_MS) / LOGO_FADE_END).coerceAtMost(1f))

    private fun logoReveal(timeMs: Float): Float =
        MovvizMotion.EaseOut.transform((phase(timeMs, 0f, LOGO_MS) / LOGO_REVEAL_END).coerceAtMost(1f))

    /** Part de la hauteur masquée en haut et en bas (fente) : 0.48 → 0 à 75 %. */
    fun logoClipInset(timeMs: Float): Float = lerp(LOGO_CLIP_START, 0f, logoReveal(timeMs))

    fun logoScale(timeMs: Float): Float = lerp(LOGO_SCALE_START, 1f, logoReveal(timeMs))

    fun projectorAlpha(timeMs: Float): Float =
        (phase(timeMs, 0f, PROJECTOR_MS) / PROJECTOR_FADE_END).coerceAtMost(1f)

    /** 0.5 → 0.85 pendant l'allumage (35 %), puis 0.85 → 1. */
    fun projectorScale(timeMs: Float): Float {
        val p = phase(timeMs, 0f, PROJECTOR_MS)
        return if (p <= PROJECTOR_FADE_END) {
            lerp(0.5f, 0.85f, MovvizMotion.EaseOut.transform(p / PROJECTOR_FADE_END))
        } else {
            lerp(0.85f, 1f, MovvizMotion.EaseOut.transform((p - PROJECTOR_FADE_END) / (1f - PROJECTOR_FADE_END)))
        }
    }

    fun horizonScaleX(timeMs: Float): Float =
        lerp(0.3f, 1f, MovvizMotion.EaseOut.transform(phase(timeMs, 0f, HORIZON_MS)))

    /** Entrée d'une orbite (0 → 1, EaseOut) ; `durationMs` = 2000 ou 2200. */
    fun orbitEntry(timeMs: Float, durationMs: Float): Float =
        MovvizMotion.EaseOut.transform(phase(timeMs, 0f, durationMs))

    /** Angle d'une orbite : part de ±115° et se pose à ∓28° (signe = côté). */
    fun orbitRotation(entry: Float, clockwise: Boolean): Float {
        val rest = if (clockwise) ORBIT_TILT_DEGREES else -ORBIT_TILT_DEGREES
        val from = if (clockwise) -ORBIT_ENTRY_DEGREES else ORBIT_ENTRY_DEGREES
        return lerp(from, rest, entry)
    }

    fun orbitScale(entry: Float): Float = lerp(0.7f, 1f, entry)

    /** Position du reflet sur le logo, -0.4 (avant) → 1.4 (après). */
    fun sheenPosition(timeMs: Float): Float = lerp(-0.4f, 1.4f, phase(timeMs, SHEEN_DELAY_MS, SHEEN_MS))

    fun textAlpha(timeMs: Float, delayMs: Float): Float =
        MovvizMotion.EaseOut.transform(phase(timeMs, delayMs, TEXT_MS))

    /** Échelle de sortie (fondu de l'overlay) : 1 → 1.06. */
    fun exitScale(exitProgress: Float): Float = lerp(1f, EXIT_SCALE, exitProgress.coerceIn(0f, 1f))

    /** Fraction de la barre ; null (indéterminé) = barre vide + reflet seul. */
    fun progressFraction(progress: Int?): Float = (progress ?: 0).coerceIn(0, 100) / 100f
}

/**
 * Splash cinématique Bêta (plein écran, non focalisable). La scène vit dans [CinemaSplash] ;
 * cette fonction garde l'API historique pour que les appelants ne changent pas.
 *
 * @param progress avancement réel 0..100, ou null si inconnu.
 * @param message libellé de l'étape en cours ; null = « Préparation de ton cinéma… ».
 * @param ready chargement terminé : déclenche l'éclat de fin.
 */
@Composable
fun ProjectionSplash(
    modifier: Modifier = Modifier,
    progress: Int? = null,
    message: String? = null,
    ready: Boolean = false,
) {
    CinemaSplash(modifier = modifier, progress = progress, message = message, ready = ready)
}

/**
 * Splash en surcouche avec sortie animée : fondu 500 ms EaseOut + zoom
 * 1 → 1.06 quand `visible` passe à faux (fondu 120 ms seul en mouvement
 * réduit). Apparaît sans animation, n'impose aucune durée minimale et ne
 * prend jamais le focus : le poser au-dessus du NavHost, la cible de focus
 * réelle vit dessous.
 */
@Composable
fun ProjectionSplashOverlay(
    visible: Boolean,
    modifier: Modifier = Modifier,
    progress: Int? = null,
    message: String? = null,
    ready: Boolean = false,
) {
    val reduce = LocalMovvizReduceMotion.current
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = EnterTransition.None,
        exit = if (reduce) {
            fadeOut(tween(MovvizMotion.FAST))
        } else {
            fadeOut(tween(500, easing = MovvizMotion.EaseOut)) +
                scaleOut(targetScale = ProjectionSplashTimeline.EXIT_SCALE, animationSpec = tween(500, easing = MovvizMotion.EaseOut))
        },
    ) {
        ProjectionSplash(progress = progress, message = message, ready = ready || !visible)
    }
}

@androidx.compose.ui.tooling.preview.Preview(device = "id:tv_1080p", showBackground = true)
@Composable
private fun ProjectionSplashPreview() {
    MovvizTvTheme(beta = true) { ProjectionSplash(progress = 42, message = "Synchronisation de la bibliothèque") }
}
