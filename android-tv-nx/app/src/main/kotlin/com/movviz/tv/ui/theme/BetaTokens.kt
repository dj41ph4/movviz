package com.movviz.tv.ui.theme

import android.os.Build
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Typography
import com.movviz.tv.R

// ────────────────────────────────────────────────────────────────
// Typographie et formes Bêta « Salle obscure » — mêmes repères que
// l'apparence Bêta desktop (Bricolage Grotesque éditorial, Geist pour
// l'interface, Geist Mono pour les surtitres), transposés à l'échelle
// 10-foot (canevas 960×540 dp). Bêta reste légèrement plus grande que Stable.
// Stable n'utilise rien de ce fichier.
// ────────────────────────────────────────────────────────────────

/**
 * Une entrée par graisse, chacune avec son réglage de variation : Compose
 * choisit la graisse la plus proche et l'axe `wght` du fichier variable rend
 * la vraie graisse.
 */
@OptIn(ExperimentalTextApi::class)
private fun variable(res: Int, weight: Int) = Font(
    resId = res,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

/**
 * Sous l'API 26 les variations de police sont ignorées : toutes les graisses
 * retomberaient sur l'instance par défaut du fichier variable, sans faux gras.
 * Repli déterministe sur Inter (5 vraies graisses déjà embarquées).
 */
private val supportsVariableFonts = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

/** Bricolage Grotesque : voix éditoriale (titre du hero, de la fiche, en-têtes de page). */
val MovvizDisplayFonts: FontFamily =
    if (supportsVariableFonts) FontFamily(listOf(500, 600, 700).map { variable(R.font.bricolage_grotesque_variable, it) })
    else MovvizFonts

/** Geist : texte d'interface (rangées, boutons, métadonnées). */
val MovvizUiFonts: FontFamily =
    if (supportsVariableFonts) FontFamily(listOf(400, 500, 550, 600, 700).map { variable(R.font.geist_variable, it) })
    else MovvizFonts

/** Geist Mono : surtitres en capitales espacées, compteurs. */
val MovvizMonoFonts: FontFamily =
    if (supportsVariableFonts) FontFamily(listOf(400, 500).map { variable(R.font.geist_mono_variable, it) })
    else FontFamily.Monospace

/** Chiffres tabulaires : les compteurs et durées ne « dansent » pas en changeant. */
private const val TABULAR = "tnum"

/** Échelle typographique Bêta (plan §3.2). Stable garde sa propre échelle Inter. */
internal val MovvizBetaTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = MovvizDisplayFonts, fontWeight = FontWeight.Bold,
        fontSize = 40.sp, lineHeight = 43.sp, letterSpacing = (-1.4).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = MovvizDisplayFonts, fontWeight = FontWeight.Bold,
        fontSize = 35.sp, lineHeight = 39.sp, letterSpacing = (-1.2).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = MovvizDisplayFonts, fontWeight = FontWeight.Bold,
        fontSize = 24.sp, lineHeight = 28.sp, letterSpacing = (-0.7).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.SemiBold,
        fontSize = 19.sp, lineHeight = 25.sp, letterSpacing = (-0.35).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp, lineHeight = 17.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.Normal,
        fontSize = 13.sp, lineHeight = 20.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.Medium,
        fontSize = 12.sp, lineHeight = 18.sp, fontFeatureSettings = TABULAR,
    ),
    labelLarge = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight.Medium, fontSize = 12.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = MovvizUiFonts, fontWeight = FontWeight(550),
        fontSize = 10.5.sp, letterSpacing = 0.12.sp, fontFeatureSettings = TABULAR,
    ),
)

/**
 * Styles sans emplacement dans la Typography Material. Lire via
 * `MovvizTheme.textStyles`. En Stable, l'instance reflète les équivalents
 * Inter actuels mais n'est lue par aucun chemin Stable.
 */
