package com.movviz.nx.mobile.ui.theme

import androidx.compose.ui.graphics.Color

// ────────────────────────────────────────────────────────────────
// Identité Movviz — fond bleu-nuit/violet profond (jamais neutre),
// aligné sur la palette web (src/app/globals.css : --color-void/
// --color-surface/--color-brand). La charte mobile (esquisse fournie
// 2026-09) confirme ce fond teinté violet plutôt qu'un noir Netflix
// neutre : les cartes et rangées restent sombres et calmes, mais la
// teinte de fond porte la marque même quand aucun accent n'est visible.
// ────────────────────────────────────────────────────────────────

// Brand — accent ET signature de fond (dégradés CTA, indicateurs actifs).
// Mêmes valeurs que --color-brand/--color-brand-2/--color-brand-glow du desktop
// (alignement 2026-11 : le mauve électrique #8B2FFF propre au mobile est retiré).
val MovvizBrand = Color(0xFF7458E8)
val MovvizBrand2 = Color(0xFFA77BFF)
val MovvizBrandGlow = Color(0xFFB892FF)

// Bordure électrique nuancée (ref visuel : halo bleu → violet → magenta sur
// fond nuit, pas un aplat). Brush partagé par les contours visibles
// (tuiles plateformes, cartes posters, recherche) — même coût qu'un
// linearGradient 2 stops, mais avec la profondeur du néon.
val MovvizElectricBlue = Color(0xFF3D7BFF)
val MovvizElectricBorder: androidx.compose.ui.graphics.Brush
    get() = androidx.compose.ui.graphics.Brush.linearGradient(
        listOf(MovvizElectricBlue, MovvizBrand, MovvizBrand2),
    )

// Surfaces — bleu-nuit/violet profond, jamais un noir neutre. Mêmes valeurs
// que --color-void/--color-abyss/--color-surface/--color-surface-2 côté web.
val MovvizBackground = Color(0xFF0B0C10)
val MovvizAbyss = Color(0xFF0A0C15)
val MovvizSurface = Color(0xFF13151B)
val MovvizSurfaceStrong = Color(0xFF1B1E27)
val MovvizLine = Color(0xFF1F2233)

// Fond de page unique NX Mobile (portrait + paysage, tous les écrans sans
// exception) : le ton exact du bandeau logo/avatar (MovvizSurface à 55 % sur
// MovvizBackground). Plus aucun noir ni à-plat différent qui casserait
// l'immersion entre les pages.
val MovvizPage = Color(0xFF0B0C10)

// Text hierarchy — white for titles, progressively dimmer for secondary.
// Secondaire et tertiaire teintés bleu-nuit comme le web (--color-ink-soft/
// --color-ink-dim) : les gris neutres hérités de Netflix juraient avec le fond.
val MovvizInk = Color(0xFFF5F2EB)
val MovvizInkSoft = Color(0xFFAAA7BD)
val MovvizInkDim = Color(0xFF8A879F)

// Semantic status pills — kept for functional indicators.
val MovvizOk = Color(0xFF43E6A0)
val MovvizAmber = Color(0xFFFFB84B)
val MovvizDown = Color(0xFFFF5B78)
val MovvizCyan = Color(0xFFA77BFF)

// Animated logo flow — brand signature on the wordmark.
val MovvizFlowInk = Color(0xFFEEF1FF)
val MovvizFlowGlow = Color(0xFFA06BFF)
val MovvizFlowMagenta = Color(0xFFFF4BD0)
val MovvizFlowCyan = Color(0xFF34E2FF)

// Dégradé de marque du desktop (.brand-gradient, Salle obscure) : lilas → violet clair → violet,
// sans rose ; dans ce sens-là, jamais violet → clair.
val MovvizBrandMagenta = Color(0xFFC9ADFF)
val MovvizBrandGradientColors = listOf(MovvizBrandMagenta, MovvizBrand2, MovvizBrand)

// Bordure des posters et tuiles plateformes : le filet blanc discret du desktop
// (Salle obscure, --so-line : blanc à 8-14 %),
// sans le halo bleu → magenta de MovvizElectricBorder réservé au champ de
// recherche et aux pastilles rondes de l'en-tête.
val MovvizPosterBorder: androidx.compose.ui.graphics.Brush
    get() = androidx.compose.ui.graphics.Brush.linearGradient(
        listOf(
            Color.White.copy(alpha = 0.10f),
            Color.White.copy(alpha = 0.10f),
        ),
    )

// Remplissage des boutons principaux et des sélections actives : le lilas pâle
// du bouton « Lire » du desktop (#E4D9FF, texte #211830), jamais du blanc pur.
val MovvizPrimaryFill = Color(0xFFE4D9FF)
val MovvizOnPrimaryFill = Color(0xFF211830)

// Violet plein du desktop (#7458E8) pour les sélections actives et les boutons d'action
// (puce « Tout » active, bouton « Ajouter ») ; le dégradé reste réservé aux barres de progression.
val MovvizBrandSolid: androidx.compose.ui.graphics.Brush
    get() = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand))
