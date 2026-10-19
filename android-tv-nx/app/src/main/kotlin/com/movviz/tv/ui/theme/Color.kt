package com.movviz.tv.ui.theme

import androidx.compose.ui.graphics.Color

// ────────────────────────────────────────────────────────────────
// Palette bleu-nuit — refonte design (Claude Design, "Movviz Android TV"),
// remplace l'ancien noir pur inspiré Netflix. Les accents sémantiques (4K,
// HDR, VF) restent quasi identiques à l'ancienne palette : seuls fond,
// surfaces, bordures et hiérarchie de texte changent de teinte.
// ────────────────────────────────────────────────────────────────

// Dégradé de marque 3 stops (bleu → violet → magenta) — CTA principal,
// item de nav actif. MovvizBrand/Brand2 restent les 2 tokens historiques
// (repris comme stops 2/3) pour ne pas casser tout ce qui les référence déjà.
val MovvizBrand3 = Color(0xFF3D7BFF)
val MovvizBrand = Color(0xFF8B2FFF)
val MovvizBrand2 = Color(0xFFBC3FFF)
val MovvizBrandGlow = Color(0xFFA06BFF)

// Surfaces — fond bleu-nuit profond, rail/panneaux légèrement plus clairs,
// champs de saisie encore un cran au-dessus.
val MovvizBackground = Color(0xFF05070F)
val MovvizSurface = Color(0xFF0E1330)
val MovvizSurfaceStrong = Color(0xFF131836)
val MovvizBorder = Color(0xFF1E2440)

// Text hierarchy — blanc légèrement bleuté pour les titres, de plus en plus
// dilué vers le bleu-gris pour le texte secondaire/tertiaire.
val MovvizInk = Color(0xFFEEF1FF)
val MovvizInkSoft = Color(0xFFAEB4D6)
val MovvizInkDim = Color(0xFF6B7099)

// Semantic status pills — kept for functional indicators.
val MovvizOk = Color(0xFF43E6A0)
val MovvizAmber = Color(0xFFFFB84B)
val MovvizDown = Color(0xFFE87C7C)
val MovvizCyan = Color(0xFF34E2FF)

// Animated logo flow — brand signature on the wordmark.
val MovvizFlowInk = Color(0xFFEEF1FF)
val MovvizFlowGlow = Color(0xFFA06BFF)
val MovvizFlowMagenta = Color(0xFFFF4BD0)
val MovvizFlowCyan = Color(0xFF34E2FF)

// ────────────────────────────────────────────────────────────────
// Palette par rôle (refonte Bêta « Salle obscure »). Les écrans lisent
// `MovvizTheme.palette.<rôle>` au lieu d'une constante : l'instance Stable
// pointe sur les constantes historiques ci-dessus (rendu Stable identique au
// pixel près), l'instance Bêta porte les encres graphite / texte ivoire /
// accent lavande de l'apparence Bêta desktop.
// ────────────────────────────────────────────────────────────────

/**
 * Couleurs nommées par rôle. Lire via `MovvizTheme.palette` dans un
 * composable, ou directement `MovvizBetaPalette` / `MovvizStablePalette`
 * hors composition (pinceaux mis en cache, tests).
 *
 * Les champs `nav*`, `hero*`, `primaryContainer`, `eyebrow`, `chip*`,
 * `badge*`, `progress*` n'existent visuellement qu'en Bêta : en Stable ils
 * portent une valeur raisonnable mais ne doivent être lus que dans une
 * branche `if (beta)` — Stable garde ses couleurs locales historiques.
 */
@androidx.compose.runtime.Immutable
data class MovvizPalette(
    /** Fond de scène (écran, rail exclus). */
    val background: Color,
    /** Panneaux, cartes au repos. */
    val surface: Color,
    /** Surface d'un cran au-dessus (élément focalisé non sélectionné, ligne de réglage). */
    val surfaceRaised: Color,
    /** Surface la plus claire (piste d'interrupteur éteinte). */
    val surfaceHigh: Color,
    /** Texte principal. */
    val ink: Color,
    /** Texte secondaire (métadonnées). */
    val inkSoft: Color,
    /** Texte tertiaire (compteurs, libellés au repos). */
    val inkDim: Color,
    /** Accent unique (filet de surtitre, progression, interrupteur actif). */
    val accent: Color,
    /** Filet au repos (8 % de blanc en Bêta). */
    val line: Color,
    /** Filet appuyé (14 % de blanc en Bêta) — contours de panneaux. */
    val lineStrong: Color,
    /** Anneau de focus extérieur. */
    val focusRing: Color,
    val navBackground: Color,
    val navEdge: Color,
    /** Élément du rail sélectionné : fond ivoire. */
    val navSelectedContainer: Color,
    val navSelectedContent: Color,
    val navSelectedIcon: Color,
    val heroFrame: Color,
    /** Teinte des voiles du hero (dégradés bas et gauche). */
    val heroScrim: Color,
    val heroFrameBorder: Color,
    /** Bouton principal (Lire, Voir la fiche) : lavande pâle. */
    val primaryContainer: Color,
    val onPrimaryContainer: Color,
    /** Texte des surtitres en capitales. */
    val eyebrow: Color,
    val chipContainer: Color,
    /** Chip actif : ivoire, comme l'élément sélectionné du rail. */
    val chipActiveContainer: Color,
    val chipActiveContent: Color,
    val badgeContainer: Color,
    val badgeBorder: Color,
    /** Action destructive (déconnexion). */
    val danger: Color,
    val progressTrack: Color,
    /** Dégradé de progression du splash (violet → lilas → cyan en Bêta). */
    val progressFill: List<Color>,
    /** Couleur de marque : violet en Stable, or foncé en Bêta (CTA, états actifs, jauges). */
    val brand: Color,
    val brand2: Color,
    /** Lueur / texte d'accent de la marque, plus clair que [brand2]. */
    val brandGlow: Color,
)

