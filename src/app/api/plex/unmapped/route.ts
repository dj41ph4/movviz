import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeriesByTmdbId, updateSeries } from "@/lib/library/store";
import { requestMedia } from "@/lib/requests/requestMedia";
import { reconcileSeriesPlayback } from "@/lib/plex/librarySync";
import { loadUnmappedRegistry, removeUnmappedShows, setShowsDismissed } from "@/lib/plex/unmappedEpisodes";

export const dynamic = "force-dynamic";

/**
 * Épisodes vus dans Plex mais sans fiche dans la bibliothèque Movviz, regroupés par série.
 * Liste en lecture ; aucune série n'est ajoutée sans une action explicite de l'administrateur.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const shows = Object.values(loadUnmappedRegistry().shows)
    .map((show) => {
      const inLibrary = show.tmdbId != null ? getSeriesByTmdbId(show.tmdbId) : null;
      return {
        showKey: show.showKey,
        title: show.showTitle,
        tmdbId: show.tmdbId,
        episodeCount: show.episodes.length,
        // Aperçu : les premiers épisodes seulement, pour garder la liste légère.
        episodes: show.episodes.slice(0, 5).map((e) => ({ season: e.season, episode: e.episode, title: e.title })),
        // absent : la série n'est pas dans Movviz · linked : elle y est mais ces épisodes ne sont pas reliés à Plex
        // · unmatched : Plex ne l'a pas associée à TMDb, impossible de l'ajouter d'ici.
        status: show.tmdbId == null ? ("unmatched" as const) : inLibrary ? ("linkable" as const) : ("absent" as const),
        dismissed: show.dismissed,
        firstSeenAt: show.firstSeenAt,
      };
    })
    .sort((a, b) => Number(a.dismissed) - Number(b.dismissed) || a.title.localeCompare(b.title));
  return NextResponse.json({ shows });
}

type Action = "add" | "link" | "dismiss" | "restore";
type ShowResult = { showKey: string; ok: boolean; error?: string };

/**
 * POST { action: "add" | "link" | "dismiss" | "restore", showKeys: string[] }
 * - add : ajoute la série à la bibliothèque (sans lancer de recherche de torrents), puis relie ses épisodes à Plex.
 * - link : la série est déjà dans Movviz ; relie ses épisodes à leurs fiches Plex.
 * - dismiss / restore : masque (ou réaffiche) la série dans la liste.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { action?: Action; showKeys?: unknown } | null;
  const action = body?.action;
  const showKeys = Array.isArray(body?.showKeys) ? body.showKeys.filter((k): k is string => typeof k === "string").slice(0, 100) : [];
  if (!action || !["add", "link", "dismiss", "restore"].includes(action) || showKeys.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (action === "dismiss" || action === "restore") {
    const changed = setShowsDismissed(showKeys, action === "dismiss");
    return NextResponse.json({ ok: true, changed });
  }

  const registry = loadUnmappedRegistry();
  const results: ShowResult[] = [];
  const done: string[] = [];
  for (const showKey of showKeys) {
    const show = registry.shows[showKey];
    if (!show) { results.push({ showKey, ok: false, error: "not_listed" }); continue; }
    if (show.tmdbId == null) { results.push({ showKey, ok: false, error: "no_tmdb_id" }); continue; }
    try {
      let series = getSeriesByTmdbId(show.tmdbId);
      if (action === "add" && !series) {
        const result = await requestMedia(admin, "series", show.tmdbId, undefined, undefined, { skipSearch: true });
        if ("blocked" in result) { results.push({ showKey, ok: false, error: "blocked" }); continue; }
        if ("error" in result) { results.push({ showKey, ok: false, error: String(result.error) }); continue; }
        series = getSeriesByTmdbId(show.tmdbId);
      }
      if (!series) { results.push({ showKey, ok: false, error: "not_in_library" }); continue; }
      // reconcileSeriesPlayback ne consulte Plex que pour une série qui porte sa clé Plex.
      if (!series.plexRatingKey) series = updateSeries(series.id, { plexRatingKey: showKey }) ?? series;
      await reconcileSeriesPlayback(series.id);
      results.push({ showKey, ok: true });
      done.push(showKey);
    } catch (error) {
      results.push({ showKey, ok: false, error: error instanceof Error ? error.message : "failed" });
    }
  }
  // Les séries traitées quittent la liste ; la prochaine synchro recalcule ce qui reste.
  if (done.length > 0) removeUnmappedShows(done);
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
