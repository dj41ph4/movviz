package com.movviz.tv.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import com.movviz.tv.ui.theme.withTvPrefetchDisabled
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.BuildConfig
import com.movviz.tv.ui.home.requestFocusSafely
import com.movviz.tv.ui.theme.BetaEyebrow
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizBetaShapes
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizChip
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.movvizBetaSurfaceScale
import com.movviz.tv.ui.theme.movvizFocusRing
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick

/** Langue → libellé affiché — mêmes 7 valeurs que PREFERRED_AUDIO_LANGUAGES
 *  côté serveur (src/lib/userPrefs/languages.ts), traduites une fois ici
 *  puisque l'app TV n'a pas de système i18n (voir NavRail/LoginScreen —
 *  chaînes françaises en dur partout). */
private val AUDIO_LANGUAGE_LABELS = listOf(
    "auto" to "Auto",
    "fr" to "Français",
    "en" to "Anglais",
    "es" to "Espagnol",
    "de" to "Allemand",
    "it" to "Italien",
    "nl" to "Néerlandais",
)

@Composable
fun SettingsScreen(
    viewModel: AppViewModel,
    onLoggedOut: () -> Unit,
    // Cible D-pad « flèche bas depuis la NavRail » — attachée au titre
    // visible de la page. Ce repère est volontairement réel : depuis une
    // action basse, UP remonte d'abord ici et le scroll revient au sommet ;
    // seulement un second UP passe à la barre de navigation.
    entryFocusRequester: FocusRequester? = null,
    // Onglet actif de la barre latérale : GAUCHE depuis le premier élément de
    // chaque ligne (titre, langues, interrupteurs, boutons) y mène toujours,
    // au lieu de glisser en diagonale vers le titre ou « Se déconnecter ».
    navRailFocusRequester: FocusRequester? = null,
) {
    val serverUrl by viewModel.serverUrl.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()
    val userPrefs by viewModel.userPrefs.collectAsState()
    var headerFocused by remember { mutableStateOf(false) }
    val beta = LocalMovvizBeta.current
    // Déconnexion confirmée : jamais d'action destructive sur un seul OK
    // accidentel à la télécommande. À la fermeture sans déconnexion, le
    // focus revient sur le bouton qui a ouvert la confirmation.
    var logoutConfirmOpen by remember { mutableStateOf(false) }
    var logoutConfirmWasOpen by remember { mutableStateOf(false) }
    val logoutFocus = remember { FocusRequester() }
    val selectedLanguage = userPrefs?.preferredAudioLanguage ?: "auto"
    val selectedLanguageFocus = remember { FocusRequester() }
    LaunchedEffect(logoutConfirmOpen) {
        if (logoutConfirmOpen) { logoutConfirmWasOpen = true; return@LaunchedEffect }
        if (!logoutConfirmWasOpen) return@LaunchedEffect
        logoutConfirmWasOpen = false
        repeat(20) { attempt ->
            if (logoutFocus.requestFocusSafely()) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }

    // Chargés à l'entrée sur l'écran plutôt qu'au niveau de MainScreen — ni
    // l'identité du compte ni les préférences de lecture ne sont utiles
    // ailleurs (Accueil/Recherche), pas la peine de les garder à jour en
    // permanence en arrière-plan.
    LaunchedEffect(Unit) {
        viewModel.loadCurrentUser()
        viewModel.loadUserPrefs()
    }

    // TvLazyColumn (pas Column+verticalScroll) : le défilement suit le
    // focus D-pad automatiquement et la position survit au retour arrière.
    // top = 32dp : dégage la barre de nav flottante sans bande opaque
    // ajoutée plus haut au niveau de MainScreen.
    TvLazyColumn(
        state = rememberTvLazyListState().withTvPrefetchDisabled(),
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 36.dp, top = 24.dp, end = 36.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(21.dp),
    ) {
        item(key = "header", contentType = "header") {
            val headerShape = RoundedCornerShape(6.dp)
            Text(
                text = "Paramètres",
                style = if (beta) MaterialTheme.typography.headlineMedium.copy(color = MovvizTheme.palette.ink)
                else TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
                modifier = Modifier
                    .railExitGroup(navRailFocusRequester)
                    .let { if (entryFocusRequester != null) it.focusRequester(entryFocusRequester) else it }
                    .background(if (headerFocused && !beta) Color.White.copy(alpha = 0.08f) else Color.Transparent, headerShape)
                    .onFocusChanged { headerFocused = it.isFocused }
                    .movvizFocusRing(headerShape, enabled = beta)
                    .focusable()
                    .padding(horizontal = 6.dp, vertical = 3.dp),
            )
        }

        item(key = "account", contentType = "account") {
            SettingsSection(title = "Compte", navRailFocusRequester = navRailFocusRequester) {
                InfoRow(label = "Utilisateur", value = currentUser?.username ?: "—")
                Spacer(modifier = Modifier.height(8.dp))
                Row {
                    Text(
                        text = "Rôle",
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInkDim),
                        modifier = Modifier.width(120.dp),
                    )
                    RolePill(role = currentUser?.role)
                }
                Spacer(modifier = Modifier.height(8.dp))
                InfoRow(label = "Serveur", value = serverUrl ?: "—")
            }
        }

        item(key = "playback", contentType = "playback") {
            SettingsSection(title = "Lecture", navRailFocusRequester = navRailFocusRequester) {
                Text(
                    text = "Langue audio par défaut",
                    style = TextStyle(fontSize = if (beta) 13.sp else 10.sp, color = if (beta) MovvizTheme.palette.inkSoft else MovvizInkSoft),
                )
                Spacer(modifier = Modifier.height(9.dp))
                // TvLazyRow (pas Row+horizontalScroll) : les 7 langues
                // dépassent la carte et le scroll suit le focus D-pad, avec
                // restauration de position au retour via focusRestorer. À la
                // toute première entrée, le focus va sur la langue CHOISIE.
                TvLazyRow(
                    state = rememberTvLazyListState().withTvPrefetchDisabled(),
                    modifier = Modifier.focusRestorer(selectedLanguageFocus),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(bottom = 2.dp),
                ) {
                    itemsIndexed(AUDIO_LANGUAGE_LABELS, key = { _, item -> "lang-${item.first}" }, contentType = { _, _ -> "language" }) { _, item ->
                        val selected = selectedLanguage == item.first
                        LanguageChip(
                            label = item.second,
                            selected = selected,
                            onClick = { viewModel.setPreferredAudioLanguage(item.first) },
                            focusRequester = if (selected) selectedLanguageFocus else null,
                        )
                    }
                }
            }
        }

        item(key = "appearance", contentType = "appearance") {
            SettingsSection(title = "Apparence", navRailFocusRequester = navRailFocusRequester) {
                val betaUi by viewModel.betaUiEnabled.collectAsState()
                Text(
                    text = "Une mise en scène cinéma : grand écran, typographie immersive et navigation à la télécommande. Désactivez-la pour retrouver l’interface classique.",
                    style = TextStyle(fontSize = if (beta) 13.sp else 10.sp, color = if (beta) MovvizTheme.palette.inkSoft else MovvizInkSoft),
                )
                Spacer(modifier = Modifier.height(9.dp))
                SettingsToggle(
                    label = if (betaUi == true) "Interface Bêta : activée" else "Interface Bêta : désactivée",
                    enabled = betaUi == true,
                    onToggle = { viewModel.setBetaUiEnabled(betaUi != true) },
                )
            }
        }

        item(key = "about", contentType = "about") {
            SettingsSection(title = "À propos", navRailFocusRequester = navRailFocusRequester) {
                InfoRow(label = "Version", value = BuildConfig.VERSION_NAME)
                Spacer(modifier = Modifier.height(8.dp))
                InfoRow(label = "Application", value = "Movviz NX")
                if (BuildConfig.AUTO_UPDATE) {
                    Spacer(modifier = Modifier.height(11.dp))
                    AutoUpdateToggle(viewModel)
                    Spacer(modifier = Modifier.height(11.dp))
                    SettingsButton(text = "Vérifier les mises à jour") { viewModel.requestUpdateCheck() }
                    val updateCheckStatus by viewModel.updateCheckStatus.collectAsState()
                    updateCheckStatus?.let {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(text = it, style = TextStyle(fontSize = if (beta) 12.sp else 9.sp, color = if (beta) MovvizTheme.palette.inkDim else MovvizInkDim))
                    }
                }
            }
        }

        item(key = "logout", contentType = "logout") {
            Box(modifier = Modifier.railExitGroup(navRailFocusRequester)) {
                SettingsButton(text = "Se déconnecter", dangerous = true, focusRequester = logoutFocus) {
                    logoutConfirmOpen = true
                }
            }
        }
    }

    if (logoutConfirmOpen) {
        LogoutConfirmDialog(
            onCancel = { logoutConfirmOpen = false },
            onConfirm = {
                logoutConfirmOpen = false
                logoutConfirmWasOpen = false
                viewModel.logout()
                onLoggedOut()
            },
        )
    }
}

