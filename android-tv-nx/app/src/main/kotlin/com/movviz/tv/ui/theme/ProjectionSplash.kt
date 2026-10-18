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

private val SplashBackground = Color(0xFF05050B)
private val ProjectorCore = Color(0x38C4B5FD)
private val ProjectorMid = Color(0x147C3AED)
private val HaloViolet = Color(0x667C3AED)
private val HaloCyan = Color(0x442DD4BF)
private val OrbitViolet = Color(0x30C4B5FD)
private val OrbitCyan = Color(0x1C67E8F9)
private val OrbitDot = Color(0xFFDDD6FE)
private val FrameCorner = Color(0x45C4B5FD)
private val EyebrowTint = Color(0xB3C4B5FD)
private val HeadlineTint = Color(0xCFF1EDFF)
private val LoadingLabel = Color(0xFFA8A3BD)
private val LoadingPercent = Color(0xFFEDE9FE)
private val LoadingTrack = Color.White.copy(alpha = 0.07f)

/**
 * Splash cinématique Bêta (plein écran, non focalisable).
 *
 * @param progress avancement réel 0..100, ou null si inconnu (la barre ne
 *  montre alors que le reflet).
 * @param message libellé de l'étape en cours ; null = « Préparation de ton cinéma… ».
 * @param ready chargement terminé : les boucles s'arrêtent, les orbites s'effacent.
 * @param focused dessine l'anneau de focus autour du bloc de chargement quand
 *  la vraie cible de focus (bloc de chargement de l'accueil) est sous l'overlay.
 *
 * Usage simple : `ProjectionSplash()` ; avec sortie animée : [ProjectionSplashOverlay].
 */
@Composable
fun ProjectionSplash(
    modifier: Modifier = Modifier,
    progress: Int? = null,
    message: String? = null,
    ready: Boolean = false,
    focused: Boolean = false,
) {
    val reduce = LocalMovvizReduceMotion.current
    val clock = remember { Animatable(if (reduce) ProjectionSplashTimeline.END_MS else 0f) }
    LaunchedEffect(reduce) {
        if (reduce) {
            clock.snapTo(ProjectionSplashTimeline.END_MS)
        } else {
            clock.animateTo(ProjectionSplashTimeline.END_MS, tween(ProjectionSplashTimeline.END_MS.toInt(), easing = LinearEasing))
        }
    }
    val time = { clock.value }
    val loopsActive = !ready && !reduce
    val ambient = if (loopsActive) rememberSplashAmbient() else null
    val orbitFade by animateFloatAsState(
        targetValue = if (ready || reduce) 0f else 1f,
        animationSpec = if (reduce) snap() else tween(300),
        label = "splashOrbitFade",
    )

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .clearAndSetSemantics { contentDescription = "Movviz" }
            .splashBackdrop(time, { orbitFade }, ambient, reduce),
    ) {
        val logoWidth = min(220f, maxWidth.value * 0.42f).dp
        Column(
            modifier = Modifier.align(Alignment.Center).padding(bottom = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            SplashLogo(width = logoWidth, time = time, reduce = reduce)
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Ton cinéma personnel".uppercase(Locale.FRENCH),
                style = MovvizBetaTextStyles.eyebrow.copy(letterSpacing = 3.8.sp),
                color = EyebrowTint,
                modifier = Modifier.graphicsLayer {
                    alpha = ProjectionSplashTimeline.textAlpha(time(), ProjectionSplashTimeline.EYEBROW_DELAY_MS)
                },
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = "Le cinéma prend vie.",
                style = MovvizBetaTextStyles.splashHeadline,
                color = HeadlineTint,
                modifier = Modifier.graphicsLayer {
                    val a = ProjectionSplashTimeline.textAlpha(time(), ProjectionSplashTimeline.HEADLINE_DELAY_MS)
                    alpha = a
                    if (!reduce) translationY = (1f - a) * 8.dp.toPx()
                },
            )
        }
        SplashLoading(
            progress = progress,
            message = message,
            sweep = ambient?.sweep,
            reduce = reduce,
            focused = focused,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = maxHeight * 0.08f),
        )
    }
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
    focused: Boolean = false,
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
        ProjectionSplash(progress = progress, message = message, ready = ready || !visible, focused = focused)
    }
}

/** Boucles d'ambiance (reflet de la barre, faisceaux) — composées seulement
 *  pendant le chargement et hors mouvement réduit. */
private class SplashAmbient(val sweep: State<Float>, val beamA: State<Float>, val beamB: State<Float>)

@Composable
private fun rememberSplashAmbient(): SplashAmbient {
    val transition = rememberInfiniteTransition(label = "splashAmbient")
    val sweep = transition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1600, easing = LinearEasing), RepeatMode.Restart),
        label = "splashSweep",
    )
    val beamA = transition.animateFloat(
        initialValue = 0.35f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(6000, easing = MovvizMotion.EaseInOut), RepeatMode.Reverse),
        label = "splashBeamA",
    )
    val beamB = transition.animateFloat(
        initialValue = 1f, targetValue = 0.35f,
        animationSpec = infiniteRepeatable(tween(7000, easing = MovvizMotion.EaseInOut), RepeatMode.Reverse),
        label = "splashBeamB",
    )
    return remember(sweep, beamA, beamB) { SplashAmbient(sweep, beamA, beamB) }
}

