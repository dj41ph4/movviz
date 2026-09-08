package com.movviz.nx.mobile.ui.home

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.Alignment
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Surface
import androidx.tv.material3.Border
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.R
import com.movviz.nx.mobile.ui.theme.MovvizIconSearch
import com.movviz.nx.mobile.ui.theme.MovvizIconSettings
import com.movviz.nx.mobile.ui.theme.tvPointerClick
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
    // Port direct de la barre NX TV : à 375 dp elle reste complète mais peut
    // se parcourir au doigt. Aucun onglet ni action ne doit se superposer ou
    // disparaître ; tablettes/Fold ouvert gardent l'alignement TV étendu.
    val compactWidth = LocalConfiguration.current.screenWidthDp < 600 &&
        LocalConfiguration.current.screenHeightDp > LocalConfiguration.current.screenWidthDp
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
    // En portrait il ne faut jamais faire défiler la barre elle-même : des
    // actions cachées donnent une interface cassée. Les trois destinations
    // principales restent visibles et les actions secondaires sont rangées
    // dans un menu accessible au doigt et au D-pad. Le chemin paysage ne
    // passe jamais ici, il garde donc la barre TV pixel pour pixel.
    if (compactWidth) {
        CompactNxTopNav(
            selected = selected,
            onSelect = onSelect,
            onSearchToggle = onSearchToggle,
            onOpenProfile = onOpenProfile,
            onOpenSettings = onOpenSettings,
            onSwitchProfile = onSwitchProfile,
            updateAvailableTag = updateAvailableTag,
            onUpdateClick = onUpdateClick,
            modifier = modifier,
        )
        return
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
            .padding(
                top = 16.dp,
                start = 56.dp,
                end = 56.dp,
                bottom = 8.dp,
            )
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
                    .height(38.dp)
                    // Compose TV Surface gère le D-pad, mais ne transforme
                    // pas systématiquement un tap en clic. La barre mobile
                    // est une couche au premier plan : chaque action doit
                    // donc recevoir explicitement le pointeur.
                    .tvPointerClick { onSelect(tab) },
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
            modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent).tvPointerClick(onSearchToggle),
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
            modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent).tvPointerClick(onOpenSettings),
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
                modifier = Modifier.height(38.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent).graphicsLayer { alpha = updatePulse }.tvPointerClick(onUpdateClick),
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
            modifier = Modifier.height(42.dp).width(42.dp).onPreviewKeyEvent(moveDownToContent).tvPointerClick(onSwitchProfile),
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

@Composable
private fun CompactNxTopNav(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    onSearchToggle: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenSettings: () -> Unit,
    onSwitchProfile: () -> Unit,
    updateAvailableTag: String?,
    onUpdateClick: () -> Unit,
    modifier: Modifier,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(
        modifier = modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.9f))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(painter = painterResource(R.drawable.movviz_mark), contentDescription = "Movviz", modifier = Modifier.width(32.dp).height(32.dp), contentScale = ContentScale.Fit)
        listOf(HomeTab.HOME, HomeTab.SERIES, HomeTab.MOVIES).forEach { tab ->
            val active = selected == tab
            Surface(onClick = { onSelect(tab) }, modifier = Modifier.height(40.dp).tvPointerClick { onSelect(tab) },
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(20.dp)),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = if (active) Color(0xFF383941) else Color.Transparent, focusedContainerColor = Color(0xFF4A4B53), contentColor = Color.White, focusedContentColor = Color.White)) {
                Text(tab.label, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 9.dp, vertical = 10.dp))
            }
        }
        Spacer(Modifier.weight(1f))
        Surface(onClick = onSearchToggle, modifier = Modifier.width(44.dp).height(44.dp).tvPointerClick(onSearchToggle),
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(CircleShape), colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = Color(0xFF3A3B42), contentColor = Color.White, focusedContentColor = Color.White)) {
            Icon(MovvizIconSearch, "Recherche", Modifier.padding(11.dp), Color.White)
        }
        Surface(onClick = { menuOpen = true }, modifier = Modifier.width(44.dp).height(44.dp).tvPointerClick { menuOpen = true },
            shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(CircleShape), colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color(0xFF2A2B31), focusedContainerColor = Color(0xFF4A4B53), contentColor = Color.White, focusedContentColor = Color.White)) {
            Text("•••", fontSize = 16.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp))
        }
    }
    if (menuOpen) Popup(alignment = Alignment.TopEnd, properties = PopupProperties(focusable = true), onDismissRequest = { menuOpen = false }) {
        androidx.compose.foundation.layout.Column(Modifier.padding(top = 60.dp, end = 12.dp).width(210.dp).background(Color(0xFF1B1B20), RoundedCornerShape(14.dp)).padding(8.dp)) {
            @Composable fun item(label: String, action: () -> Unit) { Surface(onClick = { menuOpen = false; action() }, modifier = Modifier.fillMaxWidth().height(46.dp).tvPointerClick { menuOpen = false; action() }, shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(RoundedCornerShape(9.dp)), colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = Color(0xFF454650), contentColor = Color.White, focusedContentColor = Color.White)) { Text(label, modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) } }
            item("Mon profil", onOpenProfile)
            item("Changer de profil", onSwitchProfile)
            item("Paramètres", onOpenSettings)
            if (updateAvailableTag != null) item("Mettre à jour", onUpdateClick)
        }
    }
}
