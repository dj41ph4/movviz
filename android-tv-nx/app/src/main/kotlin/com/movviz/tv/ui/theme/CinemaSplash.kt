package com.movviz.tv.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Matrix
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import com.movviz.tv.R
import java.util.Locale
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.roundToInt

// ────────────────────────────────────────────────────────────────
// Splash Bêta « cinéma » : une plaque (1672×941) éclairée en direct.
//
// Latence minimale, par construction :
//  • les images sont décodées hors du thread principal dès le lancement (CinemaSplashAssets) ;
//    en attendant, une version 3,7 Ko de la MÊME plaque sert de décor → premier rendu immédiat ;
//  • aucun calcul de pixels : masque du logo, halos et plaque nettoyée sont livrés précalculés ;
//  • aucune recomposition par image : l'horloge n'est lue que pendant le dessin ;
//  • la lumière est faite de cercles/ovales empilés et de peu de dégradés : pas de coût de flou.
// La barre montre l'avancement RÉEL ; le splash n'est jamais focalisable.
// ────────────────────────────────────────────────────────────────

/** Géométrie « cover » : la plaque couvre la zone, centrée (testable, sans Android). */
object CinemaSplashGeometry {
    const val PLATE_W = 1672f
    const val PLATE_H = 941f

    class Cover(val scale: Float, val offsetX: Float, val offsetY: Float)

    fun cover(width: Float, height: Float): Cover {
        if (width <= 0f || height <= 0f) return Cover(1f, 0f, 0f)
        val s = maxOf(width / PLATE_W, height / PLATE_H)
        return Cover(s, (width - PLATE_W * s) / 2f, (height - PLATE_H * s) / 2f)
    }

    /** Lent travelling avant, qui se stabilise (jamais de saut à la boucle : il n'y en a pas). */
    fun zoom(timeSec: Float): Float = 1f + 0.035f * (1f - exp(-timeSec / 5f))

    fun easeInOut(x: Float): Float {
        val t = x.coerceIn(0f, 1f)
        return if (t < 0.5f) 4f * t * t * t else 1f - Math.pow((-2.0 * t + 2.0), 3.0).toFloat() / 2f
    }
}

private const val STILL_TIME = 3.2f
private val SplashBase = Color(0xFF05050B)
private val Plate = IntSize(CinemaSplashGeometry.PLATE_W.toInt(), CinemaSplashGeometry.PLATE_H.toInt())
private val LabelColor = Color(0xDBD0D6EC)
private val TaglineBrush = Brush.horizontalGradient(
    0f to Color(0xFFAAB4D6),
    0.62f to Color(0xFFAAB4D6),
    0.78f to Color(0xFFFFB33D),
    1f to Color(0xFFF58A14),
)

private class Comet(val x0: Float, val y0: Float, val x1: Float, val y1: Float, val durationSec: Float, val phase: Float)

private val Comets = arrayOf(
    Comet(722f, 100f, 1088f, 294f, 3.4f, 0f),
    Comet(1258f, 280f, 1672f, 4f, 4.2f, 0.35f),
    Comet(0f, 584f, 548f, 676f, 3.8f, 0.62f),
    Comet(1214f, 676f, 1672f, 748f, 3.6f, 0.18f),
)

/** Braises : positions déterministes, calculées une seule fois. */
private object Embers {
    const val COUNT = 26
    val x = FloatArray(COUNT)
    val y = FloatArray(COUNT)
    val speed = FloatArray(COUNT)
    val size = FloatArray(COUNT)
    val sway = FloatArray(COUNT)
    val freq = FloatArray(COUNT)
    val alpha = FloatArray(COUNT)

    init {
        var seed = 7L
        fun rnd(): Float {
            seed = seed * 16807L % 2147483647L
            return seed / 2147483647f
        }
        for (i in 0 until COUNT) {
            x[i] = rnd() * CinemaSplashGeometry.PLATE_W
            y[i] = rnd() * CinemaSplashGeometry.PLATE_H
            speed[i] = 10f + rnd() * 28f
            size[i] = 0.7f + rnd() * 2.1f
            sway[i] = rnd() * 6.28f
            freq[i] = 0.5f + rnd() * 1.6f
            alpha[i] = 0.25f + rnd() * 0.55f
        }
    }
}

