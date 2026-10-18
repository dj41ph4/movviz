package com.movviz.tv.ui.theme

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
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

// ────────────────────────────────────────────────────────────────
// Interface Bêta « Salle obscure » (Paramètres > Apparence). Tout ce qui
// suit ne s'applique que lorsque l'utilisateur l'active : l'apparence Stable
// reste strictement celle d'avant. Jetons : Color.kt (palette par rôle),
// BetaTokens.kt (typographie, formes), MovvizMotion.kt (mouvement),
// MovvizFocus.kt (anneau de focus et briques partagées).
// ────────────────────────────────────────────────────────────────

/** Vrai quand l'interface Bêta est active — lu par les écrans pour choisir
 *  tailles, marges et anneau de focus. */
val LocalMovvizBeta = staticCompositionLocalOf { false }

/**
 * Point d'accès unique aux jetons du thème courant, dans un composable :
 * `MovvizTheme.palette.ink`, `MovvizTheme.textStyles.eyebrow`,
 * `if (MovvizTheme.reduceMotion) …`, `if (MovvizTheme.beta) …`.
 * Dans un élément de liste paresseuse, résoudre une fois au niveau de la
 * rangée et passer les valeurs en paramètre.
 */
object MovvizTheme {
    /** Palette par rôle : [MovvizStablePalette] ou [MovvizBetaPalette]. */
    val palette: MovvizPalette
        @Composable @ReadOnlyComposable get() = LocalMovvizPalette.current

    /** Styles hors Typography (surtitre, compteur, splash, mot-symbole). */
    val textStyles: MovvizTextStyles
        @Composable @ReadOnlyComposable get() = LocalMovvizTextStyles.current

    /** Animations système coupées : utiliser les variantes statiques. */
    val reduceMotion: Boolean
        @Composable @ReadOnlyComposable get() = LocalMovvizReduceMotion.current

    /** Interface Bêta active (identique à `LocalMovvizBeta.current`). */
    val beta: Boolean
        @Composable @ReadOnlyComposable get() = LocalMovvizBeta.current
}

/** Taille de texte Stable ou Bêta. */
@Composable
fun betaSp(stable: Float, beta: Float): androidx.compose.ui.unit.TextUnit =
    if (LocalMovvizBeta.current) beta.sp else stable.sp

/** Dimension Stable ou Bêta. */
@Composable
fun betaDp(stable: androidx.compose.ui.unit.Dp, beta: androidx.compose.ui.unit.Dp): androidx.compose.ui.unit.Dp =
    if (LocalMovvizBeta.current) beta else stable

/** Couleur et épaisseur uniques de l'anneau de focus Bêta : blanc pur 3 dp. */
val MovvizBetaFocusColor = Color.White
val MovvizBetaFocusWidth = 3.dp

/** Bordure de focus historique : en Bêta, un anneau blanc 3 dp dessiné à
 *  l'intérieur ; en Stable, la bordure propre à chaque composant (passée en
 *  `stable`). Conservée pour les écrans pas encore migrés (ils ne perdent
 *  jamais un focus visible) ; un composant migré utilise plutôt
 *  `Modifier.movvizFocusRing` + `movvizCardBorder` (MovvizFocus.kt). */
@Composable
fun movvizFocusBorder(
    shape: Shape,
    stable: androidx.compose.foundation.BorderStroke,
): androidx.compose.foundation.BorderStroke =
    if (LocalMovvizBeta.current) androidx.compose.foundation.BorderStroke(MovvizBetaFocusWidth, MovvizBetaFocusColor) else stable

/** Marge latérale des rangées : 39 dp en Stable, 48 dp (zone de sécurité
 *  5 %) en Bêta. */
@Composable
fun movvizRowInset(): androidx.compose.ui.unit.Dp = betaDp(39.dp, 48.dp)

/** Schéma Bêta : les dégradés qui lisent déjà `colorScheme.background`
 *  (fiche) suivent d'eux-mêmes. */
private val MovvizBetaColorScheme = MovvizColorScheme.copy(
    primary = MovvizBetaPalette.accent,
    background = MovvizBetaPalette.background,
    surface = MovvizBetaPalette.surface,
    onBackground = MovvizBetaPalette.ink,
    onSurface = MovvizBetaPalette.ink,
)

/**
 * Thème racine. Fournit l'interface Bêta ([LocalMovvizBeta]), la palette,
 * les styles complémentaires et le drapeau de mouvement réduit (suivi en
 * direct des réglages système). `beta = false` reproduit exactement
 * l'apparence Stable historique.
 */
@Composable
fun MovvizTvTheme(beta: Boolean = false, content: @Composable () -> Unit) {
    val reduceMotion = rememberSystemReduceMotion()
    CompositionLocalProvider(
        LocalMovvizBeta provides beta,
        LocalMovvizPalette provides if (beta) MovvizBetaPalette else MovvizStablePalette,
        LocalMovvizTextStyles provides if (beta) MovvizBetaTextStyles else MovvizStableTextStyles,
        LocalMovvizReduceMotion provides reduceMotion,
    ) {
        MaterialTheme(
            colorScheme = if (beta) MovvizBetaColorScheme else MovvizColorScheme,
            typography = if (beta) MovvizBetaTypography else MovvizTypography,
            content = content,
        )
    }
}
