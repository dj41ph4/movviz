package com.movviz.tv.ui.theme

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.InfiniteTransition
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import kotlin.math.cos
import kotlin.math.sin

private data class OrbitParticle(val radiusDp: Float, val periodMs: Int, val phaseDeg: Float, val reverse: Boolean, val color: Color)

private val PARTICLES = listOf(
    OrbitParticle(radiusDp = 30f, periodMs = 4500, phaseDeg = 0f, reverse = false, color = Color(0xFF4BC8E0)),
    OrbitParticle(radiusDp = 34f, periodMs = 6500, phaseDeg = 140f, reverse = true, color = Color(0xFFE04BC8)),
    OrbitParticle(radiusDp = 25f, periodMs = 8000, phaseDeg = 260f, reverse = false, color = MovvizBrand2),
)

/**
 * Portage TV de src/components/fx/AnimatedLogo.tsx — même langage visuel
 * (particules en orbite, anneaux d'onde, respiration du carré central en
 * dégradé de marque) plutôt qu'un simple texte statique. Pas de flou réel
 * (pas de dépendance blur disponible ici) : le halo est simulé par un
 * dégradé radial qui tourne lentement, suffisant à distance TV.
 */
@Composable
fun AnimatedLogo(size: Dp = 64.dp) {
    val infinite = rememberInfiniteTransition(label = "movviz_logo")

    val breathe by infinite.floatLoop(1f, 1.06f, 3000, FastOutSlowInEasing, RepeatMode.Reverse)
    val haloRotation by infinite.floatLoop(0f, 360f, 12000, LinearEasing, RepeatMode.Restart)
    val ripple1 by infinite.floatLoop(0f, 1f, 2600, LinearEasing, RepeatMode.Restart)
    val ripple2 by infinite.floatLoop(0f, 1f, 2600, LinearEasing, RepeatMode.Restart, startDelayMs = 1300)

    Box(modifier = Modifier.size(size * 1.9f), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(size * 1.5f)
                .alpha(0.55f)
                .rotate(haloRotation)
                .background(
                    Brush.radialGradient(listOf(MovvizBrand.copy(alpha = 0.35f), Color.Transparent)),
                    CircleShape,
                ),
        )

        RippleRing(size = size, progress = ripple1)
        RippleRing(size = size, progress = ripple2)

        PARTICLES.forEach { p -> OrbitDot(particle = p) }

        Box(
            modifier = Modifier
                .size(size * 0.72f)
                .scale(breathe)
                .clip(RoundedCornerShape(size.value * 0.22f))
                .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))),
            contentAlignment = Alignment.Center,
        ) {
            // Geometrie portee 1:1 depuis public/icon.svg (viewBox 512x512),
            // fractions = coordonnee SVG / 512, pour rester fidele au clap
            // de cinema du logo desktop plutot qu'un emoji generique.
            Canvas(modifier = Modifier.fillMaxSize()) {
                val w = this.size.width
                val h = this.size.height
                val stripeColor = MovvizBrand.copy(alpha = 0.4f)
                val strokeW = 0.0156f * w

                // Corps du clap (panneau translucide)
                drawRoundRect(
                    color = Color.White.copy(alpha = 0.15f),
                    topLeft = Offset(0.2109f * w, 0.2969f * h),
                    size = Size(0.5781f * w, 0.4688f * h),
                    cornerRadius = CornerRadius(0.0391f * w, 0.0391f * h),
                )
                // Barre superieure du clap (rayures diagonales)
                drawRoundRect(
                    color = Color.White.copy(alpha = 0.9f),
                    topLeft = Offset(0.2109f * w, 0.2109f * h),
                    size = Size(0.5781f * w, 0.2109f * h),
                    cornerRadius = CornerRadius(0.0391f * w, 0.0391f * h),
                )
                listOf(
                    Offset(0.3672f * w, 0.2109f * h) to Offset(0.2891f * w, 0.4219f * h),
                    Offset(0.5234f * w, 0.2109f * h) to Offset(0.4453f * w, 0.4219f * h),
                    Offset(0.6797f * w, 0.2109f * h) to Offset(0.6016f * w, 0.4219f * h),
                ).forEach { (a, b) ->
                    drawLine(stripeColor, a, b, strokeWidth = strokeW, cap = StrokeCap.Round)
                }
                // Bobines + ligne de base
                drawLine(
                    stripeColor,
                    Offset(0.2734f * w, 0.5469f * h),
                    Offset(0.7266f * w, 0.5469f * h),
                    strokeWidth = strokeW,
                    cap = StrokeCap.Round,
                )
                drawCircle(Color.White.copy(alpha = 0.9f), radius = 0.0469f * w, center = Offset(0.3281f * w, 0.5859f * h))
                drawCircle(Color.White.copy(alpha = 0.9f), radius = 0.0469f * w, center = Offset(0.6719f * w, 0.5859f * h))
            }
        }
    }
}

