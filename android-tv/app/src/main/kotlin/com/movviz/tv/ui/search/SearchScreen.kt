package com.movviz.tv.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.rememberAsyncImagePainter
import com.movviz.tv.AppViewModel
import com.movviz.tv.data.SearchResultDto
import com.movviz.tv.ui.theme.MovvizInk
import com.movviz.tv.ui.theme.MovvizInkDim
import com.movviz.tv.ui.theme.MovvizSurface
import com.movviz.tv.ui.theme.MovvizSurfaceStrong
import com.movviz.tv.ui.theme.RatingBadge
import com.movviz.tv.ui.theme.tvPointerClick

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342"

/**
 * Recherche unifiée film/série (`/api/metadata/search`, la même route que la
 * barre de recherche desktop) — un champ, validation clavier (pas de
 * live-typing, voir AppViewModel.search), puis une grille de résultats
 * focusable au D-pad menant à la fiche titre (qui gère déjà aussi bien un
 * titre en bibliothèque qu'un titre découverte à ajouter).
 */
@Composable
fun SearchScreen(viewModel: AppViewModel, onOpenTitle: (type: String, tmdbId: Int) -> Unit) {
    var query by remember { mutableStateOf("") }
    var hasSearched by remember { mutableStateOf(false) }
    val results by viewModel.searchResults.collectAsState()
    val searching by viewModel.searching.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(start = 48.dp, top = 40.dp, end = 48.dp),
    ) {
        Text(
            text = "Recherche",
            style = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground),
        )
        Spacer(modifier = Modifier.height(20.dp))

        SearchField(
            value = query,
            onValueChange = { query = it },
            onSearch = { hasSearched = true; viewModel.search(query) },
        )

        Spacer(modifier = Modifier.height(24.dp))

        when {
            searching -> Text(
                text = "Recherche…",
                style = TextStyle(fontSize = 14.sp, color = MovvizInkDim),
            )
            hasSearched && results.isEmpty() -> Text(
                text = "Aucun résultat pour « $query »",
                style = TextStyle(fontSize = 14.sp, color = MovvizInkDim),
            )
            results.isNotEmpty() -> TvLazyVerticalGrid(
                columns = TvGridCells.Fixed(6),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(results, key = { "${it.type}-${it.tmdbId}" }) { result ->
                    SearchResultCard(result = result, onClick = { onOpenTitle(result.type, result.tmdbId) })
                }
            }
        }
    }
}

@Composable
private fun SearchField(value: String, onValueChange: (String) -> Unit, onSearch: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    // clearFocus() seul ne suffit pas : ça enlève le focus logique Compose
    // mais ne dit rien à Android de fermer le clavier virtuel — confirmé en
    // testant, la loupe lançait bien la recherche mais le clavier restait
    // ouvert par-dessus les résultats. Il faut explicitement passer par le
    // contrôleur du clavier logiciel.
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    // Même rayon/bordure/palette que les champs de connexion et d'assistant
    // (TvTextField/LoginField) — avant, ce champ était seul à utiliser 8dp et
    // un gris de bordure ad hoc au lieu du même vocabulaire "champ TV".
    Box(
        modifier = Modifier
            .fillMaxWidth(0.5f)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MaterialTheme.colorScheme.primary else MovvizInk.copy(alpha = 0.12f),
                shape = RoundedCornerShape(12.dp),
            )
            .background(MovvizSurface, RoundedCornerShape(12.dp))
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(text = "Titre d'un film ou d'une série…", style = TextStyle(fontSize = 18.sp, color = MovvizInkDim))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 18.sp, color = MovvizInk),
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = {
                onSearch()
                focusManager.clearFocus()
                keyboardController?.hide()
            }),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun SearchResultCard(result: SearchResultDto, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val posterUrl = result.posterPath?.let { "$TMDB_IMAGE_BASE$it" }
    val shape = RoundedCornerShape(10.dp)

    Column {
        Surface(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .scale(if (focused) 1.08f else 1f)
                .onFocusChanged { focused = it.isFocused }
                .tvPointerClick(onClick),
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                    shape = shape,
                ),
            ),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (posterUrl != null) {
                    Image(
                        painter = rememberAsyncImagePainter(model = posterUrl),
                        contentDescription = result.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                // Même pastille note ★ que les posters de l'accueil — pas de
                // pastille de statut ici : un résultat de recherche est un
                // titre TMDb pas encore forcément en bibliothèque, l'API de
                // recherche ne renvoie d'ailleurs aucun champ de statut.
                if (result.rating > 0) {
                    RatingBadge(
                        rating = result.rating,
                        modifier = Modifier.align(Alignment.TopStart).padding(6.dp),
                    )
                }
            }
        }
        Text(
            text = result.title,
            style = TextStyle(fontSize = 12.sp, color = MaterialTheme.colorScheme.onBackground),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