/** Objets de dessin réutilisés à chaque image (aucune allocation de pinceau stable). */
private class SceneCache(val glow: ImageBitmap) {
    val plusPaint = Paint().apply { blendMode = BlendMode.Plus }
    val skew = Matrix().also { it[0, 1] = -0.32f }
    val barFill = Brush.horizontalGradient(
        0f to Color(0xFFFFD27A),
        0.55f to Color(0xFFFFA62B),
        1f to Color(0xFFFF8A14),
        startX = BAR_X0,
        endX = BAR_X1,
    )
    val sweepColors = listOf(Color(0x00FFF6E1), Color(0xF2FFF6E1), Color(0x00FFF6E1))
    val shineBrush = Brush.verticalGradient(
        0f to Color(0x8CFFFFFF),
        0.5f to Color(0x00FFFFFF),
        startY = BAR_Y,
        endY = BAR_Y + BAR_H,
    )
}

private const val BAR_X0 = 466f
private const val BAR_X1 = 1207f
private const val BAR_Y = 553f
private const val BAR_H = 24f
private val LogoBounds = Rect(466f, 328f, 466f + 746f, 328f + 126f)

/**
 * Splash cinématique Bêta (plein écran, non focalisable).
 *
 * @param progress avancement réel 0..100, ou null si inconnu (la barre montre alors un filet de vie).
 * @param message libellé de l'étape en cours ; null = « Préparation de ton cinéma… ».
 * @param ready chargement terminé : l'éclat de fin se déclenche.
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
    val context = LocalContext.current
    val lowRes = remember { CinemaSplashAssets.lowRes(context) }
    val assets by produceState<CinemaSplashAssets.Loaded?>(CinemaSplashAssets.peek()) {
        value = CinemaSplashAssets.await(context)
    }
    val richAlpha by animateFloatAsState(
        targetValue = if (assets != null) 1f else 0f,
        animationSpec = if (reduce) snap() else tween(350),
        label = "splashRich",
    )
    DisposableEffect(Unit) { onDispose { CinemaSplashAssets.release() } }

    val time = remember { mutableFloatStateOf(if (reduce) STILL_TIME else 0f) }
    LaunchedEffect(reduce) {
        if (reduce) {
            time.floatValue = STILL_TIME
            return@LaunchedEffect
        }
        val start = androidx.compose.runtime.withFrameNanos { it }
        while (true) androidx.compose.runtime.withFrameNanos { time.floatValue = (it - start) / 1_000_000_000f }
    }
    val fraction by animateFloatAsState(
        targetValue = ProjectionSplashTimeline.progressFraction(progress),
        animationSpec = if (reduce) snap() else tween(220, easing = LinearEasing),
        label = "splashProgress",
    )
    val flashStart = remember { mutableFloatStateOf(-1f) }
    LaunchedEffect(ready, progress) {
        if ((ready || (progress ?: 0) >= 100) && flashStart.floatValue < 0f) flashStart.floatValue = time.floatValue
    }
    val cache = remember { SceneCache(CinemaSplashAssets.glow()) }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(SplashBase)
            .clearAndSetSemantics { contentDescription = "Movviz" },
    ) {
        val cover = CinemaSplashGeometry.cover(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        Canvas(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    val z = CinemaSplashGeometry.zoom(time.floatValue)
                    scaleX = z
                    scaleY = z
                },
        ) {
            val t = time.floatValue
            val flash = if (reduce || flashStart.floatValue < 0f) 0f else (1f - (t - flashStart.floatValue) / 1.1f).coerceIn(0f, 1f)
            drawScene(cover, t, maxOf(fraction, MIN_SLIVER), flash, richAlpha, lowRes, assets, reduce, cache)
        }

        val density = LocalDensity.current
        val scale = cover.scale
        val tagline = stringResource(R.string.splash_tagline).uppercase(Locale.getDefault())
        val label = message ?: stringResource(R.string.splash_preparing)
        val tagY = cover.offsetY + 486f * scale
        val labelY = cover.offsetY + 606f * scale
        Text(
            text = tagline,
            style = TextStyle(
                fontFamily = MovvizUiFonts,
                fontWeight = FontWeight.Medium,
                fontSize = with(density) { (17f * scale).toSp() },
                letterSpacing = with(density) { (7.5f * scale).toSp() },
                brush = TaglineBrush,
            ),
            maxLines = 1,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset { IntOffset(0, tagY.roundToInt()) }
                .graphicsLayer { translationY = -size.height / 2f },
        )
        Text(
            text = label,
            style = TextStyle(
                fontFamily = MovvizUiFonts,
                fontWeight = FontWeight.Normal,
                fontSize = with(density) { (17f * scale).toSp() },
                letterSpacing = with(density) { (2f * scale).toSp() },
            ),
            color = LabelColor,
            maxLines = 1,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset { IntOffset(0, labelY.roundToInt()) }
                .graphicsLayer { translationY = -size.height / 2f },
        )
        // Anneau de focus : seulement quand la vraie cible de focus est sous la surcouche.
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .offset { IntOffset(0, (cover.offsetY + 540f * scale).roundToInt()) }
                .size(with(density) { (780f * scale).toDp() }, with(density) { (96f * scale).toDp() })
                .movvizFocusRing(RoundedCornerShape(12.dp), focused = { focused }),
        )
    }
}

private const val MIN_SLIVER = 0.03f

/** Lueur douce : le sprite est étiré (rond ou ovale) et ajouté à la scène, sans bord. */
private fun DrawScope.glow(sprite: ImageBitmap, cx: Float, cy: Float, w: Float, h: Float, alpha: Float) {
    if (alpha <= 0.002f) return
    drawImage(
        sprite,
        dstOffset = IntOffset((cx - w / 2f).roundToInt(), (cy - h / 2f).roundToInt()),
        dstSize = IntSize(w.roundToInt().coerceAtLeast(1), h.roundToInt().coerceAtLeast(1)),
        alpha = alpha.coerceIn(0f, 1f),
        blendMode = BlendMode.Plus,
        filterQuality = FilterQuality.Low,
    )
}

