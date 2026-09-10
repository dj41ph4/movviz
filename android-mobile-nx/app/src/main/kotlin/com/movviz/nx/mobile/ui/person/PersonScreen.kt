package com.movviz.nx.mobile.ui.person

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.compose.foundation.gestures.BringIntoViewSpec
import androidx.compose.foundation.gestures.LocalBringIntoViewSpec
import androidx.compose.runtime.CompositionLocalProvider
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.ui.home.TitleRow
import com.movviz.nx.mobile.ui.home.TvTitleCard
import com.movviz.nx.mobile.ui.theme.MovvizInk
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.MovvizInkSoft
import com.movviz.nx.mobile.ui.theme.MovvizSurfaceStrong
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import com.movviz.nx.mobile.ui.theme.withTvPrefetchDisabled

private const val TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w342"

/** Fiche acteur/actrice — ouverte depuis la Distribution d'une fiche titre :
 *  photo, biographie, puis filmographie complète (films + séries) dans la
 *  même rangée que le reste de l'app (TitleRow/PosterCard), pas un écran
 *  au look différent. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun PersonScreen(
    viewModel: AppViewModel,
    personId: Int,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    entryFocusRequester: FocusRequester? = null,
    // Bouton retour portrait — même correctif que RowDetailScreen.kt : cet
    // écran vit hors "home" (ni en-tête ni barre basse en portrait), donc
    // sans lui la fiche acteur était sans aucune navigation.
    onBack: () -> Unit = {},
) {
    val compactPortrait = androidx.compose.ui.platform.LocalConfiguration.current.let {
        it.screenWidthDp < 600 && it.screenHeightDp > it.screenWidthDp
    }
    val person by viewModel.person.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()

    LaunchedEffect(personId) {
        viewModel.loadPerson(personId)
    }

    // Filtre anti-pollution : les crédits TMDb d'un acteur débordent de
    // talk-shows et cérémonies — Saturday Night Live, Tonight Show, Graham
    // Norton, Kelly Clarkson, Golden Globes… Aucun intérêt dans une
    // filmographie (demandé en direct : "j'en ai marre de voir les late
    // night"). Filtrage par titre : le DTO crédit ne transporte pas le nom
    // du personnage ("Self").
    val junkShow = Regex(
        "saturday night live|tonight show|late night|late show|graham norton|kelly clarkson|" +
            "jimmy kimmel|ellen( show)?|golden globes?|(academy|people'?s choice|mtv (movie|video)|critics'?) awards?" +
            "|\\bawards?\\b|critics'? choice|good morning america|today show|conan( o'brien)?|" +
            "mike tyson mysteries|red carpet|the view|watch what happens",
        RegexOption.IGNORE_CASE,
    )
    val filmography = remember(person) {
        person?.credits.orEmpty()
            .filter { c -> !junkShow.containsMatchIn(c.title) }
            .map { c ->
                TvTitleCard(
                    id = "${c.type}-${c.tmdbId}",
                    title = c.title,
                    posterPath = c.posterPath,
                    backdropPath = c.backdropPath,
                    tmdbId = c.tmdbId,
                    isMovie = c.type == "movie",
                    year = c.year,
                    rating = c.rating,
                    overview = c.overview,
                )
            }
    }

    // Spec de scroll minimal (voir TitleDetailScreen) : le pivot TV
    // défilait la fiche acteur toute seule à l'ouverture.
    CompositionLocalProvider(
        LocalBringIntoViewSpec provides object : BringIntoViewSpec {},
    ) {
    val sideEdge = if (compactPortrait) 16.dp else 48.dp
    TvLazyColumn(
        state = rememberTvLazyListState().withTvPrefetchDisabled(),
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(top = if (compactPortrait) 0.dp else 96.dp, bottom = 40.dp),
    ) {
        if (compactPortrait) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(start = sideEdge, top = 10.dp, bottom = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    androidx.tv.material3.Surface(
                        onClick = onBack,
                        modifier = Modifier.size(36.dp).tvPointerClick(onBack),
                        shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(CircleShape),
                        colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(
                            containerColor = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.08f),
                            contentColor = androidx.compose.ui.graphics.Color.White,
                        ),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            androidx.tv.material3.Icon(com.movviz.nx.mobile.ui.theme.MovvizIconBack, "Retour", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
        item {
            val p = person
            if (p == null) {
                Text(
                    text = "Chargement…",
                    style = TextStyle(fontSize = 15.sp, color = MovvizInkDim),
                    modifier = Modifier.padding(start = sideEdge),
                )
            } else {
                val photoUrl = p.profilePath?.let { "$TMDB_PROFILE_BASE$it" }
                val photo = @Composable {
                    Box(
                        modifier = Modifier
                            .size(if (compactPortrait) 110.dp else 140.dp)
                            .clip(CircleShape)
                            .background(MovvizSurfaceStrong),
                    ) {
                        if (photoUrl != null) {
                            Image(
                                painter = rememberAsyncImagePainter(model = photoUrl),
                                contentDescription = p.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                }
                val texts = @Composable {
                    Text(
                        text = p.name,
                        style = TextStyle(fontSize = if (compactPortrait) 22.sp else 30.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                    )
                    if (p.biography.isNotBlank()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = p.biography,
                            style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft, lineHeight = 20.sp),
                            maxLines = 6,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (compactPortrait) {
                    Column(modifier = Modifier.padding(start = sideEdge, end = sideEdge, bottom = 32.dp)) {
                        photo()
                        Spacer(modifier = Modifier.height(16.dp))
                        texts()
                    }
                } else {
                    Row(modifier = Modifier.padding(start = sideEdge, end = sideEdge, bottom = 32.dp)) {
                        photo()
                        Spacer(modifier = Modifier.width(28.dp))
                        Column(modifier = Modifier.weight(1f)) { texts() }
                    }
                }
            }
        }
        if (filmography.isNotEmpty()) {
            item {
                TitleRow(
                    heading = "Filmographie",
                    items = filmography,
                    onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    firstItemFocusRequester = entryFocusRequester,
                    titleLogoPaths = heroLogos,
                    onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                )
            }
        }
    }
    }
}
