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
// Splash Bêta « cinéma » : une plaque 21:9 (1916×821) éclairée en direct.
//
// Latence minimale, par construction :
//  • les images sont décodées hors du thread principal dès le lancement (CinemaSplashAssets) ;
//    en attendant, une version 6 Ko de la MÊME plaque sert de décor → premier rendu immédiat ;
//  • aucun calcul de pixels : masque du logo et calques de néons (un par famille de lignes) sont
//    livrés précalculés ; ils reprennent la couleur et le dégradé réels de la plaque ;
//  • aucune recomposition par image : l'horloge n'est lue que pendant le dessin ;
//  • chaque famille de néons n'est composée qu'une fois par image (une couche, une bande mobile).
// La barre montre l'avancement RÉEL ; le splash n'est jamais focalisable.
// ────────────────────────────────────────────────────────────────

/** Géométrie : la plaque 21:9 s'ajuste exactement en 21:9, rogne les côtés en 16:9, garde le logo entier en étroit. */
object CinemaSplashGeometry {
    const val PLATE_W = 1916f
    const val PLATE_H = 821f

    /** Largeur de plaque toujours visible (le mot entier + marge). */
    const val MIN_VISIBLE_W = 780f

    class Cover(val scale: Float, val offsetX: Float, val offsetY: Float)

    fun cover(width: Float, height: Float): Cover {
        if (width <= 0f || height <= 0f) return Cover(1f, 0f, 0f)
        val aspect = width / height
        val s = if (aspect >= PLATE_W / PLATE_H) width / PLATE_W else width / maxOf(PLATE_H * aspect, MIN_VISIBLE_W)
        return Cover(s, (width - PLATE_W * s) / 2f, (height - PLATE_H * s) / 2f)
    }

    /** Lent travelling avant, qui se stabilise (jamais de saut à la boucle : il n'y en a pas). */
    fun zoom(timeSec: Float): Float = 1f + 0.03f * (1f - exp(-timeSec / 5f))

    fun easeInOut(x: Float): Float {
        val t = x.coerceIn(0f, 1f)
        return if (t < 0.5f) 4f * t * t * t else 1f - Math.pow((-2.0 * t + 2.0), 3.0).toFloat() / 2f
    }
}

/**
 * Familles de néons : chacune est un morceau de la plaque (rectangle en coordonnées plaque) qui
 * suit une direction (la lumière y circule) ou, pour le triangle, tourne autour d'un centre.
 */
object CinemaSplashLayout {
    class Family(
        val drawable: Int,
        val x: Float, val y: Float, val w: Float, val h: Float,
        val conic: Boolean,
        val dx: Float, val dy: Float,
        val period: Float, val phase: Float, val band: Float, val gain: Float,
    ) {
        val cx get() = x + w / 2f
        val cy get() = y + h / 2f

        /** Demi-extension du rectangle le long de la direction. */
        val half: Float get() = (kotlin.math.abs(dx) * w + kotlin.math.abs(dy) * h) / 2f

        /** Demi-longueur de la bande lumineuse. */
        val bandHalf: Float get() = maxOf(30f, half * band)
        val angleDeg: Float get() = Math.toDegrees(kotlin.math.atan2(dy, dx).toDouble()).toFloat()
    }

    val families = listOf(
        Family(R.drawable.splash_lit_tri, 700f, 30f, 470f, 320f, true, 0f, 0f, 5.2f, 0f, 0.2f, 1f),
        Family(R.drawable.splash_lit_beaml, 640f, 0f, 66f, 345f, false, 0f, 1f, 3.6f, 0.1f, 0.45f, 0.9f),
        Family(R.drawable.splash_lit_beamr, 1210f, 0f, 66f, 345f, false, 0f, 1f, 3.6f, 0.6f, 0.45f, 0.9f),
        Family(R.drawable.splash_lit_ceill, 0f, 0f, 640f, 205f, false, 0.89f, 0.46f, 4.1f, 0.2f, 0.32f, 1f),
        Family(R.drawable.splash_lit_ceilr, 1276f, 0f, 640f, 205f, false, -0.89f, 0.46f, 4.1f, 0.7f, 0.32f, 1f),
        Family(R.drawable.splash_lit_pilll, 490f, 205f, 150f, 375f, false, 0f, -1f, 3.4f, 0.35f, 0.38f, 1f),
        Family(R.drawable.splash_lit_pillr, 1276f, 205f, 150f, 375f, false, 0f, -1f, 3.4f, 0.85f, 0.38f, 1f),
        Family(R.drawable.splash_lit_floorl, 0f, 575f, 958f, 246f, false, -1f, 0f, 4.6f, 0.5f, 0.3f, 1f),
        Family(R.drawable.splash_lit_floorr, 958f, 575f, 958f, 246f, false, 1f, 0f, 4.6f, 0.05f, 0.3f, 1f),
    )

