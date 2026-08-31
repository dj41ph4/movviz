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
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.tv.R
import kotlin.math.cos
import kotlin.math.sin

private data class OrbitParticle(val radiusDp: Float, val periodMs: Int, val phaseDeg: Float, val reverse: Boolean, val color: Color)

/*
 * Valeurs relevées directement dans src/components/fx/AnimatedLogo.tsx.
 * Les délais CSS négatifs sont convertis en position initiale sur l'orbite :
 * -2 / 6.5 tour en sens inverse = -110.769°, -4.5 / 8 = 202.5°.
 */
private val DESKTOP_PARTICLES = listOf(
    OrbitParticle(radiusDp = 30f, periodMs = 4500, phaseDeg = 0f, reverse = false, color = MovvizCyan),
    OrbitParticle(radiusDp = 34f, periodMs = 6500, phaseDeg = -110.76923f, reverse = true, color = MovvizFlowMagenta),
    OrbitParticle(radiusDp = 25f, periodMs = 8000, phaseDeg = 202.5f, reverse = false, color = MovvizBrand2),
)

/**
 * Port exact du mark desktop `src/components/fx/AnimatedLogo.tsx`.
 *
 * Il conserve les cinq éléments de l'original : halo aurora conique (5 s),
 * deux ondes (2,8 s, décalées de 1,4 s), trois particules, pulsation centrale
 * (3 s) et le même Clapperboard Lucide en trait 2,5. La Box ne clippe jamais
 * les effets extérieurs, comme le div HTML du desktop.
 */
@Composable
fun AnimatedLogo(size: Dp = 56.dp) {
    val infinite = rememberInfiniteTransition(label = "movviz_logo")

    // Framer Motion : scale [1, 1.05, 1], 3 secondes ease-in-out.
    val breathe by infinite.floatLoop(1f, 1.05f, 1500, FastOutSlowInEasing, RepeatMode.Reverse)
    // .logo-halo { animation: logoSpin 5s linear infinite }
    val haloRotation by infinite.floatLoop(0f, 360f, 5000, LinearEasing, RepeatMode.Restart)
    // .logo-ripple { scale .75 -> 2.1, opacity .55 -> 0, 2.8s ease-out }
    val ripple1 by infinite.floatLoop(0f, 1f, 2800, FastOutSlowInEasing, RepeatMode.Restart)
    val ripple2 = (ripple1 + .5f) % 1f

    // SIZES.md du composant desktop : outer 56, inner 44, icon 20, halo -12.
    // À 40dp (rail) ces valeurs deviennent exactement le preset desktop sm.
    val innerSize = if (size <= 40.dp) size else size * (44f / 56f)
    val iconSize = if (size <= 40.dp) size * .5f else size * (20f / 56f)
    val haloInset = if (size <= 40.dp) 10.dp else size * (12f / 56f)

    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        MulticolorBlurHalo(size = size + haloInset * 2, rotation = haloRotation)

        RippleRing(size = size, progress = ripple1, color = MovvizBrand.copy(alpha = .4f))
        RippleRing(size = size, progress = ripple2, color = MovvizFlowMagenta.copy(alpha = .3f))

        DESKTOP_PARTICLES.forEach { p -> OrbitDot(particle = p) }

        // Equivalent visuel du box-shadow .logo-glow-pulse sous le mark.
        Box(
            modifier = Modifier
                .size(innerSize + 10.dp)
                .scale(breathe)
                .background(
                    Brush.radialGradient(
                        listOf(MovvizFlowMagenta.copy(alpha = .65f), MovvizBrand.copy(alpha = .35f), Color.Transparent),
                    ),
                    CircleShape,
                )
                .blur(9.dp, edgeTreatment = BlurredEdgeTreatment.Unbounded),
        )
        Box(
            modifier = Modifier
                .size(innerSize)
                .scale(breathe)
                .clip(RoundedCornerShape(if (size <= 40.dp) 16.dp else 18.dp))
                // .brand-gradient : violet -> violet clair -> magenta, 120deg
                .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2, MovvizFlowMagenta))),
            contentAlignment = Alignment.Center,
        ) {
            ClapperboardGlyph(Modifier.size(iconSize))
        }
    }
}

