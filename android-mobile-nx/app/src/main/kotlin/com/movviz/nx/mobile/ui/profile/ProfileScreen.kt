package com.movviz.nx.mobile.ui.profile

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ProfileMediaCardDto
import com.movviz.nx.mobile.data.ProfileMediaResponseDto
import com.movviz.nx.mobile.data.TvProfile
import com.movviz.nx.mobile.ui.theme.MovvizBackground

private const val TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
private const val TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w500"
private val profileCardShape = RoundedCornerShape(10.dp)

/** Dashboard personnel. La safe area haute évite que le premier focus passe
 * sous la navigation flottante de MainActivity. */
@Composable
fun ProfileScreen(
    viewModel: AppViewModel,
    entryFocusRequester: FocusRequester,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit,
    onScrollChanged: (Boolean) -> Unit = {},
    // Liste de réglages en bas du dashboard (esquisse mobile section 14) —
    // Compte/Langue/À propos redirigent vers l'écran Paramètres existant
    // (pas dupliqué ici), Téléchargements vers son propre onglet. Confiden-
    // tialité/Notifications/Aide sont omis : aucun contenu réel ne les
    // alimente aujourd'hui (voir SettingsScreen, qui ne les a pas non plus).
    onOpenSettings: () -> Unit = {},
    onOpenDownloads: () -> Unit = {},
    onSwitchProfile: () -> Unit = {},
) {
    val compactPortrait = LocalConfiguration.current.let { it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp }
    val data by viewModel.profileMedia.collectAsState()
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
            .padding(start = if (compactPortrait) 16.dp else 56.dp, end = if (compactPortrait) 16.dp else 56.dp, bottom = if (compactPortrait) 24.dp else 48.dp),
        // C'est du padding de contenu, pas une marge fixe : une fois la page
        // défilée, une rangée remonte naturellement sous la barre opaque au
        // lieu de laisser un grand trou noir permanent.
        // bottom 156dp en portrait (pas 24dp) : la barre basse flottante
        // masquait la dernière ligne de réglages ("Changer de profil"),
        // repéré en testant la nouvelle liste de réglages sur émulateur.
        contentPadding = PaddingValues(top = if (compactPortrait) 76.dp else 156.dp, bottom = if (compactPortrait) 156.dp else 40.dp),
        verticalArrangement = Arrangement.spacedBy(if (compactPortrait) 22.dp else 30.dp),
    ) {
        if (profileData == null) {
            item { ProfileLoadingDashboard() }
            return@LazyColumn
        }
        item { ProfileDashboardHeader(profileData, activeProfile) }
        if (profileData.continueWatching.isEmpty() && profileData.watchHistory.isEmpty() && profileData.ratings.isEmpty() && profileData.watchlist.isEmpty()) item {
            Text("Votre activité apparaîtra ici dès votre première lecture.", color = Color(0xFFA7A7A7), fontSize = 16.sp)
        }
        var entryAssigned = false
        profileRail("Continuer à regarder", profileData.continueWatching, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode, isResumeRail = true, heroLogos = heroLogos)
        if (profileData.continueWatching.isNotEmpty()) entryAssigned = true
        profileRail("Historique de visionnage", profileData.watchHistory, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)
        if (profileData.watchHistory.isNotEmpty()) entryAssigned = true
        profileRail("Mes évaluations", profileData.ratings, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)
        if (profileData.ratings.isNotEmpty()) entryAssigned = true
        profileRail("Ma Watchlist", profileData.watchlist, if (!entryAssigned) entryFocusRequester else null, onOpenTitle, onOpenEpisode)

        item {
            ProfileSettingsList(
                userPrefs = viewModel.userPrefs.collectAsState().value,
                onOpenSettings = onOpenSettings,
                onOpenDownloads = onOpenDownloads,
                onSwitchProfile = onSwitchProfile,
            )
        }
    }
}

/** Liste de réglages type esquisse mobile section 14 — chaque ligne mène à
 *  un écran/action réels (Compte/Langue/À propos → Paramètres existant,
 *  Téléchargements → son onglet, Changer de profil → sélecteur de profils).
 *  Apparence reste une ligne d'info statique honnête : l'app n'a qu'un seul
 *  thème (sombre), donc pas de sélecteur factice. */
@Composable
private fun ProfileSettingsList(
    userPrefs: com.movviz.nx.mobile.data.UserPrefsDto?,
    onOpenSettings: () -> Unit,
    onOpenDownloads: () -> Unit,
    onSwitchProfile: () -> Unit,
) {
    val languageLabel = when (userPrefs?.preferredAudioLanguage) {
        "fr", null, "auto" -> "Français"
        "en" -> "Anglais"
        "es" -> "Espagnol"
        "de" -> "Allemand"
        "it" -> "Italien"
        "nl" -> "Néerlandais"
        else -> userPrefs.preferredAudioLanguage
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.05f), RoundedCornerShape(16.dp))
            .border(1.dp, Color.White.copy(alpha = 0.08f), RoundedCornerShape(16.dp)),
    ) {
        ProfileSettingsRow(label = "Compte", value = null, onClick = onOpenSettings)
        ProfileSettingsDivider()
        ProfileSettingsRow(label = "Apparence", value = "Thème sombre", onClick = null)
        ProfileSettingsDivider()
        ProfileSettingsRow(label = "Langue", value = languageLabel, onClick = onOpenSettings)
        ProfileSettingsDivider()
        ProfileSettingsRow(label = "Téléchargements", value = null, onClick = onOpenDownloads)
        ProfileSettingsDivider()
        ProfileSettingsRow(label = "À propos", value = com.movviz.nx.mobile.BuildConfig.VERSION_NAME, onClick = onOpenSettings)
        ProfileSettingsDivider()
        ProfileSettingsRow(label = "Changer de profil", value = null, onClick = onSwitchProfile)
    }
}

