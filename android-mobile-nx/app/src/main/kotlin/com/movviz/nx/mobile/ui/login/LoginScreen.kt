package com.movviz.nx.mobile.ui.login

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.layout.imePadding
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizDown
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizIconPlay
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizWordmark
import com.movviz.nx.mobile.ui.wizard.GradientButton
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

/** Même composition carte que WizardScreen — logo animé, titre, champs
 *  étiquetés, bouton en dégradé de marque. En mode `addMode`, le login
 *  sert à AJOUTER un utilisateur au foyer : le titre l'indique. */
@Composable
fun LoginScreen(viewModel: AppViewModel, onLoggedIn: () -> Unit, onChangeServer: () -> Unit = {}, addMode: Boolean = false) {
    val compactPortrait = LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var plexBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val usernameFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val loginButtonFocus = remember { FocusRequester() }
    val plexLoginFocus = remember { FocusRequester() }

    // Focus initial explicite — un seul essai non protégé ici plantait le
    // LaunchedEffect (IllegalStateException, noeud pas encore attaché à la
    // première frame) sans jamais réclamer le focus : symptôme signalé en
    // direct sur "Ajouter utilisateur" (écran qui "ne répond pas" au D-pad).
    // Même filet de sécurité que ProfilePickerScreen/le reste de cet
    // écran (overlay Plex) : retente sur quelques frames au lieu de
    // supposer que le champ est déjà attaché.
    LaunchedEffect(Unit) {
        repeat(10) { attempt ->
            val granted = runCatching { usernameFocus.requestFocus() }.isSuccess
            if (granted) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .then(if (compactPortrait) Modifier.fillMaxWidth().padding(horizontal = 20.dp) else Modifier.width(400.dp))
                .widthIn(max = 400.dp)
                .then(if (compactPortrait) Modifier.verticalScroll(rememberScrollState()).imePadding() else Modifier)
                .background(Color(0xFF101225), RoundedCornerShape(26.dp))
                .border(1.dp, Color(0xFF292D45), RoundedCornerShape(26.dp))
                .padding(horizontal = if (compactPortrait) 22.dp else 34.dp, vertical = if (compactPortrait) 24.dp else 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AnimatedLogo(size = 52.dp)
            Spacer(Modifier.height(10.dp))
            MovvizWordmark(fontSize = 25.sp)
            Spacer(Modifier.height(6.dp))
            Text(
                text = if (addMode) "Ajouter un utilisateur au foyer" else "ÉTAPE 2 / 5 · CONNECTEZ-VOUS",
                style = TextStyle(fontSize = 11.sp, color = MovvizInkDim),
            )
            Spacer(Modifier.height(26.dp))

            FieldLabel("Nom d'utilisateur")
            LoginField(
                value = username,
                onValueChange = { username = it; error = null },
                nextFocus = passwordFocus,
                focusRequester = usernameFocus,
            )
            Spacer(Modifier.height(13.dp))
            FieldLabel("Mot de passe")
            LoginField(
                value = password,
                onValueChange = { password = it; error = null },
                isPassword = true,
                nextFocus = loginButtonFocus,
                focusRequester = passwordFocus,
            )

            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(text = error!!, style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizDown))
            }

            Spacer(Modifier.height(16.dp))

            GradientButton(
                text = if (busy) "Connexion..." else "Se connecter",
                enabled = !busy,
                focusRequester = loginButtonFocus,
                onClick = {
                    if (busy || username.isBlank() || password.isBlank()) return@GradientButton
                    busy = true
                    error = null
                    scope.launch {
                        when (val result = viewModel.login(username.trim(), password)) {
                            is ApiResult.Success -> onLoggedIn()
                            is ApiResult.Failure -> error = "Identifiants incorrects"
                            ApiResult.Unauthorized -> error = "Identifiants incorrects"
                        }
                        busy = false
                    }
                },
            )

            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.09f)))
                Text(
                    text = "OU",
                    style = TextStyle(fontSize = 10.sp, color = MovvizInkDim, letterSpacing = 1.sp),
                    modifier = Modifier.padding(horizontal = 14.dp),
                )
                Box(modifier = Modifier.weight(1f).height(1.dp).background(Color.White.copy(alpha = 0.09f)))
            }
            Spacer(Modifier.height(18.dp))

            Surface(
                onClick = {
                    if (plexBusy || busy) return@Surface
                    plexBusy = true
                    error = null
                    scope.launch {
                        try {
                            when (val pin = viewModel.createPlexPin()) {
                                is ApiResult.Success -> {
                                    // Même parcours OAuth que le desktop :
                                    // l'URL app.plex.tv est ouverte tout de
                                    // suite, puis ce client récupère la session
                                    // via le polling du PIN. L'ancien chemin
                                    // utilisait /tv-pin (code TV) et ne lançait
                                    // jamais l'autorisation sur mobile.
                                    val oauthOpened = runCatching {
                                        require(pin.data.authUrl.startsWith("https://"))
                                        context.startActivity(
                                            Intent(Intent.ACTION_VIEW, Uri.parse(pin.data.authUrl)),
                                        )
                                    }.isSuccess
                                    if (!oauthOpened) {
                                        error = "Impossible d’ouvrir Plex. Réessayez ou ouvrez le lien Plex."
                                        return@launch
                                    }
                                    val deadline = System.currentTimeMillis() + 120_000L
                                    while (System.currentTimeMillis() < deadline) {
                                        delay(2_000L)
                                        when (val poll = viewModel.pollPlexPin(pin.data.id)) {
                                            is ApiResult.Success -> {
                                                poll.data.error?.let {
                                                    error = if (it == "no_plex_access") {
                                                        "Ce compte Plex n’a pas accès à ce serveur Movviz"
                                                    } else "Connexion Plex impossible"
                                                    return@launch
                                                }
                                                if (poll.data.done) {
                                                    if (poll.data.user != null) {
                                                        onLoggedIn()
                                                        return@launch
                                                    } else {
                                                        error = "Plex a validé l’autorisation, mais Movviz n’a pas reçu le compte"
                                                        return@launch
                                                    }
                                                }
                                            }
                                            ApiResult.Unauthorized -> {
                                                error = "Connexion Plex refusée"
                                                return@launch
                                            }
                                            is ApiResult.Failure -> {
                                                error = poll.message
                                                return@launch
                                            }
                                        }
                                    }
                                    error = "La connexion Plex a expiré"
                                }
                                ApiResult.Unauthorized -> error = "Connexion Plex indisponible"
                                is ApiResult.Failure -> error = "Plex est inaccessible"
                            }
                        } finally {
                            plexBusy = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().focusRequester(plexLoginFocus),
                shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(14.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = Color.Transparent,
                    contentColor = MovvizAmber,
                ),
                border = ClickableSurfaceDefaults.border(
                    border = Border(border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)), shape = RoundedCornerShape(14.dp)),
                    focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(2.dp, MovvizAmber), shape = RoundedCornerShape(14.dp)),
                ),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 15.dp),
                ) {
                    Icon(
                        imageVector = MovvizIconPlay,
                        contentDescription = null,
                        tint = MovvizAmber,
                        modifier = Modifier.size(15.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = if (plexBusy) "Connexion à Plex…" else "Se connecter avec Plex",
                        style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = MovvizAmber),
                    )
                }
            }

            Spacer(Modifier.height(18.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Text(text = "Pas encore de compte ? ", style = TextStyle(fontSize = 11.sp, color = MovvizInkDim))
                Text(text = "Créer un compte", style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary))
            }
            Spacer(Modifier.height(12.dp))
            Surface(
                onClick = onChangeServer,
                colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, contentColor = MovvizInkDim),
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
            ) {
                Text("Changer de serveur", fontSize = 11.sp, color = MovvizInkDim, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MovvizInkDim),
        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
    )
}

@Composable
private fun LoginField(
    value: String,
    onValueChange: (String) -> Unit,
    isPassword: Boolean = false,
    nextFocus: FocusRequester,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(12.dp),
            )
            .background(Color(0xFFE8F0FF), RoundedCornerShape(12.dp))
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 15.sp, color = Color(0xFF181A28)),
            singleLine = true,
            visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (isPassword) KeyboardType.Password else KeyboardType.Text,
                imeAction = ImeAction.Done,
            ),
            // Sans onDone, la coche du clavier virtuel n'a aucune action et
            // ne referme donc jamais le clavier (voir WizardScreen.TvTextField
            // pour le même constat, confirmé en testant).
            keyboardActions = KeyboardActions(onDone = {
                nextFocus.requestFocus()
                keyboardController?.hide()
            }),
            // Voir WizardScreen.TvTextField pour le pourquoi de
            // onPreviewKeyEvent — focusProperties seul ne suffit pas,
            // BasicTextField avale la touche bas avant le système de focus.
            modifier = Modifier
                .fillMaxWidth()
                .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                .focusProperties { down = nextFocus }
                .onPreviewKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
                        nextFocus.requestFocus()
                        true
                    } else {
                        false
                    }
                },
        )
    }
}
