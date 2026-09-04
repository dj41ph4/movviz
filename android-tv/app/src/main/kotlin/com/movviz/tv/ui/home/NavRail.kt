package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizIconDotCircle
import com.movviz.tv.ui.theme.MovvizIconDownload
import com.movviz.tv.ui.theme.MovvizIconPlus
import com.movviz.tv.ui.theme.MovvizIconSwap
import com.movviz.tv.ui.theme.MovvizIconHome
import com.movviz.tv.ui.theme.MovvizIconFilm
import com.movviz.tv.ui.theme.MovvizIconTvScreen
import com.movviz.tv.ui.theme.MovvizIconStar
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.tween
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import com.movviz.tv.data.TvProfile
import coil.compose.AsyncImage
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.unit.IntOffset

// Réduite le plus possible en repos (icônes seules) et déployée uniquement
// quand le D-pad s'en approche — demandé en direct : la barre pleine
// largeur (224dp) était jugée « trop large » en permanence. 76dp loge une
// icône ~22dp + son halo de focus sans le serrer ; 188dp (au lieu de 224dp)
// reste demandé « un peu moins large » même déployée.
private val NAV_RAIL_COLLAPSED_WIDTH = 76.dp
private val NAV_RAIL_EXPANDED_WIDTH = 188.dp

enum class HomeTab(val label: String) {
    HOME("Accueil"),
    DISCOVER("Découverte"),
    MOVIES("Films"),
    SERIES("Séries"),
    PROFILE("Mon profil"),
    SETTINGS("Paramètres"),
}

/** Icône par onglet — la NavRail collapsed n'affiche QUE l'icône (pas de
 *  libellé), chaque onglet doit donc rester identifiable seul. */
private fun HomeTab.icon(): ImageVector = when (this) {
    HomeTab.HOME -> MovvizIconHome
    HomeTab.DISCOVER -> MovvizIconStar
    HomeTab.MOVIES -> MovvizIconFilm
    HomeTab.SERIES -> MovvizIconTvScreen
    HomeTab.PROFILE -> MovvizIconDotCircle
    HomeTab.SETTINGS -> MovvizIconHome // jamais rendu comme TopNavItem (voir plus bas) — engrenage dédié.
}

/** Icône engrenage vectorielle — Paramètres devient une icône entre la
 *  loupe et l'avatar profil (demandé en direct), même style que la loupe
 *  dessinée dans SearchButton. */
