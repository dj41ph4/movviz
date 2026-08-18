package com.movviz.tv.ui.theme

import androidx.compose.ui.graphics.Color

// Reprises telles quelles de src/app/globals.css (thème sombre — c'est le
// seul mode qui a du sens sur un téléviseur, jamais de "mode clair TV").
val MovvizBrand = Color(0xFF7C5CFF)
val MovvizBrand2 = Color(0xFFC04BFF)
val MovvizBrandGlow = Color(0xFFA06BFF)

val MovvizBackground = Color(0xFF0B0B14)
val MovvizSurface = Color(0xFF15151F)
val MovvizSurfaceStrong = Color(0xFF1D1D2B)

val MovvizInk = Color(0xFFF5F5FA)
val MovvizInkSoft = Color(0xFFB8B8C8)
val MovvizInkDim = Color(0xFF7A7A8C)

// Stops exacts de .text-logo-flow (src/app/globals.css, thème sombre) pour
// le texte "Movviz" en degrade anime — mêmes couleurs que le desktop.
val MovvizFlowInk = Color(0xFFEEF1FF)
val MovvizFlowGlow = Color(0xFFA06BFF)
val MovvizFlowMagenta = Color(0xFFFF4BD0)
val MovvizFlowCyan = Color(0xFF34E2FF)

// Couleurs sémantiques (--color-ok/amber/down/cyan en thème sombre dans
// globals.css) — pour les pastilles de statut (téléchargement en cours,
// en pause, en erreur...), jamais du texte coloré brut (voir CLAUDE.md).
val MovvizOk = Color(0xFF43E6A0)
val MovvizAmber = Color(0xFFFFB84B)
val MovvizDown = Color(0xFFFF5B78)
val MovvizCyan = Color(0xFF34E2FF)
