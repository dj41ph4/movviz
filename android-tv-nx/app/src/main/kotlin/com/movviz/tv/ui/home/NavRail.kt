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
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.foundation.focusGroup
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import com.movviz.tv.BuildConfig
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizFullLogo
import com.movviz.tv.ui.theme.BetaEyebrow
import com.movviz.tv.ui.theme.MovvizBetaShapes
import com.movviz.tv.ui.theme.MovvizMotion
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.movvizBetaSurfaceScale
import com.movviz.tv.ui.theme.movvizFocusRing
import androidx.tv.material3.MaterialTheme
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
private val NAV_RAIL_EXPANDED_WIDTH = 156.dp
// Bêta : entre les dimensions du rail Stable (63/156) et l'ancien Bêta (72/200).
private val NAV_RAIL_BETA_COLLAPSED_WIDTH = 68.dp
private val NAV_RAIL_BETA_EXPANDED_WIDTH = 178.dp
private val NAV_ITEM_BETA_HEIGHT = 45.dp

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
@OptIn(ExperimentalComposeUiApi::class)
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
    // Cible HAUT depuis le contenu : onglet sélectionné de la barre de
    // navigation, pour que la touche HAUT depuis le contenu rejoigne
    // directement la NavRail (frères superposés dans un Box — Compose
    // ne trouve pas la nav automatiquement).
    navRailFocusRequester: FocusRequester? = null,
    // Cible DROITE prioritaire : le conteneur du contenu (MainScreen ou
    // DetailFocusToNavHandler), toujours attaché quand la barre est
    // affichée. Son focusRestorer rend l'élément quitté par GAUCHE (rangée
    // C, carte 5) au lieu de renvoyer systématiquement sur le hero.
    contentReentryFocusRequester: FocusRequester? = null,
    modifier: Modifier = Modifier,
) {
    // IMPORTANT : ne pas intercepter DPAD_RIGHT avec onPreviewKeyEvent ici.
    // Le moteur de focus Compose sait déjà sortir d'un focusGroup via
    // focusProperties.exit. Intercepter RIGHT puis appeler requestFocus()
    // consommait la touche avant la recherche de focus native et pouvait
    // laisser le focus dans la sidebar. L'ordre des modifiers est également
    // volontaire : focusProperties DOIT envelopper focusGroup pour piloter
    // la sortie du groupe (doc officielle Compose).
    val beta = LocalMovvizBeta.current
    var railFocused by remember { mutableStateOf(false) }
    var profileMenuOpen by remember { mutableStateOf(false) }
    val expanded = railFocused || profileMenuOpen
    val selectedNavTab = when (selected) {
        HomeTab.MOVIES, HomeTab.SERIES -> HomeTab.LIBRARY
        else -> selected
    }
    val palette = MovvizTheme.palette
    val reduceMotion = MovvizTheme.reduceMotion
    // Bêta : 68/178 dp en 220 ms EaseOut (la largeur suit le focus, une
    // fois par entrée dans la barre). Stable garde son tween(280) d'origine.
    val width by androidx.compose.animation.core.animateDpAsState(
        targetValue = if (expanded) { if (beta) NAV_RAIL_BETA_EXPANDED_WIDTH else NAV_RAIL_EXPANDED_WIDTH } else { if (beta) NAV_RAIL_BETA_COLLAPSED_WIDTH else NAV_RAIL_COLLAPSED_WIDTH },
        animationSpec = if (beta) {
            if (reduceMotion) androidx.compose.animation.core.snap() else tween(MovvizMotion.PANEL, easing = MovvizMotion.EaseOut)
        } else {
            tween(280)
        },
        label = "navRailWidth",
    )
    Column(
        horizontalAlignment = if (expanded) Alignment.Start else Alignment.CenterHorizontally,
        modifier = modifier
            .layout { measurable, constraints ->
                val railWidth = constraints.constrainWidth(width.roundToPx())
                val placeable = measurable.measure(constraints.copy(minWidth = railWidth, maxWidth = railWidth))
                layout(placeable.width, placeable.height) { placeable.placeRelative(0, 0) }
            }
            .fillMaxHeight()
            .focusProperties {
                exit = { focusDirection ->
                    if (focusDirection == FocusDirection.Right) {
                        contentReentryFocusRequester ?: contentFocusRequester ?: FocusRequester.Default
                    } else {
                        FocusRequester.Default
                    }
                }
            }
            .onFocusChanged { railFocused = it.hasFocus }
            .focusGroup()
            // Stable : MovvizSurface / MovvizBorder (valeurs de la palette
            // Stable, pixel-identique). Bêta : aplat #101116 + filet navEdge.
            .background(palette.navBackground)
            .drawBehind {
                drawLine(
                    color = palette.navEdge,
                    start = androidx.compose.ui.geometry.Offset(size.width, 0f),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            // Bêta : (68 − 45) / 2 ≈ 11.5 dp replié, ce qui laisse aussi la
            // place de l'anneau extérieur (6 dp) sans le rogner.
            .padding(horizontal = if (beta) { if (expanded) 15.dp else 11.dp } else { if (expanded) 15.dp else 11.dp }, vertical = 24.dp),
    ) {
        if (beta) {
            // En-tête Bêta : mot-symbole (style wordmark), filet navEdge
            // dessous, 20 dp d'air avant les onglets.
            Column(modifier = Modifier.padding(bottom = 20.dp)) {
                // Barre étendue : logo complet à gauche ; repliée : le symbole « O » seul, CENTRÉ dans la
                // colonne utile, et assez grand pour rester lisible à distance.
                Box(
                    modifier = Modifier.fillMaxWidth().height(46.dp).padding(bottom = 8.dp),
                    contentAlignment = if (expanded) Alignment.CenterStart else Alignment.Center,
                ) {
                    androidx.compose.animation.Crossfade(
                        targetState = expanded,
                        animationSpec = if (reduceMotion) androidx.compose.animation.core.snap() else tween(180),
                        label = "navRailLogo",
                    ) { open ->
                        if (open) MovvizFullLogo(height = 27.dp) else AnimatedLogo(size = 30.dp, symbolOnly = true)
                    }
                }
                Box(Modifier.fillMaxWidth().height(1.dp).background(palette.navEdge))
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 36.dp)) {
                AnimatedLogo(size = 24.dp)
                AnimatedVisibility(visible = expanded, enter = fadeIn(tween(180)), exit = fadeOut(tween(120))) {
                    Row {
                        Spacer(Modifier.width(8.dp))
                        MovvizWordmark(fontSize = 14.sp)
                    }
                }
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(if (beta) 6.dp else 5.dp)) {
            NAV_ITEMS.forEach { tabItem ->
                if (beta) {
                    BetaNavItem(
                        tab = tabItem,
                        active = tabItem == selectedNavTab,
                        expanded = expanded,
                        palette = palette,
                        onClick = { onSelect(tabItem) },
                        focusRequester = if (tabItem == selectedNavTab) navRailFocusRequester else null,
                    )
                } else {
                    TopNavItem(
                        tab = tabItem,
                        active = tabItem == selectedNavTab,
                        expanded = expanded,
                        onClick = { onSelect(tabItem) },
                        focusRequester = if (tabItem == selectedNavTab) navRailFocusRequester else null,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Pied de rail : avatar + nom actif, puis version + pastille de
        // statut (fusion de l'ancien UpdateAvailableButton séparé).
        ProfileFooterRow(
            profiles = profiles,
            active = activeProfile,
            expanded = expanded,
            onSelect = onProfileSelected,
            onAdd = onAddProfile,
            onOpenProfile = onOpenProfile,
            onSwitch = onSwitchProfile,
            onMenuOpenChanged = { profileMenuOpen = it },
            focusRequester = if (selected == HomeTab.PROFILE) navRailFocusRequester else null,
        )
        AnimatedVisibility(visible = expanded, enter = fadeIn(tween(180)), exit = fadeOut(tween(120))) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 11.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(palette.navEdge))
                Spacer(Modifier.height(9.dp))
                if (beta) {
                    Text("Movviz v${BuildConfig.VERSION_NAME}", color = palette.inkDim, style = MaterialTheme.typography.labelSmall)
                } else {
                    Text("Movviz v${BuildConfig.VERSION_NAME}", color = MovvizInkDim, fontSize = 9.sp)
                }
                Spacer(Modifier.height(5.dp))
                UpdateStatusPill(updateAvailable = updateAvailableTag != null, onClick = onUpdateClick)
            }
        }
    }
}

@Composable
private fun UpdateStatusPill(updateAvailable: Boolean, onClick: () -> Unit) {
    val beta = LocalMovvizBeta.current
    val reduceMotion = MovvizTheme.reduceMotion
    var focused by remember { mutableStateOf(false) }
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
            .heightIn(min = if (beta) 32.dp else 0.dp)
            .onFocusChanged { focused = it.isFocused }
            // Mouvement réduit (Bêta) : pas de pulsation infinie.
            .let { if (updateAvailable && !focused && !(beta && reduceMotion)) it.graphicsLayer { this.alpha = alpha } else it }
            .movvizFocusRing(shape, enabled = beta)
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (updateAvailable) MovvizTheme.palette.brand.copy(alpha = 0.18f) else MovvizOk.copy(alpha = 0.08f),
            focusedContainerColor = if (updateAvailable) MovvizTheme.palette.brand.copy(alpha = 0.32f) else MovvizOk.copy(alpha = 0.16f),
        ),
        // Bêta : l'anneau extérieur porte le focus, aucune bordure interne.
        border = if (beta) ClickableSurfaceDefaults.border() else ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(1.dp, if (updateAvailable) MovvizTheme.palette.brand2.copy(alpha = 0.65f) else MovvizOk.copy(alpha = 0.65f)), shape = shape),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)) {
            Box(
                Modifier.size(5.dp).clip(androidx.compose.foundation.shape.CircleShape)
                    .background(if (updateAvailable) Brush.linearGradient(listOf(MovvizBrand3, MovvizTheme.palette.brand2)) else Brush.linearGradient(listOf(MovvizOk, MovvizOk))),
            )
            Spacer(Modifier.width(5.dp))
            val label = if (updateAvailable) "Mettre à jour" else "À jour"
            val labelColor = if (updateAvailable) Color.White else MovvizOk
            if (beta) {
                Text(text = label, color = labelColor, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold))
            } else {
                Text(text = label, color = labelColor, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun ProfileFooterRow(
    profiles: List<TvProfile>,
    active: TvProfile?,
    expanded: Boolean,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
    onOpenProfile: () -> Unit,
    onSwitch: () -> Unit,
    onMenuOpenChanged: (Boolean) -> Unit,
    focusRequester: FocusRequester? = null,
) {
    val beta = LocalMovvizBeta.current
    val avatarFocus = remember { FocusRequester() }
    var restoreAvatarFocus by remember { mutableStateOf(false) }
    var open by remember { mutableStateOf(false) }
    fun closeMenu(restoreInvoker: Boolean = false) {
        restoreAvatarFocus = restoreInvoker
        open = false
        onMenuOpenChanged(false)
    }
    LaunchedEffect(open, restoreAvatarFocus) {
        if (!open && restoreAvatarFocus) {
            withFrameNanos { }
            // Selecting a profile may replace the home entry while the popup closes.
            // Its destination owns initial focus if the invoker has already detached.
            try {
                avatarFocus.requestFocus()
            } catch (_: IllegalStateException) {
                // The rail was removed by navigation; do not request its detached target.
            }
            restoreAvatarFocus = false
        }
    }
    Box {
        // Cercle 38dp replié ; s'élargit (pleine largeur du rail) en mode
        // déployé pour laisser la place au nom, même logique que TopNavItem.
        val avatarShape = if (expanded) { if (beta) MovvizBetaShapes.NavItem else RoundedCornerShape(14.dp) } else androidx.compose.foundation.shape.CircleShape
        val palette = MovvizTheme.palette
        Surface(
            onClick = { open = true; onMenuOpenChanged(true) },
            modifier = Modifier
                .height(if (beta) 40.dp else 29.dp)
                .let { if (expanded) it.fillMaxWidth() else it.width(if (beta) 40.dp else 29.dp) }
                .focusRequester(avatarFocus)
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .semantics { contentDescription = "Menu du profil : ${active?.name.orEmpty()}" }
                // Bêta : anneau extérieur (le cercle de l'avatar reste net).
                .movvizFocusRing(avatarShape, enabled = beta)
                .tvPointerClick { open = true; onMenuOpenChanged(true) },
            shape = ClickableSurfaceDefaults.shape(avatarShape),
            scale = if (beta) movvizBetaSurfaceScale() else ClickableSurfaceDefaults.scale(focusedScale = 1f),
            colors = if (beta) ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = palette.surfaceRaised, pressedContainerColor = palette.surfaceRaised)
                else ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = .06f), focusedContainerColor = Color.White.copy(alpha = .14f)),
            border = if (beta) ClickableSurfaceDefaults.border() else ClickableSurfaceDefaults.border(
                focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(1.dp, MovvizTheme.palette.brand2.copy(alpha = 0.55f)), shape = avatarShape),
            ),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxHeight().aspectRatio(1f).clip(androidx.compose.foundation.shape.CircleShape), contentAlignment = Alignment.Center) {
                    if (active != null) {
                        com.movviz.tv.ui.profile.AvatarImage(
                            profile = active,
                            modifier = Modifier.fillMaxSize(),
                            shape = avatarShape,
                            initialsFontSize = 10.sp,
                        )
                    } else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(MovvizTheme.palette.brand, MovvizTheme.palette.brand2))), contentAlignment = Alignment.Center) {
                        Text("?", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
                AnimatedVisibility(visible = expanded, enter = fadeIn(tween(180)), exit = fadeOut(tween(100))) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Spacer(Modifier.width(8.dp))
                        if (beta) {
                            Text(active?.name ?: "—", color = palette.ink, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        } else {
                            Text(active?.name ?: "—", color = MovvizInk, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
        if (open) {
            Popup(
                alignment = Alignment.BottomStart,
                offset = IntOffset(70, 0),
                onDismissRequest = { closeMenu(restoreInvoker = true) },
                properties = PopupProperties(focusable = true),
            ) {
                val firstItemFocus = remember { FocusRequester() }
                LaunchedEffect(Unit) {
                    withFrameNanos { }
                    firstItemFocus.requestFocus()
                }
                val menuMaxHeight = (LocalConfiguration.current.screenHeightDp * 0.8f).dp
                Surface(
                    modifier = Modifier.width(if (beta) 270.dp else 215.dp).heightIn(max = menuMaxHeight),
                    // Bêta : panneau `background` + filet lineStrong, rayon 18.
                    shape = if (beta) MovvizBetaShapes.Panel else RoundedCornerShape(11.dp),
                    colors = SurfaceDefaults.colors(containerColor = if (beta) palette.background else MovvizSurface),
                    border = Border(
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (beta) palette.lineStrong else MovvizBorder),
                        shape = if (beta) MovvizBetaShapes.Panel else RoundedCornerShape(11.dp),
                    ),
                ) {
                    Column(
                        Modifier
                            .focusProperties { exit = { FocusRequester.Cancel } }
                            .focusGroup()
                            .verticalScroll(rememberScrollState())
                            .padding(8.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)) {
                            Box(Modifier.size(26.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizTheme.palette.brand, MovvizTheme.palette.brand2))), contentAlignment = Alignment.Center) {
                                if (active != null) {
                                    com.movviz.tv.ui.profile.AvatarImage(
                                        profile = active,
                                        modifier = Modifier.fillMaxSize(),
                                        shape = androidx.compose.foundation.shape.CircleShape,
                                        initialsFontSize = 8.sp,
                                    )
                                } else Text("?", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.width(9.dp))
                            Column {
                                if (beta) {
                                    BetaEyebrow("Profil actif", color = palette.inkDim, showRule = false)
                                    Text(active?.name ?: "—", color = palette.ink, style = MaterialTheme.typography.titleMedium)
                                } else {
                                    Text("Profil actif", color = MovvizInkDim, fontSize = 8.sp, letterSpacing = 1.sp)
                                    Text(active?.name ?: "—", color = MovvizInk, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                        Spacer(Modifier.height(5.dp))
                        MenuItem(leadingIcon = MovvizIconDotCircle, label = "Mon profil", focusRequester = firstItemFocus, onClick = { closeMenu(); onOpenProfile() })
                        Spacer(Modifier.height(5.dp))
                        MenuItem(leadingIcon = MovvizIconSwap, label = "Changer d'utilisateur", onClick = { closeMenu(); onSwitch() })
                        Spacer(Modifier.height(5.dp))
                        if (profiles.isNotEmpty()) {
                            Box(Modifier.fillMaxWidth().height(1.dp).padding(horizontal = 12.dp).background(if (beta) palette.line else MovvizBorder))
                            Spacer(Modifier.height(5.dp))
                            profiles.forEach { profile ->
                                MenuItem(avatar = profile, label = profile.name, onClick = { closeMenu(restoreInvoker = true); onSelect(profile) })
                            }
                            Spacer(Modifier.height(3.dp))
                        }
                        MenuItem(leadingIcon = MovvizIconPlus, label = "Ajouter un utilisateur", accent = true, onClick = { closeMenu(); onAdd() })
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
    val beta = LocalMovvizBeta.current
    if (beta) {
        BetaMenuItem(label, onClick, leadingIcon, avatar, accent, focusRequester)
        return
    }
    val shape = RoundedCornerShape(8.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.09f),
            contentColor = if (accent) MovvizTheme.palette.brand2 else MovvizInk,
            focusedContentColor = MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(1.dp, MovvizTheme.palette.brand2.copy(alpha = 0.50f)), shape = shape),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 9.dp, vertical = 6.dp)) {
            if (avatar != null) {
                Box(Modifier.size(21.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizTheme.palette.brand, MovvizTheme.palette.brand2))), contentAlignment = Alignment.Center) {
                    com.movviz.tv.ui.profile.AvatarImage(
                        profile = avatar,
                        modifier = Modifier.fillMaxSize(),
                        shape = androidx.compose.foundation.shape.CircleShape,
                        initialsFontSize = 8.sp,
                    )
                }
                Spacer(Modifier.width(8.dp))
            } else if (leadingIcon != null) {
                Icon(imageVector = leadingIcon, contentDescription = null, tint = if (accent) MovvizTheme.palette.brand2 else MovvizInk, modifier = Modifier.size(12.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(label, color = if (accent) MovvizTheme.palette.brand2 else MovvizInk, fontSize = 11.sp, fontWeight = if (accent) FontWeight.Bold else FontWeight.Medium)
        }
    }
}

/** Ligne du menu profil Bêta : 44 dp, rayon 10, anneau extérieur au focus
 *  (le panneau garde 8 dp de marge intérieure pour ne jamais le rogner). */
@Composable
private fun BetaMenuItem(
    label: String,
    onClick: () -> Unit,
    leadingIcon: ImageVector?,
    avatar: TvProfile?,
    accent: Boolean,
    focusRequester: FocusRequester?,
) {
    val palette = MovvizTheme.palette
    val shape = MovvizBetaShapes.Control
    val restContent = if (accent) palette.accent else palette.inkSoft
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .movvizFocusRing(shape)
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape),
        scale = movvizBetaSurfaceScale(),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            contentColor = restContent,
            focusedContainerColor = palette.surfaceRaised,
            focusedContentColor = if (accent) palette.accent else palette.ink,
            pressedContainerColor = palette.surfaceRaised,
            pressedContentColor = if (accent) palette.accent else palette.ink,
        ),
    ) {
        val content = androidx.tv.material3.LocalContentColor.current
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            if (avatar != null) {
                Box(Modifier.size(24.dp).clip(androidx.compose.foundation.shape.CircleShape).background(palette.surfaceHigh), contentAlignment = Alignment.Center) {
                    com.movviz.tv.ui.profile.AvatarImage(
                        profile = avatar,
                        modifier = Modifier.fillMaxSize(),
                        shape = androidx.compose.foundation.shape.CircleShape,
                        initialsFontSize = 10.sp,
                    )
                }
                Spacer(Modifier.width(10.dp))
            } else if (leadingIcon != null) {
                Icon(imageVector = leadingIcon, contentDescription = null, tint = content, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(10.dp))
            }
            Text(label, color = content, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
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

/**
 * Onglet du rail Bêta (plan §4.3). La SÉLECTION se lit à l'ivoire
 * (#F1EDE5, texte #17151E, icône #514177) ; le FOCUS à l'anneau blanc
 * extérieur, ajouté par-dessus l'état de sélection : les deux restent
 * toujours distinguables (focalisé non sélectionné = surfaceRaised + ink).
 * Changement d'état instantané : la barre se parcourt trop souvent.
 */
@Composable
private fun BetaNavItem(
    tab: HomeTab,
    active: Boolean,
    expanded: Boolean,
    palette: com.movviz.tv.ui.theme.MovvizPalette,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null,
) {
    val shape = MovvizBetaShapes.NavItem
    val restContent = if (active) palette.navSelectedContent else palette.inkDim
    val focusedContent = if (active) palette.navSelectedContent else palette.ink
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth().height(NAV_ITEM_BETA_HEIGHT)
            .semantics { contentDescription = tab.label }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .movvizFocusRing(shape)
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = movvizBetaSurfaceScale(),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) palette.navSelectedContainer else Color.Transparent,
            contentColor = restContent,
            focusedContainerColor = if (active) palette.navSelectedContainer else palette.surfaceRaised,
            focusedContentColor = focusedContent,
            pressedContainerColor = if (active) palette.navSelectedContainer else palette.surfaceRaised,
            pressedContentColor = focusedContent,
        ),
    ) {
        // LocalContentColor suit l'état de la Surface (repos / focus) ;
        // l'icône de l'onglet sélectionné garde son violet dédié.
        val content = androidx.tv.material3.LocalContentColor.current
        val iconTint = if (active) palette.navSelectedIcon else content
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start,
            modifier = Modifier.fillMaxSize().padding(horizontal = 13.dp),
        ) {
            if (tab == HomeTab.LIBRARY) {
                BookmarkIcon(color = iconTint, modifier = Modifier.size(18.dp))
            } else {
                Icon(imageVector = tab.icon(), contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
            }
            AnimatedVisibility(
                visible = expanded,
                enter = fadeIn(if (MovvizTheme.reduceMotion) androidx.compose.animation.core.snap() else tween(180)),
                exit = fadeOut(if (MovvizTheme.reduceMotion) androidx.compose.animation.core.snap() else tween(120)),
            ) {
                Row {
                    Spacer(Modifier.width(12.dp))
                    Text(
                        text = tab.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = content,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun TopNavItem(tab: HomeTab, active: Boolean, expanded: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    // Onglet Stable uniquement : le Bêta passe par BetaNavItem.
    var focused by remember { mutableStateOf(false) }
    val ink = if (active) MovvizInk else MovvizInkDim
    // Carré 56dp en rail replié (comme la maquette carrée du second visuel),
    // pill étirée en déployé. Même rayon que la tuile carrée de la 2e image.
    val collapsedShape = RoundedCornerShape(11.dp)
    val expandedShape = RoundedCornerShape(10.dp)
    val shape = if (expanded) expandedShape else collapsedShape

    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (expanded) it.fillMaxWidth() else it.size(42.dp) }
            .semantics { contentDescription = tab.label }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = 0.055f),
            pressedContainerColor = Color.White.copy(alpha = 0.08f),
            contentColor = if (active) MovvizInk else MovvizInkDim,
            focusedContentColor = MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(1.dp, MovvizTheme.palette.brand2.copy(alpha = 0.52f)), shape = shape),
        ),
    ) {
        Box(
            modifier = Modifier
                .let { if (active) it.background(MovvizTheme.palette.brand.copy(alpha = if (focused) 0.14f else 0.085f), shape) else it }
                .let { if (expanded) it.fillMaxWidth() else it.fillMaxSize() },
            contentAlignment = if (expanded) Alignment.CenterStart else Alignment.Center,
        ) {
            if (expanded) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
                ) {
                    if (tab == HomeTab.LIBRARY) {
                        BookmarkIcon(color = ink, modifier = Modifier.size(15.dp))
                    } else {
                        Icon(
                            imageVector = tab.icon(),
                            contentDescription = null,
                            tint = ink,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                    Spacer(Modifier.width(11.dp))
                    Text(
                        text = tab.label,
                        style = TextStyle(fontSize = 10.5.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium, color = ink),
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
                        tint = ink,
                        modifier = Modifier.size(17.dp),
                    )
                }
            }
        }
    }
}