/**
 * Confirmation de déconnexion. Fenêtre à part (Dialog) : le focus y est
 * confiné, la page dessous ne reçoit plus aucune touche. « Annuler » a le
 * focus à l'ouverture — jamais l'action destructive — et Retour referme
 * comme « Annuler ».
 */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
private fun LogoutConfirmDialog(onCancel: () -> Unit, onConfirm: () -> Unit) {
    val beta = LocalMovvizBeta.current
    val palette = MovvizTheme.palette
    val cancelFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        repeat(20) { attempt ->
            if (cancelFocus.requestFocusSafely()) return@LaunchedEffect
            if (attempt < 19) withFrameNanos { }
        }
    }
    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false),
    ) {
        val panelShape = if (beta) MovvizBetaShapes.Panel else RoundedCornerShape(12.dp)
        Column(
            modifier = Modifier
                .widthIn(max = 420.dp)
                .background(if (beta) palette.surface else Color(0xFF0E1330), panelShape)
                .border(1.dp, if (beta) palette.lineStrong else Color.White.copy(alpha = 0.10f), panelShape)
                .padding(horizontal = 24.dp, vertical = 22.dp)
                // Aucune direction ne sort du panneau (filet de sécurité en plus
                // de la fenêtre dédiée).
                .focusProperties { exit = { FocusRequester.Cancel } }
                .focusGroup(),
        ) {
            Text(
                text = "Se déconnecter ?",
                style = if (beta) MaterialTheme.typography.headlineMedium.copy(color = palette.ink)
                else TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Black, color = MovvizInk),
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Ce profil sera déconnecté de cette TV. Il faudra se reconnecter pour le retrouver.",
                style = TextStyle(fontSize = if (beta) 14.sp else 11.sp, color = if (beta) palette.inkSoft else MovvizInkSoft),
            )
            Spacer(modifier = Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SettingsButton(text = "Annuler", focusRequester = cancelFocus, onClick = onCancel)
                SettingsButton(text = "Se déconnecter", dangerous = true, onClick = onConfirm)
            }
        }
    }
}

