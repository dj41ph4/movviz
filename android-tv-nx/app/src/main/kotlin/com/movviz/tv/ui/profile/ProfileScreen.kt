package com.movviz.tv.ui.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import androidx.tv.material3.Border
import androidx.tv.material3.Glow
import androidx.tv.material3.Text
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import com.movviz.tv.ui.theme.LocalMovvizBeta
import com.movviz.tv.ui.theme.MovvizBetaCardFocusedLine
import com.movviz.tv.ui.theme.MovvizBetaShapes
import com.movviz.tv.ui.theme.MovvizTheme
import com.movviz.tv.ui.theme.animateMovvizImageZoom
import com.movviz.tv.ui.theme.movvizFocusRing
import com.movviz.tv.ui.theme.movvizImageZoom
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ProfileMediaCardDto
import com.movviz.tv.data.ProfileMediaResponseDto
import com.movviz.tv.data.TvProfile
import com.movviz.tv.ui.theme.MovvizBackground
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.CircleShape

private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"
private val profileCardShape = RoundedCornerShape(8.dp)

/** Dashboard personnel. La safe area haute évite que le premier focus passe
 * sous la navigation flottante de MainActivity. */
@Composable
fun ProfileScreen(
    viewModel: AppViewModel,
    entryFocusRequester: FocusRequester,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit,
    onScrollChanged: (Boolean) -> Unit = {},
) {
    val data by viewModel.profileMedia.collectAsState()
    val failed by viewModel.profileMediaFailed.collectAsState()
    val currentUser by viewModel.currentUser.collectAsState()
    val activeProfile by viewModel.activeProfile.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadProfileMedia() }
    LaunchedEffect(data?.continueWatching) {
        data?.continueWatching
            ?.filter { it.seasonNumber != null && it.episodeNumber != null }
            ?.forEach { viewModel.requestHeroLogo("series", it.tmdbId) }
    }
    val profileData = data
    val listState = rememberLazyListState()
    val hasScrolled by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 || listState.firstVisibleItemScrollOffset > 10
        }
    }
    // La navigation reste transparente sur l'en-tête, puis obtient un fond
    // opaque dès que les rangées passent derrière elle : texte lisible sans
    // sacrifier l'arrivée visuelle de la page profil.
    LaunchedEffect(hasScrolled) { onScrollChanged(hasScrolled) }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().background(MovvizBackground)
            .padding(start = 42.dp, end = 42.dp, bottom = 36.dp),
        // C'est du padding de contenu, pas une marge fixe : une fois la page
        // défilée, une rangée remonte naturellement sous la barre opaque au
        // lieu de laisser un grand trou noir permanent.
        contentPadding = PaddingValues(top = 117.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(23.dp),
    ) {
        if (profileData == null) {
            // Échec : bouton « Réessayer » focalisable (entrée D-pad de la page)
            // au lieu d'un squelette de chargement éternel.
            item { if (failed) ProfileErrorDashboard(activeProfile, entryFocusRequester) { viewModel.loadProfileMedia() } else ProfileLoadingDashboard(activeProfile) }
            return@LazyColumn
        }
        item { ProfileDashboardHeader(profileData, activeProfile, isAdmin = currentUser?.role == "admin") }
        if (profileData.continueWatching.isEmpty() && profileData.watchHistory.isEmpty() && profileData.ratings.isEmpty() && profileData.watchlist.isEmpty()) item {
            Text("Votre activité apparaîtra ici dès votre première lecture.", color = Color(0xFFA7A7A7), fontSize = 12.sp)
        }
        // Ordre du profil web : reprises, liste, historique, notes.
        var entryAssigned = false
        profileRail("Continuer à regarder", profileData.continueWatching, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode, isResumeRail = true, heroLogos = heroLogos)
        if (profileData.continueWatching.isNotEmpty()) entryAssigned = true
        profileRail("Ma liste", profileData.watchlist, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)
        if (profileData.watchlist.isNotEmpty()) entryAssigned = true
        profileRail("Historique de visionnage", profileData.watchHistory, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)
        if (profileData.watchHistory.isNotEmpty()) entryAssigned = true
        profileRail("Mes évaluations", profileData.ratings, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)
    }
}

/** Identité du profil : avatar cerclé du dégradé de marque, nom, rôle réel
 *  du compte — même en-tête que le profil mobile. */
