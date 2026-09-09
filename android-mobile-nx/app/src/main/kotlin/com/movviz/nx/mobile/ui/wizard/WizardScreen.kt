package com.movviz.nx.mobile.ui.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalConfiguration
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.ui.theme.MovvizBrand
import com.movviz.nx.mobile.ui.theme.MovvizBrand2
import com.movviz.nx.mobile.ui.theme.MovvizDown
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlinx.coroutines.launch

/**
 * Étape 1/5 premier démarrage — "Où se trouve votre serveur ?".
 * Maquette : carte sombre, champ URL avec icône lien, CTA Continuer ›,
 * illustration serveurs stylisée en bas de carte.
 */
@Composable
fun WizardScreen(viewModel: AppViewModel, onConnected: () -> Unit) {
    var url by remember { mutableStateOf("") }
    var testing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val connectButtonFocus = remember { FocusRequester() }
    val urlFieldFocus = remember { FocusRequester() }

    LaunchedEffect(Unit) { urlFieldFocus.requestFocus() }

    OnboardingBackground {
        OnboardingCard {
            OnboardingHeader()
            Spacer(Modifier.height(16.dp))
            OnboardingTitles(
                title = "Où se trouve\nvotre serveur ?",
                subtitle = "Renseignez l'URL de votre serveur\nMovviz ou Jellyfin.",
            )
            Spacer(Modifier.height(20.dp))

            ServerUrlField(
                value = url,
                onValueChange = { url = it; error = null },
                nextFocus = connectButtonFocus,
                focusRequester = urlFieldFocus,
            )

            OnboardingError(error)
            Spacer(Modifier.height(16.dp))

            OnboardingPrimaryButton(
                text = if (testing) "Connexion..." else "Continuer",
                enabled = !testing,
                focusRequester = connectButtonFocus,
                onClick = {
                    if (testing) return@OnboardingPrimaryButton
                    testing = true
                    error = null
                    scope.launch {
                        when (val result = viewModel.testAndSaveServerUrl(url)) {
                            is ApiResult.Success -> onConnected()
                            is ApiResult.Failure -> error = "Connexion impossible : ${result.message}"
                            ApiResult.Unauthorized -> onConnected()
                        }
                        testing = false
                    }
                },
            )
            Spacer(Modifier.height(18.dp))
            ServerIllustration()
        }
    }
}

/** Champ URL sombre avec glpyhe lien "🔗" (maquette) — tactile + D-pad. */
@Composable
fun ServerUrlField(
    value: String,
    onValueChange: (String) -> Unit,
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
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "🔗", style = TextStyle(fontSize = 15.sp), modifier = Modifier.padding(end = 10.dp))
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) {
                Text(text = "https://votre-serveur.fr", style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.38f)))
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(fontSize = 14.sp, color = MovvizInk),
                singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = {
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
    }
}

/** Illustration "serveurs" stylisée : 3 barres empilées avec LEDs, halo violet. */
@Composable
private fun ServerIllustration() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(112.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.verticalGradient(
                    listOf(Color.Transparent, MovvizBrand.copy(alpha = 0.22f)),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            repeat(3) { row ->
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF1B2142))
                        .border(1.dp, MovvizBrand.copy(alpha = 0.45f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 10.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(6.dp).clip(androidx.compose.foundation.shape.CircleShape).background(if (row == 2) MovvizBrand2 else Color(0xFF5CE0D8)))
                        Box(Modifier.size(6.dp).clip(androidx.compose.foundation.shape.CircleShape).background(MovvizBrand.copy(alpha = 0.8f)))
                        Spacer(Modifier.width(4.dp))
                        Box(Modifier.width(56.dp).height(5.dp).clip(RoundedCornerShape(3.dp)).background(Color.White.copy(alpha = 0.16f)))
                    }
                }
            }
        }
    }
}

/** Champ de texte minimal pensé D-pad (réutilisé par Login). */
@Composable
fun TvTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    nextFocus: FocusRequester,
    focusRequester: FocusRequester? = null,
) {
    ServerUrlField(value = value, onValueChange = onValueChange, nextFocus = nextFocus, focusRequester = focusRequester)
}

/** Bouton principal en dégradé de marque — alias maquette. */
@Composable
fun GradientButton(text: String, enabled: Boolean = true, focusRequester: FocusRequester? = null, onClick: () -> Unit) {
    OnboardingPrimaryButton(text = text, enabled = enabled, focusRequester = focusRequester, onClick = onClick)
}