@Composable
private fun ProfileSettingsDivider() {
    androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.06f)))
}

@Composable
private fun ProfileSettingsRow(label: String, value: String?, onClick: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
        if (value != null) {
            Text(value, color = Color(0xFFA7A7A7), fontSize = 13.sp, modifier = Modifier.padding(end = 8.dp))
        }
        if (onClick != null) {
            androidx.tv.material3.Icon(
                com.movviz.nx.mobile.ui.theme.MovvizIconChevronRight,
                contentDescription = null,
                tint = Color(0xFFA7A7A7),
                modifier = Modifier.size(16.dp),
            )
        }
    }
}

@Composable private fun ProfileLoadingDashboard() {
    Column {
        Text("Mon espace", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text("Chargement de votre activité…", color = Color(0xFFA7A7A7), fontSize = 16.sp, modifier = Modifier.padding(top = 7.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 20.dp)) {
            repeat(3) { ProfileMetric("…", 0, loading = true) }
        }
    }
}

@Composable private fun ProfileDashboardHeader(data: ProfileMediaResponseDto, profile: TvProfile?) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        profile?.let { ProfileAvatar(it, Modifier.size(88.dp), cornerRadius = 44.dp) }
        Column(modifier = Modifier.padding(start = if (profile != null) 18.dp else 0.dp)) {
            Text(
                if (profile?.name.isNullOrBlank()) "Mon espace" else "${profile?.name} · mon espace",
                color = Color.White,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
            )
            Text("Vos reprises, votre historique et vos listes.", color = Color(0xFFA7A7A7), fontSize = 16.sp, modifier = Modifier.padding(top = 7.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 18.dp)) {
                ProfileMetric("EN COURS", data.continueWatching.size)
                ProfileMetric("VUS", data.watchHistory.size)
                ProfileMetric("NOTES", data.ratings.size)
                ProfileMetric("LISTES", data.watchlist.size)
            }
        }
    }
}

@Composable private fun ProfileMetric(label: String, value: Int, loading: Boolean = false) {
    Column(Modifier.width(142.dp).background(Color(0xFF1B1B20), RoundedCornerShape(10.dp)).padding(horizontal = 17.dp, vertical = 13.dp)) {
        Text(if (loading) "—" else value.toString(), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(label, color = Color(0xFFA7A7A7), fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
    }
}

// internal (pas private) : réutilisé par LibraryHubScreen.kt pour les rails
// Watchlist/Historique de la Bibliothèque portrait (même carte, même style).
internal fun LazyListScope.profileRail(
    title: String,
    cards: List<ProfileMediaCardDto>,
    entryFocusRequester: FocusRequester?,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onOpenEpisode: (tmdbId: Int, season: Int, episode: Int) -> Unit,
    isResumeRail: Boolean = false,
    heroLogos: Map<String, String> = emptyMap(),
    onSeeAll: (() -> Unit)? = null,
) {
    if (cards.isEmpty()) return
    item {
        Column(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 14.dp)) {
                Text(title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (onSeeAll != null) {
                    Text(
                        "Tout voir",
                        color = Color(0xFFA7A7A7),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 8.dp).clickable(onClick = onSeeAll),
                    )
                }
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                itemsIndexed(cards, key = { _, card -> "${card.type}-${card.tmdbId}-${card.seasonNumber}-${card.episodeNumber}" }) { index, card ->
                    ProfilePosterCard(
                        card = card,
                        modifier = if (index == 0 && entryFocusRequester != null) Modifier.focusRequester(entryFocusRequester) else Modifier,
                        showEpisodeResumeBadge = isResumeRail,
                        seriesLogoPath = if (isResumeRail) heroLogos["series-${card.tmdbId}"] else null,
                        onClick = {
                            val season = card.seasonNumber
                            val episode = card.episodeNumber
                            if (card.type == "series" && season != null && episode != null) {
                                onOpenEpisode(card.tmdbId, season, episode)
                            } else {
                                onOpenTitle(card.type, card.tmdbId)
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
    Card(
        onClick = onClick, modifier = modifier.width(184.dp).height(276.dp),
        shape = CardDefaults.shape(shape = profileCardShape),
        colors = CardDefaults.colors(containerColor = Color(0xFF202026), focusedContainerColor = Color(0xFF302A3A), contentColor = Color.White, focusedContentColor = Color.White),
    ) {
        Box(Modifier.fillMaxSize().clip(profileCardShape)) {
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
                    ),
                    contentDescription = card.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                ProfileFallbackArtwork()
            }
            if (showEpisodeResumeBadge && card.seasonNumber != null && card.episodeNumber != null) {
                Text(
                    text = "S${card.seasonNumber.toString().padStart(2, '0')} · E${card.episodeNumber.toString().padStart(2, '0')}",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .background(Color.Black.copy(alpha = 0.82f), RoundedCornerShape(5.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
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
                    modifier = Modifier.align(Alignment.BottomStart).padding(start = 12.dp, end = 12.dp, bottom = 54.dp).heightIn(max = 42.dp).widthIn(max = 148.dp),
                )
            }
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp)) {
                if (seriesLogoPath == null || !usesEpisodeResumeArtwork) {
                    Text(card.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
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