private fun DrawScope.drawScene(
    cover: CinemaSplashGeometry.Cover,
    t: Float,
    prog: Float,
    flash: Float,
    richAlpha: Float,
    lowRes: ImageBitmap,
    assets: CinemaSplashAssets.Loaded?,
    reduce: Boolean,
    cache: SceneCache,
) {
    val energy = 0.55f + 0.45f * prog
    withTransform({
        translate(cover.offsetX, cover.offsetY)
        scale(cover.scale, cover.scale, Offset.Zero)
    }) {
        // 1. décor : basse définition tout de suite, plaque nettoyée en fondu dès qu'elle est décodée
        if (assets == null || richAlpha < 1f) drawImage(lowRes, dstSize = Plate, filterQuality = FilterQuality.Medium)
        if (assets == null) return@withTransform
        drawImage(assets.plate, dstSize = Plate, alpha = richAlpha, filterQuality = FilterQuality.High)

        // 2. halos vivants sur les arêtes orange réelles (calques précalculés, additifs)
        val pulse = 0.7f + 0.3f * sin(t * 2.1f)
        drawImage(assets.bloomWide, dstSize = Plate, alpha = (0.85f * energy * pulse * richAlpha).coerceIn(0f, 1f), blendMode = BlendMode.Plus)
        drawImage(assets.bloomFine, dstSize = Plate, alpha = (0.55f * energy * pulse * richAlpha).coerceIn(0f, 1f), blendMode = BlendMode.Plus)

        if (!reduce) drawComets(t, richAlpha, cache)

        // 3. le mot : la lumière n'éclaire QUE les lettres (masque), jamais un rectangle
        drawLogoLight(assets, t, flash, reduce, cache)

        // 4. anneaux depuis le bouton lecture
        if (!reduce) {
            for (i in 0..1) {
                val r = (t / 2.7f + i * 0.5f) % 1f
                val e = 1f - (1f - r) * (1f - r) * (1f - r)
                drawCircle(
                    color = Color(1f, 0.675f, 0.216f, (1f - r) * (1f - r) * 0.55f * richAlpha),
                    radius = 72f + 78f * e,
                    center = Offset(705f, 386f),
                    style = Stroke(width = 3.2f * (1f - r) + 0.5f),
                )
            }
        }

        // 5. sol : lueur qui monte avec le chargement
        glow(cache.glow, 838f, 750f, 760f, 150f, 0.16f * energy * (0.75f + 0.25f * sin(t * 1.4f)) * richAlpha)

        drawBar(t, prog, flash, richAlpha, reduce, cache)
        if (!reduce) drawEmbers(t, richAlpha, cache)
    }
    // vignette douce : fond les bords
    drawRect(Brush.radialGradient(0.55f to Color.Transparent, 1f to Color(0x6B000000), center = center, radius = size.maxDimension * 0.75f))
}

