package com.movviz.tv.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Card
import androidx.tv.material3.Text
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ProfileMediaCardDto
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizInkDim

@Composable
fun ProfileScreen(viewModel: AppViewModel, entryFocusRequester: FocusRequester) {
    val data by viewModel.profileMedia.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadProfileMedia() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(MovvizBackground).padding(horizontal = 32.dp, vertical = 28.dp),
        contentPadding = PaddingValues(bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item { Text("Mon profil média", modifier = Modifier.focusRequester(entryFocusRequester).focusable(), color = Color.White) }
        profileRail("Continuer à regarder", data?.continueWatching.orEmpty())
        profileRail("Historique de visionnage", data?.watchHistory.orEmpty())
        profileRail("Mes évaluations", data?.ratings.orEmpty())
        profileRail("Ma Watchlist", data?.watchlist.orEmpty())
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.profileRail(title: String, cards: List<ProfileMediaCardDto>) {
    if (cards.isEmpty()) return
    item {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(title, color = Color.White, modifier = Modifier.padding(bottom = 10.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(cards) { card ->
                    Card(onClick = {}, modifier = Modifier.fillMaxWidth(0.22f)) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(card.title, color = Color.White, maxLines = 2)
                            card.progress?.let { Text("${(it.ratio * 100).toInt()} %", color = MovvizInkDim) }
                            card.userRating?.let { Text("★ $it/5", color = Color(0xFFFFC857)) }
                        }
                    }
                }
            }
        }
    }
}
