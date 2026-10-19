package com.movviz.tv.ui.theme

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.movviz.tv.R
import java.util.Locale
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// ────────────────────────────────────────────────────────────────
// Splash Bêta « M ruban » : nuit violette, le M au centre avec sa lueur, MOVVIZ dessous,
// une barre fine qui suit l'avancement RÉEL. Sobre et instantané : trois petites images
// livrées prêtes (M, lueur pré-floutée, mot), aucun calcul de pixels. Les animations ne lisent
// leur horloge qu'au dessin (graphicsLayer / offset lambda) : aucune recomposition par image.
// Même composition que le splash web (src/components/dashboard/dashboard-splash.css).
// ────────────────────────────────────────────────────────────────

/** Géométrie pure du splash (testable sans Android). */
object CinemaSplashGeometry {
    /** Proportions des images livrées (largeur / hauteur). */
    const val MARK_ASPECT = 640f / 442f
    const val WORD_ASPECT = 720f / 248f

    /** Centre du M, en fraction de la hauteur. */
    const val MARK_CENTER_Y = 0.41f

    /** Largeur du M : 19 % de la largeur disponible, entre 150 et 290 dp. */
    fun markWidth(screenWidthDp: Float): Float = (screenWidthDp * 0.19f).coerceIn(150f, 290f)

    fun easeInOut(x: Float): Float {
        val t = x.coerceIn(0f, 1f)
        return if (t < 0.5f) 4f * t * t * t else 1f - Math.pow((-2.0 * t + 2.0), 3.0).toFloat() / 2f
    }
}

private val SplashBackground = Brush.radialGradient(
    0f to Color(0xFF1D0B42),
    0.48f to Color(0xFF0E0623),
    1f to Color(0xFF05030B),
)
private val BarFill = Brush.horizontalGradient(listOf(Color(0xFF5B20D4), Color(0xFFA13CFF), Color(0xFFF3E8FF)))
private val LabelColor = Color(0x99D8CCF5)

/** Décor seul (fond + M immobile), aux mêmes place et taille : affiché dès le lancement, avant le reste. */
@Composable
fun CinemaSplashBackdrop(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.fillMaxSize().background(SplashBackground)) {
        val markW = CinemaSplashGeometry.markWidth(maxWidth.value).dp
        val markH = markW / CinemaSplashGeometry.MARK_ASPECT
        Image(
            painter = painterResource(R.drawable.movviz_brand_m),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = maxHeight * CinemaSplashGeometry.MARK_CENTER_Y - markH / 2)
                .size(markW, markH),
        )
    }
}

/**
 * Splash cinématique Bêta (plein écran, non focalisable).
 *
 * @param progress avancement réel 0..100, ou null si inconnu (la barre montre alors un filet de vie).
 * @param message libellé de l'étape en cours ; null = « Préparation de ton cinéma… ».
 * @param ready chargement terminé : la barre se remplit.
 * @param focused anneau de focus autour du bloc de chargement quand la vraie cible de focus
 *  (bloc de chargement de l'accueil) est sous la surcouche.
 */
@Composable
fun CinemaSplash(
    modifier: Modifier = Modifier,
    progress: Int? = null,
    message: String? = null,
    ready: Boolean = false,
    focused: Boolean = false,
) {
    val reduce = LocalMovvizReduceMotion.current
    val fraction by animateFloatAsState(
        targetValue = if (ready) 1f else maxOf(ProjectionSplashTimeline.progressFraction(progress), 0.03f),
        animationSpec = if (reduce) snap() else tween(500),
        label = "splashProgress",
    )
    // Le décor affichait déjà le M à cette place : il ne bouge pas. Le mot puis la barre apparaissent.
    val wordIn = remember { Animatable(if (reduce) 1f else 0f) }
    val barIn = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(reduce) {
        if (reduce) return@LaunchedEffect
        coroutineScope {
            launch { delay(350); wordIn.animateTo(1f, tween(800, easing = MovvizMotion.EaseOut)) }
            launch { delay(600); barIn.animateTo(1f, tween(700, easing = MovvizMotion.EaseOut)) }
        }
    }
    val glow by rememberInfiniteTransition(label = "splashGlow").animateFloat(
        initialValue = 0.55f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(tween(2500, easing = LinearEasing), RepeatMode.Reverse),
        label = "splashGlowAlpha",
    )

    BoxWithConstraints(
        modifier
            .fillMaxSize()
            .background(SplashBackground)
            .clearAndSetSemantics { contentDescription = "Movviz" },
    ) {
        val markW = CinemaSplashGeometry.markWidth(maxWidth.value).dp
        val markH = markW / CinemaSplashGeometry.MARK_ASPECT
        val centerY = maxHeight * CinemaSplashGeometry.MARK_CENTER_Y
        val glowW = markW * 1.55f
        val glowH = glowW / CinemaSplashGeometry.MARK_ASPECT
        val wordW = markW * 0.7f
        val wordH = wordW / CinemaSplashGeometry.WORD_ASPECT
        val wordTop = centerY + markH / 2 + 24.dp
        val barTop = wordTop + wordH + 30.dp
        val barW = markW * 0.72f

        // Lueur derrière le ruban : une copie floutée livrée prête, seule son opacité respire.
        Image(
            painter = painterResource(R.drawable.movviz_brand_m_glow),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = centerY - glowH / 2)
                .size(glowW, glowH)
                .graphicsLayer { alpha = if (reduce) 0.6f else glow },
        )
        // Le M, traversé de temps en temps par un reflet découpé à sa forme exacte.
        MovvizMarkO(
            size = markH,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = centerY - markH / 2),
        )
        Image(
            painter = painterResource(R.drawable.movviz_brand_word),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset { IntOffset(0, (wordTop + 8.dp * (1f - wordIn.value)).roundToPx()) }
                .size(wordW, wordH)
                .graphicsLayer { alpha = wordIn.value },
        )
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .offset(y = barTop)
                .size(barW, 2.dp)
                .graphicsLayer { alpha = barIn.value }
                .clip(RoundedCornerShape(1.dp))
                .background(Color(0x14FFFFFF)),
        ) {
            Box(
                Modifier
                    .fillMaxHeight()
                    .width(barW * fraction.coerceIn(0f, 1f))
                    .background(BarFill),
            )
        }
        Text(
            text = (message ?: stringResource(R.string.splash_preparing)).uppercase(Locale.getDefault()),
            style = TextStyle(fontFamily = MovvizUiFonts, fontWeight = FontWeight.Normal, fontSize = 11.sp, letterSpacing = 2.4.sp),
            color = LabelColor,
            maxLines = 1,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = barTop + 14.dp)
                .graphicsLayer { alpha = barIn.value },
        )
        // Anneau de focus : seulement quand la vraie cible de focus est sous la surcouche.
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .offset(y = barTop - 18.dp)
                .size(barW + 48.dp, 56.dp)
                .graphicsLayer { alpha = barIn.value }
                .movvizFocusRing(RoundedCornerShape(12.dp), focused = { focused }),
        )
    }
}
