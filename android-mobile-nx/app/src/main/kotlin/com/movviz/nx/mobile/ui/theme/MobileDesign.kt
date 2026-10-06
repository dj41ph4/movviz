package com.movviz.nx.mobile.ui.theme

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.core.graphics.drawable.toBitmap
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Classes d'écran du mobile (refonte premium 2026-10). Remplace le seuil
 * unique « 700 dp de large en paysage » qui envoyait un téléphone tourné et
 * un Fold ouvert dans le même châssis, et laissait le Fold ouvert tenu droit
 * (≈ 700 × 830 dp) retomber sur l'interface TV.
 *
 * - COMPACT_PORTRAIT : téléphone tenu droit, écran externe du Fold.
 * - LANDSCAPE_SHORT : téléphone ou Fold plié tourné (hauteur < 480 dp).
 * - FOLD_UPRIGHT : Fold ouvert tenu droit, petite tablette (600–840 dp).
 * - FOLD_FLAT : Fold ouvert tourné, tablette (≥ 840 dp de large).
 * - TV : UiMode télévision, garde son interface 10-foot.
 */
enum class MovvizWindowClass { COMPACT_PORTRAIT, LANDSCAPE_SHORT, FOLD_UPRIGHT, FOLD_FLAT, TV }

@Composable
fun rememberMovvizWindowClass(): MovvizWindowClass {
    val configuration = LocalConfiguration.current
    val context = LocalContext.current
    val television = remember(context) {
        (context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager)?.currentModeType ==
            Configuration.UI_MODE_TYPE_TELEVISION
    }
    val width = configuration.screenWidthDp
    val height = configuration.screenHeightDp
    return when {
        television -> MovvizWindowClass.TV
        width < 600 && height > width -> MovvizWindowClass.COMPACT_PORTRAIT
        height < 480 -> MovvizWindowClass.LANDSCAPE_SHORT
        width >= 840 -> MovvizWindowClass.FOLD_FLAT
        else -> MovvizWindowClass.FOLD_UPRIGHT
    }
}

/** Grand écran tactile (Fold ouvert, tablette), quelle que soit l'orientation. */
val MovvizWindowClass.isLargeTouch: Boolean
    get() = this == MovvizWindowClass.FOLD_UPRIGHT || this == MovvizWindowClass.FOLD_FLAT

/** Échelle typographique mobile : six niveaux, jamais de taille ad hoc. */
object MovvizType {
    val display = TextStyle(fontFamily = MovvizFonts, fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.4).sp)
    val title = TextStyle(fontFamily = MovvizFonts, fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp)
    val row = TextStyle(fontFamily = MovvizFonts, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.1).sp)
    val body = TextStyle(fontFamily = MovvizFonts, fontSize = 15.sp, lineHeight = 22.sp, fontWeight = FontWeight.Normal)
    val meta = TextStyle(fontFamily = MovvizFonts, fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium)
    val label = TextStyle(fontFamily = MovvizFonts, fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.9.sp)
}

/** Trois rayons : affiches, boutons/vignettes, dock/feuilles. */
object MovvizRadius {
    val small = RoundedCornerShape(8.dp)
    val medium = RoundedCornerShape(14.dp)
    val large = RoundedCornerShape(24.dp)
}

/**
 * Couleur d'ambiance tirée de l'affiche : moyenne des pixels pondérée par
 * leur saturation (les gris et noirs des bandes ne comptent presque pas),
 * puis ramenée à une teinte sombre et lisible sous du texte blanc. Calculée
 * sur une vignette 32 px déjà en cache Coil, hors du thread UI ; null tant
 * qu'elle n'est pas prête, l'écran garde alors le fond par défaut.
 */
@Composable
fun rememberPosterAmbient(url: String?): Color? {
    val context = LocalContext.current
    var color by remember(url) { mutableStateOf<Color?>(null) }
    LaunchedEffect(url) {
        if (url == null) return@LaunchedEffect
        val request = ImageRequest.Builder(context).data(url).size(32).allowHardware(false).build()
        val drawable = runCatching { context.imageLoader.execute(request).drawable }.getOrNull() ?: return@LaunchedEffect
        color = withContext(Dispatchers.Default) {
            runCatching { ambientFrom(drawable.toBitmap(32, 32)) }.getOrNull()
        }
    }
    return color
}

private fun ambientFrom(bitmap: android.graphics.Bitmap): Color {
    var r = 0.0
    var g = 0.0
    var b = 0.0
    var weight = 0.0
    val hsv = FloatArray(3)
    for (x in 0 until bitmap.width) {
        for (y in 0 until bitmap.height) {
            val pixel = bitmap.getPixel(x, y)
            android.graphics.Color.colorToHSV(pixel, hsv)
            val w = 0.05 + hsv[1] * hsv[2]
            r += android.graphics.Color.red(pixel) * w
            g += android.graphics.Color.green(pixel) * w
            b += android.graphics.Color.blue(pixel) * w
            weight += w
        }
    }
    val avg = android.graphics.Color.rgb((r / weight).toInt(), (g / weight).toInt(), (b / weight).toInt())
    android.graphics.Color.colorToHSV(avg, hsv)
    hsv[1] = hsv[1].coerceIn(0.35f, 0.75f)
    hsv[2] = hsv[2].coerceIn(0.28f, 0.42f)
    return Color(android.graphics.Color.HSVToColor(hsv))
}
