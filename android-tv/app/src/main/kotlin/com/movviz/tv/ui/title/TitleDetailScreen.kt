package com.movviz.tv.ui.title

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.ApiResult
import com.movviz.tv.data.SeriesEpisodeDto
import com.movviz.tv.data.SeriesSeasonDto
import com.movviz.tv.ui.player.QueueItem
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.launch

private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"

/**
 * Fiche titre — même composition que le hero desktop (TitleContent.tsx) :
 * backdrop plein écran + dégradé, pastille de statut, titre, ligne méta
 * (étoile/année/durée/genres), tagline, synopsis, puis une rangée d'actions
 * avec un bouton principal en dégradé de marque. Adaptée au 10-foot UI :
 * pas de survol souris, tout doit rester utilisable au D-pad seul, donc les
 * actions sont deux Surface focusables plutôt que des boutons cliqués à la
 * souris.
 */
@Composable
fun TitleDetailScreen(
    viewModel: AppViewModel,
    type: String,
    tmdbId: Int,
    onPlay: (title: String, queue: List<QueueItem>, startIndex: Int) -> Unit,
) {
    val detail by viewModel.detail.collectAsState()
    val addingToLibrary by viewModel.addingToLibrary.collectAsState()
    val seasons by viewModel.seriesSeasons.collectAsState()
    val scope = rememberCoroutineScope()
    var addError by remember { mutableStateOf<String?>(null) }

    val inLibrary = viewModel.isInLibrary(type, tmdbId)

    LaunchedEffect(type, tmdbId) {
        viewModel.loadDetail(type, tmdbId)
        if (type == "series" && inLibrary) viewModel.loadSeriesSeasons(tmdbId)
    }

    val plexRatingKey = viewModel.libraryPlexRatingKey(type, tmdbId)

    // File de lecture épisode par épisode — à plat sur toutes les saisons,
    // dans l'ordre d'affichage, pour que suivant/précédent dans le lecteur
    // puisse traverser une frontière de saison naturellement (S1E10 → S2E1).
    val playableEpisodes = remember(seasons) {
        seasons.flatMap { season ->
            season.episodes
                .filter { it.plexRatingKey != null && it.status == "available" }
                .map { ep ->
                    QueueItem(
                        ratingKey = ep.plexRatingKey!!,
                        label = "S${season.seasonNumber} · Ép ${ep.episodeNumber} · ${ep.title}",
                        seasonNumber = season.seasonNumber,
                        episodeNumber = ep.episodeNumber,
                    )
                }
        }
    }

    // Focus initial déterministe — sans ceci, rien ne réclame jamais le
    // focus D-pad en entrant sur la fiche (constat direct : deux DPAD_DOWN
    // consécutifs, focus immobile, avant ce correctif). La cible doit
    // toujours être un élément déjà composé au premier rendu — viser
    // directement le premier épisode d'une saison a été essayé et plante
    // (IllegalStateException "FocusRequester is not initialized") ou échoue
    // silencieusement : cette rangée vit dans la TvLazyColumn et n'est pas
    // forcément composée tant qu'elle n'est pas au moins proche du viewport
    // (synopsis long ⇒ saison 1 hors-champ au premier rendu). On utilise
    // donc le CTA principal (Lire/Ajouter) quand il existe — il est toujours
    // dans le tout premier `item{}`, donc toujours composé — sinon un ancrage
    // invisible placé au même endroit (cas d'une série déjà en bibliothèque,
    // sans CTA générique). Une fois le focus posé en haut, la descente D-pad
    // classique fait défiler/composer les rangées de saisons normalement
    // (même mécanisme que la ligne Films → Séries de l'accueil).
    val initialFocusRequester = remember { FocusRequester() }
    var hasRequestedInitialFocus by remember { mutableStateOf(false) }
    val hasFocusableCta = when {
        type == "movie" && plexRatingKey != null -> true
        type == "movie" -> !inLibrary
        else -> !inLibrary // série
    }
    LaunchedEffect(detail) {
        if (hasRequestedInitialFocus) return@LaunchedEffect
        if (detail == null) return@LaunchedEffect
        hasRequestedInitialFocus = true
        // Le tout premier `item{}` composé peut prendre une frame — on
        // retente sur quelques frames plutôt que de laisser un crash D-pad
        // silencieux (constaté en direct) sortir l'utilisateur de l'app.
        repeat(10) { attempt ->
            val focused = runCatching { initialFocusRequester.requestFocus() }.isSuccess
            if (focused) return@LaunchedEffect
            if (attempt < 9) withFrameNanos { }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val backdropUrl = detail?.backdropPath?.let { "$TMDB_BACKDROP_BASE$it" }
        if (backdropUrl != null) {
            Image(
                painter = rememberAsyncImagePainter(model = backdropUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(560.dp),
            )
        } else {
            Box(modifier = Modifier.fillMaxWidth().height(560.dp).background(MaterialTheme.colorScheme.surface))
        }

        // Même double dégradé que le web (vertical pour la lisibilité du bas,
        // horizontal pour ancrer le texte à gauche) — juste transposé à des
        // Brush Compose au lieu de classes Tailwind.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(560.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, MaterialTheme.colorScheme.background.copy(alpha = 0.75f), MaterialTheme.colorScheme.background),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(560.dp)
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(MaterialTheme.colorScheme.background.copy(alpha = 0.55f), Color.Transparent),
                    ),
                ),
        )

        if (detail == null) {
            Text(
                text = "Chargement…",
                style = TextStyle(fontSize = 16.sp, color = MaterialTheme.colorScheme.onBackground),
                modifier = Modifier.padding(start = 56.dp, top = 320.dp),
            )
            return@Box
        }
        val d = detail!!

        TvLazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 56.dp, end = 56.dp, bottom = 40.dp),
            contentPadding = PaddingValues(top = 320.dp),
        ) {
            item {
            if (!hasFocusableCta) {
                // Ancrage de focus invisible — série déjà en bibliothèque,
                // donc aucun CTA généré plus bas dans ce même `item{}` (voir
                // hasFocusableCta) : sans cible focusable garantie composée
                // dès le premier rendu, le focus D-pad n'a nulle part où
                // atterrir en entrant sur la fiche.
                Box(
                    modifier = Modifier
                        .size(1.dp)
                        .focusRequester(initialFocusRequester)
                        .focusable(),
                )
            }
            if (inLibrary) {
                // Trio pastille standard (texte/fond/bordure sur la même teinte
                // sémantique) — voir CLAUDE.md, jusque-là seuls texte+fond
                // étaient posés ici, sans bordure comme partout ailleurs.
                Box(
                    modifier = Modifier
                        .background(MovvizOk.copy(alpha = 0.12f), RoundedCornerShape(50))
                        .border(1.dp, MovvizOk.copy(alpha = 0.25f), RoundedCornerShape(50))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    Text(
                        text = "Dans la bibliothèque",
                        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MovvizOk),
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            Text(
                text = d.title,
                style = TextStyle(fontSize = 44.sp, fontWeight = FontWeight.Black, color = MovvizInk),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 720.dp),
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "★ ${"%.1f".format(d.rating)}",
                    style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF5C144)),
                )
                MetaSep()
                Text(text = d.year?.toString() ?: "—", style = metaStyle())
                d.runtime?.let {
                    MetaSep()
                    Text(text = "$it min", style = metaStyle())
                }
                if (d.genres.isNotEmpty()) {
                    MetaSep()
                    Text(
                        text = d.genres.take(3).joinToString(", "),
                        style = metaStyle(),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 320.dp),
                    )
                }
            }

            if (d.tagline.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = d.tagline,
                    style = TextStyle(fontSize = 14.sp, fontStyle = FontStyle.Italic, color = MovvizInkSoft),
                    modifier = Modifier.widthIn(max = 640.dp),
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = d.overview,
                style = TextStyle(fontSize = 14.sp, color = MovvizInkSoft, lineHeight = 20.sp),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 640.dp),
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Film : un seul CTA (Lire si le fichier est prêt, sinon Ajouter).
            // Série : Ajouter tant qu'elle n'est pas en bibliothèque — une
            // fois dedans, la lecture se fait épisode par épisode plus bas,
            // pas de CTA générique unique (mêmes hiérarchie qu'un show sur
            // Plex/Netflix : jamais un simple bouton "Lire" sur une série).
            if (type == "movie") {
                Row {
                    if (plexRatingKey != null) {
                        PrimaryPill(text = "▶  Lire", brush = null, solidWhite = true, focusRequester = initialFocusRequester) {
                            onPlay(d.title, listOf(QueueItem(plexRatingKey, null, -1, -1)), 0)
                        }
                    } else if (!inLibrary) {
                        PrimaryPill(
                            text = if (addingToLibrary) "Ajout…" else "+  Ajouter à la bibliothèque",
                            brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                            solidWhite = false,
                            enabled = !addingToLibrary,
                            focusRequester = initialFocusRequester,
                        ) {
                            scope.launch {
                                when (val result = viewModel.addCurrentToLibrary(type, tmdbId)) {
                                    is ApiResult.Failure -> addError = result.message
                                    else -> addError = null
                                }
                            }
                        }
                    } else {
                        PrimaryPill(text = "En attente de synchronisation", brush = null, solidWhite = false, enabled = false) {}
                    }
                }
            } else if (!inLibrary) {
                Row {
                    PrimaryPill(
                        text = if (addingToLibrary) "Ajout…" else "+  Ajouter à la bibliothèque",
                        brush = Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)),
                        solidWhite = false,
                        enabled = !addingToLibrary,
                        focusRequester = initialFocusRequester,
                    ) {
                        scope.launch {
                            when (val result = viewModel.addCurrentToLibrary(type, tmdbId)) {
                                is ApiResult.Failure -> addError = result.message
                                else -> addError = null
                            }
                        }
                    }
                }
            }

            addError?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = it, style = TextStyle(fontSize = 12.sp, color = MovvizDown))
            }
            } // item

            if (type == "series" && inLibrary) {
                item { Spacer(modifier = Modifier.height(28.dp)) }
                if (seasons.isEmpty()) {
                    item {
                        Text(
                            text = "Chargement des épisodes…",
                            style = TextStyle(fontSize = 13.sp, color = MovvizInkDim),
                        )
                    }
                } else {
                    items(seasons, key = { it.seasonNumber }) { season ->
                        SeasonRow(season = season) { episode ->
                            val index = playableEpisodes.indexOfFirst {
                                it.seasonNumber == season.seasonNumber && it.episodeNumber == episode.episodeNumber
                            }
                            if (index >= 0) onPlay(d.title, playableEpisodes, index)
                        }
                    }
                }
            }
        }
    }
}

