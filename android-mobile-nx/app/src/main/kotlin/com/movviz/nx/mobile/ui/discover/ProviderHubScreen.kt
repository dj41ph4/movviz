package com.movviz.nx.mobile.ui.discover

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import coil.imageLoader
import coil.request.ImageRequest
import com.movviz.nx.mobile.AppViewModel
import com.movviz.nx.mobile.data.ApiResult
import com.movviz.nx.mobile.data.MovvizRepository
import com.movviz.nx.mobile.data.ProviderRowDescDto
import com.movviz.nx.mobile.data.SearchResultDto
import com.movviz.nx.mobile.ui.home.TitleRow
import com.movviz.nx.mobile.ui.home.TitleRowSkeleton
import com.movviz.nx.mobile.ui.home.TvTitleCard
import com.movviz.nx.mobile.ui.home.withWatchedMovies
import com.movviz.nx.mobile.ui.theme.AnimatedLogo
import com.movviz.nx.mobile.ui.theme.MovvizIconBack
import com.movviz.nx.mobile.ui.theme.MovvizInkDim
import com.movviz.nx.mobile.ui.theme.tvPointerClick
import kotlinx.coroutines.launch

/** Rangée « Sélection pour vous » (classement personnalisé existant) gardée
 *  en tête de la page plateforme : aucune perte par rapport à l'ancien écran. */
private const val FOR_YOU_KEY = "__foryou"

/** Cartes montées dans une rangée à son arrivée, puis allongées par paquets au fil du défilement : la
 *  première page serveur en contient jusqu'à ~80, les monter toutes d'un coup alourdissait l'écran. */
private const val INITIAL_CARDS = 8
private const val CARDS_STEP = 8

/** Rangées suivantes chargées d'avance, pour qu'elles soient prêtes quand on y arrive. */
private const val LOOKAHEAD_ROWS = 2
private const val POSTER_BASE = "https://image.tmdb.org/t/p/w500"

/**
 * Les catégories d'une plateforme ne changent presque jamais : on les affiche TOUT DE SUITE, avant
 * que le serveur réponde — celles de la dernière visite (mémorisées sur l'appareil), à défaut cette
 * liste de départ (les catégories communes à toutes les plateformes). La liste du serveur les remplace
 * dès qu'elle arrive.
 */
private val DEFAULT_ROWS = listOf(
    ProviderRowDescDto("trending", "Tendances"),
    ProviderRowDescDto("new", "Nouveautés"),
    ProviderRowDescDto("top", "Les mieux notés"),
    ProviderRowDescDto("action", "Action et aventure"),
    ProviderRowDescDto("comedy", "Comédies"),
    ProviderRowDescDto("superhero", "Super-héros"),
    ProviderRowDescDto("scifi", "Science-fiction et fantastique"),
    ProviderRowDescDto("crime", "Policier et thriller"),
    ProviderRowDescDto("truestory", "Inspiré d'une histoire vraie"),
    ProviderRowDescDto("family", "En famille"),
    ProviderRowDescDto("animation", "Animation"),
    ProviderRowDescDto("anime", "Animés"),
    ProviderRowDescDto("drama", "Drames"),
    ProviderRowDescDto("romcom", "Comédies romantiques"),
    ProviderRowDescDto("horror", "Horreur et frissons"),
    ProviderRowDescDto("french", "Films et séries français"),
    ProviderRowDescDto("korean", "Corée : films et K-dramas"),
    ProviderRowDescDto("short", "Moins de 1 h 40"),
    ProviderRowDescDto("epic", "Grands films (plus de 2 h 30)"),
    ProviderRowDescDto("y2010", "Les années 2010"),
    ProviderRowDescDto("y2000", "Les années 2000"),
    ProviderRowDescDto("y1990", "Les années 90"),
    ProviderRowDescDto("classics", "Grands classiques"),
    ProviderRowDescDto("history", "Histoire et guerre"),
    ProviderRowDescDto("western", "Western"),
    ProviderRowDescDto("music", "Musique et comédies musicales"),
    ProviderRowDescDto("documentary", "Documentaires"),
    ProviderRowDescDto("reality", "Téléréalité et émissions"),
)

private const val ROWS_PREFS = "provider_rows"
private const val ROW_SEPARATOR = "\u001F"

private fun readSavedRows(context: Context, providerId: Int): List<ProviderRowDescDto>? {
    val raw = context.getSharedPreferences(ROWS_PREFS, Context.MODE_PRIVATE).getString("rows_$providerId", null) ?: return null
    val rows = raw.split("\n").mapNotNull { line ->
        val parts = line.split(ROW_SEPARATOR)
        if (parts.size == 2 && parts[0].isNotBlank()) ProviderRowDescDto(parts[0], parts[1]) else null
    }
    return rows.ifEmpty { null }
}