    const val TRI_CX = 940f
    const val TRI_CY = 215f
}

private const val STILL_TIME = 3.2f
private val SplashBase = Color(0xFF05050B)
private val Plate = IntSize(CinemaSplashGeometry.PLATE_W.toInt(), CinemaSplashGeometry.PLATE_H.toInt())
private val LabelColor = Color(0xE0DCD8F0)
private val TaglineBrush = Brush.horizontalGradient(
    0f to Color(0xFFD4CFF0),
    1f to Color(0xFFBDA7FF),
)

private const val BAR_X0 = 686f
private const val BAR_X1 = 1234f
private const val BAR_Y = 510f
private const val BAR_H = 26f
private const val CX = 958f
private const val TAG_Y = 457f
private const val LABEL_Y = 564f
private val LogoBounds = Rect(620f, 290f, 620f + 686f, 290f + 146f)

/** Braises : positions déterministes, calculées une seule fois. */
private object Embers {
    const val COUNT = 14
    val x = FloatArray(COUNT)
    val y = FloatArray(COUNT)
    val speed = FloatArray(COUNT)
    val size = FloatArray(COUNT)
    val sway = FloatArray(COUNT)
    val freq = FloatArray(COUNT)
    val alpha = FloatArray(COUNT)

    init {
        var seed = 11L
        fun rnd(): Float {
            seed = seed * 16807L % 2147483647L
            return seed / 2147483647f
        }
        for (i in 0 until COUNT) {
            x[i] = rnd() * CinemaSplashGeometry.PLATE_W
            y[i] = rnd() * CinemaSplashGeometry.PLATE_H
            speed[i] = 8f + rnd() * 22f
            size[i] = 0.7f + rnd() * 1.9f
            sway[i] = rnd() * 6.28f
            freq[i] = 0.5f + rnd() * 1.6f
            alpha[i] = 0.16f + rnd() * 0.3f
        }
    }
}

/** Objets de dessin réutilisés à chaque image (aucune allocation de pinceau par image). */
private class SceneCache(val glow: ImageBitmap) {
    val plusPaint = Paint().apply { blendMode = BlendMode.Plus }
    val skew = Matrix().also { it[0, 1] = -0.32f }
    val barFill = Brush.horizontalGradient(
        0f to Color(0xFF7C3AED),
        0.6f to Color(0xFFB78BFF),
        1f to Color(0xFFECE2FF),
        startX = BAR_X0,
        endX = BAR_X1,
    )
    val sweepColors = listOf(Color(0x00ECE2FF), Color(0xB3ECE2FF), Color(0x00ECE2FF))
    val shineBrush = Brush.verticalGradient(
        0f to Color(0x80FFFFFF),
        0.5f to Color(0x00FFFFFF),
        startY = BAR_Y,
        endY = BAR_Y + BAR_H,
    )

    /** Bande de lumière d'une famille linéaire : alpha seul (masque), tête devant, longue traîne derrière. */
    val bands: List<Brush?> = CinemaSplashLayout.families.map { f ->
        if (f.conic) null else Brush.horizontalGradient(
            0f to Color.Black.copy(alpha = 0f),
            0.3f to Color.Black.copy(alpha = 0.22f),
            0.55f to Color.Black.copy(alpha = 0.85f),
            0.62f to Color.Black,
            1f to Color.Black.copy(alpha = 0f),
            startX = -f.bandHalf,
            endX = f.bandHalf,
        )
    }

