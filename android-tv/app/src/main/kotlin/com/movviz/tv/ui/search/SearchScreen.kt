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
            onSearch = { viewModel.search(query) },
        )

        Spacer(modifier = Modifier.height(24.dp))

        when {
            searching -> Text(
                text = "Recherche…",
                style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.6f)),
            )
            results.isEmpty() && query.isNotBlank() -> Text(
                text = "Aucun résultat pour « $query »",
                style = TextStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.6f)),
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
    Box(
        modifier = Modifier
            .fillMaxWidth(0.5f)
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) MaterialTheme.colorScheme.primary else Color(0xFF3A3A4A),
                shape = RoundedCornerShape(8.dp),
            )
            .background(Color(0xFF15151F), RoundedCornerShape(8.dp))
            .onFocusChanged { focused = it.isFocused }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(text = "Titre d'un film ou d'une série…", style = TextStyle(fontSize = 18.sp, color = Color(0xFF7A7A8C)))
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(fontSize = 18.sp, color = Color(0xFFF5F5FA)),
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { onSearch() }),
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
                .onFocusChanged { focused = it.isFocused },
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            colors = ClickableSurfaceDefaults.colors(containerColor = Color(0xFF1D1D2B)),
            border = ClickableSurfaceDefaults.border(
                focusedBorder = Border(
                    border = androidx.compose.foundation.BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
                    shape = shape,
                ),
            ),
        ) {
            if (posterUrl != null) {
                Image(
                    painter = rememberAsyncImagePainter(model = posterUrl),
                    contentDescription = result.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
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
