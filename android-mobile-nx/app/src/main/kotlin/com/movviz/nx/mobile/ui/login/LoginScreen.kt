package com.movviz.nx.mobile.ui.login

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.ui.theme.MovvizAmber
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.wizard.OnboardingBackground
import com.movviz.nx.mobile.ui.wizard.OnboardingCard
import com.movviz.nx.mobile.ui.wizard.OnboardingError
import com.movviz.nx.mobile.ui.wizard.OnboardingFieldShape
import com.movviz.nx.mobile.ui.wizard.OnboardingFootnote
import com.movviz.nx.mobile.ui.wizard.OnboardingHeader
import com.movviz.nx.mobile.ui.wizard.OnboardingOrDivider
import com.movviz.nx.mobile.ui.wizard.OnboardingPrimaryButton
import com.movviz.nx.mobile.ui.wizard.OnboardingTitles
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

/**
 * Étape 2/5 — "Connectez-vous à votre compte".
 * Maquette : 2 champs sombres avec icônes (personne/cadenas + œil),
 * CTA "Se connecter ›", séparateur "ou", bouton "❯ Se connecter avec Plex",
 * mention "Pas encore de compte ?".
 *
 * En [addMode] (ajout depuis "Qui regarde ?" = 3 → 2 → 3), même layout,
 * seul le titre change.
 */