    /** Triangle : un secteur qui tourne (tête nette, traîne longue), centré sur le contour. */
    val sweep: Brush = Brush.sweepGradient(
        0f to Color.Black,
        0.05f to Color.Black.copy(alpha = 0.35f),
        0.55f to Color.Black.copy(alpha = 0f),
        0.8f to Color.Black.copy(alpha = 0.18f),
        1f to Color.Black,
        center = Offset(CinemaSplashLayout.TRI_CX, CinemaSplashLayout.TRI_CY),
    )
}

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
        val tagY = cover.offsetY + TAG_Y * scale
        val labelY = cover.offsetY + LABEL_Y * scale
        Text(
            text = tagline,
            style = TextStyle(
                fontFamily = MovvizUiFonts,
                fontWeight = FontWeight.Medium,
                fontSize = with(density) { (17f * scale).toSp() },
                letterSpacing = with(density) { (6.5f * scale).toSp() },
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
                .offset { IntOffset(0, (cover.offsetY + (BAR_Y - 13f) * scale).roundToInt()) }
                .size(with(density) { (700f * scale).toDp() }, with(density) { (96f * scale).toDp() })
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
    val intro = if (reduce) 1f else 1f - (1f - (t / 1.4f).coerceIn(0f, 1f)).let { it * it * it }
    withTransform({
        translate(cover.offsetX, cover.offsetY)
        scale(cover.scale, cover.scale, Offset.Zero)
    }) {
        // 1. décor : basse définition tout de suite, plaque en fondu dès qu'elle est décodée
        if (assets == null || richAlpha < 1f) drawImage(lowRes, dstSize = Plate, filterQuality = FilterQuality.Medium)
        if (assets == null) return@withTransform
        drawImage(assets.plate, dstSize = Plate, alpha = richAlpha, filterQuality = FilterQuality.High)

        // 2. néons : la lumière circule sur les lignes réelles de la plaque
        val families = CinemaSplashLayout.families
        for (i in families.indices) drawFamily(families[i], assets.families[i], cache.bands[i], t, energy * intro, flash, richAlpha, reduce, cache)

        // 3. le mot : la lumière n'éclaire QUE les lettres (masque), jamais un rectangle
        drawLogoLight(assets, t, flash, reduce, cache)
        glow(cache.glow, CX, LogoBounds.top + LogoBounds.height * 0.55f, 900f, 260f, 0.07f * (energy * (0.8f + 0.2f * sin(t * 1.7f)) + flash * 0.8f) * intro * richAlpha)

        // 4. sol : lueur qui monte avec le chargement
        glow(cache.glow, CX, 751f, 840f, 150f, 0.12f * energy * (0.75f + 0.25f * sin(t * 1.4f)) * intro * richAlpha)

        drawBar(t, prog, flash, richAlpha, reduce, cache)
        if (!reduce) drawEmbers(t, richAlpha, cache)
    }
    // vignette douce : fond les bords
    drawRect(Brush.radialGradient(0.55f to Color.Transparent, 1f to Color(0x66000000), center = center, radius = size.maxDimension * 0.75f))
}

/**
 * Une famille de néons : base discrète qui respire + une bande lumineuse qui court sur les lignes
 * (couche unique : bande en masque, image « lumière » composée en SrcIn, puis ajoutée à la scène).
 */
private fun DrawScope.drawFamily(
    f: CinemaSplashLayout.Family,
    image: ImageBitmap,
    band: Brush?,
    t: Float,
    energy: Float,
    flash: Float,
    richAlpha: Float,
    reduce: Boolean,
    cache: SceneCache,
) {
    val amount = (f.gain * (0.42f + 0.32f * energy) + flash * 0.4f).coerceIn(0f, 1f) * richAlpha
    val base = if (reduce) 0.3f else 0.06f + 0.04f * sin(t * 1.3f + f.phase * 6.28f)
    val offset = IntOffset(f.x.toInt(), f.y.toInt())
    drawImage(image, dstOffset = offset, alpha = (base * amount).coerceIn(0f, 1f), blendMode = BlendMode.Plus)

    val u = if (reduce) 0.5f else (t / f.period + f.phase) % 1.35f // 1.35 : courte pause entre deux passages
    if (u > 1f && !f.conic) return
    val big = maxOf(f.w, f.h)
    drawIntoCanvas { canvas ->
        canvas.saveLayer(Rect(f.x, f.y, f.x + f.w, f.y + f.h), cache.plusPaint)
        if (f.conic) {
            val angle = (if (reduce) 0.62f else (t / f.period + f.phase) % 1f) * 360f
            withTransform({ rotate(angle, Offset(CinemaSplashLayout.TRI_CX, CinemaSplashLayout.TRI_CY)) }) {
                drawRect(
                    cache.sweep,
                    Offset(CinemaSplashLayout.TRI_CX - big, CinemaSplashLayout.TRI_CY - big),
                    Size(big * 2f, big * 2f),
                )
            }
        } else if (band != null) {
            val bandHalf = f.bandHalf
            val pos = -f.half - bandHalf + (f.half * 2f + bandHalf * 2f) * u.coerceIn(0f, 1f)
            withTransform({
                translate(f.cx, f.cy)
                rotate(f.angleDeg, Offset.Zero)
                translate(pos, 0f)
            }) {
                drawRect(band, Offset(-bandHalf, -big), Size(bandHalf * 2f, big * 2f))
            }
        }
        drawImage(image, dstOffset = offset, alpha = amount, blendMode = BlendMode.SrcIn)
        canvas.restore()
    }
}

private fun DrawScope.drawLogoLight(assets: CinemaSplashAssets.Loaded, t: Float, flash: Float, reduce: Boolean, cache: SceneCache) {
    val sweepU = ((t - 1.1f) / 2.8f) % 1.8f
    val sweeping = !reduce && t > 1.1f && sweepU < 1f
    if (!sweeping && flash <= 0f) return
    drawIntoCanvas { canvas ->
        canvas.saveLayer(LogoBounds, cache.plusPaint)
        if (sweeping) {
            val bx = -160f + (686f + 320f) * CinemaSplashGeometry.easeInOut(sweepU)
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
        if (flash > 0f) drawRect(Color(0.839f, 0.769f, 1f, flash * 0.85f), LogoBounds.topLeft, LogoBounds.size)
        drawImage(assets.logoMask, dstOffset = IntOffset(LogoBounds.left.toInt(), LogoBounds.top.toInt()), blendMode = BlendMode.DstIn)
        canvas.restore()
    }
}

private fun DrawScope.drawBar(t: Float, prog: Float, flash: Float, richAlpha: Float, reduce: Boolean, cache: SceneCache) {
    val radius = CornerRadius(BAR_H / 2f)
    drawRoundRect(Color(0xF0080612), Offset(BAR_X0, BAR_Y), Size(BAR_X1 - BAR_X0, BAR_H), radius)
    drawRoundRect(Color(0x8CC4B6FF), Offset(BAR_X0, BAR_Y), Size(BAR_X1 - BAR_X0, BAR_H), radius, style = Stroke(2f))

    val fw = (BAR_X1 - BAR_X0 - 6f) * prog
    if (fw <= 1f) return
    val fillRadius = CornerRadius((BAR_H - 6f) / 2f)
    val fillTop = BAR_Y + 3f
    val fillH = BAR_H - 6f

    // halo de la partie remplie : lueur douce étirée à la longueur réelle de la barre
    val mid = BAR_X0 + 3f + fw / 2f
    glow(cache.glow, mid, BAR_Y + BAR_H / 2f, fw + 90f, 70f, 0.4f * richAlpha)

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
    glow(cache.glow, hx, hy, 96f + flash * 50f, 96f + flash * 50f, 0.8f * richAlpha)
    drawCircle(Color(0.93f, 0.89f, 1f, 0.9f * richAlpha), 5f, Offset(hx, hy), blendMode = BlendMode.Plus)
    if (flash > 0f) {
        // éclat de fin : lueur centrée autour de la barre, courte (pas de trait sur toute la largeur)
        glow(cache.glow, CX, hy, 760f, 60f, 0.5f * flash)
        glow(cache.glow, CX, hy, 340f, 160f, 0.2f * flash)
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