private fun saveRows(context: Context, providerId: Int, rows: List<ProviderRowDescDto>) {
    val raw = rows.joinToString("\n") { "${it.key}$ROW_SEPARATOR${it.label}" }
    context.getSharedPreferences(ROWS_PREFS, Context.MODE_PRIVATE).edit().putString("rows_$providerId", raw).apply()
}

private class ProviderRowState {
    var cards by mutableStateOf<List<TvTitleCard>>(emptyList())
    var visible by mutableStateOf(INITIAL_CARDS)
    var page by mutableStateOf(0)
    var totalPages by mutableStateOf(1)
    var loading by mutableStateOf(false)
    var loaded by mutableStateOf(false)
}

/**
 * Page « plateforme » mobile (Netflix, Disney+…) — même contenu que sur
 * Android TV : une rangée par catégorie, films ET séries mélangés côté
 * serveur (providerCatalog.ts). Les catégories s'affichent tout de suite (titre + emplacements vides),
 * se remplissent à l'approche avec 8 affiches, s'allongent par paquets de 8 en faisant défiler à droite
 * (les suivantes et les affiches à venir sont préchargées), avec « Voir tout » en fin de rangée. Les
 * rangées sans titre sur la plateforme disparaissent après leur premier chargement.
 */
@Composable
fun ProviderHubScreen(
    viewModel: AppViewModel,
    providerId: Int,
    providerName: String,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    onSeeAll: (rowKey: String, label: String) -> Unit,
    onSeeAllForYou: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val baseUrl by viewModel.serverUrl.collectAsState()
    val heroLogos by viewModel.heroLogos.collectAsState()
    val providerTiles by viewModel.watchProviderTiles.collectAsState()
    val watchStatus by viewModel.watchStatus.collectAsState()
    val watchedMovieIds = remember(watchStatus) { watchStatus?.movies?.toSet().orEmpty() }
    val repository = remember(baseUrl) { baseUrl?.let { MovvizRepository(it) } }
    val scope = rememberCoroutineScope()

    // Catégories connues d'avance : jamais d'écran vide en attendant le serveur.
    var rows by remember(providerId) {
        mutableStateOf<List<ProviderRowDescDto>?>(listOf(ProviderRowDescDto(FOR_YOU_KEY, "Sélection pour vous")) + (readSavedRows(context, providerId) ?: DEFAULT_ROWS))
    }
    var rowsFailed by remember(providerId) { mutableStateOf(false) }
    val states = remember(providerId) { mutableStateMapOf<String, ProviderRowState>() }

    fun toCards(results: List<SearchResultDto>) = results.map {
        TvTitleCard("provider-${it.type}-${it.tmdbId}", it.title, it.posterPath, it.backdropPath, it.tmdbId, it.type == "movie", it.year, it.rating)
    }.withWatchedMovies(watchedMovieIds)

    /** Préchargement des affiches : elles sont déjà en mémoire quand le défilement les atteint. */
    fun prefetchPosters(cards: List<TvTitleCard>) {
        cards.forEach { card ->
            val path = card.posterPath ?: return@forEach
            context.imageLoader.enqueue(ImageRequest.Builder(context).data("$POSTER_BASE$path").build())
        }
    }

    suspend fun loadRows() {
        val repo = repository ?: return
        rowsFailed = false
        when (val r = repo.providerRows(providerId)) {
            is ApiResult.Success -> {
                rows = listOf(ProviderRowDescDto(FOR_YOU_KEY, "Sélection pour vous")) + r.data
                if (r.data.isNotEmpty()) saveRows(context, providerId, r.data)
            }
            // Les catégories déjà affichées (mémorisées ou de départ) restent : seule une panne sans rien
            // d'autre à montrer bascule sur le message d'erreur.
            else -> rowsFailed = true
        }
    }

    suspend fun loadRowPage(key: String, target: Int) {
        val repo = repository ?: return
        val state = states.getOrPut(key) { ProviderRowState() }
        if (state.loading || (target > 1 && target > state.totalPages)) return
        state.loading = true
        try {
            val page = if (key == FOR_YOU_KEY) {
                when (val r = repo.rowPage("movie", "providerSuggested:$providerId", target)) {
                    is ApiResult.Success -> Triple(r.data.results, r.data.page, r.data.totalPages)
                    else -> null
                }
            } else {
                when (val r = repo.providerRow(providerId, key, target)) {
                    is ApiResult.Success -> Triple(r.data.results, r.data.page, r.data.totalPages)
                    else -> null
                }
            }
            if (page != null) {
                val newCards = toCards(page.first)
                state.cards = (if (target == 1) newCards else state.cards + newCards).distinctBy { it.id }
                state.page = page.second
                state.totalPages = page.third
                // Les 8 suivantes sont préchargées dès l'arrivée de la rangée.
                if (target == 1) prefetchPosters(state.cards.drop(state.visible).take(CARDS_STEP))
            }
        } finally {
            state.loading = false
            state.loaded = true
        }
    }

    LaunchedEffect(providerId, repository) {
        if (providerTiles.isEmpty()) viewModel.loadDiscoverLogos()
        loadRows()
    }

    val visibleRows = rows.orEmpty().filter { row -> states[row.key]?.let { !it.loaded || it.cards.isNotEmpty() } ?: true }

    Column(Modifier.fillMaxSize().background(com.movviz.nx.mobile.ui.theme.MovvizPage).statusBarsPadding()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.tv.material3.Surface(
                onClick = onBack,
                modifier = Modifier.size(36.dp).tvPointerClick(onBack),
                shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.CircleShape),
                colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color.White.copy(alpha = 0.08f), contentColor = Color.White),
            ) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    androidx.tv.material3.Icon(MovvizIconBack, "Retour", modifier = Modifier.size(16.dp))
                }
            }
            Spacer(Modifier.width(14.dp))
            providerTiles.firstOrNull { it.id == providerId }?.logoPath?.let { logo ->
                coil.compose.AsyncImage(
                    model = "https://image.tmdb.org/t/p/w500$logo",
                    contentDescription = providerName,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.padding(end = 12.dp).size(width = 44.dp, height = 44.dp)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp)),
                )
            }
            Column {
                Text(providerName, style = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Bold, color = Color.White), maxLines = 1)
                Text("Films et séries par catégorie", style = TextStyle(fontSize = 12.sp, color = MovvizInkDim))
            }
        }
        when {
            rowsFailed && visibleRows.none { states[it.key]?.cards?.isNotEmpty() == true } -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                androidx.tv.material3.Surface(
                    onClick = { scope.launch { loadRows() } },
                    modifier = Modifier.tvPointerClick { scope.launch { loadRows() } },
                    shape = androidx.tv.material3.ClickableSurfaceDefaults.shape(androidx.compose.foundation.shape.RoundedCornerShape(12.dp)),
                    colors = androidx.tv.material3.ClickableSurfaceDefaults.colors(containerColor = Color(0xFF2A2A31), contentColor = Color.White),
                ) {
                    Text("Impossible de charger $providerName — Réessayer", modifier = Modifier.padding(horizontal = 18.dp, vertical = 12.dp))
                }
            }
            rows != null && visibleRows.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Aucun titre pour le moment", style = TextStyle(color = MovvizInkDim, fontSize = 14.sp))
            }
            else -> Box(Modifier.fillMaxSize()) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 156.dp),
                ) {
                    itemsIndexed(visibleRows, key = { _, row -> row.key }, contentType = { _, _ -> "provider-row" }) { index, row ->
                        val state = states.getOrPut(row.key) { ProviderRowState() }
                        LaunchedEffect(row.key) {
                            if (!state.loaded) loadRowPage(row.key, 1)
                            // Les deux rangées suivantes se chargent déjà : elles sont prêtes quand on y arrive.
                            for (ahead in 1..LOOKAHEAD_ROWS) {
                                val next = visibleRows.getOrNull(index + ahead) ?: break
                                val nextState = states.getOrPut(next.key) { ProviderRowState() }
                                if (!nextState.loaded) scope.launch { loadRowPage(next.key, 1) }
                            }
                        }
                        if (state.cards.isEmpty()) {
                            // Titre de la catégorie + emplacements vides tant que ses titres arrivent ; une
                            // rangée qui se révèle sans aucun titre disparaît.
                            if (state.loaded) Spacer(Modifier.size(1.dp)) else TitleRowSkeleton(row.label)
                        } else {
                            TitleRow(
                                heading = row.label,
                                items = state.cards.take(state.visible),
                                onClick = { onOpenTitle(if (it.isMovie) "movie" else "series", it.tmdbId) },
                                onSeeAll = {
                                    if (row.key == FOR_YOU_KEY) onSeeAllForYou() else onSeeAll(row.key, "${row.label} · $providerName")
                                },
                                titleLogoPaths = heroLogos,
                                onFocusedCard = { viewModel.requestHeroLogo(if (it.isMovie) "movie" else "series", it.tmdbId) },
                                onNearEnd = {
                                    if (state.visible < state.cards.size) {
                                        // Les cartes déjà reçues arrivent par paquets de 8 ; les 8 suivantes sont préchargées.
                                        state.visible = minOf(state.visible + CARDS_STEP, state.cards.size)
                                        prefetchPosters(state.cards.drop(state.visible).take(CARDS_STEP))
                                    }
                                    // Moins de deux paquets en réserve : la page suivante part avant d'être nécessaire.
                                    if (state.cards.size - state.visible < 2 * CARDS_STEP && state.page < state.totalPages) {
                                        scope.launch { loadRowPage(row.key, state.page + 1) }
                                    }
                                },
                            )
                        }
                    }
                }
                // Le logo animé n'apparaît plus qu'en dernier recours : les catégories sont déjà là.
                if (rows == null) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { AnimatedLogo(size = 42.dp) }
                }
            }
        }
    }
}
