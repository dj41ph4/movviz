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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
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

/**
 * Mark Movviz fixe — l'animation orbitale autour du logo (halo tournant,
 * ondes, particules, pulsation) a été retirée : rendu kitsch sur TV.
 * Même signature pour ne toucher à aucun appelant ; le mark officiel
 * (R.drawable.movviz_mark) est affiché tel quel, sans effet.
 */
@Composable
fun AnimatedLogo(size: Dp = 56.dp) {
    StaticLogo(size = size)
}

/**
 * Version immobile du même mark pour une tuile : aucun anneau, aucune
 * particule, aucune pulsation, mais le halo aurora multicolore est conservé
 * comme demandé. Elle ne sert jamais au rail, qui utilise AnimatedLogo.
 */
@Composable
fun StaticLogo(size: Dp = 30.dp) {
    Image(
        painter = painterResource(R.drawable.movviz_mark),
        contentDescription = "Movviz",
        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
        modifier = Modifier.size(size),
    )
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