/** Groupe dont la sortie GAUCHE mène à l'onglet actif de la barre ; sans
 *  barre connue, la recherche par défaut s'applique (comportement d'avant). */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
private fun Modifier.railExitGroup(rail: FocusRequester?): Modifier =
    focusProperties {
        exit = { direction ->
            if (direction == androidx.compose.ui.focus.FocusDirection.Left && rail != null) rail else FocusRequester.Default
        }
    }.focusGroup()

@Composable
private fun AutoUpdateToggle(viewModel: AppViewModel) {
    val enabled by viewModel.autoUpdateEnabled.collectAsState()
    SettingsToggle(
        label = if (enabled) "Auto-mise à jour : ON" else "Auto-mise à jour : OFF",
        enabled = enabled,
        onToggle = { viewModel.setAutoUpdateEnabled(!enabled) },
    )
}

/** Interrupteur de réglage — même rendu pour l'auto-mise à jour et
 *  l'interface Bêta. */
@Composable
private fun SettingsToggle(label: String, enabled: Boolean, onToggle: () -> Unit) {
    if (LocalMovvizBeta.current) {
        BetaSettingsToggle(label = label, enabled = enabled, onToggle = onToggle)
        return
    }
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    Surface(
        onClick = onToggle,
        modifier = Modifier
            .tvFocusLift(focused = focused, shape = shape, maxElevation = 9.dp)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onToggle),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (enabled) MovvizTheme.palette.brand.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.08f),
            contentColor = if (enabled) MovvizTheme.palette.brand else MovvizInkSoft,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, if (enabled) MovvizTheme.palette.brand else Color.White.copy(alpha = 0.4f)),
                shape = shape,
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                text = label,
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            )
            Box(
                modifier = Modifier
                    .width(33.dp)
                    .height(18.dp)
                    .background(
                        if (enabled) MovvizTheme.palette.brand else Color.White.copy(alpha = 0.15f),
                        RoundedCornerShape(9.dp),
                    ),
            ) {
                Box(
                    modifier = Modifier
                        .size(15.dp)
                        .offset(x = if (enabled) 17.dp else 2.dp, y = 2.dp)
                        .background(Color.White, RoundedCornerShape(8.dp)),
                )
            }
        }
    }
}