@Composable
private fun GearIcon(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.size(24.dp)) {
        val stroke = 2.dp.toPx()
        // Couronne : cercle denté simplifié — 8 dents en traits courts.
        drawCircle(
            color = color,
            radius = 6.4.dp.toPx(),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke),
        )
        for (i in 0 until 8) {
            val angle = Math.PI * 2.0 * i / 8.0
            val cx = center.x + 6.4.dp.toPx() * kotlin.math.cos(angle).toFloat()
            val cy = center.y + 6.4.dp.toPx() * kotlin.math.sin(angle).toFloat()
            val ex = center.x + 9.dp.toPx() * kotlin.math.cos(angle).toFloat()
            val ey = center.y + 9.dp.toPx() * kotlin.math.sin(angle).toFloat()
            drawLine(
                color = color,
                start = androidx.compose.ui.geometry.Offset(cx, cy),
                end = androidx.compose.ui.geometry.Offset(ex, ey),
                strokeWidth = stroke,
            )
        }
        // Moyeu central.
        drawCircle(color = color, radius = 2.2.dp.toPx())
    }
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
    searchOpen: Boolean = false,
    searchQuery: String = "",
    onSearchToggle: () -> Unit = {},
    onSearchQueryChange: (String) -> Unit = {},
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
    // bouton recherche, avatar profil) → 3 niveaux, du plus précis au plus robuste :
    //   1. contentFocusRequester : le premier élément RÉEL de l'écran courant
    //      (hero CTA, première carte, premier réglage…).
    //   2. moveFocus(Right) : repli GÉOMÉTRIQUE — l'élément focusable le plus
    //      proche dans la zone de contenu. Fonctionne même quand la cible n°1 n'est pas
    //      encore composée (écran en chargement, changement d'onglet) —
    //      c'était LE trou : avant, on sautait direct sur l'ancre invisible,
    //      l'utilisateur ne voyait RIEN bouger (« DOWN ne redescend plus »,
    //      constaté en direct sur Google TV).
    //   3. fallbackFocusRequester : ancre toujours attachée (MovvizNavHost),
    //      désormais dessinée quand elle prend le focus pour ne jamais
    //      ressembler à un écran gelé.
    // onPreviewKeyEvent (pas onKeyEvent ni focusProperties déclaratif) : la
    // touche DROITE doit être interceptée AVANT que les Surface/TopNavItem
    // enfants ne la consomment, et chaque tentative doit pouvoir intercepter
    // un échec individuellement (une cible non attachée lève une exception).
    val focusManager = LocalFocusManager.current
    val navDownKeyHandler = Modifier.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionRight) return@onPreviewKeyEvent false
        // requestFocus() retourne VOID en compose-ui 1.7.6 (vérifié au
        // javap) — l'ancien commentaire « returns Boolean » était FAUX et
        // l'ancien pattern .getOrDefault(false) produisait Result<Unit>,
        // donc (Unit == true) = TOUJOURS faux : le repli se déclenchait
        // même quand la cible n°1 avait réussi. Le vrai test de succès est
        // .isSuccess : requestFocus() LÈVE IllegalStateException quand le
        // requester n'est attaché à aucun noeud composé.
        val moved = contentFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
        if (moved) return@onPreviewKeyEvent true
        if (focusManager.moveFocus(FocusDirection.Right)) return@onPreviewKeyEvent true
        fallbackFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
    }
    // hasFocus (pas isFocused) : vrai dès qu'un DESCENDANT quelconque de la
    // colonne a le focus D-pad (onglet, loupe, engrenage, avatar…), pas
    // seulement la colonne elle-même — c'est ce qui fait « se déployer au
    // D-pad vers la gauche » plutôt qu'au survol souris (inexistant sur TV).
    var railFocused by remember { mutableStateOf(false) }
    val railWidth by animateDpAsState(
        targetValue = if (railFocused) NAV_RAIL_EXPANDED_WIDTH else NAV_RAIL_COLLAPSED_WIDTH,
        animationSpec = tween(220),
        label = "navRailWidth",
    )
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .width(railWidth)
            .fillMaxHeight()
            .onFocusChanged { railFocused = it.hasFocus }
            .then(navDownKeyHandler)
            .background(
                // Scrim renforcé côté haut : sur un backdrop clair (ciel,
                // neige…) les libellés gris MovvizInkDim devenaient
                // illisibles — constaté en direct sur le hero "86".
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.82f),
                        Color.Black.copy(alpha = 0.45f),
                        Color.Black.copy(alpha = 0.08f),
                    ),
                ),
            )
            .drawBehind {
                drawLine(
                    color = Color.White.copy(alpha = 0.055f),
                    start = androidx.compose.ui.geometry.Offset(0f, size.height),
                    end = androidx.compose.ui.geometry.Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .padding(horizontal = 12.dp, vertical = 22.dp),
    ) {
        // Même logo animé que l'accueil/login : halo, ondes et particules
        // font partie de l'identité Movviz, ce n'est pas une icône carrée.
        // Preset `sm` du Sidebar desktop : outer 40, mark 40, wordmark animé.
        // Le wordmark texte disparaît en collapsed (pas la place), le logo
        // seul reste l'ancre visuelle identifiable dans les deux états.
        AnimatedLogo(size = 32.dp)
        AnimatedVisibility(visible = railFocused, enter = fadeIn(tween(180)), exit = fadeOut(tween(120))) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(modifier = Modifier.height(8.dp))
                MovvizWordmark(fontSize = 16.sp)
            }
        }

        Spacer(modifier = Modifier.height(34.dp))

        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
            // SETTINGS retiré des onglets texte : devient l'icône engrenage
            // entre la loupe et l'avatar (voir plus bas).
            // Le vrai profil est l'avatar en bas du rail. Il ne doit pas
            // exister une seconde fois comme onglet de navigation.
            HomeTab.entries.filter { it != HomeTab.SETTINGS && it != HomeTab.PROFILE }.forEach { tab ->
                TopNavItem(
                    tab = tab,
                    active = tab == selected,
                    expanded = railFocused,
                    onClick = { onSelect(tab) },
                    focusRequester = if (tab == selected) navRailFocusRequester else null,
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))
        if (updateAvailableTag != null) {
            UpdateAvailableButton(
                tag = updateAvailableTag,
                expanded = railFocused,
                onClick = onUpdateClick,
            )
            Spacer(modifier = Modifier.height(12.dp))
        }
        SearchButton(
            open = searchOpen,
            query = searchQuery,
            onToggle = onSearchToggle,
            onQueryChange = onSearchQueryChange,
            downFocus = contentFocusRequester,
            fallbackFocus = fallbackFocusRequester,
        )
        Spacer(modifier = Modifier.height(16.dp))
        // Paramètres en ICÔNE engrenage entre la loupe et l'avatar profil
        // (demandé en direct) — même langage visuel que la loupe : trait
        // blanc, fond discret au focus, bordure nette au D-pad.
        var gearFocused by remember { mutableStateOf(false) }
        val gearShape = androidx.compose.foundation.shape.CircleShape
        Surface(
            onClick = { onSelect(HomeTab.SETTINGS) },
            modifier = Modifier
                .size(36.dp)
                // Paramètres n'est plus un TopNavItem depuis la refonte :
                // l'icône doit donc porter elle-même la cible de retour
                // contenu → NavRail. Sans ce requester, HAUT depuis les
                // réglages visait un noeud qui n'existait plus.
                .let {
                    if (selected == HomeTab.SETTINGS && navRailFocusRequester != null) {
                        it.focusRequester(navRailFocusRequester)
                    } else {
                        it
                    }
                }
                .onFocusChanged { gearFocused = it.isFocused }
                .tvPointerClick { onSelect(HomeTab.SETTINGS) },
            shape = ClickableSurfaceDefaults.shape(shape = gearShape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = if (selected == HomeTab.SETTINGS) Color.White.copy(alpha = 0.14f) else Color.Transparent,
                focusedContainerColor = Color.White.copy(alpha = 0.10f),
            ),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, if (selected == HomeTab.SETTINGS) MovvizBrand2 else Color.White.copy(alpha = .65f)),
                    shape = gearShape,
                ),
            ),
        ) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                GearIcon(color = Color.White.copy(alpha = if (gearFocused || selected == HomeTab.SETTINGS) 1f else 0.75f))
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        // À la place du texte "MOVVIZ TV" : l'avatar du profil actif, toujours
        // visible — même composition que Netflix. Le menu donne accès au
        // changement d'utilisateur (→ écran "Qui est-ce ?") et, pour l'admin,
        // aux profils du foyer en raccourci + l'ajout d'un membre.
        ProfileMenuButton(
            profiles = profiles,
            active = activeProfile,
            onSelect = onProfileSelected,
            onAdd = onAddProfile,
            onOpenProfile = onOpenProfile,
            onSwitch = onSwitchProfile,
        )
    }
}

