package com.movviz.tv.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.movviz.tv.AppViewModel
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick

@Composable
fun SettingsScreen(viewModel: AppViewModel, onLoggedOut: () -> Unit) {
    val serverUrl by viewModel.serverUrl.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(start = 48.dp, top = 40.dp, end = 48.dp),
    ) {
        Text(
            text = "Paramètres",
            style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
        )
        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Serveur",
            style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.5f)),
        )
        Text(
            text = serverUrl ?: "—",
            style = TextStyle(fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground),
        )

        Spacer(modifier = Modifier.height(32.dp))

        SettingsButton(text = "Se déconnecter") {
            viewModel.logout()
            onLoggedOut()
        }
    }
}

@Composable
private fun SettingsButton(text: String, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)
    Surface(
        onClick = onClick,
        modifier = Modifier
            // tvFocusLift (Theme.kt) au lieu d'un scale() isolé — même lift
            // Apple TV que le reste de l'appli.
            .tvFocusLift(focused, shape = shape)
            .onFocusChanged { focused = it.isFocused }
            .tvPointerClick(onClick),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.1f), contentColor = Color.White),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary),
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = text,
            style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold),
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
        )
    }
}
