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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
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
            Text(text = "🎬", style = TextStyle(fontSize = (size.value * 0.34f).sp))
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
