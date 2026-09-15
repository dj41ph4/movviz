package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import com.movviz.tv.BuildConfig
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizBorder
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizBrand3
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurface
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizIconDotCircle
import com.movviz.tv.ui.theme.MovvizIconPlus
import com.movviz.tv.ui.theme.MovvizIconSwap
import com.movviz.tv.ui.theme.MovvizIconHome
import com.movviz.tv.ui.theme.MovvizIconCompass
import com.movviz.tv.ui.theme.MovvizIconSearch
import com.movviz.tv.ui.theme.MovvizIconSettings
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import com.movviz.tv.data.TvProfile
import coil.compose.AsyncImage
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.unit.IntOffset

// Largeurs du design ("Movviz Android TV" / TvSidebar.dc.html) : repliée en
// rail d'icônes, déployée au focus D-pad (pas de survol souris sur TV — le
// hover web devient "un descendant quelconque de la colonne a le focus").
// Valeurs exactes du mockup Claude Design (TvSidebar.dc.html) — source de
// vérité : width 84/260, padding vertical 32, padding horizontal 14/20,
// gap inter-items 6, gap icône-libellé 14, icônes 20px, logo margin-bottom 48.
private val NAV_RAIL_COLLAPSED_WIDTH = 63.dp
private val NAV_RAIL_EXPANDED_WIDTH = 195.dp

// HomeTab garde MOVIES/SERIES/PROFILE : MOVIES/SERIES restent le filtre
// interne Films/Séries de Découverte et de la Bibliothèque (jamais des
// items de nav depuis la refonte — seuls HOME/DISCOVER/LIBRARY/SEARCH/
// SETTINGS le sont), PROFILE reste accessible via le menu avatar en bas de
// la sidebar, jamais un onglet de la liste.
enum class HomeTab(val label: String) {
    HOME("Accueil"),
    DISCOVER("Découverte"),
    LIBRARY("Bibliothèque"),
    MOVIES("Films"),
    SERIES("Séries"),
    SEARCH("Rechercher"),
    PROFILE("Mon profil"),
    SETTINGS("Paramètres"),
}

/** Les 5 items réellement affichés dans la sidebar, dans l'ordre du design. */
private val NAV_ITEMS = listOf(HomeTab.HOME, HomeTab.DISCOVER, HomeTab.LIBRARY, HomeTab.SEARCH, HomeTab.SETTINGS)

private fun HomeTab.icon(): ImageVector = when (this) {
    HomeTab.HOME -> MovvizIconHome
    HomeTab.DISCOVER -> MovvizIconCompass
    HomeTab.SEARCH -> MovvizIconSearch
    HomeTab.SETTINGS -> MovvizIconSettings
    // LIBRARY utilise une icône dessinée (voir BookmarkIcon) : pas de
    // glyphe "signet" dans MovvizIcons.kt aujourd'hui — jamais rendu par ce
    // chemin de toute façon (TopNavItem gère LIBRARY à part, voir plus bas).
    else -> MovvizIconHome
}

/**
 * Navigation latérale réservée. Elle vit dans sa propre colonne du layout
 * racine (MainActivity), jamais superposée au contenu : le hero et les pages
 * commencent donc toujours strictement à sa droite.
 */