@Composable
private fun UpdateAvailableButton(tag: String, expanded: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val pulse = rememberInfiniteTransition(label = "updatePulse")
    val alpha by pulse.animateFloat(
        initialValue = 0.48f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(720), RepeatMode.Reverse),
        label = "updatePulseAlpha",
    )
    val shape = RoundedCornerShape(10.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp)
            .graphicsLayer {
                this.alpha = if (focused) 1f else alpha
                scaleX = if (focused) 1.04f else 1f
                scaleY = if (focused) 1.04f else 1f
            }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizBrand.copy(alpha = 0.18f),
            focusedContainerColor = MovvizBrand.copy(alpha = 0.32f),
            contentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2),
                shape = shape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize().padding(horizontal = 8.dp),
        ) {
            Icon(
                imageVector = MovvizIconDownload,
                contentDescription = "Mise à jour $tag disponible",
                tint = Color.White,
                modifier = Modifier.size(22.dp),
            )
            AnimatedVisibility(visible = expanded, enter = fadeIn(tween(140)), exit = fadeOut(tween(90))) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Mise à jour ${tag.removePrefix("v")}",
                        style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White),
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileMenuButton(
    profiles: List<TvProfile>,
    active: TvProfile?,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
    onOpenProfile: () -> Unit,
    onSwitch: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        val avatarShape = androidx.compose.foundation.shape.CircleShape
        Surface(
            onClick = { open = !open },
            modifier = Modifier
                .size(36.dp)
                .tvPointerClick { open = !open },
            shape = ClickableSurfaceDefaults.shape(avatarShape),
            colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = .12f), focusedContainerColor = Color.White.copy(alpha = .22f)),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = androidx.tv.material3.Border(
                    border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2),
                    shape = avatarShape,
                ),
            ),
        ) {
            if (active?.avatar?.startsWith("http") == true) AsyncImage(model = active.avatar, contentDescription = active.name, modifier = Modifier.fillMaxSize())
            else Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                Text(active?.name?.take(2)?.uppercase() ?: "?", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (open) {
            Popup(
                alignment = Alignment.TopEnd,
                offset = IntOffset(-20, 60),
                onDismissRequest = { open = false },
                properties = PopupProperties(focusable = true),
            ) {
                // Focus D-pad : le Popup est une fenêtre séparée — sans
                // demande explicite, le focus reste piégé sur la Surface
                // englobante (l'ancien onClick={} sans action, qui volait
                // le focus) et la flèche bas ne descend jamais dans le menu
                // (bug constaté sur vraie TV). On pose donc le focus sur le
                // premier item dès l'ouverture, en retentant sur quelques
                // frames : l'attachement du noeud peut suivre d'une frame
                // la composition de la fenêtre popup.
                val firstItemFocus = remember { FocusRequester() }
                // LaunchedEffect(open) : relancé à chaque ouverture (le
                // contenu du Popup est recomposé de zéro à chaque fois).
                LaunchedEffect(open) {
                    repeat(10) { attempt ->
                        // requestFocus() retourne void — le succès se teste
                        // par l'ABSENCE d'exception (IllegalStateException si
                        // le noeud n'est pas encore attaché). Retry jusqu'à
                        // ce que le focus soit réellement accordé.
                        val granted = try { firstItemFocus.requestFocus(); true } catch (_: Exception) { false }
                        if (granted) return@LaunchedEffect
                        if (attempt < 9) withFrameNanos { }
                    }
                }
                // Charte Movviz : fond sombre profond, coins doux, bordure
                // discrète, focus à bordure claire — mêmes codes que le
                // sélecteur de profils et les boutons du wizard.
                // PAS de onClick ici : une Surface cliquable sans action
                // prendrait le focus D-pad et bloquerait la descente vers
                // les items (bug constaté sur vraie TV).
                Surface(
                    modifier = Modifier.width(320.dp),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                    colors = SurfaceDefaults.colors(containerColor = Color(0xFF141414)),
                    border = Border(
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                    ),
                ) {
                    Column(Modifier.padding(10.dp)) {
                        // En-tête : profil actif (avatar + nom).
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp)) {
                            Box(Modifier.size(34.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                                if (active?.avatar?.startsWith("http") == true) AsyncImage(model = active.avatar, contentDescription = active.name, modifier = Modifier.fillMaxSize())
                                else Text(active?.name?.take(2)?.uppercase() ?: "?", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text("Profil actif", color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp, letterSpacing = 1.sp)
                                Text(active?.name ?: "—", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        MenuItem(
                            leadingIcon = MovvizIconDotCircle,
                            label = "Mon profil",
                            focusRequester = firstItemFocus,
                            onClick = { open = false; onOpenProfile() },
                        )
                        Spacer(Modifier.height(6.dp))
                        MenuItem(
                            leadingIcon = MovvizIconSwap,
                            label = "Changer d'utilisateur",
                            onClick = { open = false; onSwitch() },
                        )
                        Spacer(Modifier.height(6.dp))
                        if (profiles.isNotEmpty()) {
                            Box(Modifier.fillMaxWidth().height(1.dp).padding(horizontal = 16.dp).background(Color.White.copy(alpha = 0.10f)))
                            Spacer(Modifier.height(6.dp))
                            profiles.forEach { profile ->
                                MenuItem(
                                    avatar = profile,
                                    label = profile.name,
                                    onClick = { open = false; onSelect(profile) },
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            MenuItem(
                                leadingIcon = MovvizIconPlus,
                                label = "Ajouter un utilisateur",
                                accent = true,
                                onClick = { open = false; onAdd() },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Item de menu profil — focus D-pad ET clic pointeur (tvPointerClick,
 *  sans quoi le clic souris de l'émulateur ne fait rien), bordure focus
 *  claire, même famille visuelle que le reste de l'appli. */
@Composable
private fun MenuItem(
    label: String,
    onClick: () -> Unit,
    leading: String? = null,
    leadingIcon: ImageVector? = null,
    avatar: TvProfile? = null,
    accent: Boolean = false,
    focusRequester: FocusRequester? = null,
) {
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp)
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
            contentColor = if (accent) MovvizBrand2 else Color.White,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MovvizBrand2.copy(alpha = 0.9f)),
                shape = shape,
            ),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            if (avatar != null) {
                Box(Modifier.size(28.dp).clip(androidx.compose.foundation.shape.CircleShape).background(Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2))), contentAlignment = Alignment.Center) {
                    if (avatar.avatar?.startsWith("http") == true) AsyncImage(model = avatar.avatar, contentDescription = avatar.name, modifier = Modifier.fillMaxSize())
                    else Text(avatar.name.take(2).uppercase(), color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(10.dp))
            } else if (leadingIcon != null) {
                // Icône vectorielle (MovvizIcons) — les glyphes Unicode ◉ ⇄
                // n'existent pas dans Inter et rendaient en carrés sur TV.
                Icon(
                    imageVector = leadingIcon,
                    contentDescription = null,
                    tint = if (accent) MovvizBrand2 else Color.White,
                    modifier = Modifier.size(16.dp).let { it },
                )
                Spacer(Modifier.width(8.dp))
            } else if (leading != null) {
                Text(leading, color = if (accent) MovvizBrand2 else Color.White, fontSize = 15.sp, modifier = Modifier.width(22.dp))
            }
            Text(label, color = if (accent) MovvizBrand2 else Color.White, fontSize = 15.sp, fontWeight = if (accent) FontWeight.Bold else FontWeight.Medium)
        }
    }
}

@Composable
private fun SearchButton(open: Boolean, query: String, onToggle: () -> Unit, onQueryChange: (String) -> Unit, downFocus: FocusRequester? = null, fallbackFocus: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val inputRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    LaunchedEffect(open) { if (open) inputRequester.requestFocus() }
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)
    Surface(
        onClick = onToggle,
        modifier = Modifier.onFocusChanged { focused = it.isFocused }.tvPointerClick(onToggle),
        shape = ClickableSurfaceDefaults.shape(shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (open) Color.White.copy(alpha = .14f) else Color.Transparent,
            focusedContainerColor = Color.White.copy(alpha = .10f),
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = .65f)),
                shape = shape,
            ),
        ),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
            Canvas(Modifier.size(20.dp)) {
                drawCircle(Color.White, radius = 6.dp.toPx(), center = androidx.compose.ui.geometry.Offset(8.dp.toPx(), 8.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx()))
                drawLine(Color.White, androidx.compose.ui.geometry.Offset(12.dp.toPx(), 12.dp.toPx()), androidx.compose.ui.geometry.Offset(18.dp.toPx(), 18.dp.toPx()), strokeWidth = 2.dp.toPx())
            }
            if (open) {
                Spacer(Modifier.width(8.dp))
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = TextStyle(fontSize = 14.sp, color = Color.White),
                    // BasicTextField garde les directions pour son curseur.
                    // Dans une rail latérale, DROITE est la sortie explicite
                    // vers les résultats ; BAS poursuit le parcours vertical
                    // vers les actions sous le champ. L'action IME
                    // "Recherche" fait pareil et referme le clavier.
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        val moved = downFocus?.let { runCatching { it.requestFocus() }.isSuccess } == true
                        if (!moved) runCatching { fallbackFocus?.requestFocus() }
                        keyboardController?.hide()
                    }),
                    modifier = Modifier
                        // La recherche reste intégralement contenue dans la
                        // colonne réservée : aucune surface ne déborde dans
                        // la zone de contenu / hero.
                        .width(128.dp)
                        .focusRequester(inputRequester)
                        .onPreviewKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionRight) {
                                val moved = downFocus?.let { runCatching { it.requestFocus() }.isSuccess } == true
                                if (moved) true
                                else fallbackFocus?.let { runCatching { it.requestFocus() }.isSuccess } == true
                            } else {
                                false
                            }
                        },
                )
            }
        }
    }
}

