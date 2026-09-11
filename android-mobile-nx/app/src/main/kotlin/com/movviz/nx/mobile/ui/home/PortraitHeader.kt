package com.movviz.nx.mobile.ui.home

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.R
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizElectricBorder
import com.movviz.nx.mobile.ui.theme.MovvizIconDownload
import com.movviz.nx.mobile.ui.theme.MovvizIconSearch
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizSurface
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick

/**
 * En-tête mobile portrait — mark + wordmark + avatar, puis une barre de
 * recherche PERSISTANTE (jamais un simple bouton loupe qui ouvre/ferme un
 * champ). Reprend la structure des 5 écrans de la charte mobile fournie
 * 2026-09 : sur téléphone portrait, NxTopNav (barre TV condensée) n'est
 * jamais affichée du tout (voir routeShowsNavRail + !compactPortrait dans
 * MainActivity) — ce composable est donc un VRAI en-tête portrait, pas un
 * reskin de la barre TV. Il vit dans le flux (pas en overlay) : le contenu
 * qui suit n'a donc aucun padding devinette à maintenir en synchronisation.
 *
 * Pas de cloche de notifications : aucune fonctionnalité de notification
 * n'existe côté client/serveur aujourd'hui (aucun StateFlow, aucune route
 * API) — l'esquisse en montre une, mais en ajouter une ici serait une fausse
 * affordance qui ne mène nulle part. Omis volontairement (voir rapport).
 */
@Composable
fun PortraitTopHeader(
    activeProfile: TvProfile?,
    onSearchClick: () -> Unit,
    onAvatarClick: () -> Unit,
    modifier: Modifier = Modifier,
    // Variante Téléchargements : titre d'écran à la place du champ de
    // recherche (voir l'esquisse section 3). `title = null` conserve le
    // comportement historique.
    title: String? = null,
    // Variante Profil : ni champ recherche ni titre — juste mark + avatar
    // (esquisse section 3 : "pas de champ de recherche" sous Profil, le
    // contenu porte lui-même son propre "Mon profil").
    showSearchRow: Boolean = true,
    // Mise à jour disponible : pastille flèche-bas à GAUCHE de l'avatar,
    // rendue uniquement quand updateTag est non-null (jamais de trou de
    // layout sinon). Clignotement mauve électrique premium via le halo.
    updateTag: String? = null,
    onUpdateClick: () -> Unit = {},
    // Repli quand aucun profil n'est actif (session sans profil choisi) :
    // initiales + nom d'utilisateur au lieu du "MO" anonyme.
    fallbackName: String? = null,
) {
    val displayName = activeProfile?.name?.takeIf { it.isNotBlank() } ?: fallbackName
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(com.movviz.nx.mobile.ui.theme.MovvizPage)
            .statusBarsPadding()
            .padding(start = 18.dp, end = 18.dp, top = 10.dp, bottom = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(
                painter = painterResource(R.drawable.movviz_mark),
                contentDescription = "Movviz",
                contentScale = ContentScale.Fit,
                modifier = Modifier.size(28.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "Movviz",
                style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = Color.White),
            )
            Spacer(Modifier.weight(1f))
            if (updateTag != null) {
                PortraitUpdateButton(tag = updateTag, onClick = onUpdateClick)
                Spacer(Modifier.width(10.dp))
            }
            Surface(
                onClick = onAvatarClick,
                modifier = Modifier.size(36.dp).tvPointerClick(onAvatarClick),
                shape = ClickableSurfaceDefaults.shape(CircleShape),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = MovvizSurfaceStrong,
                    focusedContainerColor = MovvizSurfaceStrong,
                    contentColor = Color.White,
                    focusedContentColor = Color.White,
                ),
            ) {
                if (activeProfile != null) {
                    com.movviz.nx.mobile.ui.profile.AvatarImage(
                        profile = activeProfile,
                        modifier = Modifier.fillMaxSize(),
                        shape = CircleShape,
                        initialsFontSize = 12.sp,
                        contentDescription = "Changer de profil : ${displayName ?: "..."}",
                    )
                } else {
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            displayName?.take(2)?.uppercase() ?: "MO",
                            color = Color.White,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
        if (title != null) {
            Spacer(Modifier.height(14.dp))
            Text(
                text = title,
                style = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Black, color = Color.White),
            )
        } else if (showSearchRow) {
            Spacer(Modifier.height(12.dp))
        Surface(
            onClick = onSearchClick,
            modifier = Modifier.fillMaxWidth().height(46.dp)
                .border(1.dp, com.movviz.nx.mobile.ui.theme.MovvizElectricBorder, RoundedCornerShape(23.dp))
                .tvPointerClick(onSearchClick),
            shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(23.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = MovvizSurface,
                    focusedContainerColor = MovvizSurfaceStrong,
                    contentColor = Color.White,
                    focusedContentColor = Color.White,
                ),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                ) {
                    Icon(
                        imageVector = MovvizIconSearch,
                        contentDescription = null,
                        tint = MovvizInkSoft,
                        modifier = Modifier.size(17.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "Rechercher un film, une série, un acteur…",
                        color = MovvizInkSoft,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/** Pastille mise à jour du header portrait — flèche-bas dans un anneau
 *  mauve électrique, à gauche de l'avatar, visible uniquement quand une mise
 *  à jour existe. Le halo respire (alpha 0.35↔1 en boucle) : signal premium,
 *  jamais agressif. Hitbox 44dp (règle tactile projet). */
@Composable
private fun PortraitUpdateButton(
    tag: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pulse = rememberInfiniteTransition(label = "headerUpdatePulse")
    val glowAlpha by pulse.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "headerUpdateGlow",
    )
    Surface(
        onClick = onClick,
        modifier = modifier.size(44.dp).tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(CircleShape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizSurfaceStrong,
            focusedContainerColor = MovvizSurfaceStrong,
            contentColor = Color.White,
            focusedContentColor = Color.White,
        ),
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.fillMaxSize()
                .border(1.5.dp, MovvizElectricBorder, CircleShape)
                .background(MovvizBrand2.copy(alpha = 0.10f + 0.12f * glowAlpha), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = MovvizIconDownload,
                contentDescription = "Mise à jour ${tag.removePrefix("v")} disponible",
                tint = Color.White,
                modifier = Modifier.size(18.dp),
            )
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 7.dp, end = 7.dp)
                    .size(7.dp)
                    .background(MovvizBrand2.copy(alpha = glowAlpha), CircleShape),
            )
        }
    }
}
