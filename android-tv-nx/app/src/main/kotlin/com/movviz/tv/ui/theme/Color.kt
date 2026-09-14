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
