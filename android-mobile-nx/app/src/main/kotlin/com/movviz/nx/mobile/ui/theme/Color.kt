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
// Déclinaison NX Mobile seule en mauve électrique (le web et les 3 autres
// modules gardent #7c3aed) : violet plus saturé/lumineux avec pointe bleue.
val MovvizBrand = Color(0xFF8B2FFF)
val MovvizBrand2 = Color(0xFFBC3FFF)
val MovvizBrandGlow = Color(0xFFA66BFF)

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
val MovvizBackground = Color(0xFF0B1026)
val MovvizAbyss = Color(0xFF0E1330)
val MovvizSurface = Color(0xFF131836)
val MovvizSurfaceStrong = Color(0xFF1A1F3D)
val MovvizLine = Color(0xFF1E2440)

// Text hierarchy — white for titles, progressively dimmer for secondary.
val MovvizInk = Color(0xFFFFFFFF)
val MovvizInkSoft = Color(0xFFB3B3B3)
val MovvizInkDim = Color(0xFF6B6B6B)

// Semantic status pills — kept for functional indicators.
val MovvizOk = Color(0xFF43E6A0)
val MovvizAmber = Color(0xFFFFB84B)
val MovvizDown = Color(0xFFE87C7C)
val MovvizCyan = Color(0xFF5CE0D8)

// Animated logo flow — brand signature on the wordmark.
val MovvizFlowInk = Color(0xFFEEF1FF)
val MovvizFlowGlow = Color(0xFFA06BFF)
val MovvizFlowMagenta = Color(0xFFFF4BD0)
val MovvizFlowCyan = Color(0xFF34E2FF)