/** Fond, projecteur, halos, faisceaux, orbites, horizon, coins, puis les
 *  volets PAR-DESSUS le contenu. Pinceaux mis en cache par taille. */
private fun Modifier.splashBackdrop(
    time: () -> Float,
    orbitFade: () -> Float,
    ambient: SplashAmbient?,
    reduce: Boolean,
): Modifier = drawWithCache {
    val w = size.width
    val h = size.height
    val center = Offset(w / 2f, h * 0.44f)
    val projectorRadius = min(w, h) * 0.62f
    val projector = Brush.radialGradient(
        0f to ProjectorCore, 0.3f to ProjectorMid, 0.6f to Color.Transparent,
        center = center, radius = projectorRadius,
    )
    val haloRadius = w * 0.5f
    val violet = Brush.radialGradient(listOf(HaloViolet, Color.Transparent), center = Offset(w * 0.08f, h * 0.05f), radius = haloRadius)
    val cyan = Brush.radialGradient(listOf(HaloCyan, Color.Transparent), center = Offset(w * 0.94f, h * 0.98f), radius = haloRadius)
    val beam = Brush.verticalGradient(listOf(Color.Transparent, HaloViolet.copy(alpha = 0.18f), Color.Transparent))
    val orbitDiameter = min(475.dp.toPx(), 1.45f * w)
    val orbitSize = Size(orbitDiameter, orbitDiameter * 0.48f)
    val orbitTopLeft = Offset(center.x - orbitSize.width / 2f, center.y - orbitSize.height / 2f)
    val hairline = 1.dp.toPx()
    val dotRadius = 2.5.dp.toPx() / 2f
    val horizon = Brush.horizontalGradient(listOf(Color.Transparent, OrbitViolet.copy(alpha = 0.55f), Color.Transparent))
    val corner = 14.dp.toPx()
    val inset = 16.dp.toPx()

    fun DrawScope.orbit(color: Color, durationMs: Float, clockwise: Boolean, dotAngle: Float) {
        val entry = if (reduce) 1f else ProjectionSplashTimeline.orbitEntry(time(), durationMs)
        val alpha = entry * orbitFade()
        if (alpha <= 0f) return
        val s = ProjectionSplashTimeline.orbitScale(entry)
        rotate(ProjectionSplashTimeline.orbitRotation(entry, clockwise), pivot = center) {
            scale(s, pivot = center) {
                drawOval(color, orbitTopLeft, orbitSize, alpha = alpha, style = Stroke(hairline))
                val dot = Offset(
                    center.x + orbitSize.width / 2f * cos(dotAngle),
                    center.y + orbitSize.height / 2f * sin(dotAngle),
                )
                drawCircle(OrbitDot, radius = dotRadius, center = dot, alpha = alpha)
            }
        }
    }

    onDrawWithContent {
        val t = time()
        drawRect(SplashBackground)
        drawRect(violet)
        drawRect(cyan)
        val projectorAlpha = if (reduce) 1f else ProjectionSplashTimeline.projectorAlpha(t)
        val projectorScale = if (reduce) 1f else ProjectionSplashTimeline.projectorScale(t)
        scale(projectorScale, pivot = center) { drawRect(projector, alpha = projectorAlpha) }
        if (ambient != null) {
            rotate(-30f, pivot = center) { drawRect(beam, Offset(center.x - w * 0.12f, -h), Size(w * 0.24f, h * 3f), alpha = ambient.beamA.value) }
            rotate(30f, pivot = center) { drawRect(beam, Offset(center.x - w * 0.12f, -h), Size(w * 0.24f, h * 3f), alpha = ambient.beamB.value) }
        }
        if (!reduce) {
            orbit(OrbitViolet, ProjectionSplashTimeline.ORBIT_A_MS, clockwise = false, dotAngle = 0.35f)
            orbit(OrbitCyan, ProjectionSplashTimeline.ORBIT_B_MS, clockwise = true, dotAngle = 3.6f)
        }
        val horizonY = h * 0.57f
        val horizonScale = if (reduce) 1f else ProjectionSplashTimeline.horizonScaleX(t)
        scale(horizonScale, 1f, pivot = Offset(w / 2f, horizonY)) {
            drawRect(horizon, Offset(0f, horizonY), Size(w, hairline))
        }
        drawFrameCorners(inset, corner, hairline)
        drawContent()
        if (!reduce) {
            val open = ProjectionSplashTimeline.shutterOpen(t)
            if (open < 1f) {
                val half = w / 2f
                drawRect(SplashBackground, Offset(-half * open, 0f), Size(half, h))
                drawRect(SplashBackground, Offset(half + half * open, 0f), Size(half, h))
            }
        }
    }
}

