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
import com.movviz.tv.ui.home.TitleRow
import com.movviz.tv.ui.home.TvTitleCard
import com.movviz.tv.ui.player.QueueItem
import com.movviz.tv.ui.theme.MovvizBrand
import com.movviz.tv.ui.theme.MovvizBrand2
import com.movviz.tv.ui.theme.MovvizCyan
import com.movviz.tv.ui.theme.MovvizDown
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizInkSoft
import com.movviz.tv.ui.theme.MovvizOk
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.tvPointerClick
import androidx.compose.ui.draw.clip
import kotlinx.coroutines.launch

private const val TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"
private const val TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185"

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
    // Navigation vers un AUTRE titre depuis cette même fiche — sert la
    // rangée "Titres similaires" plus bas (clic → nouvelle fiche, poussée
    // sur la pile de nav, exactement Netflix/Apple TV). Optionnel : les
    // quelques autres call sites potentiels (aucun aujourd'hui) n'ont pas
    // à le fournir.
    onOpenTitle: (type: String, tmdbId: Int) -> Unit = { _, _ -> },
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
        if (type == "movie") viewModel.loadContinueWatching()
        // Statut "vu" manuel — utile aux deux types (badge "Vu" sur un film
        // terminé, coche par épisode pour une série), voir /api/watch-status.
        viewModel.loadWatchStatus()
    }

    val plexRatingKey = viewModel.libraryPlexRatingKey(type, tmdbId)

    // Reprise pour un film déjà entamé — via /api/plex/on-deck (déjà chargé
    // pour la rangée "Continuer à regarder" de l'accueil), PAS un stockage
    // local à l'appareil : la position doit être la même quel que soit
    // l'appareil utilisé (TV, desktop...), donc côté serveur/compte Plex,
    // jamais un cache propre à un seul écran.
    val continueWatching by viewModel.continueWatching.collectAsState()
    val movieResume = remember(continueWatching, type, tmdbId) {
        if (type != "movie") null
        else continueWatching.firstOrNull { it.type == "movie" && it.tmdbId == tmdbId && it.offsetMs > 5_000L }
    }

    // Statut "vu" manuel par utilisateur — /api/watch-status, distinct de
    // LibraryStatus (qui dit si le FICHIER existe, pas si on l'a regardé).
    // Le CTA actuel ne distinguait que "jamais commencé" vs "en cours" ;
    // "déjà terminé" est un troisième état réel qu'aucun autre signal ne
    // couvre (movieResume exige un offset > 5s ET vient d'une source
    // différente — le on-deck Plex, pas ce toggle manuel).
    val watchStatus by viewModel.watchStatus.collectAsState()
    val movieWatched = remember(watchStatus, type, tmdbId) {
        type == "movie" && watchStatus?.movies?.contains(tmdbId) == true
    }
    // Clés "saison.épisode" déjà vues pour CETTE série — watchStatus.episodes
    // est global à l'utilisateur (toutes séries confondues, tmdbId = id de
    // la série), donc filtré ici avant de passer aux rangées de saisons.
    val watchedEpisodeKeys = remember(watchStatus, type, tmdbId) {
        if (type != "series") emptySet()
        else watchStatus?.episodes
            ?.filter { it.tmdbId == tmdbId }
            ?.map { "${it.season}.${it.episode}" }
            ?.toSet()
            ?: emptySet()
    }

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

        // Rangée "Titres similaires" — même esprit Netflix/Apple TV que le
        // web (TitleContent.tsx, "title.similar") : d.similar vient du même
        // /api/metadata/detail déjà appelé pour cette fiche (recommandations
        // TMDb), pas un appel réseau séparé. Calculé ici (hors du DSL
        // LazyColumn, où `remember` n'est pas utilisable) puis réutilisé via
        // TitleRow/TvTitleCard de l'accueil pour rester visuellement
        // identique aux autres rangées de posters de l'app.
        val similarCards = remember(d) {
            d.similar
                .filter { !(it.tmdbId == tmdbId && it.type == type) }
                .map { TvTitleCard(it.tmdbId.toString(), it.title, it.posterPath, null, it.tmdbId, isMovie = it.type == "movie") }
        }

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
            if (inLibrary || movieWatched) {
                // Trio pastille standard (texte/fond/bordure sur la même teinte
                // sémantique) — voir CLAUDE.md, jusque-là seuls texte+fond
                // étaient posés ici, sans bordure comme partout ailleurs.
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (inLibrary) {
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
                    }
                    // "Vu" — statut manuel par utilisateur (/api/watch-status),
                    // troisième état réel que le CTA seul ne couvrait pas
                    // (jamais commencé / en cours de reprise / déjà terminé).
                    if (movieWatched) {
                        Box(
                            modifier = Modifier
                                .background(MovvizCyan.copy(alpha = 0.12f), RoundedCornerShape(50))
                                .border(1.dp, MovvizCyan.copy(alpha = 0.25f), RoundedCornerShape(50))
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                        ) {
                            Text(
                                text = "✓ Vu",
                                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MovvizCyan),
                            )
                        }
                    }
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

            // Titre original — affiché seulement s'il diffère réellement du
            // titre localisé (ex: "The Dark Knight" sous "The Dark Knight :
            // Le Chevalier noir"), confirmé en direct contre
            // /api/metadata/detail. Un titre déjà identique (le cas le plus
            // fréquent) n'affiche rien de plus.
            if (!d.originalTitle.isNullOrBlank() && !d.originalTitle.equals(d.title, ignoreCase = true)) {
                Text(
                    text = "Titre original : ${d.originalTitle}",
                    style = TextStyle(fontSize = 13.sp, color = MovvizInkDim),
                )
            }

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

            d.crew.firstOrNull { it.job == "Director" }?.let { director ->
                Spacer(modifier = Modifier.height(6.dp))
                Row {
                    Text(text = "Réalisation ", style = TextStyle(fontSize = 13.sp, color = MovvizInkDim))
                    Text(text = director.name, style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
                }
            }

            // Saga TMDb (belongs_to_collection) — simple mention texte, pas
            // de duplication d'un écran Collections qui n'existe pas côté TV.
            // Zone secondaire discrète, jamais la hiérarchie principale.
            d.collection?.let { collection ->
                Spacer(modifier = Modifier.height(6.dp))
                Row {
                    Text(text = "Fait partie de ", style = TextStyle(fontSize = 13.sp, color = MovvizInkDim))
                    Text(text = collection.name, style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MovvizInkSoft))
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
                Column {
                    Row {
                        if (plexRatingKey != null) {
                            val ctaText = if (movieResume != null) "▶  Reprendre à ${formatResumeTime(movieResume.offsetMs)}" else "▶  Lire"
                            PrimaryPill(text = ctaText, brush = null, solidWhite = true, focusRequester = initialFocusRequester) {
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
                            PrimaryPill(text = movieStatusLabel(viewModel.libraryMovieStatus(tmdbId)), brush = null, solidWhite = false, enabled = false) {}
                        }
                    }
                    // Fine barre de progression sous le CTA de reprise — même
                    // esprit que le hero de l'accueil (progressPercent sur
                    // PosterCard), juste sous un bouton plutôt que sur un
                    // poster ici.
                    movieResume?.let { resume ->
                        Spacer(modifier = Modifier.height(8.dp))
                        Box(
                            modifier = Modifier
                                .width(200.dp)
                                .height(3.dp)
                                .background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(2.dp)),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(fraction = (resume.progressPercent / 100f).coerceIn(0f, 1f))
                                    .fillMaxHeight()
                                    .background(Brush.horizontalGradient(listOf(MovvizBrand, MovvizBrand2)), RoundedCornerShape(2.dp)),
                            )
                        }
                    }
                    // Infos techniques du fichier RÉELLEMENT en bibliothèque
                    // (pas des infos TMDb) — résolution/codecs/HDR/source, tels
                    // que Plex les a analysés (confirmé en direct contre
                    // /api/library/movies : file.resolution/videoCodec/
                    // audioCodec/hdr/source). Zone secondaire discrète sous le
                    // CTA, jamais la hiérarchie principale de la fiche.
                    if (plexRatingKey != null) {
                        viewModel.libraryMovieFile(tmdbId)?.let { file ->
                            FileTechInfoRow(file)
                        }
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
                        SeasonRow(season = season, watchedEpisodeKeys = watchedEpisodeKeys) { episode ->
                            val index = playableEpisodes.indexOfFirst {
                                it.seasonNumber == season.seasonNumber && it.episodeNumber == episode.episodeNumber
                            }
                            if (index >= 0) onPlay(d.title, playableEpisodes, index)
                        }
                    }
                }
            }

            if (d.cast.isNotEmpty()) {
                item { Spacer(modifier = Modifier.height(28.dp)) }
                item { CastRow(cast = d.cast) }
            }

            // Rangée "Titres similaires" — voir similarCards ci-dessus
            // (calculé hors du DSL LazyColumn, `remember` n'est pas
            // utilisable directement dans le corps d'un `item {}` builder).
            if (similarCards.isNotEmpty()) {
                item { Spacer(modifier = Modifier.height(28.dp)) }
                item {
                    TitleRow(
                        heading = "Titres similaires",
                        items = similarCards,
                        onClick = { card -> onOpenTitle(if (card.isMovie) "movie" else "series", card.tmdbId) },
                    )
                }
            }
        }
    }
}