private fun DrawScope.drawComets(t: Float, richAlpha: Float, cache: SceneCache) {
    for (c in Comets) {
        val cyc = (t / c.durationSec + c.phase) % 1.7f
        if (cyc > 1f) continue
        val tailU = maxOf(0f, cyc - 0.26f)
        val steps = 14
        var px = c.x0 + (c.x1 - c.x0) * tailU
        var py = c.y0 + (c.y1 - c.y0) * tailU
        for (i in 1..steps) {
            val u = tailU + (cyc - tailU) * i / steps
            val nx = c.x0 + (c.x1 - c.x0) * u
            val ny = c.y0 + (c.y1 - c.y0) * u
            val k = i / steps.toFloat()
            drawLine(
                color = Color(1f, 0.58f + 0.35f * k, 0.24f + 0.43f * k * k, (0.05f + 0.8f * k * k) * richAlpha),
                start = Offset(px, py),
                end = Offset(nx, ny),
                strokeWidth = 0.7f + 3.4f * k * k,
                cap = StrokeCap.Round,
                blendMode = BlendMode.Plus,
            )
            px = nx
            py = ny
        }
        glow(cache.glow, px, py, 54f, 54f, 0.8f * richAlpha)
        drawCircle(Color(1f, 0.94f, 0.8f, 0.9f * richAlpha), 4.5f, Offset(px, py), blendMode = BlendMode.Plus)
    }
}

private fun DrawScope.drawLogoLight(assets: CinemaSplashAssets.Loaded, t: Float, flash: Float, reduce: Boolean, cache: SceneCache) {
    val sweepU = ((t - 1.1f) / 2.6f) % 1.8f
    val sweeping = !reduce && t > 1.1f && sweepU < 1f
    if (!sweeping && flash <= 0f) return
    drawIntoCanvas { canvas ->
        canvas.saveLayer(LogoBounds, cache.plusPaint)
        if (sweeping) {
            val bx = -160f + (746f + 320f) * CinemaSplashGeometry.easeInOut(sweepU)
            translate(left = LogoBounds.left, top = LogoBounds.top) {
                withTransform({ transform(cache.skew) }) {
                    drawRect(
                        brush = Brush.horizontalGradient(cache.sweepColors, startX = bx - 120f, endX = bx + 120f),
                        topLeft = Offset(bx - 130f, -10f),
                        size = Size(260f, LogoBounds.height + 20f),
                    )
                }
            }
        }
        if (flash > 0f) drawRect(Color(1f, 0.886f, 0.667f, flash * 0.85f), LogoBounds.topLeft, LogoBounds.size)
        drawImage(assets.logoMask, dstOffset = androidx.compose.ui.unit.IntOffset(LogoBounds.left.toInt(), LogoBounds.top.toInt()), blendMode = BlendMode.DstIn)
        canvas.restore()
    }
}

