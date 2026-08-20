package com.movviz.tv.ui.search

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.items
import androidx.tv.foundation.lazy.grid.itemsIndexed
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
import com.movviz.tv.ui.theme.tvFocusLift
import com.movviz.tv.ui.theme.tvPointerClick
import kotlinx.coroutines.delay

private const val TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

/** Recherche TV inspirée du flux Netflix : résultats pendant la saisie,
 * suggestions sous le champ, cartes larges et aperçu du titre ciblé. */
@Composable
fun SearchScreen(
    viewModel: AppViewModel,
    onOpenTitle: (type: String, tmdbId: Int) -> Unit,
    query: String = "",
    onQueryChange: (String) -> Unit = {},
    showSearchField: Boolean = true,
    // Cible D-pad pour sortir du champ de recherche (NavRail.SearchButton) :
    // première carte de la grille de résultats.
    resultFocusRequester: FocusRequester? = null,
) {
    var focusedResult by remember { mutableStateOf<SearchResultDto?>(null) }
    var fieldFocused by remember { mutableStateOf(false) }
    val results by viewModel.searchResults.collectAsState()
    val searching by viewModel.searching.collectAsState()

    LaunchedEffect(query) {
        if (query.isBlank()) focusedResult = null
        else { delay(350); viewModel.search(query) }
    }

    val selected = focusedResult
    // top = 96dp : même marge que Paramètres pour dégager la barre de nav
    // flottante sans bande de fond opaque ajoutée au-dessus (voir MainScreen).
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(start = 48.dp, top = 96.dp, end = 48.dp, bottom = 30.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (showSearchField) {
                Text("Recherche", style = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground))
                Spacer(Modifier.width(24.dp))
                SearchField(query, fieldFocused, { fieldFocused = it }, onQueryChange, { viewModel.search(query) }, Modifier.width(430.dp))
            }
        }
        Spacer(Modifier.height(18.dp))
        if (query.isNotBlank() && results.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Autres titres à découvrir", color = MovvizInkDim, fontSize = 13.sp)
                Spacer(Modifier.width(10.dp))
                results.take(8).forEachIndexed { index, item ->
                    Surface(onClick = { onQueryChange(item.title) }, modifier = Modifier.tvPointerClick { onQueryChange(item.title) }, colors = ClickableSurfaceDefaults.colors(containerColor = Color.Transparent, focusedContainerColor = MovvizSurfaceStrong), shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(4.dp))) {
                        Text(item.title, color = if (item == selected) MaterialTheme.colorScheme.primary else MovvizInk, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 4.dp, vertical = 3.dp))
                    }
                    if (index < results.take(8).lastIndex) Text("  |  ", color = MovvizInkDim, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(18.dp))
        }
        when {
            searching -> Text("Recherche…", color = MovvizInkDim, fontSize = 15.sp)
            query.isBlank() -> Text("Recherchez un film ou une série", color = MovvizInkDim, fontSize = 15.sp)
            results.isEmpty() -> Text("Aucun résultat pour « $query »", color = MovvizInkDim, fontSize = 15.sp)
            else -> TvLazyVerticalGrid(columns = TvGridCells.FixedSize(154.dp), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalArrangement = Arrangement.spacedBy(22.dp), modifier = Modifier.fillMaxSize()) {
                itemsIndexed(results, key = { _, result -> "${result.type}-${result.tmdbId}" }) { index, result ->
                    SearchResultCard(
                        result, result == selected, { focusedResult = result },
                        focusRequester = if (index == 0) resultFocusRequester else null,
                    ) { onOpenTitle(result.type, result.tmdbId) }
                }
            }
        }
    }
}

@Composable
private fun SearchField(value: String, focused: Boolean, onFocusChanged: (Boolean) -> Unit, onValueChange: (String) -> Unit, onSearch: () -> Unit, modifier: Modifier) {
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    Box(modifier.height(52.dp).border(2.dp, if (focused) MaterialTheme.colorScheme.primary else MovvizInk.copy(alpha = .25f), RoundedCornerShape(26.dp)).background(MovvizSurface, RoundedCornerShape(26.dp)).onFocusChanged { onFocusChanged(it.isFocused) }.padding(horizontal = 20.dp), contentAlignment = Alignment.CenterStart) {
        if (value.isEmpty()) Text("Rechercher un titre…", color = MovvizInkDim, fontSize = 17.sp)
        BasicTextField(value, onValueChange, singleLine = true, textStyle = TextStyle(fontSize = 17.sp, color = MovvizInk), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { onSearch(); focusManager.clearFocus(); keyboardController?.hide() }), modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun SearchResultCard(result: SearchResultDto, selected: Boolean, onFocus: () -> Unit, focusRequester: FocusRequester? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(10.dp)
    Column {
        Surface(onClick = onClick, modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f).let { if (focusRequester != null) it.focusRequester(focusRequester) else it }.tvFocusLift(selected, shape = shape).onFocusChanged { if (it.isFocused) onFocus() }.tvPointerClick(onClick), shape = ClickableSurfaceDefaults.shape(shape = shape), colors = ClickableSurfaceDefaults.colors(containerColor = MovvizSurfaceStrong), border = ClickableSurfaceDefaults.border(focusedBorder = Border(border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary), shape = shape))) {
            Box(Modifier.fillMaxSize()) {
                result.posterPath?.let { Image(painter = rememberAsyncImagePainter("$TMDB_IMAGE_BASE$it"), contentDescription = result.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                if (result.rating > 0) RatingBadge(result.rating, Modifier.align(Alignment.TopStart).padding(7.dp))
            }
        }
        Text(result.title, color = MaterialTheme.colorScheme.onBackground, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 7.dp))
        Text(if (result.type == "series") "Série" else "Film", color = MovvizInkDim, fontSize = 11.sp)
    }
}
