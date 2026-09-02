package com.movviz.tv.ui.theme

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
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
 * "Lift" Netflix-style : la carte au focus se détache visuellement avec un
 * scale + ombre profonde portée. Netflix utilise un lift discret mais net :
 * la carte s'agrandit légèrement (1.06x) avec une ombre diffuse noire — pas
 * de bordure colorée, pas de scale agressif. Le rebond spring est adouci
 * pour un mouvement naturel à la télécommande.
 */
@Composable
fun Modifier.tvFocusLift(
    focused: Boolean,
    shape: Shape = RoundedCornerShape(8.dp),
    maxScale: Float = 1.06f,
    maxElevation: androidx.compose.ui.unit.Dp = 24.dp,
): Modifier {
    val scale by animateFloatAsState(
        targetValue = if (focused) maxScale else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "tvFocusLiftScale",
    )
    val elevation by animateDpAsState(
        targetValue = if (focused) maxElevation else 0.dp,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "tvFocusLiftElevation",
    )
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(elevation = elevation, shape = shape, ambientColor = androidx.compose.ui.graphics.Color.Black, spotColor = androidx.compose.ui.graphics.Color.Black)
}

/** Focus des cartes de contenu TV : le poster reste strictement à sa taille
 * de grille — aucune mesure de layout ne change — et le focus se lit par un
 * micro-zoom GPU (3,5%), un contour blanc net et un halo lent blanc/Movviz. C'est le repère Netflix
 * attendu au D-pad, sans l'effet "zoom" qui faisait sauter la grille.
 *
 * L'application ne possède pas de préférence reduce-motion distincte ; cette
 * seule pulsation très lente est donc volontairement limitée au halo (aucun
 * déplacement ni redimensionnement de contenu). */
@Composable
fun Modifier.tvCardFocusHalo(
    focused: Boolean,
    shape: Shape = MovvizCardShape,
): Modifier {
    val focusAlpha by animateFloatAsState(
        targetValue = if (focused) 1f else 0f,
        animationSpec = tween(durationMillis = 160),
        label = "tvCardFocusAlpha",
    )
    val elevation by animateDpAsState(
        targetValue = if (focused) 20.dp else 0.dp,
        animationSpec = tween(durationMillis = 180),
        label = "tvCardFocusElevation",
    )
    val scale by animateFloatAsState(
        targetValue = if (focused) 1.035f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "tvCardFocusScale",
    )
    val transition = rememberInfiniteTransition(label = "tvCardFocusPulse")
    val pulse by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1_800),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "tvCardFocusPulseAlpha",
    )
    val haloAlpha = focusAlpha * (0.10f + 0.12f * pulse)
    val outlineAlpha = focusAlpha * (0.76f + 0.18f * pulse)
    return this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .shadow(
            elevation = elevation,
            shape = shape,
            ambientColor = Color.White.copy(alpha = haloAlpha),
            spotColor = MovvizBrand.copy(alpha = haloAlpha * 1.4f),
        )
        .border(2.dp, Color.White.copy(alpha = outlineAlpha), shape)
}

/**
 * Forme unique des cartes Netflix — coins arrondis doux (8dp), identiques
 * à la couche de contenu Netflix. Ajuster ici propage partout ; ne JAMAIS
 * mettre un rayon ad hoc dans un écran.
 */
val MovvizCardShape = RoundedCornerShape(12.dp)

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
        fontFamily = MovvizFonts, fontSize = 44.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.5).sp, lineHeight = 50.sp,
    ),
    // Section header (hero subtitle, row headers)
    headlineMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 26.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.3).sp,
    ),
    // Row heading — large white bold, Netflix-style category label
    titleLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 22.sp, fontWeight = FontWeight.Bold,
        letterSpacing = (-0.2).sp,
    ),
    // Card title
    titleMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
    ),
    // Synopsis / body text
    bodyLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 16.sp, fontWeight = FontWeight.Normal,
        lineHeight = 24.sp,
    ),
    // Secondary text, metadata
    bodyMedium = TextStyle(
        fontFamily = MovvizFonts, fontSize = 14.sp, fontWeight = FontWeight.Normal,
        lineHeight = 20.sp,
    ),
    // Button labels, badges
    labelLarge = TextStyle(
        fontFamily = MovvizFonts, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
    ),
    // Fine metadata (year, duration, resolution)
    labelSmall = TextStyle(
        fontFamily = MovvizFonts, fontSize = 12.sp, fontWeight = FontWeight.Medium,
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
