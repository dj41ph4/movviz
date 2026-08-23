package com.movviz.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.movviz.tv.data.ApiClient
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.MovvizRepository
import kotlinx.coroutines.launch

private val Void = Color(0xFF080812)
private val SurfaceDark = Color(0xFF111121)
private val Violet = Color(0xFF8755FF)
private val Magenta = Color(0xFFEC3FD1)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ApiClient.initialize(applicationContext)
        setContent { MovvizMobileApp() }
    }
}

@Composable
private fun MovvizMobileApp() {
    var server by remember { mutableStateOf("") }
    var connected by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Void) {
            if (!connected) {
                ServerOnboarding(
                    server = server,
                    onServerChange = { server = it; error = null },
                    checking = checking,
                    error = error,
                    onCheck = {
                        val base = server.trim().trimEnd('/')
                        if (base.isBlank()) {
                            error = "Saisis l’adresse de ton serveur Movviz."
                            return@ServerOnboarding
                        }
                        checking = true
                        scope.launch {
                            val result = runCatching { MovvizRepository(base).ping() }
                                .getOrElse { ApiResult.Failure("Serveur inaccessible") }
                            checking = false
                            if (result is ApiResult.Success) connected = true
                            else error = "Ce serveur ne répond pas comme Movviz."
                        }
                    },
                )
            } else {
                MobileShell(onDisconnect = { connected = false })
            }
        }
    }
}

@Composable
private fun ServerOnboarding(
    server: String,
    onServerChange: (String) -> Unit,
    checking: Boolean,
    error: String?,
    onCheck: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF18132B), Void)))
            .statusBarsPadding()
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.Center) {
            Text("Movviz", color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Black)
            Text("Ton catalogue. Ton serveur. Tes règles.", color = Color(0xFFB9B4D0), fontSize = 14.sp)
            Spacer(Modifier.height(32.dp))
            Text("Connecter un serveur", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = server,
                onValueChange = onServerChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Adresse du serveur") },
                placeholder = { Text("https://movviz...") },
                shape = RoundedCornerShape(14.dp),
            )
            if (error != null) {
                Spacer(Modifier.height(8.dp))
                Text(error, color = Color(0xFFFF718B), fontSize = 13.sp)
            }
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = onCheck,
                enabled = !checking,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Violet),
                shape = RoundedCornerShape(14.dp),
            ) { Text(if (checking) "Test en cours…" else "Tester la connexion", fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun MobileShell(onDisconnect: () -> Unit) {
    var selected by remember { mutableStateOf(0) }
    Scaffold(
        containerColor = Void,
        bottomBar = {
            Row(
                modifier = Modifier.fillMaxWidth().background(SurfaceDark).navigationBarsPadding().padding(8.dp),
                horizontalArrangement = Arrangement.SpaceAround,
            ) {
                listOf(Icons.Rounded.Home, Icons.Rounded.Favorite, Icons.Rounded.Search, Icons.Rounded.Person)
                    .forEachIndexed { index, icon ->
                        TextButton(onClick = { selected = index }) {
                            Icon(icon, contentDescription = null, tint = if (selected == index) Magenta else Color(0xFFAAA5BD))
                            Spacer(Modifier.width(4.dp))
                            Text(listOf("Accueil", "Explorer", "Recherche", "Profil")[index], color = Color.White, fontSize = 12.sp)
                        }
                    }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp, vertical = 18.dp)) {
            Text("Movviz", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(18.dp))
            Text(
                when (selected) { 1 -> "Explorer"; 2 -> "Recherche"; 3 -> "Profil"; else -> "Accueil" },
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(12.dp))
            Text("Le socle smartphone est connecté au backend Movviz existant.", color = Color(0xFFB9B4D0))
            if (selected == 3) TextButton(onClick = onDisconnect) { Text("Changer de serveur") }
        }
    }
}
