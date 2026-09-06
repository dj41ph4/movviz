package com.movviz.tv.ui.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ProfileMediaCardDto
import com.movviz.tv.data.ProfileMediaResponseDto
import com.movviz.tv.ui.theme.MovvizBackground

private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
private val profileCardShape = RoundedCornerShape(10.dp)

/** Dashboard personnel. La safe area haute évite que le premier focus passe
 * sous la navigation flottante de MainActivity. */
@Composable
fun ProfileScreen(viewModel: AppViewModel, entryFocusRequester: FocusRequester) {
    val data by viewModel.profileMedia.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadProfileMedia() }
    val profileData = data ?: ProfileMediaResponseDto()
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(MovvizBackground)
            .padding(start = 56.dp, top = 156.dp, end = 56.dp, bottom = 48.dp),
        contentPadding = PaddingValues(bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(30.dp),
    ) {
        item { ProfileDashboardHeader(profileData) }
        if (profileData.continueWatching.isEmpty() && profileData.watchHistory.isEmpty() && profileData.ratings.isEmpty() && profileData.watchlist.isEmpty()) item {
            Text("Votre activité apparaîtra ici dès votre première lecture.", color = Color(0xFFA7A7A7), fontSize = 16.sp)
        }
        profileRail("Continuer à regarder", profileData.continueWatching)
        profileRail("Historique de visionnage", profileData.watchHistory)
        profileRail("Mes évaluations", profileData.ratings)
        profileRail("Ma Watchlist", profileData.watchlist)
    }
}

@Composable private fun ProfileDashboardHeader(data: ProfileMediaResponseDto) {
    Column {
        Text("Mon espace", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text("Vos reprises, votre historique et vos listes.", color = Color(0xFFA7A7A7), fontSize = 16.sp, modifier = Modifier.padding(top = 7.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 20.dp)) {
            ProfileMetric("EN COURS", data.continueWatching.size)
            ProfileMetric("VUS", data.watchHistory.size)
            ProfileMetric("LISTES", data.watchlist.size)
        }
    }
}

@Composable private fun ProfileMetric(label: String, value: Int) {
    Column(Modifier.width(132.dp).background(Color(0xFF1B1B20), RoundedCornerShape(8.dp)).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(value.toString(), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(label, color = Color(0xFFA7A7A7), fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
    }
}

private fun LazyListScope.profileRail(title: String, cards: List<ProfileMediaCardDto>) {
    if (cards.isEmpty()) return
    item {
        Column(Modifier.fillMaxWidth()) {
            Text(title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 14.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                itemsIndexed(cards, key = { _, card -> "${card.type}-${card.tmdbId}-${card.seasonNumber}-${card.episodeNumber}" }) { index, card ->
                    ProfilePosterCard(card)
                }
            }
        }
    }
}

@Composable private fun ProfilePosterCard(card: ProfileMediaCardDto, modifier: Modifier = Modifier) {
    Card(
        onClick = {}, modifier = modifier.width(184.dp).height(276.dp),
        shape = CardDefaults.shape(shape = profileCardShape),
        colors = CardDefaults.colors(containerColor = Color(0xFF202026), focusedContainerColor = Color(0xFF302A3A), contentColor = Color.White, focusedContentColor = Color.White),
    ) {
        Box(Modifier.fillMaxSize().clip(profileCardShape)) {
            val imagePath = card.stillPath ?: card.posterPath
            if (imagePath != null) Image(rememberAsyncImagePainter("$TMDB_POSTER_BASE$imagePath"), card.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Color(0xE9000000)))))
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp)) {
                Text(card.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val detail = card.progress?.let { "${(it.ratio * 100).toInt()} % repris" } ?: card.userRating?.let { "★ $it / 5" }
                if (detail != null) Text(detail, color = Color(0xFFD1D1D1), fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                card.progress?.let { progress ->
                    Box(Modifier.fillMaxWidth().height(4.dp).padding(top = 9.dp).background(Color.White.copy(alpha = 0.35f), RoundedCornerShape(2.dp))) {
                        Box(Modifier.fillMaxWidth(progress.ratio.toFloat().coerceIn(0f, 1f)).height(4.dp).background(Color(0xFFE84AD9), RoundedCornerShape(2.dp)))
                    }
                }
            }
        }
    }
}