private fun DrawScope.drawBar(t: Float, prog: Float, flash: Float, richAlpha: Float, reduce: Boolean, cache: SceneCache) {
    val radius = CornerRadius(BAR_H / 2f)
    drawRoundRect(Color(0xEB090D1E), Offset(BAR_X0, BAR_Y), Size(BAR_X1 - BAR_X0, BAR_H), radius)
    drawRoundRect(Color(0x80ACB8D8), Offset(BAR_X0, BAR_Y), Size(BAR_X1 - BAR_X0, BAR_H), radius, style = Stroke(2f))

    val fw = (BAR_X1 - BAR_X0 - 6f) * prog
    if (fw <= 1f) return
    val fillRadius = CornerRadius((BAR_H - 6f) / 2f)
    val fillTop = BAR_Y + 3f
    val fillH = BAR_H - 6f

    // halo de la partie remplie + son reflet sur le sol : lueurs douces étirées à la longueur réelle de la barre
    val mid = BAR_X0 + 3f + fw / 2f
    glow(cache.glow, mid, BAR_Y + BAR_H / 2f, fw + 90f, 70f, 0.42f * richAlpha)
    glow(cache.glow, mid, 790f, fw + 90f, 120f, (0.2f + flash * 0.2f) * richAlpha)

    drawRoundRect(cache.barFill, Offset(BAR_X0 + 3f, fillTop), Size(maxOf(fw, fillH), fillH), fillRadius)
    clipRect(BAR_X0 + 3f, fillTop, BAR_X0 + 3f + fw, fillTop + fillH) {
        drawRect(cache.shineBrush, Offset(BAR_X0, BAR_Y), Size(fw + 6f, BAR_H))
        if (!reduce) {
            val sx = BAR_X0 + ((t * 420f) % (fw + 220f)) - 110f
            drawRect(
                Brush.horizontalGradient(cache.sweepColors.map { it.copy(alpha = it.alpha * 0.55f) }, startX = sx - 60f, endX = sx + 60f),
                Offset(sx - 60f, BAR_Y),
                Size(120f, BAR_H),
            )
        }
    }
    // étincelle de tête de barre
    val hx = BAR_X0 + 3f + fw
    val hy = BAR_Y + BAR_H / 2f
    glow(cache.glow, hx, hy, 96f + flash * 50f, 96f + flash * 50f, 0.85f * richAlpha)
    drawCircle(Color(1f, 0.94f, 0.8f, 0.9f * richAlpha), 6f, Offset(hx, hy), blendMode = BlendMode.Plus)
    if (flash > 0f) {
        // éclat de fin : lueur centrée autour de la barre, courte (pas de trait sur toute la largeur)
        glow(cache.glow, 837f, hy, 720f, 60f, 0.55f * flash)
        glow(cache.glow, 837f, hy, 320f, 160f, 0.22f * flash)
    }
}

private fun DrawScope.drawEmbers(t: Float, richAlpha: Float, cache: SceneCache) {
    val wrap = CinemaSplashGeometry.PLATE_H + 40f
    for (i in 0 until Embers.COUNT) {
        val raw = (Embers.y[i] - t * Embers.speed[i]) % wrap
        val y = if (raw < -20f) raw + wrap else raw
        val x = Embers.x[i] + sin(t * 0.8f + Embers.sway[i]) * 14f
        val tw = 0.5f + 0.5f * sin(t * Embers.freq[i] * 2f + Embers.sway[i])
        val a = Embers.alpha[i] * (0.5f + tw * 0.5f) * richAlpha
        val d = Embers.size[i] * 9f
        glow(cache.glow, x, y, d, d, a)
    }
}

@Suppress("unused")
private const val UNUSED_PI = PI
