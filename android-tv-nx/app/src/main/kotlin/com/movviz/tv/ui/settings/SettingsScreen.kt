package com.movviz.tv.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.BuildConfig
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
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
) {
    val serverUrl by viewModel.serverUrl.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()
    val userPrefs by viewModel.userPrefs.collectAsState()
    var headerFocused by remember { mutableStateOf(false) }

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
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 36.dp, top = 24.dp, end = 36.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(21.dp),
    ) {
        item(contentType = "header") {
            Text(
                text = "Paramètres",
                style = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
                modifier = Modifier
                    .let { if (entryFocusRequester != null) it.focusRequester(entryFocusRequester) else it }
                    .background(if (headerFocused) Color.White.copy(alpha = 0.08f) else Color.Transparent, RoundedCornerShape(6.dp))
                    .onFocusChanged { headerFocused = it.isFocused }
                    .focusable()
                    .padding(horizontal = 6.dp, vertical = 3.dp),
            )
        }

        item(contentType = "account") {
            SettingsSection(title = "Compte") {
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

        item(contentType = "playback") {
            SettingsSection(title = "Lecture") {
                Text(
                    text = "Langue audio par défaut",
                    style = TextStyle(fontSize = 10.sp, color = MovvizInkSoft),
                )
                Spacer(modifier = Modifier.height(9.dp))
                // TvLazyRow (pas Row+horizontalScroll) : les 7 langues
                // dépassent la carte et le scroll suit le focus D-pad, avec
                // restauration de position au retour via focusRestorer.
                TvLazyRow(
                    modifier = Modifier.focusRestorer(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 2.dp),
                ) {
                    itemsIndexed(AUDIO_LANGUAGE_LABELS, key = { _, item -> "lang-${item.first}" }) { _, item ->
                        LanguageChip(
                            label = item.second,
                            selected = (userPrefs?.preferredAudioLanguage ?: "auto") == item.first,
                            onClick = { viewModel.setPreferredAudioLanguage(item.first) },
                        )
                    }
                }
            }
        }

        item(contentType = "about") {
            SettingsSection(title = "À propos") {
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
                        Text(text = it, style = TextStyle(fontSize = 9.sp, color = MovvizInkDim))
                    }
                }
            }
        }

        item(contentType = "logout") {
            SettingsButton(text = "Se déconnecter", dangerous = true) {
                viewModel.logout()
                onLoggedOut()
            }
        }
    }
}

@Composable
private fun AutoUpdateToggle(viewModel: AppViewModel) {
    val enabled by viewModel.autoUpdateEnabled.collectAsState()
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    Surface(
        onClick = { viewModel.setAutoUpdateEnabled(!enabled) },
        modifier = Modifier
            .tvFocusLift(focused = focused, shape = shape, maxElevation = 9.dp)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick { viewModel.setAutoUpdateEnabled(!enabled) },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f), colors = ClickableSurfaceDefaults.colors(
            containerColor = if (enabled) MovvizBrand.copy(alpha = 0.25f) else Color.White.copy(alpha = 0.08f),
            contentColor = if (enabled) MovvizBrand else MovvizInkSoft,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, if (enabled) MovvizBrand else Color.White.copy(alpha = 0.4f)),
                shape = shape,
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 9.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                text = if (enabled) "Auto-mise à jour : ON" else "Auto-mise à jour : OFF",
                style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
            )
            Box(
                modifier = Modifier
                    .width(33.dp)
                    .height(18.dp)
                    .background(
                        if (enabled) MovvizBrand else Color.White.copy(alpha = 0.15f),
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

/** Carte glass standard — même trio surface/bordure que le reste de l'app
 *  (voir NavRail, StatusPill) : fond sombre translucide + liseré blanc
 *  8-10%, jamais un aplat opaque. Contenu simple (plus de ColumnScope :
 *  les sections vivent dans des item{} de TvLazyColumn). */
@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column {
        Text(
            text = title.uppercase(),
            style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = MovvizInkSoft, letterSpacing = 1.sp),
        )
        Spacer(modifier = Modifier.height(9.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                .padding(horizontal = 17.dp, vertical = 15.dp),
            content = { content() },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row {
        Text(
            text = label,
            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MovvizInkDim),
            modifier = Modifier.width(135.dp),
        )
        Text(
            text = value,
            style = TextStyle(fontSize = 11.sp, color = MovvizInk),
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
 *  dégradé de marque plein comme l'onglet actif du rail de navigation. */
@Composable
private fun LanguageChip(label: String, selected: Boolean, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
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
            containerColor = if (selected) MovvizBrand.copy(alpha = 0.9f) else Color.White.copy(alpha = 0.08f),
            contentColor = if (selected) Color.White else MovvizInkSoft,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary),
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
private fun SettingsButton(text: String, dangerous: Boolean = false, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(8.dp)
    val baseColor = if (dangerous) MovvizDown else Color.White
    Surface(
        onClick = onClick,
        modifier = Modifier
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
