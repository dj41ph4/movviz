package com.movviz.tv.ui.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Button
import androidx.tv.material3.CircularProgressIndicator
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import kotlinx.coroutines.launch

/**
 * Premier écran au lancement — demande l'URL/IP du serveur Movviz avant
 * tout le reste (identique au principe Plex/Jellyfin). Teste réellement la
 * connexion (GET /api/system/changelog) avant de valider, plutôt que de
 * laisser l'utilisateur avancer sur une IP fausse et découvrir le problème
 * plus tard à l'écran de login.
 */
@Composable
fun WizardScreen(viewModel: AppViewModel, onConnected: () -> Unit) {
    var url by remember { mutableStateOf("http://192.168.1.") }
    var testing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 96.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Movviz",
            style = TextStyle(fontSize = 48.sp, color = MaterialTheme.colorScheme.primary),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "À quelle adresse se trouve ton serveur Movviz ?",
            style = TextStyle(fontSize = 22.sp, color = MaterialTheme.colorScheme.onBackground),
        )
        Spacer(Modifier.height(32.dp))

        TvTextField(
            value = url,
            onValueChange = { url = it; error = null },
            placeholder = "http://192.168.1.42:9810",
        )

        if (error != null) {
            Spacer(Modifier.height(16.dp))
            Text(text = error!!, style = TextStyle(fontSize = 16.sp, color = Color(0xFFEF4444)))
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = {
                if (testing) return@Button
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
        ) {
            if (testing) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(if (testing) "Connexion..." else "Se connecter")
        }
    }
}

/** Champ de texte minimal pensé D-pad : focus visible via une bordure au
 *  dégradé de marque (le clavier système Android TV s'ouvre automatiquement
 *  quand ce composable prend le focus et que l'utilisateur appuie sur OK). */
@Composable
private fun TvTextField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth(0.6f)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MaterialTheme.colorScheme.primary else Color(0xFF3A3A4A),
                shape = RoundedCornerShape(8.dp),
            )
            .background(Color(0xFF15151F), RoundedCornerShape(8.dp))
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, style = TextStyle(fontSize = 18.sp, color = Color(0xFF7A7A8C)))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 18.sp, color = Color(0xFFF5F5FA)),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
