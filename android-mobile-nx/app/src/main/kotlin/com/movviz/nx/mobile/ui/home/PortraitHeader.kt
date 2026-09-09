package com.movviz.nx.mobile.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import coil.compose.AsyncImage
import com.movviz.nx.mobile.R
import com.movviz.nx.mobile.data.TvProfile
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
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MovvizSurface.copy(alpha = 0.55f))
            .statusBarsPadding()
            .padding(horizontal = 18.dp, top = 10.dp, bottom = 12.dp),
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
                if (activeProfile?.avatar?.startsWith("http") == true) {
                    AsyncImage(
                        model = activeProfile.avatar,
                        contentDescription = "Changer de profil : ${activeProfile.name}",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize().clip(CircleShape),
                    )
                } else {
                    androidx.compose.foundation.layout.Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            activeProfile?.name?.take(2)?.uppercase() ?: "MO",
                            color = Color.White,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Surface(
            onClick = onSearchClick,
            modifier = Modifier.fillMaxWidth().height(46.dp).tvPointerClick(onSearchClick),
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
