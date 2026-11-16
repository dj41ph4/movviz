package com.movviz.nx.mobile.data

/*
 * « Récemment ajouté » : un titre y entre à son PREMIER téléchargement — un
 * film à l'arrivée de son fichier, une série à l'arrivée de son premier
 * épisode — même s'il était déjà dans la bibliothèque comme manquant. Un
 * nouvel épisode d'une série déjà présente ne la fait pas remonter : il va
 * dans « Épisodes récemment ajoutés ». Même règle que le web
 * (src/lib/dashboard/recentlyAdded.ts) et que Tizen.
 */

fun LibraryMovieDto.recentlyAddedAt(): Long =
    latestAvailableAt.takeIf { it > 0L } ?: file?.addedAt?.takeIf { it > 0L } ?: addedAt

fun LibrarySeriesDto.recentlyAddedAt(): Long =
    firstAvailableAt.takeIf { it > 0L } ?: addedAt
