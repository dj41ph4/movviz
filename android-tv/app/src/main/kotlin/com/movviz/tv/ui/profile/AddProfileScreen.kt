package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.movviz.tv.data.MovvizUserDto
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizBrand2

/** « Ajouter un membre au foyer » — l'admin choisit parmi les comptes
 *  existants (jamais leurs mots de passe). Seul l'admin y a accès : le
 *  serveur refuse tout POST non-admin, et la liste des comptes est
 *  admin-only. */
@Composable
fun AddProfileScreen(
    accounts: List<MovvizUserDto>,
    onSelectAccount: (MovvizUserDto) -> Unit,
    onBack: () -> Unit,
) {
    Box(
        Modifier.fillMaxSize().background(Color(0xFF101010)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Ajouter un membre au foyer", style = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.Bold, color = Color.White))
            Spacer(Modifier.height(12.dp))
            Text(
                "Choisis un compte existant — il pourra être sélectionné sur l'écran « Qui est-ce ? »",
                style = TextStyle(fontSize = 16.sp, color = Color.White.copy(alpha = 0.7f)),
            )
            Spacer(Modifier.height(42.dp))
            TvLazyRow(horizontalArrangement = Arrangement.spacedBy(28.dp), contentPadding = PaddingValues(horizontal = 48.dp)) {
                items(accounts, key = { it.id }) { account ->
                    ProfileTile(
                        profile = TvProfile(id = account.id, serverUrl = "", name = account.username, avatar = account.plexAvatar),
                        onClick = { onSelectAccount(account) },
                    )
                }
            }
            Spacer(Modifier.height(36.dp))
            Surface(
                onClick = onBack,
                shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(12.dp)),
                colors = ClickableSurfaceDefaults.colors(
                    containerColor = Color(0xFF242424),
                    focusedContainerColor = Color(0xFF383838),
                ),
                border = ClickableSurfaceDefaults.border(
                    focusedBorder = Border(
                        border = BorderStroke(2.dp, MovvizBrand2),
                        shape = RoundedCornerShape(12.dp),
                    ),
                ),
            ) {
                Text("Retour", color = Color.White, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 28.dp, vertical = 10.dp))
            }
        }
    }
}