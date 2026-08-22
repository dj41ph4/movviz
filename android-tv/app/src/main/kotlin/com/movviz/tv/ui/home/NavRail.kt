package com.movviz.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import com.movviz.tv.ui.theme.MovvizIconPlus
import com.movviz.tv.ui.theme.MovvizIconSwap
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick
import com.movviz.tv.data.TvProfile
import coil.compose.AsyncImage
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.unit.IntOffset

enum class HomeTab(val label: String) {
    HOME("Accueil"),
    MOVIES("Films"),
    SERIES("Séries"),
    SETTINGS("Paramètres"),
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
 * Barre de navigation horizontale en haut — même composition que le lanceur
 * Netflix : wordmark compact à gauche, libellés texte à plat, et un seul
 * voile très léger qui laisse le hero vivre derrière. L'onglet actif est un
 * aplat neutre discret ; le focus D-pad garde seul une bordure nette.
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
    onSwitchProfile: () -> Unit = {},
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
    // flèche bas depuis N'IMPORTE quel item de cette barre (onglet, bouton
    // recherche, avatar profil) → 3 niveaux, du plus précis au plus robuste :
    //   1. contentFocusRequester : le premier élément RÉEL de l'écran courant
    //      (hero CTA, première carte, premier réglage…).
    //   2. moveFocus(Down) : repli GÉOMÉTRIQUE — l'élément focusable le plus
    //      proche sous la barre. Fonctionne même quand la cible n°1 n'est pas
    //      encore composée (écran en chargement, changement d'onglet) —
    //      c'était LE trou : avant, on sautait direct sur l'ancre invisible,
    //      l'utilisateur ne voyait RIEN bouger (« DOWN ne redescend plus »,
    //      constaté en direct sur Google TV).
    //   3. fallbackFocusRequester : ancre toujours attachée (MovvizNavHost),
    //      désormais dessinée quand elle prend le focus pour ne jamais
    //      ressembler à un écran gelé.
    // onPreviewKeyEvent (pas onKeyEvent ni focusProperties déclaratif) : la
    // touche BAS doit être interceptée AVANT que les Surface/TopNavItem
    // enfants ne la consomment, et chaque tentative doit pouvoir intercepter
    // un échec individuellement (une cible non attachée lève une exception).
    val focusManager = LocalFocusManager.current
    val navDownKeyHandler = Modifier.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionDown) return@onPreviewKeyEvent false
        // requestFocus() retourne VOID en compose-ui 1.7.6 (vérifié au
        // javap) — l'ancien commentaire « returns Boolean » était FAUX et
        // l'ancien pattern .getOrDefault(false) produisait Result<Unit>,
        // donc (Unit == true) = TOUJOURS faux : le repli se déclenchait
        // même quand la cible n°1 avait réussi. Le vrai test de succès est
        // .isSuccess : requestFocus() LÈVE IllegalStateException quand le
        // requester n'est attaché à aucun noeud composé.
        val moved = contentFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
        if (moved) return@onPreviewKeyEvent true
        if (focusManager.moveFocus(FocusDirection.Down)) return@onPreviewKeyEvent true
        fallbackFocusRequester?.let { runCatching { it.requestFocus() }.isSuccess } == true
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            // Barre haute volontairement fine : la navigation reste
            // atteignable sans prendre la place des cartes et du hero.
            .height(56.dp)
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
            .padding(horizontal = 26.dp),
    ) {
        // Même logo animé que l'accueil/login : halo, ondes et particules
        // font partie de l'identité Movviz, ce n'est pas une icône carrée.
        // Preset `sm` du Sidebar desktop : outer 40, mark 40, wordmark animé.
        AnimatedLogo(size = 32.dp)
        Spacer(modifier = Modifier.width(8.dp))
        MovvizWordmark(fontSize = 16.sp)

        Spacer(modifier = Modifier.width(38.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            // SETTINGS retiré des onglets texte : devient l'icône engrenage
            // entre la loupe et l'avatar (voir plus bas).
            HomeTab.entries.filter { it != HomeTab.SETTINGS }.forEach { tab ->
                TopNavItem(
                    tab = tab,
                    active = tab == selected,
                    onClick = { onSelect(tab) },
                    focusRequester = if (tab == selected) navRailFocusRequester else null,
                )
            }
        }

Spacer(modifier = Modifier.weight(1f))
        SearchButton(
            open = searchOpen,
            query = searchQuery,
            onToggle = onSearchToggle,
            onQueryChange = onSearchQueryChange,
            downFocus = contentFocusRequester,
            fallbackFocus = fallbackFocusRequester,
        )
        Spacer(modifier = Modifier.width(14.dp))
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
        Spacer(modifier = Modifier.width(14.dp))
        // À la place du texte "MOVVIZ TV" : l'avatar du profil actif, toujours
        // visible — même composition que Netflix. Le menu donne accès au
        // changement d'utilisateur (→ écran "Qui est-ce ?") et, pour l'admin,
        // aux profils du foyer en raccourci + l'ajout d'un membre.
        ProfileMenuButton(
            profiles = profiles,
            active = activeProfile,
            onSelect = onProfileSelected,
            onAdd = onAddProfile,
            onSwitch = onSwitchProfile,
        )
    }
}

@Composable
private fun ProfileMenuButton(
    profiles: List<TvProfile>,
    active: TvProfile?,
    onSelect: (TvProfile) -> Unit,
    onAdd: () -> Unit,
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
                            onClick = { open = false; onSwitch() },
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
                    // Même piège que WizardScreen.TvTextField : BasicTextField
                    // avale la flèche bas (mouvement de curseur) et le focus
                    // resterait piégé dans le champ, sans jamais atteindre la
                    // grille de résultats — on intercepte la touche pour
                    // sauter sur le premier résultat. L'action IME
                    // "Recherche" fait pareil et referme le clavier.
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        val moved = downFocus?.let { runCatching { it.requestFocus() }.isSuccess } == true
                        if (!moved) runCatching { fallbackFocus?.requestFocus() }
                        keyboardController?.hide()
                    }),
                    modifier = Modifier
                        .width(160.dp)
                        .focusRequester(inputRequester)
                        .onPreviewKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
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
private fun TopNavItem(tab: HomeTab, active: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(15.dp)

    Surface(
        onClick = onClick,
        modifier = Modifier
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
        Text(
            text = tab.label,
            style = TextStyle(
                fontSize = 13.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = if (active) Color.White else MovvizInkDim,
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}