/** Palette Stable : chaque rôle pointe sur la constante historique. */
val MovvizStablePalette = MovvizPalette(
    background = MovvizBackground,
    surface = MovvizSurface,
    surfaceRaised = MovvizSurfaceStrong,
    surfaceHigh = MovvizBorder,
    ink = MovvizInk,
    inkSoft = MovvizInkSoft,
    inkDim = MovvizInkDim,
    accent = MovvizBrand2,
    line = MovvizBorder,
    lineStrong = MovvizBorder,
    focusRing = Color.White,
    navBackground = MovvizSurface,
    navEdge = MovvizBorder,
    navSelectedContainer = MovvizBrand,
    navSelectedContent = Color.White,
    navSelectedIcon = Color.White,
    heroFrame = MovvizBackground,
    heroScrim = MovvizBackground,
    heroFrameBorder = MovvizBorder,
    primaryContainer = MovvizBrand,
    onPrimaryContainer = Color.White,
    eyebrow = MovvizInkSoft,
    chipContainer = MovvizSurface,
    chipActiveContainer = MovvizBrand,
    chipActiveContent = Color.White,
    badgeContainer = Color.Black.copy(alpha = 0.6f),
    badgeBorder = MovvizBorder,
    danger = MovvizDown,
    progressTrack = Color.White.copy(alpha = 0.10f),
    progressFill = listOf(MovvizBrand, MovvizBrand2),
    brand = MovvizBrand,
    brand2 = MovvizBrand2,
    brandGlow = MovvizBrandGlow,
)

/** Palette Bêta « Salle obscure » (valeurs du plan de refonte, §3.1). Fond du rail = fond de la scène : un seul aplat. */
val MovvizBetaPalette = MovvizPalette(
    background = Color(0xFF0B0C10),
    surface = Color(0xFF13151B),
    surfaceRaised = Color(0xFF1B1E27),
    surfaceHigh = Color(0xFF252935),
    ink = Color(0xFFF5F2EB),
    inkSoft = Color(0xFFB7B5BF),
    inkDim = Color(0xFF94919F),
    accent = Color(0xFFC4B6FF),
    line = Color(0x14FFFFFF),
    lineStrong = Color(0x24FFFFFF),
    focusRing = Color(0xFFFFFFFF),
    navBackground = Color(0xFF0B0C10),
    navEdge = Color(0x0DFFFFFF),
    navSelectedContainer = Color(0xFFF1EDE5),
    navSelectedContent = Color(0xFF17151E),
    navSelectedIcon = Color(0xFF514177),
    heroFrame = Color(0xFF14151E),
    heroScrim = Color(0xFF11121B),
    heroFrameBorder = Color(0x1AFFFFFF),
    primaryContainer = Color(0xFFE4D9FF),
    onPrimaryContainer = Color(0xFF211830),
    eyebrow = Color(0xFFD8CEF1),
    chipContainer = Color(0xFF191B23),
    chipActiveContainer = Color(0xFFF1EDE5),
    chipActiveContent = Color(0xFF17151E),
    badgeContainer = Color(0xE007080F),
    badgeBorder = Color(0x2EFFFFFF),
    danger = Color(0xFFE87C7C),
    progressTrack = Color(0x12FFFFFF),
    progressFill = listOf(Color(0xFF7C3AED), Color(0xFFC084FC), Color(0xFF67E8F9)),
    brand = MovvizBrand,
    brand2 = MovvizBrand2,
    brandGlow = MovvizBrandGlow,
)

/** Filet de carte focalisée en Bêta (24 % de blanc) — plus clair que `line`. */
val MovvizBetaCardFocusedLine = Color(0x3DFFFFFF)

/** Palette courante, fournie par [MovvizTvTheme]. Lire via `MovvizTheme.palette`. */
val LocalMovvizPalette = androidx.compose.runtime.staticCompositionLocalOf { MovvizStablePalette }
