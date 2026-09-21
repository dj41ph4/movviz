from pathlib import Path

TV = Path("android-tv-nx/app/src/main/kotlin/com/movviz/tv/ui/title/TitleDetailScreen.kt")
MOBILE = Path("android-mobile-nx/app/src/main/kotlin/com/movviz/nx/mobile/ui/title/TitleDetailScreen.kt")
README = Path("README.md")
CHANGELOG = Path("CHANGELOG.md")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_in_section(text: str, start_marker: str, end_marker: str, old: str, new: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker not found")
    section = text[start:end]
    section = replace_once(section, old, new, label)
    return text[:start] + section + text[end:]


def patch_tv() -> None:
    text = TV.read_text(encoding="utf-8")

    # Parent wiring: keep the existing season-wide callback, add an explicit
    # single-episode callback that reuses AppViewModel.toggleEpisodeWatched().
    old_parent = '''                onToggleEpisodesWatched = { episodes, watched ->
                    viewModel.toggleEpisodesWatched(tmdbId, d.title, episodes, watched, scope = "season", season = openSeason.seasonNumber)
                },
                onPlayEpisode = { episode ->'''
    new_parent = '''                onToggleEpisodesWatched = { episodes, watched ->
                    viewModel.toggleEpisodesWatched(tmdbId, d.title, episodes, watched, scope = "season", season = openSeason.seasonNumber)
                },
                onToggleEpisodeWatched = { episodeNumber, watched ->
                    viewModel.toggleEpisodeWatched(tmdbId, d.title, openSeason.seasonNumber, episodeNumber, watched)
                },
                onPlayEpisode = { episode ->'''
    text = replace_once(text, old_parent, new_parent, "TV parent episode callback")

    # Episode detail overlay was explicitly passing scope=season for ONE episode.
    old_detail = '''                onToggleWatched = { watched ->
                    viewModel.toggleEpisodesWatched(
                        tmdbId,
                        d.title,
                        listOf(com.movviz.tv.data.WatchToggleEpisodeDto(selection.season.seasonNumber, selection.episode.episodeNumber)),
                        watched,
                        scope = "season",
                        season = selection.season.seasonNumber,
                    )
                },'''
    new_detail = '''                onToggleWatched = { watched ->
                    viewModel.toggleEpisodeWatched(
                        tmdbId,
                        d.title,
                        selection.season.seasonNumber,
                        selection.episode.episodeNumber,
                        watched,
                    )
                },'''
    text = replace_once(text, old_detail, new_detail, "TV episode detail toggle")

    # SeasonPageOverlay gets two semantic actions instead of routing both
    # through the season-wide callback.
    old_sig = '''    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.tv.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onPlayEpisode: (SeriesEpisodeDto) -> Unit,'''
    new_sig = '''    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.tv.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onToggleEpisodeWatched: (Int, Boolean) -> Unit,
    onPlayEpisode: (SeriesEpisodeDto) -> Unit,'''
    text = replace_in_section(
        text,
        "private fun SeasonPageOverlay(",
        "private fun SeasonPageHeader(",
        old_sig,
        new_sig,
        "TV SeasonPageOverlay signature",
    )

    old_card = '''                        onToggleWatched = { watched ->
                            onToggleEpisodesWatched(listOf(com.movviz.tv.data.WatchToggleEpisodeDto(season.seasonNumber, episode.episodeNumber)), watched)
                        },'''
    new_card = '''                        onToggleWatched = { watched ->
                            onToggleEpisodeWatched(episode.episodeNumber, watched)
                        },'''
    text = replace_in_section(
        text,
        "private fun SeasonPageOverlay(",
        "private fun SeasonPageHeader(",
        old_card,
        new_card,
        "TV episode grid toggle",
    )

    # Guard the intended semantics: season-wide action remains in the header.
    overlay_start = text.index("private fun SeasonPageOverlay(")
    header_start = text.index("private fun SeasonPageHeader(", overlay_start)
    overlay = text[overlay_start:header_start]
    if "onToggleEpisodeWatched(episode.episodeNumber, watched)" not in overlay:
        raise SystemExit("TV guard: single episode route missing")
    if "onToggleEpisodesWatched(listOf" in overlay:
        raise SystemExit("TV guard: episode grid still uses season callback")
    if 'scope = "season"' in text[text.index("selectedEpisode?.let"):text.index("/** Distribution", text.index("selectedEpisode?.let"))]:
        raise SystemExit("TV guard: episode detail still carries season scope")

    TV.write_text(text, encoding="utf-8")


def patch_mobile() -> None:
    text = MOBILE.read_text(encoding="utf-8")

    old_parent = '''                onToggleEpisodesWatched = { episodes, watched ->
                    viewModel.toggleEpisodesWatched(tmdbId, d.title, episodes, watched, scope = "season", season = openSeason.seasonNumber)
                },
                onOpenEpisode = { episode, metadataEpisode ->'''
    new_parent = '''                onToggleEpisodesWatched = { episodes, watched ->
                    viewModel.toggleEpisodesWatched(tmdbId, d.title, episodes, watched, scope = "season", season = openSeason.seasonNumber)
                },
                onToggleEpisodeWatched = { episodeNumber, watched ->
                    viewModel.toggleEpisodeWatched(tmdbId, d.title, openSeason.seasonNumber, episodeNumber, watched)
                },
                onOpenEpisode = { episode, metadataEpisode ->'''
    text = replace_once(text, old_parent, new_parent, "Mobile parent episode callback")

    old_sig = '''    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.nx.mobile.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onOpenEpisode: (SeriesEpisodeDto, MetadataEpisodeDto?) -> Unit,'''
    new_sig = '''    onDownloadSeason: () -> Unit,
    onToggleEpisodesWatched: (List<com.movviz.nx.mobile.data.WatchToggleEpisodeDto>, Boolean) -> Unit,
    onToggleEpisodeWatched: (Int, Boolean) -> Unit,
    onOpenEpisode: (SeriesEpisodeDto, MetadataEpisodeDto?) -> Unit,'''
    text = replace_in_section(
        text,
        "private fun SeasonPageOverlay(",
        "/** Liste d'épisodes d'une saison",
        old_sig,
        new_sig,
        "Mobile SeasonPageOverlay signature",
    )

    old_card = '''                onToggleWatched = { watched ->
                    onToggleEpisodesWatched(listOf(com.movviz.nx.mobile.data.WatchToggleEpisodeDto(season.seasonNumber, episode.episodeNumber)), watched)
                },'''
    new_card = '''                onToggleWatched = { watched ->
                    onToggleEpisodeWatched(episode.episodeNumber, watched)
                },'''
    text = replace_in_section(
        text,
        "private fun SeasonPageOverlay(",
        "/** Liste d'épisodes d'une saison",
        old_card,
        new_card,
        "Mobile episode card toggle",
    )

    overlay_start = text.index("private fun SeasonPageOverlay(")
    overlay_end = text.index("/** Liste d'épisodes d'une saison", overlay_start)
    overlay = text[overlay_start:overlay_end]
    if "onToggleEpisodeWatched(episode.episodeNumber, watched)" not in overlay:
        raise SystemExit("Mobile guard: single episode route missing")
    if "onToggleEpisodesWatched(listOf" in overlay:
        raise SystemExit("Mobile guard: episode row still uses season callback")

    MOBILE.write_text(text, encoding="utf-8")


def patch_docs() -> None:
    readme = README.read_text(encoding="utf-8")
    readme = readme.replace("version-1.25.53-a855f7", "version-1.25.54-a855f7")
    readme = readme.replace("Version 1.25.53", "Version 1.25.54")
    README.write_text(readme, encoding="utf-8")

    changelog = CHANGELOG.read_text(encoding="utf-8")
    if changelog.startswith("## v1.25.54"):
        raise SystemExit("CHANGELOG already contains v1.25.54")
    entry = """## v1.25.54 — September 2026

### Android TV / Mobile NX : le statut Vu reste attaché à l'épisode

- La coche « Vu » d'un épisode passait par le callback de saison et envoyait `scope=\"season\"` à `/api/watch/toggle`. Le serveur faisait donc exactement ce qui lui était demandé : il étendait l'action à tous les épisodes connus de la saison.
- Les actions unitaires TV et mobile réutilisent désormais `toggleEpisodeWatched(...)`, déjà présent dans les ViewModels et équivalent au comportement desktop : un seul épisode est envoyé, sans scope.
- Les vrais boutons « Marquer la saison vue » conservent `toggleEpisodesWatched(..., scope=\"season\")` et « Marquer toute la série vue » conserve `scope=\"series\"`. Aucun endpoint ni comportement serveur n'a été réinventé.

"""
    CHANGELOG.write_text(entry + changelog, encoding="utf-8")


patch_tv()
patch_mobile()
patch_docs()
print("Episode watch scope repaired for Android TV and Mobile NX")
