import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../android-tv-nx/app/src/main/kotlin/com/movviz/tv/${path}`, import.meta.url), "utf8");

test("TV input invalidates the search screen, not the whole navigation host", () => {
  const host = source("MainActivity.kt");
  assert.ok(host.includes('val searchQuery = remember { mutableStateOf("") }'));
  assert.ok(host.includes('if (newTab != HomeTab.SEARCH) searchQuery.value = ""'));
  assert.ok(!host.includes("searchQuery = searchQuery.value,"));
  assert.ok(source("ui/home/MainScreen.kt").includes("searchQuery: State<String>"));
});

test("TV search return restores one card target after lazy composition", () => {
  const screen = source("ui/search/SearchScreen.kt");
  assert.ok(screen.includes("rememberSaveable(query) { mutableStateOf<String?>(null) }"));
  assert.ok(screen.includes("if (!returningFromTitle) return@LaunchedEffect"));
  assert.ok(screen.includes("gridState.scrollToItem(index)"));
  assert.ok(screen.includes("if (index == 0) firstResultFocusRequester else returnResultFocusRequester"));
  assert.ok(screen.includes("if (returnResultKey != null) return@LaunchedEffect"));
});

test("TV season initially focuses header while retaining episode-return priority", () => {
  const detail = source("ui/title/TitleDetailScreen.kt");
  const initial = detail.slice(detail.indexOf("LaunchedEffect(season.seasonNumber, landingEpisode?.episodeNumber)"), detail.indexOf("val focusManager =", detail.indexOf("LaunchedEffect(season.seasonNumber, landingEpisode?.episodeNumber)")));
  assert.ok(initial.includes("seasonGridState.scrollToItem(0)"));
  assert.ok(initial.indexOf("primaryActionFocus,") < initial.indexOf("firstEpisodeFocus.requestFocus()"));
  assert.ok(detail.includes("lastOpenedEpisode?.let { episodeCardFocus[it] }"));
  assert.ok(detail.includes(".focusRestorer { lastOpenedEpisode?.let { episodeCardFocus[it] } ?: primaryActionFocus }"));
});

test("TV library matching runs off the UI thread and guards obsolete results", () => {
  const screen = source("ui/search/SearchScreen.kt");
  assert.ok(screen.includes("emptyList(), libraryMovies, librarySeries)"));
  assert.equal((screen.match(/withContext\(Dispatchers.Default\)/g) ?? []).length, 2);
  assert.ok(screen.includes("matchedLibrary.first == query && matchedLibrary.second == typeFilter"));
  assert.ok(screen.includes("it.normalizedTitle.contains(q)"));
  assert.ok(screen.includes("!it.normalizedTitle.startsWith(q)"));
  assert.ok(screen.includes("typeFilter.apiType == null || it.result.type == typeFilter.apiType"));
  assert.ok(screen.includes("delay(350); viewModel.search(query)"));
  assert.ok(screen.includes("seen.add"));
  assert.ok(screen.includes("firstResultFocusRequester"));
  assert.ok(screen.includes("searchWatchedMovieIds"));
});
