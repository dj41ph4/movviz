package com.movviz.mobile.discover

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.movviz.tv.data.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Two genres TMDb has no id for at all (src/lib/metadata/genreTaxonomy.ts,
 *  ANIME_GENRE_ID/TEEN_GENRE_ID) — routed server-side to rule-based matching
 *  instead of a real with_genres filter, but the client just passes them as
 *  the `genre` query param exactly like a normal numeric id. */
const val ANIME_GENRE_ID = "anime"
const val TEEN_GENRE_ID = "teen"

data class DiscoverGenreOption(val id: String, val name: String)

/** Content-only state for the Discover tab (rows/genres/browse grid) — kept
 *  separate from the app-wide MobileViewModel so this feature's own fetching
 *  doesn't bloat that already-large shared model. Library membership/status
 *  (the "dynamic button" state on each poster) intentionally stays sourced
 *  from MobileViewModel's existing movies/series StateFlows instead of being
 *  duplicated here — see DiscoverScreen.kt's DiscoverPosterCard. */
internal class DiscoverViewModel(application: Application) : AndroidViewModel(application) {
    private var repo: DiscoverRepository? = null
    private var configuredBaseUrl: String? = null

    private val _mediaType = MutableStateFlow("movie")
    val mediaType: StateFlow<String> = _mediaType.asStateFlow()

    private val _rows = MutableStateFlow<List<DiscoverRowDto>>(emptyList())
    val rows: StateFlow<List<DiscoverRowDto>> = _rows.asStateFlow()

    private val _rowsLoading = MutableStateFlow(false)
    val rowsLoading: StateFlow<Boolean> = _rowsLoading.asStateFlow()

    private val _genres = MutableStateFlow<List<DiscoverGenreOption>>(emptyList())
    val genres: StateFlow<List<DiscoverGenreOption>> = _genres.asStateFlow()

    // ── Browse/grid mode: active exactly when one of these three is set ──
    private val _selectedGenreId = MutableStateFlow<String?>(null)
    val selectedGenreId: StateFlow<String?> = _selectedGenreId.asStateFlow()

    private val _activeRowKey = MutableStateFlow<String?>(null)
    val activeRowKey: StateFlow<String?> = _activeRowKey.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _rowMeta = MutableStateFlow<DiscoverRowMetaDto?>(null)
    val rowMeta: StateFlow<DiscoverRowMetaDto?> = _rowMeta.asStateFlow()

    private val _browseResults = MutableStateFlow<List<DiscoverResultDto>>(emptyList())
    val browseResults: StateFlow<List<DiscoverResultDto>> = _browseResults.asStateFlow()

    private val _browsePage = MutableStateFlow(1)
    val browsePage: StateFlow<Int> = _browsePage.asStateFlow()

    private val _browseTotalPages = MutableStateFlow(1)
    val browseTotalPages: StateFlow<Int> = _browseTotalPages.asStateFlow()

    private val _browseLoading = MutableStateFlow(false)
    val browseLoading: StateFlow<Boolean> = _browseLoading.asStateFlow()

    private val _browseLoadingMore = MutableStateFlow(false)
    val browseLoadingMore: StateFlow<Boolean> = _browseLoadingMore.asStateFlow()

    fun configure(baseUrl: String) {
        if (configuredBaseUrl == baseUrl) return
        configuredBaseUrl = baseUrl
        repo = DiscoverRepository(baseUrl)
        loadHome()
    }

    fun setMediaType(type: String) {
        if (_mediaType.value == type) return
        _mediaType.value = type
        clearBrowse()
        loadHome()
    }

    private fun loadHome() {
        val r = repo ?: return
        val type = _mediaType.value
        _rowsLoading.value = true
        viewModelScope.launch {
            when (val res = r.rows(type)) {
                is ApiResult.Success -> _rows.value = res.data.rows
                else -> Unit
            }
            _rowsLoading.value = false
        }
        viewModelScope.launch {
            val real = (r.genres(type) as? ApiResult.Success)?.data.orEmpty()
                .map { DiscoverGenreOption(it.id.toString(), it.name) }
            // Synthetic genres first, exactly like desktop's dropdown order
            // (discover/page.tsx: synthGenres rendered before the real list).
            _genres.value = listOf(
                DiscoverGenreOption(ANIME_GENRE_ID, "Anime"),
                DiscoverGenreOption(TEEN_GENRE_ID, "Romance ado"),
            ) + real
        }
    }

    fun selectGenre(id: String?) {
        _selectedGenreId.value = id
        _activeRowKey.value = null
        _searchQuery.value = ""
        _rowMeta.value = null
        if (id == null) { _browseResults.value = emptyList(); return }
        loadBrowse(reset = true)
    }

    fun seeAllRow(key: String, meta: DiscoverRowMetaDto?) {
        _activeRowKey.value = key
        _selectedGenreId.value = null
        _searchQuery.value = ""
        _rowMeta.value = meta
        loadBrowse(reset = true)
    }

    fun updateSearchQuery(q: String) {
        _searchQuery.value = q
        _activeRowKey.value = null
        _selectedGenreId.value = null
        _rowMeta.value = null
        if (q.isBlank()) { _browseResults.value = emptyList(); return }
        loadBrowse(reset = true)
    }

    fun clearBrowse() {
        _selectedGenreId.value = null
        _activeRowKey.value = null
        _searchQuery.value = ""
        _rowMeta.value = null
        _browseResults.value = emptyList()
        _browsePage.value = 1
        _browseTotalPages.value = 1
    }

    fun loadMoreBrowse() {
        if (_browseLoadingMore.value || _browseLoading.value) return
        if (_browsePage.value >= _browseTotalPages.value) return
        loadBrowse(reset = false)
    }

    fun retryBrowse() = loadBrowse(reset = _browseResults.value.isEmpty())

    private fun loadBrowse(reset: Boolean) {
        val r = repo ?: return
        val type = _mediaType.value
        val targetPage = if (reset) 1 else _browsePage.value + 1
        val rowKey = _activeRowKey.value
        val genreId = _selectedGenreId.value
        val query = _searchQuery.value.trim()
        if (reset) _browseLoading.value = true else _browseLoadingMore.value = true
        viewModelScope.launch {
            val result = when {
                rowKey != null -> r.rowPage(type, rowKey, targetPage)
                query.isNotBlank() -> r.search(query, type, targetPage)
                else -> r.browse(type, genreId, targetPage)
            }
            when (result) {
                is ApiResult.Success -> {
                    val d = result.data
                    _browseResults.value = if (reset) d.results else _browseResults.value + d.results
                    _browsePage.value = d.page
                    _browseTotalPages.value = d.totalPages
                    if (reset && d.meta != null) _rowMeta.value = d.meta
                }
                else -> Unit
            }
            _browseLoading.value = false
            _browseLoadingMore.value = false
        }
    }
}
