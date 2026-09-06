package com.movviz.tv.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Jeu d'icônes vectorielles Movviz TV — remplace les glyphes Unicode
 * (▶ ❚❚ ⏮ ⏭ ♪ ★ ✓ ↓ ⇄ ◉ ↻) que la police Inter ne contient PAS : Android
 * retombait sur une police système au rendu cassé ou en carrés vides sur
 * Google TV (« on dirait un problème UTF », constaté en direct).
 *
 * Une seule source de vérité, dessinée à la main dans un viewport 24×24,
 * style Netflix : traits ronds de ~2.2, formes pleines pour les contrôles
 * du lecteur. Tint appliqué par le composable Icon (tv.material3).
 */
private fun movvizIcon(name: String, block: ImageVector.Builder.() -> Unit): ImageVector =
    ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply(block).build()

/** Trait rond standard (largeur, caps et joins arrondis). */
private fun ImageVector.Builder.stroke(width: Float, block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) {
    path(
        stroke = SolidColor(Color.White),
        strokeLineWidth = width,
        strokeLineCap = StrokeCap.Round,
        strokeLineJoin = StrokeJoin.Round,
        fill = null,
    ) { block() }
}

private fun ImageVector.Builder.fillPath(block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) {
    path(fill = SolidColor(Color.White)) { block() }
}

/** ▶ Lecture — triangle plein légèrement adouci. */
val MovvizIconPlay: ImageVector by lazy {
    movvizIcon("MovvizIconPlay") {
        fillPath {
            moveTo(7.5f, 4.8f)
            lineTo(19.2f, 11.35f)
            quadTo(19.9f, 12f, 19.2f, 12.65f)
            lineTo(7.5f, 19.2f)
            quadTo(6.8f, 19.55f, 6.8f, 18.7f)
            lineTo(6.8f, 5.3f)
            quadTo(6.8f, 4.45f, 7.5f, 4.8f)
            close()
        }
    }
}

/** ❚❚ Pause — deux barres pleines aux coins doux. */
val MovvizIconPause: ImageVector by lazy {
    movvizIcon("MovvizIconPause") {
        fillPath {
            moveTo(6.6f, 4.6f)
            quadTo(7.4f, 4.6f, 7.4f, 5.4f)
            lineTo(7.4f, 18.6f)
            quadTo(7.4f, 19.4f, 6.6f, 19.4f)
            lineTo(5.2f, 19.4f)
            quadTo(4.4f, 19.4f, 4.4f, 18.6f)
            lineTo(4.4f, 5.4f)
            quadTo(4.4f, 4.6f, 5.2f, 4.6f)
            close()
            moveTo(18.8f, 4.6f)
            quadTo(19.6f, 4.6f, 19.6f, 5.4f)
            lineTo(19.6f, 18.6f)
            quadTo(19.6f, 19.4f, 18.8f, 19.4f)
            lineTo(17.4f, 19.4f)
            quadTo(16.6f, 19.4f, 16.6f, 18.6f)
            lineTo(16.6f, 5.4f)
            quadTo(16.6f, 4.6f, 17.4f, 4.6f)
            close()
        }
    }
}

/** ⏮ Épisode précédent — barre + triangle vers la gauche. */
val MovvizIconSkipPrev: ImageVector by lazy {
    movvizIcon("MovvizIconSkipPrev") {
        fillPath {
            moveTo(6.2f, 5f)
            quadTo(7f, 5f, 7f, 5.8f)
            lineTo(7f, 18.2f)
            quadTo(7f, 19f, 6.2f, 19f)
            lineTo(5.3f, 19f)
            quadTo(4.5f, 19f, 4.5f, 18.2f)
            lineTo(4.5f, 5.8f)
            quadTo(4.5f, 5f, 5.3f, 5f)
            close()
            moveTo(19.2f, 5.6f)
            lineTo(9.6f, 11.4f)
            quadTo(9f, 12f, 9.6f, 12.6f)
            lineTo(19.2f, 18.4f)
            quadTo(19.8f, 18.7f, 19.8f, 18f)
            lineTo(19.8f, 6f)
            quadTo(19.8f, 5.3f, 19.2f, 5.6f)
            close()
        }
    }
}

/** ⏭ Épisode suivant — triangle vers la droite + barre. */
val MovvizIconSkipNext: ImageVector by lazy {
    movvizIcon("MovvizIconSkipNext") {
        fillPath {
            moveTo(17.8f, 5f)
            quadTo(18.6f, 5f, 18.6f, 5.8f)
            lineTo(18.6f, 18.2f)
            quadTo(18.6f, 19f, 17.8f, 19f)
            lineTo(16.9f, 19f)
            quadTo(16.1f, 19f, 16.1f, 18.2f)
            lineTo(16.1f, 5.8f)
            quadTo(16.1f, 5f, 16.9f, 5f)
            close()
            moveTo(4.8f, 5.6f)
            lineTo(14.4f, 11.4f)
            quadTo(15f, 12f, 14.4f, 12.6f)
            lineTo(4.8f, 18.4f)
            quadTo(4.2f, 18.7f, 4.2f, 18f)
            lineTo(4.2f, 6f)
            quadTo(4.2f, 5.3f, 4.8f, 5.6f)
            close()
        }
    }
}