@Composable
fun NavRail(
    selected: HomeTab,
    onSelect: (HomeTab) -> Unit,
    profiles: List<TvProfile> = emptyList(),
    activeProfile: TvProfile? = null,
    onProfileSelected: (TvProfile) -> Unit = {},
    onAddProfile: () -> Unit = {},
    onOpenProfile: () -> Unit = {},
    onSwitchProfile: () -> Unit = {},
    updateAvailableTag: String? = null,
    onUpdateClick: () -> Unit = {},
    // Cible D-pad « premier élément réel du contenu affiché » — voir
    // MainScreen : n'est attachée que si l'écran a déjà un vrai premier
    // élément (pas pendant le chargement, pas sur une liste vide).
    contentFocusRequester: FocusRequester? = null,
    // Ancre de repli TOUJOURS attachée (voir MainScreen) — utilisée quand
    // contentFocusRequester ne pointe encore vers rien de réel, pour ne
    // JAMAIS laisser la flèche bas viser une cible non attachée.
    fallbackFocusRequester: FocusRequester? = null,
    // Cible HAUT depuis le contenu : onglet sélectionné de la barre de
    // navigation, pour que la touche HAUT depuis le contenu rejoigne
    // directement la NavRail (frères superposés dans un Box — Compose
    // ne trouve pas la nav automatiquement).
    navRailFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier,
) {
    // flèche droite depuis N'IMPORTE quel item de cette colonne (onglet,
    // avatar profil) → 3 niveaux, du plus précis au plus robuste :
    //   1. contentFocusRequester : le premier élément RÉEL de l'écran courant.
    //   2. moveFocus(Right) : repli GÉOMÉTRIQUE — l'élément focusable le plus
    //      proche dans la zone de contenu.
    //   3. fallbackFocusRequester : ancre toujours attachée (MovvizNavHost).
    val focusManager = LocalFocusManager.current
    val navDownKeyHandler = Modifier.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionRight) return@onPreviewKeyEvent false
        // requestFocus() lève IllegalStateException quand le requester n'est
        // attaché à aucun noeud composé — .isSuccess est le vrai test.
        val moved = contentFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
        if (moved) return@onPreviewKeyEvent true
        if (focusManager.moveFocus(FocusDirection.Right)) return@onPreviewKeyEvent true
        fallbackFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
    }
    // hasFocus (pas isFocused) : vrai dès qu'un DESCENDANT quelconque de la
    // colonne a le focus D-pad — c'est ce qui fait « se déployer » (le
    // survol souris n'existe pas sur TV, le focus D-pad en est l'équivalent).
    var railFocused by remember { mutableStateOf(false) }
    val width by androidx.compose.animation.core.animateDpAsState(
        targetValue = if (railFocused) NAV_RAIL_EXPANDED_WIDTH else NAV_RAIL_COLLAPSED_WIDTH,
        animationSpec = androidx.compose.animation.core.tween(280),
        label = "navRailWidth",
    )
    Column(
        horizontalAlignment = if (railFocused) Alignment.Start else Alignment.CenterHorizontally,
        modifier = modifier
            .width(width)
            .fillMaxHeight()
            .onFocusChanged { railFocused = it.hasFocus }
            .then(navDownKeyHandler)
            .background(MovvizSurface)
            .drawBehind {
                drawLine(
                    color = MovvizBorder,
                    start = androidx.compose.ui.geometry.Offset(size.width, 0f),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .padding(horizontal = if (railFocused) 15.dp else 11.dp, vertical = 24.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 36.dp)) {
            AnimatedLogo(size = 24.dp)
            AnimatedVisibility(visible = railFocused, enter = fadeIn(tween(180)), exit = fadeOut(tween(120))) {
                Row {
                    Spacer(Modifier.width(8.dp))
                    MovvizWordmark(fontSize = 14.sp)
                }
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            NAV_ITEMS.forEach { tabItem ->
                TopNavItem(
                    tab = tabItem,
                    active = tabItem == selected || (tabItem == HomeTab.LIBRARY && (selected == HomeTab.MOVIES || selected == HomeTab.SERIES)),
                    expanded = railFocused,
                    onClick = { onSelect(tabItem) },
                    focusRequester = if (tabItem == selected) navRailFocusRequester else null,
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Pied de rail : avatar + nom actif, puis version + pastille de
        // statut (fusion de l'ancien UpdateAvailableButton séparé).
        ProfileFooterRow(
            profiles = profiles,
            active = activeProfile,
            expanded = railFocused,
            onSelect = onProfileSelected,
            onAdd = onAddProfile,
            onOpenProfile = onOpenProfile,
            onSwitch = onSwitchProfile,
        )
        AnimatedVisibility(visible = railFocused, enter = fadeIn(tween(180)), exit = fadeOut(tween(120))) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 11.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(MovvizBorder))
                Spacer(Modifier.height(9.dp))
                Text("Movviz v${BuildConfig.VERSION_NAME}", color = MovvizInkDim, fontSize = 9.sp)
                Spacer(Modifier.height(5.dp))
                UpdateStatusPill(updateAvailable = updateAvailableTag != null, onClick = onUpdateClick)
            }
        }
    }
}

@Composable
private fun UpdateStatusPill(updateAvailable: Boolean, onClick: () -> Unit) {
    val pulse = rememberInfiniteTransition(label = "updatePulse")
    val alpha by pulse.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(720), RepeatMode.Reverse),
        label = "updatePulseAlpha",
    )
    val shape = RoundedCornerShape(15.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (updateAvailable) it.graphicsLayer { this.alpha = alpha } else it }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (updateAvailable) MovvizBrand.copy(alpha = 0.18f) else MovvizOk.copy(alpha = 0.08f),
            focusedContainerColor = if (updateAvailable) MovvizBrand.copy(alpha = 0.32f) else MovvizOk.copy(alpha = 0.16f),
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, if (updateAvailable) MovvizBrand2 else MovvizOk), shape = shape),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) {
            Box(
                Modifier.size(5.dp).clip(androidx.compose.foundation.shape.CircleShape)
                    .background(if (updateAvailable) Brush.linearGradient(listOf(MovvizBrand3, MovvizBrand2)) else Brush.linearGradient(listOf(MovvizOk, MovvizOk))),
            )
            Spacer(Modifier.width(5.dp))
            Text(
                text = if (updateAvailable) "Mettre à jour" else "À jour",
                color = if (updateAvailable) Color.White else MovvizOk,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun ProfileFooterRow(
    profiles: List<TvProfile>,
    active: TvProfile?,
    expanded: Boolean,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
    onOpenProfile: () -> Unit,
    onSwitch: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        // Cercle 38dp replié ; s'élargit (pleine largeur du rail) en mode
        // déployé pour laisser la place au nom, même logique que TopNavItem.
        val avatarShape = if (expanded) RoundedCornerShape(14.dp) else androidx.compose.foundation.shape.CircleShape
        Surface(
            onClick = { open = !open },
            modifier = Modifier
                .height(29.dp)
                .let { if (expanded) it.fillMaxWidth() else it.width(29.dp) }
                .tvPointerClick { open = !open },
            shape = ClickableSurfaceDefaults.shape(avatarShape),
            colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = .06f), focusedContainerColor = Color.White.copy(alpha = .14f)),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2), shape = avatarShape),
            ),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxHeight().aspectRatio(1f).clip(androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
                    if (active?.avatar?.startsWith("http") == true) AsyncImage(model = active.avatar, contentDescription = active.name, modifier = Modifier.fillMaxSize().clip(avatarShape))
                    else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                        Text(active?.name?.take(2)?.uppercase() ?: "?", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
                AnimatedVisibility(visible = expanded, enter = fadeIn(tween(180)), exit = fadeOut(tween(100))) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Spacer(Modifier.width(8.dp))
                        Text(active?.name ?: "—", color = MovvizInk, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        if (open) {
            Popup(
                alignment = Alignment.BottomStart,
                offset = IntOffset(70, 0),
                onDismissRequest = { open = false },
                properties = PopupProperties(focusable = true),
            ) {
                val firstItemFocus = remember { FocusRequester() }
                LaunchedEffect(open) {
                    repeat(10) { attempt ->
                        val granted = try { firstItemFocus.requestFocus(); true } catch (_: Exception) { false }
                        if (granted) return@LaunchedEffect
                        if (attempt < 9) withFrameNanos { }
                    }
                }
                Surface(
                    modifier = Modifier.width(240.dp),
                    shape = RoundedCornerShape(11.dp),
                    colors = SurfaceDefaults.colors(containerColor = MovvizSurface),
                    border = Border(border = androidx.compose.foundation.BorderStroke(1.dp, MovvizBorder), shape = RoundedCornerShape(11.dp)),
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)) {
                            Box(Modifier.size(26.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                                if (active?.avatar?.startsWith("http") == true) AsyncImage(model = active.avatar, contentDescription = active.name, modifier = Modifier.fillMaxSize())
                                else Text(active?.name?.take(2)?.uppercase() ?: "?", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.width(9.dp))
                            Column {
                                Text("Profil actif", color = MovvizInkDim, fontSize = 8.sp, letterSpacing = 1.sp)
                                Text(active?.name ?: "—", color = MovvizInk, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.height(5.dp))
                        MenuItem(leadingIcon = MovvizIconDotCircle, label = "Mon profil", focusRequester = firstItemFocus, onClick = { open = false; onOpenProfile() })
                        Spacer(Modifier.height(5.dp))
                        MenuItem(leadingIcon = MovvizIconSwap, label = "Changer d'utilisateur", onClick = { open = false; onSwitch() })
                        Spacer(Modifier.height(5.dp))
                        if (profiles.isNotEmpty()) {
                            Box(Modifier.fillMaxWidth().height(1.dp).padding(horizontal = 12.dp).background(MovvizBorder))
                            Spacer(Modifier.height(5.dp))
                            profiles.forEach { profile ->
                                MenuItem(avatar = profile, label = profile.name, onClick = { open = false; onSelect(profile) })
                            }
                            Spacer(Modifier.height(3.dp))
                            MenuItem(leadingIcon = MovvizIconPlus, label = "Ajouter un utilisateur", accent = true, onClick = { open = false; onAdd() })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MenuItem(
    label: String,
    onClick: () -> Unit,
    leadingIcon: ImageVector? = null,
    avatar: TvProfile? = null,
    accent: Boolean = false,
    focusRequester: FocusRequester? = null,
) {
    val shape = RoundedCornerShape(8.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.09f),
            contentColor = if (accent) MovvizBrand2 else MovvizInk,
            focusedContentColor = MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2.copy(alpha = 0.9f)), shape = shape),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 9.dp, vertical = 8.dp)) {
            if (avatar != null) {
                Box(Modifier.size(21.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                    if (avatar.avatar?.startsWith("http") == true) AsyncImage(model = avatar.avatar, contentDescription = avatar.name, modifier = Modifier.fillMaxSize())
                    else Text(avatar.name.take(2).uppercase(), color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(8.dp))
            } else if (leadingIcon != null) {
                Icon(imageVector = leadingIcon, contentDescription = null, tint = if (accent) MovvizBrand2 else MovvizInk, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(label, color = if (accent) MovvizBrand2 else MovvizInk, fontSize = 11.sp, fontWeight = if (accent) FontWeight.Bold else FontWeight.Medium)
        }
    }
}

/** Signet dessiné (pas de glyphe dans MovvizIcons.kt) — même langage trait
 *  blanc que les autres icônes vectorielles du rail. */
@Composable
private fun BookmarkIcon(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(15.dp)) {
        val w = size.width
        val h = size.height
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(w * 0.22f, h * 0.08f)
            lineTo(w * 0.78f, h * 0.08f)
            lineTo(w * 0.78f, h * 0.92f)
            lineTo(w * 0.5f, h * 0.72f)
            lineTo(w * 0.22f, h * 0.92f)
            close()
        }
        drawPath(path, color = color, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx(), join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

@Composable
private fun TopNavItem(tab: HomeTab, active: Boolean, expanded: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    // Carré 56dp en rail replié (comme la maquette carrée du second visuel),
    // pill étirée en déployé. Même rayon que la tuile carrée de la 2e image.
    val collapsedShape = RoundedCornerShape(11.dp)
    val expandedShape = RoundedCornerShape(8.dp)
    val shape = if (expanded) expandedShape else collapsedShape

    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (expanded) it.fillMaxWidth() else it.size(42.dp) }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.09f),
            pressedContainerColor = Color.White.copy(alpha = 0.14f),
            contentColor = if (active) MovvizInk else MovvizInkDim,
            focusedContentColor = MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier
                .let { if (active) it.background(Brush.linearGradient(listOf(MovvizBrand3, MovvizBrand, MovvizBrand2)), shape) else it }
                .let { if (!expanded) it.fillMaxSize() else it },
            contentAlignment = if (expanded) Alignment.CenterStart else Alignment.Center,
        ) {
            if (expanded) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                ) {
                    if (tab == HomeTab.LIBRARY) {
                        BookmarkIcon(color = if (active) Color.White else MovvizInkDim, modifier = Modifier.size(15.dp))
                    } else {
                        Icon(
                            imageVector = tab.icon(),
                            contentDescription = null,
                            tint = if (active) Color.White else MovvizInkDim,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                    Spacer(Modifier.width(11.dp))
                    Text(
                        text = tab.label,
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (active) Color.White else MovvizInkDim),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            } else {
                // Carré centré, icône 22dp comme sur la 2e image (search carré)
                if (tab == HomeTab.LIBRARY) {
                    BookmarkIcon(color = if (active) Color.White else MovvizInkDim, modifier = Modifier.size(17.dp))
                } else {
                    Icon(
                        imageVector = tab.icon(),
                        contentDescription = tab.label,
                        tint = if (active) Color.White else MovvizInkDim,
                        modifier = Modifier.size(17.dp),
                    )
                }
            }
        }
    }
}