/**
 * Version immobile du même mark pour une tuile : aucun anneau, aucune
 * particule, aucune pulsation, mais le halo aurora multicolore est conservé
 * comme demandé. Elle ne sert jamais au rail, qui utilise AnimatedLogo.
 */
@Composable
fun StaticLogo(size: Dp = 30.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(size * .4f))
            .background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2, MovvizFlowMagenta))),
        contentAlignment = Alignment.Center,
    ) {
        // La même géométrie Lucide que le logo desktop, sans version
        // « simplifiée » : le rail, le login et le launcher parlent enfin
        // d'une seule marque.
        // Desktop sm : icône 20px dans un carré 40px.
        ClapperboardGlyph(Modifier.size(size * 0.5f))
    }
}

/** Variante de tuile/dashboard : même halo multicolore que le logo animé,
 * mais entièrement fixe. Elle garde la présence de marque sans transformer
 * chaque carte de contenu en animation permanente. */
@Composable
fun StaticLogoWithGlow(size: Dp = 54.dp) {
    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        MulticolorBlurHalo(size = size + 24.dp, rotation = 0f)
        StaticLogo(size = size * (44f / 56f))
    }
}

/**
 * Même VectorDrawable que le `Clapperboard` Lucide du desktop : l'asset XML
 * reprend son SVG à l'identique, ce composable ne fait que l'afficher.
 */
@Composable
private fun ClapperboardGlyph(modifier: Modifier) {
    Image(
        painter = painterResource(R.drawable.ic_movviz_clapperboard),
        contentDescription = null,
        colorFilter = ColorFilter.tint(Color.White),
        modifier = modifier,
    )
}

/**
 * Halo aurora uniquement. Quatre nappes radiales transparentes donnent le
 * même mélange conique + blur du CSS, sans que RenderEffect ne dilue les
 * couleurs jusqu'au noir sur certains profils d'émulateur Android TV.
 */
@Composable
private fun MulticolorBlurHalo(size: Dp, rotation: Float) {
    Canvas(modifier = Modifier.size(size).rotate(rotation)) {
        val radius = this.size.minDimension * .48f
        val center = Offset(this.size.width / 2f, this.size.height / 2f)
        fun diffuse(color: Color, x: Float, y: Float) {
            val origin = Offset(center.x + radius * x, center.y + radius * y)
            drawCircle(
                brush = Brush.radialGradient(
                    0f to color.copy(alpha = .92f),
                    .38f to color.copy(alpha = .56f),
                    .72f to color.copy(alpha = .18f),
                    1f to Color.Transparent,
                    center = origin,
                    radius = radius,
                ),
                radius = radius,
                center = origin,
            )
        }
        // Même ordre chromatique que le conic-gradient desktop.
        diffuse(MovvizBrand, -.32f, -.34f)
        diffuse(MovvizFlowMagenta, .38f, -.22f)
        diffuse(MovvizCyan, .28f, .38f)
        diffuse(MovvizBrand2, -.38f, .28f)
    }
}

@Composable
private fun RippleRing(size: Dp, progress: Float, color: Color) {
    Box(
        modifier = Modifier
            .size(size)
            .scale(.75f + progress * 1.35f)
            .border(1.dp, color.copy(alpha = color.alpha * (.55f * (1f - progress))), CircleShape),
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
            .size(8.dp)
            .background(
                Brush.radialGradient(listOf(Color.White.copy(alpha = .9f), particle.color, particle.color.copy(alpha = .1f))),
                CircleShape,
            )
            .blur(1.dp),
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
    val shift by infinite.floatLoop(0f, 1f, 8000, LinearEasing, RepeatMode.Restart)

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
