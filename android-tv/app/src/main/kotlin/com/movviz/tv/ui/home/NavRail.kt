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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.theme.tvPointerClick
import com.movviz.tv.data.TvProfile
import coil.compose.AsyncImage
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.unit.IntOffset

enum class HomeTab(val label: String) {
    HOME("Accueil"),
    MOVIES("Films"),
    SERIES("Séries"),
    SETTINGS("Paramètres"),
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
    // recherche, avatar profil) → contentFocusRequester en priorité, repli
    // sur fallbackFocusRequester si le premier échoue. onKeyEvent (pas
    // focusProperties, déclaratif et sans possibilité d'intercepter un
    // échec) : Compose ne descend jamais dans le contenu depuis la nav par
    // défaut (nav et contenu sont deux frères superposés dans un Box,
    // zIndex(1f) ne joue que sur le dessin), et une cible non attachée
    // plante si rien n'entoure la tentative de runCatching — constaté en
    // direct sur vraie TV dans les deux sens (aucun effet, puis fermeture
    // de l'appli une fois qu'une redirection directe mais non protégée a
    // été tentée). Chaque tentative est protégée individuellement.
    // onPreviewKeyEvent (pas onKeyEvent) : la touche BAS doit être
    // interceptée AVANT que les Surface/TopNavItem enfants ne la
    // consomment pour la navigation interne. Sans ceci, l'enfant focusé
    // peut avaler DOWN avant que le Row ne le voie — constaté en direct
    // sur TV quand la NavRail a le focus et que BAS ne descendait pas
    // dans le contenu.
    val navDownKeyHandler = Modifier.onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown || event.key != Key.DirectionDown) return@onPreviewKeyEvent false
        // requestFocus() returns Boolean in Compose 1.5+ (BOM 2024.12.01) —
        // check the actual return value, NOT .isSuccess which is always true
        // since the call no longer throws. Without this, the DOWN event is
        // consumed but focus never moves, leaving the user stuck on the NavRail.
        val moved = contentFocusRequester?.let { runCatching { it.requestFocus() }.getOrDefault(false) } == true
        if (moved) true
        else fallbackFocusRequester?.let { runCatching { it.requestFocus() }.getOrDefault(false) } == true
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .height(68.dp)
            .then(navDownKeyHandler)
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.66f),
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
            .padding(horizontal = 34.dp),
    ) {
        // Même logo animé que l'accueil/login : halo, ondes et particules
        // font partie de l'identité Movviz, ce n'est pas une icône carrée.
        // Preset `sm` du Sidebar desktop : outer 40, mark 40, wordmark animé.
        AnimatedLogo(size = 40.dp)
        Spacer(modifier = Modifier.width(10.dp))
        MovvizWordmark(fontSize = 18.sp)

        Spacer(modifier = Modifier.width(56.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            HomeTab.entries.forEach { tab ->
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
        Spacer(modifier = Modifier.width(22.dp))
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
                .size(42.dp)
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
                        // requestFocus() returns Boolean in Compose 1.5+ —
                        // check actual return value, not isSuccess (always true).
                        // Retry until the node is attached and focus is granted.
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
                    modifier = Modifier.width(300.dp),
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
                            leading = "◉",
                            label = "Mon profil",
                            focusRequester = firstItemFocus,
                            onClick = { open = false; onSwitch() },
                        )
                        Spacer(Modifier.height(6.dp))
                        MenuItem(
                            leading = "⇄",
                            label = "Changer d'utilisateur",
                            onClick = { open = false; onSwitch() },
                        )
                        Spacer(Modifier.height(6.dp))
                        if (profiles.isNotEmpty()) {
                            Box(Modifier.fillMaxWidth().height(1.dp).padding(horizontal = 10.dp).background(Color.White.copy(alpha = 0.08f)))
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
                                leading = "+",
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
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)
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
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)) {
            Canvas(Modifier.size(24.dp)) {
                drawCircle(Color.White, radius = 7.dp.toPx(), center = androidx.compose.ui.geometry.Offset(9.dp.toPx(), 9.dp.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx()))
                drawLine(Color.White, androidx.compose.ui.geometry.Offset(14.dp.toPx(), 14.dp.toPx()), androidx.compose.ui.geometry.Offset(21.dp.toPx(), 21.dp.toPx()), strokeWidth = 2.dp.toPx())
            }
            if (open) {
                Spacer(Modifier.width(8.dp))
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    singleLine = true,
                    textStyle = TextStyle(fontSize = 16.sp, color = Color.White),
                    // Même piège que WizardScreen.TvTextField : BasicTextField
                    // avale la flèche bas (mouvement de curseur) et le focus
                    // resterait piégé dans le champ, sans jamais atteindre la
                    // grille de résultats — on intercepte la touche pour
                    // sauter sur le premier résultat. L'action IME
                    // "Recherche" fait pareil et referme le clavier.
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        val moved = downFocus?.let { runCatching { it.requestFocus() }.getOrDefault(false) } == true
                        if (!moved) runCatching { fallbackFocus?.requestFocus() }
                        keyboardController?.hide()
                    }),
                    modifier = Modifier
                        .width(180.dp)
                        .focusRequester(inputRequester)
                        .onPreviewKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
                                val moved = downFocus?.let { runCatching { it.requestFocus() }.getOrDefault(false) } == true
                                if (moved) true
                                else fallbackFocus?.let { runCatching { it.requestFocus() }.getOrDefault(false) } == true
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
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp)

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
                fontSize = 15.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                color = if (active) Color.White else MovvizInkDim,
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 11.dp),
        )
    }
}
