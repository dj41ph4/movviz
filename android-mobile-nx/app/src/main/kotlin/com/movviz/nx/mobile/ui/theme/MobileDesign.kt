package com.movviz.nx.mobile.ui.theme

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