@Composable
private fun RippleRing(size: Dp, progress: Float) {
    Box(
        modifier = Modifier
            .size(size)
            .scale(1f + progress * 0.9f)
            .alpha((1f - progress) * 0.6f)
            .border(1.dp, MovvizBrand.copy(alpha = 0.5f), CircleShape),
    )
}

@Composable
private fun OrbitDot(particle: OrbitParticle) {
    val infinite = rememberInfiniteTransition(label = "orbit")
    val angle by infinite.floatLoop(
        from = particle.phaseDeg,
        to = particle.phaseDeg + if (particle.reverse) -360f else 360f,
        durationMs = particle.periodMs,
        easing = LinearEasing,
        repeatMode = RepeatMode.Restart,
    )
    val rad = Math.toRadians(angle.toDouble())
    val dx = (cos(rad) * particle.radiusDp).toFloat()
    val dy = (sin(rad) * particle.radiusDp).toFloat()

    Box(
        modifier = Modifier
            .offset(x = dx.dp, y = dy.dp)
            .size(4.dp)
            .background(particle.color, CircleShape),
    )
}

@Composable
private fun InfiniteTransition.floatLoop(
    from: Float,
    to: Float,
    durationMs: Int,
    easing: Easing,
    repeatMode: RepeatMode,
    startDelayMs: Int = 0,
) = this.animateFloat(
    initialValue = from,
    targetValue = to,
    animationSpec = infiniteRepeatable(
        animation = tween(durationMs, delayMillis = startDelayMs, easing = easing),
        repeatMode = repeatMode,
    ),
    label = "anim",
)

private val WORDMARK_STOPS = listOf(
    MovvizFlowInk, MovvizFlowGlow, MovvizFlowMagenta, MovvizFlowCyan,
    MovvizFlowInk, MovvizFlowGlow, MovvizFlowMagenta, MovvizFlowCyan, MovvizFlowInk,
)

/**
 * Portage de la classe CSS .text-logo-flow (src/app/globals.css) : un texte
 * "Movviz" en degrade 9 stops qui defile lentement, plutot qu'un blanc plat.
 * Compose n'anime pas nativement un Brush de texte via CSS background-size,
 * donc on recalcule le degrade a chaque frame en decalant start/end sur la
 * largeur mesuree du texte, avec TileMode.Mirror pour boucler proprement.
 */
@Composable
fun MovvizWordmark(fontSize: androidx.compose.ui.unit.TextUnit = 28.sp) {
    var widthPx by remember { mutableStateOf(0f) }
    val infinite = rememberInfiniteTransition(label = "wordmark_flow")
    val shift by infinite.floatLoop(0f, 1f, 5000, LinearEasing, RepeatMode.Restart)

    val brush = if (widthPx <= 0f) {
        Brush.linearGradient(WORDMARK_STOPS)
    } else {
        Brush.linearGradient(
            colors = WORDMARK_STOPS,
            start = Offset(-widthPx * shift, 0f),
            end = Offset(widthPx * (2f - shift), 0f),
            tileMode = TileMode.Mirror,
        )
    }

    Text(
        text = "Movviz",
        style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Black, brush = brush),
        modifier = Modifier.onSizeChanged { widthPx = it.width.toFloat() },
    )
}
