package com.movviz.tv.ui.theme

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme
import com.movviz.tv.R

/**
 * androidx.tv.material3.Surface(onClick = ...) ne déclenche l'action que sur
 * DPAD_CENTER/ENTER (focus + touche) — confirmé sur émulateur en injectant
 * des taps synthétiques (touchscreen ET mouse via `adb shell input`) qui
 * n'ont produit aucun effet malgré des coordonnées correctes. Android TV
 * doit pourtant fonctionner à la souris/tactile en plus de la télécommande
 * (souris Bluetooth, trackpad de télécommande, etc.). Ce modifier ajoute un
 * détecteur de tap explicite en plus du onClick natif de Surface, posé sur
 * le modifier externe donc évalué avant le clickable interne de Surface —
 * aucun double-déclenchement possible, DPAD et pointeur restent tous deux
 * fonctionnels.
 */
fun Modifier.tvPointerClick(onClick: () -> Unit): Modifier =
    this.pointerInput(onClick) {
        detectTapGestures(onTap = { onClick() })
    }

/**
 * "Lift" au focus : plus aucune ombre portée ni agrandissement, seulement le
 * cadre de focus (posé par la Surface appelante ou par tvCardFocusHalo).
 *
 * Le scale d'agrandissement avait déjà été retiré (une carte qui zoome
 * rééchantillonne tout ce qu'elle contient — numéro d'épisode, pastille
 * "vu", logo incrusté — et devient floue/dentelée le temps de l'animation).
 * L'ombre profonde qui restait à sa place donnait à son tour une impression
 * de gonflement au focus, signalée en direct comme un "zoom" malgré
 * l'absence de scale réel : le halo lumineux grossissant autour de la carte
 * lit comme un agrandissement même sans redimensionnement. Retirée à son
 * tour : le contour de focus suffit à dire où l'on est.
 */
@Composable
fun Modifier.tvFocusLift(
    focused: Boolean,
    shape: Shape = RoundedCornerShape(6.dp),
    maxElevation: androidx.compose.ui.unit.Dp = 18.dp,
): Modifier = this

/** Focus des cartes de contenu TV : ni la taille ni l'ombre ne changent
 * jamais, seul le contour de focus s'allume — même raison que tvFocusLift
 * ci-dessus (une ombre qui grossit se lit comme un zoom).
 *
 * Ne dessine plus son propre contour : chaque appelant configure déjà un
 * `border = ClickableSurfaceDefaults.border(focusedBorder = ...)` natif sur
 * sa Surface. Les deux contours (celui-ci en tween(160) et celui, animé
 * séparément, de tv-material3) se déphasaient légèrement en sortant de
 * focus — deux bordures blanches quasi superposées qui ne s'éteignent
 * jamais exactement ensemble, vu comme un clignotement en quittant un
 * bouton/une carte. Un seul mécanisme doit piloter un indicateur de focus
 * donné ; c'est désormais la Surface elle-même, seule source. */
@Composable
fun Modifier.tvCardFocusHalo(
    focused: Boolean,
    shape: Shape = MovvizCardShape,
): Modifier = this

/**
 * Forme unique des cartes Netflix — coins arrondis doux (8dp), identiques
 * à la couche de contenu Netflix. Ajuster ici propage partout ; ne JAMAIS
 * mettre un rayon ad hoc dans un écran.
 */
val MovvizCardShape = RoundedCornerShape(9.dp)

/**
 * Famille Inter (la direction typographique de Netflix et de la plupart des
 * plateformes premium) — 5 graisses embarquées en .otf dans res/font/.
 * Toute la typographie TV passe par ces styles, jamais de fontSize ad hoc
 * sans passer par un style existant.
 */
val MovvizFonts = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_bold, FontWeight.Bold),
    Font(R.font.inter_extrabold, FontWeight.ExtraBold),
)

private val MovvizTypography = Typography(
    // Hero / page title — large, bold, Netflix display style
    displayLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 33.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.5).sp, lineHeight = 38.sp,
    ),
    // Section header (hero subtitle, row headers)
    headlineMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 20.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.3).sp,
    ),
    // Row heading — large white bold, Netflix-style category label
    titleLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 17.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.2).sp,
    ),
    // Card title
    titleMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
    ),
    // Synopsis / body text
    bodyLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 12.sp, fontWeight = FontWeight.Normal,
        lineHeight = 18.sp,
    ),
    // Secondary text, metadata
    bodyMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 11.sp, fontWeight = FontWeight.Normal,
        lineHeight = 15.sp,
    ),
    // Button labels, badges
    labelLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
    ),
    // Fine metadata (year, duration, resolution)
    labelSmall = TextStyle(
        fontFamily = MovvizFonts, fontSize = 9.sp, fontWeight = FontWeight.Medium,
    ),
)

// Un seul schéma de couleurs, volontairement sombre — pas de switch clair/
// sombre sur TV, une pièce de salon vise toujours l'immersion (même choix
// qu'Apple TV/Netflix).
private val MovvizColorScheme = darkColorScheme(
    primary = MovvizBrand,
    secondary = MovvizBrand2,
    tertiary = MovvizBrandGlow,
    background = MovvizBackground,
    surface = MovvizSurface,
    onBackground = MovvizInk,
    onSurface = MovvizInk,
)

@Composable
fun MovvizTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MovvizColorScheme,
        typography = MovvizTypography,
        content = content,
    )
}
