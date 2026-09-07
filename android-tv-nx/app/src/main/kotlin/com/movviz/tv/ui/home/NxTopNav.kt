package com.movviz.tv.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Surface
import androidx.tv.material3.Border
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import com.movviz.tv.data.TvProfile
import com.movviz.tv.R
import com.movviz.tv.ui.theme.MovvizIconSearch
import com.movviz.tv.ui.theme.MovvizIconSettings
import coil.compose.AsyncImage

/** Navigation NX: très peu de chrome, sans réserver une colonne au contenu. */
@Composable
fun NxTopNav(
    selected: HomeTab,
    hasScrolled: Boolean = false,
    onSelect: (HomeTab) -> Unit,
    searchOpen: Boolean = false,
    searchQuery: String = "",
    onSearchToggle: () -> Unit = {},
    onSearchQueryChange: (String) -> Unit = {},
    profiles: List<TvProfile> = emptyList(),
    activeProfile: TvProfile? = null,
    onProfileSelected: (TvProfile) -> Unit = {},
    onAddProfile: () -> Unit = {},
    onOpenProfile: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onSwitchProfile: () -> Unit = {},
    updateAvailableTag: String? = null,
    onUpdateClick: () -> Unit = {},
    contentFocusRequester: FocusRequester? = null,
    fallbackFocusRequester: FocusRequester? = null,
    navRailFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier,
) {
    // Netflix ne pose pas une bande noire fixe devant le hero : au sommet la
    // barre se fond dans une courte ombre verticale, puis elle devient une
    // surface noire pleine dès qu'une rangée passe derrière. Une transition
    // animée évite le "flash" de fond au premier appui DOWN/UP.
    val scrollScrim by animateFloatAsState(
        targetValue = if (hasScrolled) 1f else 0f,
        animationSpec = tween(durationMillis = 180),
        label = "nx_top_nav_scrim",
    )
    val topScrim = 0.56f + 0.44f * scrollScrim
    val middleScrim = 0.24f + 0.76f * scrollScrim
    val bottomScrim = scrollScrim
    // Les onglets sont les nœuds réellement focalisés. Un gestionnaire
    // posé seulement sur la Row parente ne reçoit pas systématiquement DOWN
    // depuis une Surface enfant Compose TV, ce qui bloquait Films/Séries
    // dans la barre. Les surfaces de navigation reçoivent donc le même
    // repli explicite vers le premier élément réel du contenu.
    val moveDownToContent: (KeyEvent) -> Boolean = { event ->
        if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
            contentFocusRequester?.let { requester ->
                runCatching { requester.requestFocus() }.isSuccess
            } ?: false
        } else false
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            // Au sommet le dégradé disparaît avant le hero : aucune zone
            // noire vide entre la navigation et l'image. En défilement les
            // trois stops convergent vers noir opaque pour une lecture stable
            // sur toutes les affiches, même très claires.
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = topScrim),
                        Color.Black.copy(alpha = middleScrim),
                        Color.Black.copy(alpha = bottomScrim),
                    ),
                ),
            )
            .padding(top = 16.dp, start = 56.dp, end = 56.dp, bottom = 8.dp)
            // La barre reste compacte ; seul l'onglet actif est une capsule.
            // Le héros conserve donc sa place, y compris sur 1080p.
            .onPreviewKeyEvent(moveDownToContent),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Image(
            painter = painterResource(R.drawable.movviz_mark),
            contentDescription = "Movviz",
            contentScale = ContentScale.Fit,
            modifier = Modifier.height(38.dp).width(38.dp).padding(end = 2.dp),
        )
        // Accueil mélange les univers. Films et Séries possèdent chacun leur
        // couple Suggestions/Bibliothèque : une entrée Découverte à part ne
        // ferait que fragmenter ce parcours et surchargeait la barre.
        listOf(HomeTab.HOME, HomeTab.SERIES, HomeTab.MOVIES, HomeTab.PROFILE).forEach { tab ->
            val active = selected == tab
            Surface(
                onClick = { onSelect(tab) },
                modifier = Modifier
                    .let { if (tab == selected && navRailFocusRequester != null) it.focusRequester(navRailFocusRequester) else it }
                    .onPreviewKeyEvent(moveDownToContent)
                    .height(38.dp),
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp)),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                    containerColor = if (active) Color(0xFF2A2B31) else Color.Transparent,
                    // Page active = capsule sombre persistante. Focus sur
                    // un autre onglet = simple contour clair : deux pages
                    // ne peuvent plus sembler actives simultanément.
                    focusedContainerColor = if (active) Color(0xFF3A3B42) else Color.Transparent,
                    contentColor = Color.White,
                    focusedContentColor = Color.White,
                ),
                border = androidx.tv.material3.ClickableSurfaceDefaults.border(
                    focusedBorder = Border(
                        BorderStroke(2.dp, Color.White.copy(alpha = 0.88f)),
                    ),
                ),
            ) {
                Text(tab.label, color = Color.White, fontSize = 15.sp, modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        Spacer(Modifier.weight(1f))
        Surface(
            onClick = onSearchToggle,
            modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp)),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                containerColor = Color.Black.copy(alpha = 0.42f),
                focusedContainerColor = Color(0xFF3A3B42),
                contentColor = Color.White,
                focusedContentColor = Color.White,
            ),
        ) {
            Icon(MovvizIconSearch, contentDescription = "Recherche", tint = Color.White, modifier = Modifier.padding(9.dp))
        }
        Surface(
            onClick = onOpenSettings,
            modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp)),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                containerColor = Color.Black.copy(alpha = 0.42f),
                focusedContainerColor = Color(0xFF3A3B42),
                contentColor = Color.White,
                focusedContentColor = Color.White,
            ),
        ) {
            Icon(MovvizIconSettings, contentDescription = "Paramètres", tint = Color.White, modifier = Modifier.padding(9.dp))
        }
        if (updateAvailableTag != null) {
            // Signal discret mais impossible à rater depuis l'accueil, sur
            // le même principe que Movviz TV : il n'existe qu'après une
            // détection réelle, ne recouvre jamais la lecture, et n'ouvre
            // aucune boîte invasive tout seul.
            val updatePulseTransition = rememberInfiniteTransition(label = "nx_update_available")
            val updatePulse by updatePulseTransition.animateFloat(
                initialValue = 0.52f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(tween(760), RepeatMode.Reverse),
                label = "nx_update_pulse",
            )
            Surface(
                onClick = onUpdateClick,
                modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent).graphicsLayer { alpha = updatePulse },
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(19.dp)),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                    containerColor = Color(0xFFE84AD9), focusedContainerColor = Color.White,
                    contentColor = Color.Black, focusedContentColor = Color.Black,
                ),
            ) {
                Text("↑", color = Color.Black, fontSize = 22.sp, modifier = Modifier.padding(horizontal = 14.dp, vertical = 3.dp))
            }
        }
        Surface(
            // Avatar = raccourci de changement de profil ; l'onglet Mon
            // profil reste consacré au tableau de bord personnel.
            onClick = onSwitchProfile,
            modifier = Modifier.height(42.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(CircleShape),
            colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                containerColor = Color.Black.copy(alpha = 0.42f),
                focusedContainerColor = Color(0xFF3A3B42),
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
                Text(activeProfile?.name?.take(2)?.uppercase() ?: "MO", color = Color.White, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp))
            }
        }
    }
}
