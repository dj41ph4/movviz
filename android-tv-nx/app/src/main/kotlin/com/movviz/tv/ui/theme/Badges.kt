package com.movviz.tv.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
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

/** Status pill — compact, dark glass, subtle color accent. */
@Composable
fun StatusPill(status: String, modifier: Modifier = Modifier) {
    val tone = statusTone(status)
    Text(
        text = tone.label,
        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = tone.color),
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/** Rating badge — dark glass with gold star, Netflix-style. Icône
 *  vectorielle : le glyphe ★ n'existe pas dans Inter (rendu cassé TV). */
@Composable
fun RatingBadge(rating: Double, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Icon(
            imageVector = MovvizIconStar,
            contentDescription = null,
            tint = Color(0xFFF5C542),
            modifier = Modifier.size(11.dp),
        )
        Text(
            text = "%.1f".format(rating),
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C542)),
        )
    }
}
