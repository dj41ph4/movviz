package com.movviz.tv.ui.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.ui.theme.AnimatedLogo
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import kotlinx.coroutines.launch

/**
 * Premier écran au lancement — demande l'URL/IP du serveur Movviz avant
 * tout le reste (identique au principe Plex/Jellyfin). Même composition que
 * la carte de login desktop (src/app/login/page.tsx) : logo animé + titre
 * centrés, carte semi-transparente, bouton en dégradé de marque — plutôt
 * qu'un formulaire nu plaqué à gauche sur fond noir uni.
 */
@Composable
fun WizardScreen(viewModel: AppViewModel, onConnected: () -> Unit) {
    var url by remember { mutableStateOf("http://192.168.1.") }
    var testing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    // BasicTextField avale les touches directionnelles et ne redonne jamais
    // le focus au bouton en dessous via le D-pad — confirmé sur émulateur
    // télécommande, pas une supposition. focusProperties{down=...} force
    // explicitement la sortie du champ vers le bouton.
    val connectButtonFocus = remember { FocusRequester() }

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
            Text(
                text = "Movviz",
                style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "À quelle adresse se trouve ton serveur ?",
                style = TextStyle(fontSize = 15.sp, color = Color.White.copy(alpha = 0.55f)),
            )
            Spacer(Modifier.height(28.dp))

            TvTextField(
                value = url,
                onValueChange = { url = it; error = null },
                placeholder = "http://192.168.1.42:9810",
                nextFocus = connectButtonFocus,
            )

            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = error!!,
                    style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFEF4444)),
                )
            }

            Spacer(Modifier.height(20.dp))

            GradientButton(
                text = if (testing) "Connexion..." else "Se connecter",
                enabled = !testing,
                focusRequester = connectButtonFocus,
                onClick = {
                    if (testing) return@GradientButton
                    testing = true
                    error = null
                    scope.launch {
                        when (val result = viewModel.testAndSaveServerUrl(url)) {
                            is ApiResult.Success -> onConnected()
                            is ApiResult.Failure -> error = "Connexion impossible : ${result.message}"
                            ApiResult.Unauthorized -> onConnected() // ne devrait pas arriver ici, traité côté repo
                        }
                        testing = false
                    }
                },
            )
        }
    }
}

/** Champ de texte minimal pensé D-pad : focus visible via une bordure au
 *  dégradé de marque (le clavier système Android TV s'ouvre automatiquement
 *  quand ce composable prend le focus et que l'utilisateur appuie sur OK). */
@Composable
fun TvTextField(value: String, onValueChange: (String) -> Unit, placeholder: String, nextFocus: FocusRequester) {
    var focused by remember { mutableStateOf(false) }
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
        if (value.isEmpty()) {
            Text(text = placeholder, style = TextStyle(fontSize = 16.sp, color = Color.White.copy(alpha = 0.35f)))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 16.sp, color = Color.White),
            singleLine = true,
            // focusProperties{down=...} seul ne suffit pas : BasicTextField
            // avale la touche bas (déplacement de curseur) avant qu'elle
            // n'atteigne le système de recherche de focus — confirmé en
            // testant sur un vrai émulateur télécommande, le focus restait
            // bloqué dans le champ indéfiniment. onPreviewKeyEvent intercepte
            // la touche AVANT le champ de texte et déplace le focus lui-même.
            modifier = Modifier
                .fillMaxWidth()
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

/** Bouton principal en dégradé de marque, pleine largeur — même traitement
 *  visuel que .brand-gradient côté web, adapté en Surface focusable TV. */
@Composable
fun GradientButton(text: String, enabled: Boolean = true, focusRequester: FocusRequester? = null, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), shape)
            .onFocusChanged { focused = it.isFocused },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, contentColor = Color.White),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White),
                shape = shape,
            ),
        ),
    ) {
        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp), contentAlignment = Alignment.Center) {
            Text(text = text, style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold))
        }
    }
}
