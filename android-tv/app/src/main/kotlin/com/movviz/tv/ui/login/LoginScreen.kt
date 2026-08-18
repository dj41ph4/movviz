package com.movviz.tv.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Button
import androidx.tv.material3.CircularProgressIndicator
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(viewModel: AppViewModel, onLoggedIn: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 96.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "Connexion", style = TextStyle(fontSize = 40.sp, color = MaterialTheme.colorScheme.onBackground))
        Spacer(Modifier.height(32.dp))

        LoginField(value = username, onValueChange = { username = it; error = null }, placeholder = "Nom d'utilisateur")
        Spacer(Modifier.height(16.dp))
        LoginField(value = password, onValueChange = { password = it; error = null }, placeholder = "Mot de passe", isPassword = true)

        if (error != null) {
            Spacer(Modifier.height(16.dp))
            Text(text = error!!, style = TextStyle(fontSize = 16.sp, color = Color(0xFFEF4444)))
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = {
                if (busy || username.isBlank() || password.isBlank()) return@Button
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
        ) {
            if (busy) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(if (busy) "Connexion..." else "Se connecter")
        }
    }
}

@Composable
private fun LoginField(value: String, onValueChange: (String) -> Unit, placeholder: String, isPassword: Boolean = false) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth(0.5f)
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
            visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = if (isPassword) KeyboardOptions(keyboardType = KeyboardType.Password) else KeyboardOptions.Default,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
