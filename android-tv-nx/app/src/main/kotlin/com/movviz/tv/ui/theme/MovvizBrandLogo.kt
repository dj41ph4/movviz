package com.movviz.tv.ui.theme

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import com.movviz.tv.R

// ────────────────────────────────────────────────────────────────
// Logos Bêta « M ruban » : logo horizontal (M + MOVVIZ) et M seul, mêmes fichiers que le web
// (public/brand/m). Le reflet ne s'applique QU'AUX formes du logo (couche + SrcAtop) : jamais
// de rectangle visible. Une horloge, lue au dessin seulement.
// ────────────────────────────────────────────────────────────────

private const val FULL_ASPECT = 960f / 213f
private const val CYCLE_MS = 7000
private val SweepColors = listOf(Color(0x00FFFFFF), Color(0x70FFFFFF), Color(0x00FFFFFF))

/** Logo horizontal (M + MOVVIZ) : barre latérale étendue, connexion, chargements. */
@Composable
fun MovvizFullLogo(height: Dp, modifier: Modifier = Modifier) =
    BrandLogo(R.drawable.movviz_brand_logo, FULL_ASPECT, height, modifier)

/** M seul : barre de navigation repliée, splash. `size` est sa hauteur. */
@Composable
fun MovvizMarkO(size: Dp, modifier: Modifier = Modifier) =
    BrandLogo(R.drawable.movviz_brand_m, CinemaSplashGeometry.MARK_ASPECT, size, modifier)

@Composable
private fun BrandLogo(@DrawableRes resource: Int, aspect: Float, height: Dp, modifier: Modifier) {
    val painter = painterResource(resource)
    val reduce = LocalMovvizReduceMotion.current
    val phase = if (reduce) {
        null
    } else {
        rememberInfiniteTransition(label = "brandLogo").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(CYCLE_MS, easing = LinearEasing)),
            label = "brandLogoPhase",
        )
    }
    val layerPaint = remember { Paint() }
    Canvas(
        modifier
            .height(height)
            .aspectRatio(aspect)
            .clearAndSetSemantics { contentDescription = "Movviz" },
    ) {
        val w = size.width
        val h = size.height
        drawIntoCanvas { canvas ->
            canvas.saveLayer(Rect(0f, 0f, w, h), layerPaint)
            with(painter) { draw(size) }
            val p = phase?.value ?: -1f
            if (p >= 0f) {
                if (p < SWEEP_END) {
                    val e = CinemaSplashGeometry.easeInOut(p / SWEEP_END)
                    val bx = -0.25f * w + 1.5f * w * e
                    drawRect(
                        brush = Brush.linearGradient(SweepColors, start = Offset(bx - 0.12f * w, 0f), end = Offset(bx + 0.12f * w, h * 0.6f)),
                        blendMode = BlendMode.SrcAtop,
                    )
                }
            }
            canvas.restore()
        }
    }
}

private const val SWEEP_END = 0.3f