/** Interrupteur Bêta : ligne `surfaceRaised`, anneau extérieur au focus ;
 *  piste 36×20 dp, accent + pastille couleur de fond quand activé. Le
 *  changement d'état est instantané (action répétée à la télécommande). */
@Composable
private fun BetaSettingsToggle(label: String, enabled: Boolean, onToggle: () -> Unit) {
    val palette = MovvizTheme.palette
    val shape = MovvizBetaShapes.Control
    Surface(
        onClick = onToggle,
        modifier = Modifier
            .movvizFocusRing(shape)
            .tvPointerClick(onToggle),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = movvizBetaSurfaceScale(),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = palette.surfaceRaised,
            focusedContainerColor = palette.surfaceRaised,
            contentColor = palette.ink,
            focusedContentColor = palette.ink,
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(text = label, style = MaterialTheme.typography.labelLarge)
            Box(
                modifier = Modifier
                    .width(36.dp)
                    .height(20.dp)
                    .background(if (enabled) palette.accent else palette.surfaceHigh, RoundedCornerShape(10.dp)),
            ) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .offset(x = if (enabled) 18.dp else 2.dp, y = 2.dp)
                        .background(if (enabled) palette.background else palette.inkSoft, RoundedCornerShape(8.dp)),
                )
            }
        }
    }
}

/** Carte glass standard — même trio surface/bordure que le reste de l'app
 *  (voir NavRail, StatusPill) : fond sombre translucide + liseré blanc
 *  8-10%, jamais un aplat opaque. Contenu simple (plus de ColumnScope :
 *  les sections vivent dans des item{} de TvLazyColumn).
 *  Bêta : surtitre mono à filet d'accent, panneau `surface` rayon 18. */