@Composable
private fun TopNavItem(tab: HomeTab, active: Boolean, expanded: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(15.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier
            // Déployé, chaque item doit occuper toute la largeur du rail pour
            // que les pastilles s'alignent sur un même bord gauche — en
            // wrap-content, "Accueil"/"Découverte"/"Films" avaient chacun une
            // largeur différente et le CenterHorizontally du parent les
            // faisait flotter à des abscisses différentes (rendu décousu,
            // constaté en direct). Replié, l'item reste wrap-content pour
            // rester une icône centrée compacte.
            .let { if (expanded) it.fillMaxWidth() else it }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        // focusedContainerColor explicite : sans ça, androidx.tv.material3
        // retombe sur son gris/blanc quasi opaque par défaut dès que l'item
        // garde le focus D-pad, écrasant notre teinte discrète et rendant le
        // libellé illisible ("gros bouton blanc" constaté en direct — le
        // focus initial reste sur "Accueil" tant que rien n'a bougé).
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) Color.White.copy(alpha = 0.17f) else Color.Transparent,
            focusedContainerColor = if (active) Color.White.copy(alpha = 0.22f) else Color.White.copy(alpha = 0.09f),
            pressedContainerColor = Color.White.copy(alpha = 0.22f),
            contentColor = if (active) Color.White else MovvizInkDim,
            focusedContentColor = Color.White,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = 0.6f)),
                shape = shape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = if (expanded) 14.dp else 10.dp, vertical = 9.dp),
        ) {
            Icon(
                imageVector = tab.icon(),
                contentDescription = if (expanded) null else tab.label,
                tint = if (active) Color.White else MovvizInkDim,
                modifier = Modifier.size(18.dp),
            )
            // Collapsed : icône seule, centrée — pas de place pour le
            // libellé (demandé en direct : « le plus fin possible avec
            // juste les icônes »). AnimatedVisibility (pas un simple if)
            // pour que le texte s'estompe/glisse au lieu de sauter d'un
            // état à l'autre pendant l'animation de largeur de la colonne.
            AnimatedVisibility(visible = expanded, enter = fadeIn(tween(180)), exit = fadeOut(tween(100))) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = tab.label,
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                            color = if (active) Color.White else MovvizInkDim,
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