/** ◀◀ Reculer de 10 s — double triangle vers la gauche. */
val MovvizIconRewind: ImageVector by lazy {
    movvizIcon("MovvizIconRewind") {
        fillPath {
            moveTo(11.6f, 6.1f)
            lineTo(4.4f, 11.4f)
            quadTo(3.9f, 12f, 4.4f, 12.6f)
            lineTo(11.6f, 17.9f)
            quadTo(12.2f, 18.25f, 12.2f, 17.55f)
            lineTo(12.2f, 6.45f)
            quadTo(12.2f, 5.75f, 11.6f, 6.1f)
            close()
            moveTo(20.6f, 6.1f)
            lineTo(13.4f, 11.4f)
            quadTo(12.9f, 12f, 13.4f, 12.6f)
            lineTo(20.6f, 17.9f)
            quadTo(21.2f, 18.25f, 21.2f, 17.55f)
            lineTo(21.2f, 6.45f)
            quadTo(21.2f, 5.75f, 20.6f, 6.1f)
            close()
        }
    }
}

/** ▶▶ Avancer de 10 s — double triangle vers la droite. */
val MovvizIconForward: ImageVector by lazy {
    movvizIcon("MovvizIconForward") {
        fillPath {
            moveTo(12.4f, 6.1f)
            lineTo(19.6f, 11.4f)
            quadTo(20.1f, 12f, 19.6f, 12.6f)
            lineTo(12.4f, 17.9f)
            quadTo(11.8f, 18.25f, 11.8f, 17.55f)
            lineTo(11.8f, 6.45f)
            quadTo(11.8f, 5.75f, 12.4f, 6.1f)
            close()
            moveTo(3.4f, 6.1f)
            lineTo(10.6f, 11.4f)
            quadTo(11.1f, 12f, 10.6f, 12.6f)
            lineTo(3.4f, 17.9f)
            quadTo(2.8f, 18.25f, 2.8f, 17.55f)
            lineTo(2.8f, 6.45f)
            quadTo(2.8f, 5.75f, 3.4f, 6.1f)
            close()
        }
    }
}

/** ♪ Piste audio — croche pleine (tête + hampe + fanion). */
val MovvizIconMusicNote: ImageVector by lazy {
    movvizIcon("MovvizIconMusicNote") {
        fillPath {
            // Tête de note (ellipse inclinée simplifiée)
            moveTo(9.9f, 20.1f)
            curveTo(8.2f, 20.1f, 6.9f, 18.95f, 6.9f, 17.55f)
            curveTo(6.9f, 16.15f, 8.2f, 15f, 9.9f, 15f)
            curveTo(11.6f, 15f, 12.9f, 16.15f, 12.9f, 17.55f)
            curveTo(12.9f, 18.95f, 11.6f, 20.1f, 9.9f, 20.1f)
            close()
            // Hampe + fanion
            moveTo(11.6f, 16.6f)
            lineTo(11.6f, 4.4f)
            quadTo(11.6f, 3.7f, 12.25f, 3.85f)
            curveTo(15.4f, 4.6f, 17.6f, 5.9f, 17.6f, 8.3f)
            curveTo(17.6f, 9.5f, 16.9f, 10.4f, 16.1f, 10.9f)
            curveTo(16.5f, 9.9f, 16.3f, 8.9f, 15.4f, 8.2f)
            curveTo(14.6f, 7.6f, 13.4f, 7.3f, 12.9f, 7.25f)
            lineTo(12.9f, 16.6f)
            close()
        }
    }
}

/** ✓ Coche — trait rond fin (statut « Vu », sélection de piste). */
val MovvizIconCheck: ImageVector by lazy {
    movvizIcon("MovvizIconCheck") {
        stroke(width = 2.6f) {
            moveTo(4.5f, 12.6f)
            lineTo(9.4f, 17.4f)
            lineTo(19.5f, 6.8f)
        }
    }
}

/** + Plus — trait rond fin (ajouter à la bibliothèque / au foyer). */
val MovvizIconPlus: ImageVector by lazy {
    movvizIcon("MovvizIconPlus") {
        stroke(width = 2.6f) {
            moveTo(12f, 4.5f)
            lineTo(12f, 19.5f)
            moveTo(4.5f, 12f)
            lineTo(19.5f, 12f)
        }
    }
}

/** ★ Étoile pleine — note TMDb (chemin Material connu, rendu parfait). */
val MovvizIconStar: ImageVector by lazy {
    movvizIcon("MovvizIconStar") {
        fillPath {
            moveTo(12f, 17.27f)
            lineTo(18.18f, 21f)
            lineTo(16.54f, 13.97f)
            lineTo(22f, 9.24f)
            lineTo(14.81f, 8.63f)
            lineTo(12f, 2f)
            lineTo(9.19f, 8.63f)
            lineTo(2f, 9.24f)
            lineTo(7.46f, 13.97f)
            lineTo(5.82f, 21f)
            close()
        }
    }
}