@Composable
private fun SettingsSection(title: String, navRailFocusRequester: FocusRequester? = null, content: @Composable () -> Unit) {
    val beta = LocalMovvizBeta.current
    val palette = MovvizTheme.palette
    Column(modifier = Modifier.railExitGroup(navRailFocusRequester)) {
        if (beta) {
            BetaEyebrow(text = title, color = palette.inkDim)
        } else {
            Text(
                text = title.uppercase(),
                style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInkSoft, letterSpacing = 1.sp),
            )
        }
        Spacer(modifier = Modifier.height(if (beta) 12.dp else 9.dp))
        val panelShape = if (beta) MovvizBetaShapes.Panel else RoundedCornerShape(12.dp)
        Column(
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .background(if (beta) palette.surface else Color.White.copy(alpha = 0.05f), panelShape)
                .border(1.dp, if (beta) palette.line else Color.White.copy(alpha = 0.08f), panelShape)
                .padding(horizontal = if (beta) 20.dp else 17.dp, vertical = if (beta) 18.dp else 15.dp),
            content = { content() },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    val beta = LocalMovvizBeta.current
    Row {
        Text(
            text = label,
            style = TextStyle(fontSize = if (beta) 13.sp else 11.sp, fontWeight = FontWeight.Bold, color = if (beta) MovvizTheme.palette.inkSoft else MovvizInkDim),
            modifier = Modifier.width(135.dp),
        )
        Text(
            text = value,
            style = TextStyle(fontSize = if (beta) 13.sp else 11.sp, color = if (beta) MovvizTheme.palette.ink else MovvizInk),
        )
    }
}

@Composable
private fun RolePill(role: String?) {
    val (label, color) = when (role) {
        "admin" -> "Administrateur" to MovvizOk
        "user" -> "Utilisateur" to MovvizInkSoft
        else -> "—" to MovvizInkDim
    }
    Text(
        text = label,
        style = TextStyle(fontSize = 8.sp, fontWeight = FontWeight.Bold, color = color),
        modifier = Modifier
            .background(color.copy(alpha = 0.13f), RoundedCornerShape(50))
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

/** Chip de sélection focusable — même lift que les cartes posters
 *  (tvFocusLift), l'état "sélectionné" (pas juste focusé) reprend le
 *  dégradé de marque plein comme l'onglet actif du rail de navigation.
 *  Le focus est un liseré BLANC : il restait invisible sur la langue
 *  choisie, dont le fond et l'ancien liseré avaient la même teinte de
 *  marque. Bêta : chip partagé (choisie = ivoire, focus = anneau). */
@Composable
private fun LanguageChip(label: String, selected: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    if (LocalMovvizBeta.current) {
        MovvizChip(
            label = label,
            active = selected,
            onClick = onClick,
            modifier = Modifier.tvPointerClick(onClick),
            focusRequester = focusRequester,
        )
        return
    }
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(50)
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvFocusLift(focused = focused, shape = shape, maxElevation = 9.dp)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selected) MovvizTheme.palette.brand.copy(alpha = 0.9f) else Color.White.copy(alpha = 0.08f),
            contentColor = if (selected) Color.White else MovvizInkSoft,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White),
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold),
            maxLines = 1,
            softWrap = false,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun SettingsButton(
    text: String,
    dangerous: Boolean = false,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    if (LocalMovvizBeta.current) {
        BetaSettingsButton(text = text, dangerous = dangerous, focusRequester = focusRequester, onClick = onClick)
        return
    }
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    val baseColor = if (dangerous) MovvizDown else Color.White
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .tvFocusLift(focused, shape = shape, maxElevation = 9.dp)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = baseColor.copy(alpha = 0.12f),
            contentColor = baseColor,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, baseColor),
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = text,
            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 9.dp),
        )
    }
}

/** Bouton de réglage Bêta : `surfaceRaised`, texte `danger` pour une action
 *  destructive, anneau extérieur blanc au focus (fond inchangé). */
@Composable
private fun BetaSettingsButton(text: String, dangerous: Boolean, focusRequester: FocusRequester?, onClick: () -> Unit) {
    val palette = MovvizTheme.palette
    val shape = MovvizBetaShapes.Control
    val content = if (dangerous) palette.danger else palette.ink
    Surface(
        onClick = onClick,
        modifier = Modifier
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .movvizFocusRing(shape)
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = movvizBetaSurfaceScale(),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = palette.surfaceRaised,
            focusedContainerColor = palette.surfaceRaised,
            contentColor = content,
            focusedContentColor = content,
        ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
        )
    }
}