@Composable
fun LoginScreen(viewModel: AppViewModel, onLoggedIn: () -> Unit, onChangeServer: () -> Unit = {}, addMode: Boolean = false) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var plexBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val usernameFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val loginButtonFocus = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        repeat(10) { attempt ->
            if (runCatching { usernameFocus.requestFocus() }.isSuccess) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    OnboardingBackground {
        OnboardingCard {
            // Scroll + imePadding : le clavier ne doit jamais masquer le CTA sur petit écran.
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Le halo multicolore du logo déborde au-dessus de sa propre
                // boîte (voir AnimatedLogo.kt) — sans cette marge, le viewport
                // du scroll (qui clippe à sa position 0) tronquait le haut du
                // halo puisque le logo était le tout premier élément.
                Spacer(Modifier.height(14.dp))
                OnboardingHeader()
                Spacer(Modifier.height(16.dp))
                if (addMode) {
                    OnboardingTitles(
                        title = "Ajouter un profil",
                        subtitle = "Connectez-vous avec le compte\nà ajouter sur cet appareil.",
                    )
                } else {
                    OnboardingTitles(
                        title = "Connectez-vous\nà votre compte",
                        subtitle = "Retrouvez vos bibliothèques,\nvos favoris et bien plus encore.",
                    )
                }
                Spacer(Modifier.height(20.dp))

                LoginField(
                    value = username,
                    onValueChange = { username = it; error = null },
                    placeholder = "Nom d'utilisateur",
                    leading = "👤",
                    nextFocus = passwordFocus,
                    focusRequester = usernameFocus,
                )
                Spacer(Modifier.height(12.dp))
                LoginField(
                    value = password,
                    onValueChange = { password = it; error = null },
                    placeholder = "Mot de passe",
                    leading = "🔒",
                    isPassword = !passwordVisible,
                    trailing = if (passwordVisible) "👁" else "👁‍🗨",
                    onTrailingClick = { passwordVisible = !passwordVisible },
                    nextFocus = loginButtonFocus,
                    focusRequester = passwordFocus,
                )

                OnboardingError(error)
                Spacer(Modifier.height(16.dp))

                OnboardingPrimaryButton(
                    text = if (busy) "Connexion..." else "Se connecter",
                    enabled = !busy,
                    focusRequester = loginButtonFocus,
                    onClick = {
                        if (busy || username.isBlank() || password.isBlank()) return@OnboardingPrimaryButton
                        busy = true
                        error = null
                        scope.launch {
                            when (viewModel.login(username.trim(), password)) {
                                is ApiResult.Success -> onLoggedIn()
                                is ApiResult.Failure -> error = "Identifiants incorrects"
                                ApiResult.Unauthorized -> error = "Identifiants incorrects"
                            }
                            busy = false
                        }
                    },
                )
                Spacer(Modifier.height(14.dp))
                OnboardingOrDivider()
                Spacer(Modifier.height(12.dp))

                PlexButton(
                    busy = plexBusy,
                    onClick = {
                        if (plexBusy || busy) return@PlexButton
                        plexBusy = true
                        error = null
                        scope.launch {
                            try {
                                when (val pin = viewModel.createPlexPin()) {
                                    is ApiResult.Success -> {
                                        val oauthOpened = runCatching {
                                            require(pin.data.authUrl.startsWith("https://"))
                                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(pin.data.authUrl)))
                                        }.isSuccess
                                        if (!oauthOpened) {
                                            error = "Impossible d'ouvrir Plex. Réessayez."
                                            return@launch
                                        }
                                        val deadline = System.currentTimeMillis() + 120_000L
                                        while (System.currentTimeMillis() < deadline) {
                                            delay(2_000L)
                                            when (val poll = viewModel.pollPlexPin(pin.data.id)) {
                                                is ApiResult.Success -> {
                                                    poll.data.error?.let {
                                                        error = if (it == "no_plex_access") "Ce compte Plex n'a pas accès à ce serveur Movviz"
                                                        else "Connexion Plex impossible"
                                                        return@launch
                                                    }
                                                    if (poll.data.done) {
                                                        if (poll.data.user != null) {
                                                            onLoggedIn()
                                                            return@launch
                                                        } else {
                                                            error = "Plex a validé, mais Movviz n'a pas reçu le compte"
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
                )

                OnboardingFootnote(if (addMode) "Le profil rejoint cet appareil" else "Pas encore de compte ?")
                if (!addMode) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Changer de serveur",
                        style = TextStyle(fontSize = 11.sp, color = MovvizInkDim, textAlign = TextAlign.Center),
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable(onClick = onChangeServer)
                            .tvPointerClick(onChangeServer)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    )
                }
            }
        }
    }
}

/** Bouton Plex : fond transparent, bordure fine, "❯" ambre. */
@Composable
private fun PlexButton(busy: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White.copy(alpha = 0.04f), RoundedCornerShape(14.dp))
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MovvizAmber else Color.White.copy(alpha = 0.14f),
                shape = RoundedCornerShape(14.dp),
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .tvPointerClick(onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (busy) "Connexion à Plex…" else "❯   Se connecter avec Plex",
            style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MovvizAmber, textAlign = TextAlign.Center),
        )
    }
}

@Composable
private fun LoginField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leading: String,
    isPassword: Boolean = false,
    trailing: String? = null,
    onTrailingClick: (() -> Unit)? = null,
    nextFocus: FocusRequester,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(OnboardingFieldShape)
            .background(Color.Black.copy(alpha = 0.45f), OnboardingFieldShape)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.12f),
                shape = OnboardingFieldShape,
            )
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = leading, style = TextStyle(fontSize = 14.sp), modifier = Modifier.padding(end = 10.dp))
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                Text(text = placeholder, style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.38f)))
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(fontSize = 14.sp, color = MovvizInk),
                singleLine = true,
                visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(
                    keyboardType = if (isPassword) KeyboardType.Password else KeyboardType.Text,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = {
                    nextFocus.requestFocus()
                    keyboardController?.hide()
                }),
                modifier = Modifier
                    .fillMaxWidth()
                    .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
                    .focusProperties { down = nextFocus }
                    .onPreviewKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown && event.key == Key.DirectionDown) {
                            nextFocus.requestFocus()
                            true
                        } else false
                    },
            )
        }
        if (trailing != null) {
            Text(
                text = trailing,
                style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.55f)),
                modifier = Modifier
                    .padding(start = 8.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(onClick = { onTrailingClick?.invoke() })
                    .tvPointerClick { onTrailingClick?.invoke() }
                    .padding(4.dp),
            )
        }
    }
}
