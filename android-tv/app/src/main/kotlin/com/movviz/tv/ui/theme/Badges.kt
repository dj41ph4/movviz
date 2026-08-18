package com.movviz.tv.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text

/**
 * Pastilles de statut/note partagées entre l'accueil, la recherche et
 * n'importe quel autre poster — même trio texte/fond-12%/bordure-25% que le
 * pattern "pill" du desktop (LibraryMovieCard.tsx, BADGE_SHAPE/STATUS_TONE
 * dans MediaBadges.tsx), avec les couleurs sémantiques copiées telles
 * quelles de src/app/globals.css (@theme, thème sombre) au lieu de teintes
 * ad hoc. Un seul point de vérité pour ne pas réinventer une pastille
 * légèrement différente à chaque écran.
 */
data class StatusTone(val color: Color, val label: String)

/** Correspondance avec LibraryStatus (src/lib/library/types.ts) — mêmes 5
 *  valeurs, mêmes couleurs, mêmes libellés français que status.* dans
 *  src/i18n/locales/fr.ts. Un statut inconnu retombe sur la teinte "amber"
 *  plutôt que de crasher ou de ne rien afficher. */
fun statusTone(status: String): StatusTone = when (status) {
    "available" -> StatusTone(MovvizOk, "Disponible")
    "downloading" -> StatusTone(MovvizCyan, "Téléchargement")
    "searching" -> StatusTone(MovvizBrandGlow, "Recherche…")
    "upcoming" -> StatusTone(MovvizInkDim, "À venir")
    else -> StatusTone(MovvizAmber, "Manquant")
}

/** Pastille de statut compacte — coin d'un poster (accueil/recherche) ou
 *  fiche titre. */
@Composable
fun StatusPill(status: String, modifier: Modifier = Modifier) {
    val tone = statusTone(status)
    Text(
        text = tone.label,
        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = tone.color),
        modifier = modifier
            .background(tone.color.copy(alpha = 0.15f), RoundedCornerShape(50))
            .border(1.dp, tone.color.copy(alpha = 0.28f), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** Pastille note ★ — même position/traitement que le badge étoile en haut à
 *  gauche des posters de la grille bibliothèque desktop (text-amber, fond
 *  sombre translucide). */
@Composable
fun RatingBadge(rating: Double, modifier: Modifier = Modifier) {
    Text(
        text = "★ ${"%.1f".format(rating)}",
        style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = MovvizAmber),
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(50))
            .border(1.dp, MovvizInk.copy(alpha = 0.15f), RoundedCornerShape(50))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}