@Immutable
data class MovvizTextStyles(
    /** Surtitre : Geist Mono 10.5 sp. Mettre le texte en
     *  capitales côté code (`uppercase(Locale.FRENCH)`) — voir [BetaEyebrow]. */
    val eyebrow: TextStyle,
    /** Compteur (« 128 titres ») : Geist Mono 13 sp, chiffres tabulaires. */
    val count: TextStyle,
    /** Accroche du splash : Bricolage 17/21 sp. */
    val splashHeadline: TextStyle,
    /** Mot-symbole « Movviz » du rail. */
    val wordmark: TextStyle,
)

internal val MovvizBetaTextStyles = MovvizTextStyles(
    eyebrow = TextStyle(
        fontFamily = MovvizMonoFonts, fontWeight = FontWeight.Medium,
        fontSize = 10.5.sp, letterSpacing = 2.1.sp,
    ),
    count = TextStyle(
        fontFamily = MovvizMonoFonts, fontWeight = FontWeight.Medium,
        fontSize = 13.sp, letterSpacing = (-0.4).sp, fontFeatureSettings = TABULAR,
    ),
    splashHeadline = TextStyle(
        fontFamily = MovvizDisplayFonts, fontWeight = FontWeight.Medium,
        fontSize = 17.sp, lineHeight = 21.sp, letterSpacing = (-0.6).sp,
    ),
    wordmark = TextStyle(
        fontFamily = MovvizDisplayFonts, fontWeight = FontWeight.Bold,
        fontSize = 18.sp, letterSpacing = (-0.9).sp,
    ),
)

internal val MovvizStableTextStyles = MovvizTextStyles(
    eyebrow = TextStyle(fontFamily = MovvizFonts, fontWeight = FontWeight.SemiBold, fontSize = 9.sp, letterSpacing = 1.2.sp),
    count = TextStyle(fontFamily = MovvizFonts, fontWeight = FontWeight.Medium, fontSize = 11.sp),
    splashHeadline = TextStyle(fontFamily = MovvizFonts, fontWeight = FontWeight.SemiBold, fontSize = 11.sp),
    wordmark = TextStyle(fontFamily = MovvizFonts, fontWeight = FontWeight.Black, fontSize = 21.sp),
)

/** Styles courants, fournis par [MovvizTvTheme]. Lire via `MovvizTheme.textStyles`. */
val LocalMovvizTextStyles = staticCompositionLocalOf { MovvizStableTextStyles }

/**
 * Formes Bêta (plan §3.3). Chaque écran Bêta prend ses rayons ici, jamais un
 * rayon ad hoc.
 */
object MovvizBetaShapes {
    /** Contrôles génériques (lignes de réglage, boutons de profil). */
    val Control: Shape = RoundedCornerShape(10.dp)
    /** Chips : pilule complète. */
    val Chip: Shape = RoundedCornerShape(50)
    /** Cartes affiche / épisode / plateforme. */
    val Card: Shape = RoundedCornerShape(14.dp)
    /** Panneaux (réglages, menu profil, overlays). */
    val Panel: Shape = RoundedCornerShape(18.dp)
    /** Cadre du hero. */
    val Hero: Shape = RoundedCornerShape(24.dp)
    /** Boutons d'action (Lire, bande-annonce…). */
    val Button: Shape = RoundedCornerShape(10.dp)
    /** Boutons posés dans le hero. */
    val HeroButton: Shape = RoundedCornerShape(9.dp)
    /** Éléments du rail de navigation. */
    val NavItem: Shape = RoundedCornerShape(12.dp)
    /** Champ de recherche. */
    val Field: Shape = RoundedCornerShape(12.dp)
    /** Avatars de profil. */
    val Avatar: Shape = RoundedCornerShape(20.dp)
}

/** Forme de carte : [MovvizCardShape] (9 dp) en Stable, 14 dp en Bêta. */
@Composable
@ReadOnlyComposable
fun movvizCardShape(): Shape = if (LocalMovvizBeta.current) MovvizBetaShapes.Card else MovvizCardShape
