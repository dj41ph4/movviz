package com.movviz.tv.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizWordmark
import com.movviz.tv.ui.wizard.GradientButton
import kotlinx.coroutines.launch

/** Même composition carte que WizardScreen — logo animé, titre, champs
 *  étiquetés, bouton en dégradé de marque. */
@Composable
fun LoginScreen(viewModel: AppViewModel, onLoggedIn: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val usernameFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val loginButtonFocus = remember { FocusRequester() }

    // Focus initial explicite (voir WizardScreen) — le champ existe dès la
    // première composition, pas de dépendance à une donnée async ici.
    LaunchedEffect(Unit) { usernameFocus.requestFocus() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .width(520.dp)
                .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(24.dp))
                .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(24.dp))
                .padding(40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AnimatedLogo(size = 56.dp)
            Spacer(Modifier.height(12.dp))
            MovvizWordmark()
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Connexion",
                style = TextStyle(fontSize = 13.sp, color = Color.White.copy(alpha = 0.5f)),
            )
            Spacer(Modifier.height(24.dp))

            FieldLabel("Nom d'utilisateur")
            LoginField(
                value = username,
                onValueChange = { username = it; error = null },
                nextFocus = passwordFocus,
                focusRequester = usernameFocus,
            )
            Spacer(Modifier.height(16.dp))
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
                Text(text = error!!, style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFEF4444)))
            }

            Spacer(Modifier.height(20.dp))

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
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.5f)),
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
                color = if (focused) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = 0.12f),
                shape = RoundedCornerShape(12.dp),
            )
            .background(Color.Black.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 16.sp, color = Color.White),
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