/** ↓ Télécharger — flèche vers le bas + socle, traits ronds. */
val MovvizIconDownload: ImageVector by lazy {
    movvizIcon("MovvizIconDownload") {
        stroke(width = 2.2f) {
            moveTo(12f, 3.8f)
            lineTo(12f, 14.6f)
            moveTo(6.8f, 9.8f)
            lineTo(12f, 15.4f)
            lineTo(17.2f, 9.8f)
            moveTo(4.8f, 19.6f)
            lineTo(19.2f, 19.6f)
        }
    }
}

/** ⇄ Changer d'utilisateur — deux flèches opposées, traits ronds. */
val MovvizIconSwap: ImageVector by lazy {
    movvizIcon("MovvizIconSwap") {
        stroke(width = 2.1f) {
            moveTo(4.5f, 8.3f)
            lineTo(17.6f, 8.3f)
            moveTo(14.6f, 5.1f)
            lineTo(18.2f, 8.3f)
            lineTo(14.6f, 11.5f)
            moveTo(19.5f, 15.7f)
            lineTo(6.4f, 15.7f)
            moveTo(9.4f, 12.5f)
            lineTo(5.8f, 15.7f)
            lineTo(9.4f, 18.9f)
        }
    }
}

/** ◉ Profil actif — cercle plein dans un anneau. */
val MovvizIconDotCircle: ImageVector by lazy {
    movvizIcon("MovvizIconDotCircle") {
        path(
            stroke = SolidColor(Color.White),
            strokeLineWidth = 2f,
            fill = null,
        ) {
            moveTo(12f, 4.2f)
            arcToRelative(7.8f, 7.8f, 0f, true, false, 0.01f, 0f)
            close()
        }
        fillPath {
            moveTo(12f, 8.6f)
            arcToRelative(3.4f, 3.4f, 0f, true, false, 0.01f, 0f)
            close()
        }
    }
}

/** ↻ Recommencer depuis le début — flèche circulaire (chemin Material). */
val MovvizIconReplay: ImageVector by lazy {
    movvizIcon("MovvizIconReplay") {
        fillPath {
            moveTo(12f, 5f)
            lineTo(12f, 1f)
            lineTo(7f, 6f)
            lineTo(12f, 11f)
            lineTo(12f, 7f)
            curveTo(15.31f, 7f, 18f, 9.69f, 18f, 13f)
            curveTo(18f, 16.31f, 15.31f, 19f, 12f, 19f)
            curveTo(8.69f, 19f, 6f, 16.31f, 6f, 13f)
            lineTo(4f, 13f)
            curveTo(4f, 17.42f, 7.58f, 21f, 12f, 21f)
            curveTo(16.42f, 21f, 20f, 17.42f, 20f, 13f)
            curveTo(20f, 8.58f, 16.42f, 5f, 12f, 5f)
            close()
        }
    }
}

/** ⌂ Accueil — toit en chevron + murs/sol en U, mêmes traits ronds que le
 *  reste du jeu. Utilisée par la NavRail (onglet Accueil), collapsed et
 *  déployée. */
val MovvizIconHome: ImageVector by lazy {
    movvizIcon("MovvizIconHome") {
        stroke(width = 2.2f) {
            moveTo(3.5f, 11.2f)
            lineTo(12f, 4f)
            lineTo(20.5f, 11.2f)
            moveTo(6.2f, 9.6f)
            lineTo(6.2f, 19.5f)
            lineTo(17.8f, 19.5f)
            lineTo(17.8f, 9.6f)
        }
    }
}

/** 🎬 Films — clap de cinéma : corps rectangulaire + barre du haut inclinée
 *  avec deux rayures diagonales. Utilisée par la NavRail (onglet Films). */
val MovvizIconFilm: ImageVector by lazy {
    movvizIcon("MovvizIconFilm") {
        stroke(width = 2f) {
            moveTo(4.5f, 9.5f)
            lineTo(4.5f, 19f)
            lineTo(19.5f, 19f)
            lineTo(19.5f, 9.5f)
            lineTo(4.5f, 9.5f)
            moveTo(4.5f, 9.5f)
            lineTo(5.3f, 5.2f)
            lineTo(20.3f, 5.2f)
            lineTo(19.5f, 9.5f)
            moveTo(9.3f, 5.2f)
            lineTo(8.7f, 9.5f)
            moveTo(14.3f, 5.2f)
            lineTo(13.7f, 9.5f)
        }
    }
}

/** 📺 Séries — écran + pied, silhouette de téléviseur. Utilisée par la
 *  NavRail (onglet Séries), distincte du clap Films pour rester lisible en
 *  mode collapsed (icône seule, sans libellé). */
val MovvizIconTvScreen: ImageVector by lazy {
    movvizIcon("MovvizIconTvScreen") {
        stroke(width = 2.1f) {
            moveTo(4f, 5.8f)
            lineTo(4f, 15.8f)
            lineTo(20f, 15.8f)
            lineTo(20f, 5.8f)
            lineTo(4f, 5.8f)
            moveTo(12f, 15.8f)
            lineTo(12f, 18.6f)
            moveTo(8.5f, 18.6f)
            lineTo(15.5f, 18.6f)
        }
    }
}
