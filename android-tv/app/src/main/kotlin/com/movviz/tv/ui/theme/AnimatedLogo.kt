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
import androidx.compose.ui.graphics.drawscope.Stroke
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
            // Desktop md : icône 20px dans un carré 44px. Même rapport ici,
            // sinon le trait Lucide devient une masse blanche à l'écran TV.
            ClapperboardGlyph(Modifier.size(size * 0.33f))
        }
    }
}

/**
 * Version statique du logo (clap seul, sans halo/ripples/particules en
 * orbite) — pour les contextes compacts (rail de navigation persistant,
 * en-têtes de liste) où AnimatedLogo() a été jugé "sale" à petite taille :
 * les particules en orbite (rayon jusqu'à 34dp) débordent d'une Box
 * dimensionnée pour un logo de 30dp et flottent, décrochées, à côté du
 * texte "Movviz" au lieu de rester perçues comme faisant partie du logo.
 * Le halo/ripples/particules restent réservés aux grands formats (splash,
 * login, wizard, size=56dp) où ils ont la place de se déployer proprement.
 */
@Composable
fun StaticLogo(size: Dp = 30.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(size.value * 0.22f))
            .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))),
        contentAlignment = Alignment.Center,
    ) {
        // La même géométrie Lucide que le logo desktop, sans version
        // « simplifiée » : le rail, le login et le launcher parlent enfin
        // d'une seule marque.
        // Desktop sm : icône 20px dans un carré 40px.
        ClapperboardGlyph(Modifier.size(size * 0.5f))
    }
}

/** Les quatre paths du Clapperboard Lucide importé par AnimatedLogo.tsx.
 * Centraliser ce dessin interdit tout retour d'une seconde icône Android. */
@Composable
private fun ClapperboardGlyph(modifier: Modifier) {
    Canvas(modifier = modifier) {
        val u = size.width / 24f
        val stroke = Stroke(width = 2.5f * u, cap = StrokeCap.Round)
        fun p(x: Float, y: Float) = Offset(x * u, y * u)
        val top = androidx.compose.ui.graphics.Path().apply {
            moveTo(20.2f * u, 6f * u); lineTo(3f * u, 11f * u); lineTo(2.1f * u, 8.6f * u)
            cubicTo(1.8f * u, 7.5f * u, 2.4f * u, 6.4f * u, 3.4f * u, 6.1f * u)
            lineTo(16.9f * u, 2.1f * u); cubicTo(18f * u, 1.8f * u, 19.1f * u, 2.4f * u, 19.4f * u, 3.4f * u)
            close()
        }
        val body = androidx.compose.ui.graphics.Path().apply {
            moveTo(3f * u, 11f * u); lineTo(21f * u, 11f * u); lineTo(21f * u, 19f * u)
            quadraticBezierTo(21f * u, 21f * u, 19f * u, 21f * u); lineTo(5f * u, 21f * u)
            quadraticBezierTo(3f * u, 21f * u, 3f * u, 19f * u); close()
        }
        drawPath(top, Color.White, style = stroke)
        drawPath(body, Color.White, style = stroke)
        drawLine(Color.White, p(12.296f, 3.464f), p(15.316f, 7.42f), strokeWidth = 2.5f * u, cap = StrokeCap.Round)
        drawLine(Color.White, p(6.18f, 5.276f), p(9.28f, 9.175f), strokeWidth = 2.5f * u, cap = StrokeCap.Round)
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