/** Distribution — déjà renvoyée par /api/metadata/detail (cast/crew), juste
 *  jamais affichée côté TV jusqu'ici. Portraits ronds + nom + rôle, même
 *  esprit que la section Distribution du desktop (TitleContent.tsx) mais en
 *  rangée horizontale scrollable, plus naturel au D-pad qu'une grille. */
@Composable
private fun CastRow(cast: List<com.movviz.tv.data.MetaCastMemberDto>) {
    Column(modifier = Modifier.padding(bottom = 8.dp)) {
        Text(
            text = "Distribution",
            style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MovvizInk),
            modifier = Modifier.padding(start = 48.dp, bottom = 12.dp),
        )
        TvLazyRow(
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            items(cast.take(15), key = { it.id }) { member ->
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(84.dp)) {
                    val photoUrl = member.profilePath?.let { "$TMDB_PROFILE_BASE$it" }
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(androidx.compose.foundation.shape.CircleShape)
                            .background(MovvizSurfaceStrong),
                    ) {
                        if (photoUrl != null) {
                            androidx.compose.foundation.Image(
                                painter = coil.compose.rememberAsyncImagePainter(model = photoUrl),
                                contentDescription = member.name,
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = member.name,
                        style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MovvizInk),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                    if (member.character.isNotBlank()) {
                        Text(
                            text = member.character,
                            style = TextStyle(fontSize = 11.sp, color = MovvizInkDim),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
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
    // Clés "saison.épisode" déjà vues (statut "vu" manuel utilisateur,
    // /api/watch-status) — voir watchedEpisodeKeys dans TitleDetailScreen.
    watchedEpisodeKeys: Set<String> = emptySet(),
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
                    watched = watchedEpisodeKeys.contains("${season.seasonNumber}.${ep.episodeNumber}"),
                    onClick = { onPlayEpisode(ep) },
                    focusRequester = if (index == 0) firstEpisodeFocusRequester else null,
                )
            }
        }
    }
}

@Composable
private fun EpisodeChip(episode: SeriesEpisodeDto, watched: Boolean = false, onClick: () -> Unit, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    val available = episode.plexRatingKey != null && episode.status == "available"
    val shape = RoundedCornerShape(10.dp)
    Box {
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
    // Coche "vu" — statut manuel utilisateur (/api/watch-status), coin
    // supérieur droit de la puce, même trio pastille que le reste de l'app
    // mais réduit au strict nécessaire (une puce épisode fait déjà 160dp de
    // large, pas de place pour un libellé complet).
    if (watched) {
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(4.dp)
                .background(MovvizCyan.copy(alpha = 0.9f), androidx.compose.foundation.shape.CircleShape)
                .padding(horizontal = 4.dp, vertical = 2.dp),
        ) {
            Text(text = "✓", style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White))
        }
    }
    }
}