/** Une saison — nom + rangée horizontale d'épisodes (numéro + icône lecture
 *  si le fichier est prêt), inspiré de la liste de saisons de Plex mais en
 *  rangée scrollable plutôt qu'un accordéon (plus naturel au D-pad). */
@Composable
private fun SeasonRow(
    season: SeriesSeasonDto,
    firstEpisodeFocusRequester: FocusRequester? = null,
    onPlayEpisode: (SeriesEpisodeDto) -> Unit,
) {
    Column(modifier = Modifier.padding(bottom = 24.dp)) {
        Text(
            text = season.name.ifBlank { "Saison ${season.seasonNumber}" },
            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
        )
        Spacer(modifier = Modifier.height(10.dp))
        TvLazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            itemsIndexed(season.episodes, key = { _, ep -> ep.episodeNumber }) { index, ep ->
                EpisodeChip(
                    episode = ep,
                    onClick = { onPlayEpisode(ep) },
                    focusRequester = if (index == 0) firstEpisodeFocusRequester else null,
                )
            }
        }
    }
}

@Composable
private fun EpisodeChip(episode: SeriesEpisodeDto, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val available = episode.plexRatingKey != null && episode.status == "available"
    val shape = RoundedCornerShape(10.dp)
    Surface(
        onClick = onClick,
        enabled = available,
        modifier = Modifier
            .width(160.dp)
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .scale(if (focused && available) 1.06f else 1f)
            .onFocusChanged { focused = it.isFocused }
            .let { if (available) it.tvPointerClick(onClick) else it },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MovvizInk.copy(alpha = if (available) 0.08f else 0.04f),
            contentColor = MovvizInk,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary),
                shape = shape,
            ),
        ),
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = "Épisode ${episode.episodeNumber}" + if (available) "  ▶" else "",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (available) MovvizInk else MovvizInkDim),
            )
            Text(
                text = episode.title,
                style = TextStyle(fontSize = 11.sp, color = if (available) MovvizInkSoft else MovvizInkDim),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun metaStyle() = TextStyle(fontSize = 14.sp, color = MovvizInkSoft)

@Composable
private fun MetaSep() {
    Text(text = "  •  ", style = TextStyle(fontSize = 14.sp, color = MovvizInkDim))
}

/** Bouton d'action principal — Surface focusable (obligatoire pour le D-pad),
 *  fond dégradé simulé via Modifier.background + containerColor transparent
 *  quand un Brush est fourni, sinon blanc plein (même distinction que
 *  "Lire" en blanc vs "Ajouter" en dégradé de marque côté web). */
@Composable
private fun PrimaryPill(
    text: String,
    brush: Brush?,
    solidWhite: Boolean,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(12.dp)
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .let { if (brush != null) it.background(brush, shape) else it }
            .let { if (focusRequester != null) it.focusRequester(focusRequester) else it }
            .scale(if (focused && enabled) 1.06f else 1f)
            .onFocusChanged { focused = it.isFocused }
            .let { if (enabled) it.tvPointerClick(onClick) else it },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (brush != null) Color.Transparent else if (solidWhite) Color.White else MovvizInk.copy(alpha = 0.1f),
            contentColor = if (solidWhite) Color.Black else MovvizInk,
        ),
        // Bordure de focus blanche invisible sur le variant "Lire" (fond
        // déjà blanc plein) — corrigé : bordure en dégradé de marque sur ce
        // variant précis, blanche partout ailleurs où le fond est sombre ou
        // déjà en dégradé de marque (contraste garanti dans les deux cas).
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = if (solidWhite) {
                    androidx.compose.foundation.BorderStroke(2.dp, Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)))
                } else {
                    androidx.compose.foundation.BorderStroke(2.dp, Color.White)
                },
                shape = shape,
            ),
        ),
    ) {
        Text(
            text = text,
            style = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold),
            modifier = Modifier.padding(horizontal = 22.dp, vertical = 14.dp),
        )
    }
}