private fun DrawScope.drawFrameCorners(inset: Float, length: Float, stroke: Float) {
    val color = FrameCorner
    val alpha = 0.45f
    val r = size.width - inset
    val b = size.height - inset
    // Haut-gauche, haut-droit, bas-droit, bas-gauche : deux traits par coin.
    drawRect(color, Offset(inset, inset), Size(length, stroke), alpha)
    drawRect(color, Offset(inset, inset), Size(stroke, length), alpha)
    drawRect(color, Offset(r - length, inset), Size(length, stroke), alpha)
    drawRect(color, Offset(r - stroke, inset), Size(stroke, length), alpha)
    drawRect(color, Offset(r - length, b - stroke), Size(length, stroke), alpha)
    drawRect(color, Offset(r - stroke, b - length), Size(stroke, length), alpha)
    drawRect(color, Offset(inset, b - stroke), Size(length, stroke), alpha)
    drawRect(color, Offset(inset, b - length), Size(stroke, length), alpha)
}

/** Lockup officiel révélé par une fente horizontale qui s'ouvre, avec un
 *  reflet qui ne peint que les pixels du logo (calque hors écran + SrcAtop). */
@Composable
private fun SplashLogo(width: androidx.compose.ui.unit.Dp, time: () -> Float, reduce: Boolean) {
    Image(
        painter = painterResource(R.drawable.movviz_lockup),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .size(width)
            .graphicsLayer {
                val t = time()
                alpha = ProjectionSplashTimeline.logoAlpha(t)
                val s = if (reduce) 1f else ProjectionSplashTimeline.logoScale(t)
                scaleX = s
                scaleY = s
                compositingStrategy = CompositingStrategy.Offscreen
            }
            .drawWithCache {
                val band = size.width * 0.35f
                val sheen = Brush.linearGradient(
                    listOf(Color.Transparent, Color.White.copy(alpha = 0.55f), Color.Transparent),
                    start = Offset(0f, 0f),
                    end = Offset(band, size.height * 0.4f),
                )
                onDrawWithContent {
                    val t = time()
                    val inset = if (reduce) 0f else ProjectionSplashTimeline.logoClipInset(t) * size.height
                    clipRect(top = inset, bottom = size.height - inset) {
                        this@onDrawWithContent.drawContent()
                        if (!reduce) {
                            val x = ProjectionSplashTimeline.sheenPosition(t) * size.width - band / 2f
                            if (x > -band && x < size.width) {
                                translate(left = x) {
                                    drawRect(sheen, Offset.Zero, Size(band, size.height), blendMode = BlendMode.SrcAtop)
                                }
                            }
                        }
                    }
                }
            },
    )
}

/** Bloc de chargement (200 dp utiles) : libellé + pourcentage, piste 3 dp, remplissage
 *  dégradé ancré à gauche (200 ms linéaire), reflet en boucle. */
@Composable
private fun SplashLoading(
    progress: Int?,
    message: String?,
    sweep: State<Float>?,
    reduce: Boolean,
    focused: Boolean,
    modifier: Modifier = Modifier,
) {
    val fraction by animateFloatAsState(
        targetValue = ProjectionSplashTimeline.progressFraction(progress),
        animationSpec = if (reduce) snap() else tween(200, easing = LinearEasing),
        label = "splashProgress",
    )
    val ringShape = RoundedCornerShape(10.dp)
    Column(
        modifier = modifier
            .width(220.dp)
            .movvizFocusRing(ringShape, focused = { focused })
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(
                text = message ?: "Préparation de ton cinéma…",
                style = TextStyle(fontFamily = MovvizUiFonts, fontWeight = FontWeight.Medium, fontSize = 12.sp),
                color = LoadingLabel,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            if (progress != null) {
                Text(
                    text = "${progress.coerceIn(0, 100)} %",
                    style = MovvizBetaTextStyles.count,
                    color = LoadingPercent,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(3.dp)
                .drawWithCache {
                    val radius = androidx.compose.ui.geometry.CornerRadius(size.height / 2f)
                    val fill = Brush.horizontalGradient(
                        0f to MovvizBetaPalette.progressFill[0],
                        0.55f to MovvizBetaPalette.progressFill[1],
                        1f to MovvizBetaPalette.progressFill[2],
                    )
                    val bandWidth = size.width * 0.35f
                    val light = Brush.horizontalGradient(
                        listOf(Color.Transparent, Color.White.copy(alpha = 0.45f), Color.Transparent),
                        startX = 0f, endX = bandWidth,
                    )
                    onDrawBehind {
                        drawRoundRect(LoadingTrack, cornerRadius = radius)
                        val filled = size.width * fraction
                        if (filled > 0f) drawRoundRect(fill, size = Size(filled, size.height), cornerRadius = radius)
                        val s = sweep?.value ?: return@onDrawBehind
                        val x = -bandWidth + (size.width + bandWidth) * s
                        translate(left = x) {
                            drawRect(light, Offset.Zero, Size(bandWidth, size.height))
                        }
                    }
                },
        )
    }
}

@androidx.compose.ui.tooling.preview.Preview(device = "id:tv_1080p", showBackground = true)
@Composable
private fun ProjectionSplashPreview() {
    MovvizTvTheme(beta = true) { ProjectionSplash(progress = 42, message = "Synchronisation de la bibliothèque") }
}