/** Infos techniques du fichier réellement en bibliothèque (résolution,
 *  codecs, HDR, source) — zone secondaire discrète sous le CTA de lecture,
 *  jamais la hiérarchie principale de la fiche. Texte simple plutôt que les
 *  logos de format du desktop (FormatLogos.tsx) : pas la peine de porter tout
 *  ce système d'assets pour une seule ligne d'infos secondaires côté TV. */
@Composable
private fun FileTechInfoRow(file: com.movviz.tv.data.LibraryFileDto) {
    val parts = listOfNotNull(
        file.resolution,
        file.videoCodec,
        file.audioCodec,
        file.hdr,
        file.source,
    )
    if (parts.isEmpty()) return
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text = parts.joinToString("  ·  "),
        style = TextStyle(fontSize = 12.sp, color = MovvizInkDim),
    )
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

/** Libellé français du vrai statut serveur (voir LibraryStatus dans
 *  src/lib/library/types.ts : upcoming/missing/searching/downloading/
 *  available) — remplace le texte générique "En attente de synchronisation"
 *  qui s'affichait auparavant pour TOUT film en bibliothèque sans fichier
 *  prêt, qu'il soit en recherche, en téléchargement, ou pas encore sorti. */
private fun movieStatusLabel(status: String?): String = when (status) {
    "upcoming" -> "Pas encore sorti"
    "missing" -> "En attente de recherche"
    "searching" -> "Recherche en cours…"
    "downloading" -> "Téléchargement en cours…"
    "available" -> "Import en cours…" // fichier trouvé côté serveur mais pas encore reflété ici (plexRatingKey null)
    else -> "En attente de synchronisation"
}

/** "1:23:45" ou "9:24" selon la présence d'heures — même format que
 *  formatResumeTime côté desktop (src/lib/player/watchProgress.ts), pour le
 *  CTA "Reprendre à…" d'un film déjà entamé. */
private fun formatResumeTime(offsetMs: Long): String {
    val totalSeconds = (offsetMs / 1000).coerceAtLeast(0)
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