@Composable private fun ProfileIdentity(profile: TvProfile?, subtitle: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (profile != null) {
            Box(
                Modifier
                    .border(2.dp, Brush.linearGradient(listOf(MovvizBrand, MovvizBrand2)), CircleShape)
                    .padding(3.dp),
            ) { ProfileAvatar(profile, Modifier.size(72.dp), cornerRadius = 36.dp) }
        }
        Column(modifier = Modifier.padding(start = if (profile != null) 16.dp else 0.dp)) {
            Text(
                profile?.name?.takeIf { it.isNotBlank() } ?: "Mon espace",
                color = Color.White,
                fontSize = 25.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(subtitle, color = Color(0xFFA7A7A7), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable private fun ProfileLoadingDashboard(profile: TvProfile?) {
    Column {
        ProfileIdentity(profile, "Chargement de votre activité…")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 18.dp)) {
            repeat(5) { ProfileMetric("", 0, loading = true) }
        }
    }
}

@Composable private fun ProfileErrorDashboard(profile: TvProfile?, entryFocusRequester: FocusRequester, onRetry: () -> Unit) {
    Column {
        ProfileIdentity(profile, "Impossible de charger votre activité pour le moment.")
        ProfileRetryButton(Modifier.padding(top = 18.dp).focusRequester(entryFocusRequester), onRetry)
    }
}

@Composable private fun ProfileRetryButton(modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Card(
        onClick = onClick,
        modifier = modifier.height(40.dp),
        shape = CardDefaults.shape(shape = shape),
        // Bouton gris au repos, blanc seulement au focus (règle Movviz).
        colors = CardDefaults.colors(containerColor = Color(0xFF2A2A31), focusedContainerColor = Color.White, contentColor = Color.White, focusedContentColor = Color.Black),
        scale = CardDefaults.scale(focusedScale = 1.03f),
    ) {
        Box(Modifier.fillMaxHeight().padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
            Text("Réessayer", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable private fun ProfileDashboardHeader(data: ProfileMediaResponseDto, profile: TvProfile?, isAdmin: Boolean) {
    Column {
        ProfileIdentity(profile, if (isAdmin) "Compte admin · vos reprises, votre liste et votre historique" else "Vos reprises, votre liste et votre historique")
        // Totaux réels du serveur (counts), pas la taille des listes tronquées.
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 18.dp)) {
            ProfileMetric("EN COURS", data.counts.continueWatching ?: data.continueWatching.size)
            ProfileMetric("FILMS VUS", data.counts.watchedMovies)
            ProfileMetric("SÉRIES VUES", data.counts.watchedSeries)
            ProfileMetric("DANS MA LISTE", data.counts.watchlist ?: data.watchlist.size)
            ProfileMetric("NOTES DONNÉES", data.counts.ratings ?: data.ratings.size)
        }
    }
}

@Composable private fun ProfileMetric(label: String, value: Int, loading: Boolean = false) {
    Column(Modifier.width(118.dp).background(Color(0xFF1B1B20), RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 11.dp)) {
        Text(if (loading) "—" else value.toString(), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold)
        Text(if (loading) " " else label, color = Color(0xFFA7A7A7), fontSize = 8.sp, maxLines = 1, modifier = Modifier.padding(top = 2.dp))
    }
}

private fun LazyListScope.profileRail(
    title: String,
    cards: List<ProfileMediaCardDto>,
    entryFocusRequester: FocusRequester?,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit,
    isResumeRail: Boolean = false,
    heroLogos: Map<String, String> = emptyMap(),
) {
    if (cards.isEmpty()) return
    item {
        Column(Modifier.fillMaxWidth()) {
            Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 11.dp))
            val beta = LocalMovvizBeta.current
            // focusRestorer : HAUT/BAS puis retour sur la rangée rend la carte
            // quittée (et non la première). Bêta : marge pour l'anneau extérieur.
            LazyRow(
                modifier = Modifier.focusRestorer(),
                horizontalArrangement = Arrangement.spacedBy(if (beta) 12.dp else 15.dp),
                contentPadding = if (beta) PaddingValues(8.dp) else PaddingValues(0.dp),
            ) {
                itemsIndexed(cards, key = { _, card -> "${card.type}-${card.tmdbId}-${card.seasonNumber}-${card.episodeNumber}" }) { index, card ->
                    ProfilePosterCard(
                        card = card,
                        modifier = if (index == 0 && entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier,
                        showEpisodeResumeBadge = isResumeRail,
                        seriesLogoPath = if (isResumeRail) heroLogos["series-${card.tmdbId}"] else null,
                        onClick = {
                            val season = card.seasonNumber
                            val episode = card.episodeNumber
                            if ((card.type == "series" || card.type == "episode") && season != null && episode != null) {
                                onOpenEpisode(card.tmdbId, season, episode)
                            } else {
                                onOpenTitle(if (card.type == "episode") "series" else card.type, card.tmdbId)
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable private fun ProfilePosterCard(
    card: ProfileMediaCardDto,
    modifier: Modifier = Modifier,
    showEpisodeResumeBadge: Boolean = false,
    seriesLogoPath: String? = null,
    onClick: () -> Unit,
) {
    val beta = LocalMovvizBeta.current
    val palette = MovvizTheme.palette
    val cardShape = if (beta) MovvizBetaShapes.Card else profileCardShape
    var focused by remember { mutableStateOf(false) }
    val imageZoom = animateMovvizImageZoom(focused)
    Card(
        onClick = onClick,
        modifier = modifier
            .width(138.dp).height(207.dp)
            .onFocusChanged { focused = it.isFocused }
            // Bêta : spécification de carte commune — anneau extérieur, filet,
            // aucune mise à l'échelle ; seule l'image zoome.
            .movvizFocusRing(cardShape, enabled = beta),
        shape = CardDefaults.shape(shape = cardShape),
        colors = if (beta) CardDefaults.colors(containerColor = palette.surface, focusedContainerColor = palette.surface, contentColor = palette.ink, focusedContentColor = palette.ink)
        else CardDefaults.colors(containerColor = Color(0xFF202026), focusedContainerColor = Color(0xFF302A3A), contentColor = Color.White, focusedContentColor = Color.White),
        scale = if (beta) CardDefaults.scale(focusedScale = 1f) else CardDefaults.scale(),
        border = if (beta) CardDefaults.border(
            border = Border(BorderStroke(1.dp, palette.line), shape = cardShape),
            focusedBorder = Border(BorderStroke(1.dp, MovvizBetaCardFocusedLine), shape = cardShape),
        ) else CardDefaults.border(),
        glow = if (beta) CardDefaults.glow(glow = Glow.None, focusedGlow = Glow.None) else CardDefaults.glow(),
    ) {
        Box(Modifier.fillMaxSize().clip(cardShape)) {
            // Une carte verticale doit toujours privilégier l'affiche. Une
            // capture 16:9 recadrée en portrait est cheap, et le chemin peut
            // parfois manquer dans l'historique/les notes : ce cas reçoit un
            // visuel de secours assumé, jamais un rectangle gris vide.
            val usesEpisodeResumeArtwork = showEpisodeResumeBadge && card.stillPath != null
            val imagePath = if (usesEpisodeResumeArtwork) card.stillPath else card.posterPath ?: card.stillPath
            var imageFailed by remember(imagePath) { mutableStateOf(false) }
            if (imagePath != null && !imageFailed) {
                Image(
                    painter = rememberAsyncImagePainter(
                        model = "$TMDB_POSTER_BASE$imagePath",
                        onError = { imageFailed = true },
                        contentScale = ContentScale.Crop,
                    ),
                    contentDescription = card.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().movvizImageZoom(imageZoom),
                )
            } else {
                ProfileFallbackArtwork()
            }
            if (showEpisodeResumeBadge && card.seasonNumber != null && card.episodeNumber != null) {
                Text(
                    text = "S${card.seasonNumber.toString().padStart(2, '0')} · E${card.episodeNumber.toString().padStart(2, '0')}",
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 3.dp),
                )
            }
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent, Color(0xE9000000)))))
            // Le logo est posé après le scrim : son contraste ne dépend donc
            // jamais de l'image de l'épisode sous-jacente.
            if (usesEpisodeResumeArtwork && seriesLogoPath != null) {
                Image(
                    painter = rememberAsyncImagePainter(model = "$TMDB_LOGO_BASE$seriesLogoPath"),
                    contentDescription = card.title,
                    contentScale = ContentScale.Fit,
                    alignment = Alignment.BottomStart,
                    modifier = Modifier.align(Alignment.BottomStart).padding(start = 9.dp, end = 9.dp, bottom = 41.dp).heightIn(max = 32.dp).widthIn(max = 111.dp),
                )
            }
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(9.dp)) {
                if (seriesLogoPath == null || !usesEpisodeResumeArtwork) {
                    Text(card.title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                val detail = card.progress?.let { "${(it.ratio * 100).toInt()} % repris" }
                    ?: card.userRating?.let { "★ ${if (it % 1.0 == 0.0) it.toInt() else it} / 5" }
                    ?: card.subtitle
                if (detail != null) Text(detail, color = Color(0xFFD1D1D1), fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                card.progress?.let { progress ->
                    Box(Modifier.fillMaxWidth().height(3.dp).padding(top = 7.dp).background(Color.White.copy(alpha = 0.35f), RoundedCornerShape(2.dp))) {
                        Box(Modifier.fillMaxWidth(progress.ratio.toFloat().coerceIn(0f, 1f)).height(3.dp).background(Color(0xFFE84AD9), RoundedCornerShape(2.dp)))
                    }
                }
            }
        }
    }
}

/** Fallback éditorial volontaire pour les titres dont TMDb ne fournit plus
 * d'affiche : il préserve la hiérarchie et évite le faux skeleton permanent. */
@Composable private fun ProfileFallbackArtwork() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    listOf(Color(0xFF40304F), Color(0xFF1D1D27), Color(0xFF0D0D12)),
                ),
        ),
        contentAlignment = Alignment.Center,
    ) {}
}
