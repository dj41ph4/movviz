import { NextRequest, NextResponse } from "next/server";
import { loadSeries } from "@/lib/library/store";
import { requireUser } from "@/lib/auth/guard";
import { requestMedia } from "@/lib/requests/requestMedia";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { loadTrash } from "@/lib/library/trashStore";
import { scheduleSeriesPlaybackReconcile } from "@/lib/plex/librarySync";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { projectBleachLibrary } from "@/lib/metadata/bleachPresentation";
import { parseBleachSeriesPart } from "@/lib/library/bleachScope";
import { ensureBleachRepaired } from "@/lib/library/bleachRepairService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tmdbIdFilter = Number(req.nextUrl.searchParams.get("tmdbId")) || null;
  const bleach = !tmdbIdFilter || tmdbIdFilter === BLEACH_TMDB_ID ? loadSeries().find(s => s.tmdbId === BLEACH_TMDB_ID) : undefined;
  if (bleach) await ensureBleachRepaired(bleach.id);
  const cfg = loadPlexConfig();
  const urlFor = (ratingKey: string | null) => (ratingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, ratingKey) : null);
  // A title page only ever needs its own single match — fetching the whole
  // library (every series, full season/episode structures) just to .find()
  // one by tmdbId client-side was the actual cause of "why does this page
  // take forever to know if the title is already in the library". Optional
  // filter, additive: omitting tmdbId keeps returning the full list for
  // callers that need it (the Bibliothèque page itself).
  const tmdbIdParam = req.nextUrl.searchParams.get("tmdbId");
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : null;
  const partParam = req.nextUrl.searchParams.get("seriesPart");
  const seriesPart = parseBleachSeriesPart(partParam);
  if (partParam != null && (!seriesPart || tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  let reconciling = false;
  if (tmdbId) {
    // À l'ouverture d'une cible, vérifier uniquement cette série. Cela répare
    // un épisode remplacé sans réconciliation globale ni redémarrage — mais en
    // arrière-plan : la fiche répond tout de suite avec l'état local au lieu
    // d'attendre Plex (jusqu'à ~14 s pour Bleach), puis relit `reconciling`.
    const target = loadSeries().find((s) => s.tmdbId === tmdbId);
    if (target) reconciling = scheduleSeriesPlaybackReconcile(target.id);
  }
  const all = tmdbId ? loadSeries().filter((s) => s.tmdbId === tmdbId) : loadSeries();
  const views = all.flatMap(s => s.tmdbId === BLEACH_TMDB_ID && (seriesPart || req.nextUrl.searchParams.get("partViews") === "1")
    ? (seriesPart ? [seriesPart] : ["original", "tybw"] as const).map(part => ({ ...projectBleachLibrary(s, part), bleachRepairRequired: needsBleachRepair(s) }))
    : [s]);
  const series = views.map((s) => ({
    ...s,
    ...(s.bleachPlexKeys ? { bleachPlexUrls: Object.fromEntries(Object.entries(s.bleachPlexKeys).map(([part, key]) => [part, urlFor(key ?? null)])) } : {}),
    // The title panel needs the exact episode URL to launch a selected
    // episode directly. This is additive to the existing response and
    // mirrors the single-series route below; it never changes a Plex link
    // already used by another client.
    seasons: s.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((episode) => ({
        ...episode,
        plexUrl: urlFor(episode.plexRatingKey),
      })),
    })),
    playable: s.seasons.some((season) => season.episodes.some((ep) => ep.status === "available" && !!ep.file)),
    playbackSource: s.seasons.some((season) => season.episodes.some((ep) => ep.status === "available" && !!ep.file)) ? "movviz" as const : (s.plexRatingKey ? "plex" as const : null),
    plexUrl: urlFor(s.plexRatingKey),
  }));
  const readdable = !!tmdbId && loadTrash().some((t) => t.type === "series" && t.tmdbId === tmdbId);
  return NextResponse.json({ series, readdable, reconciling });
}

/** Same auto-approve/pending-request split as movies (see /api/library/movies). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const tmdbId = Number(body.tmdbId);
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
  const seriesPart = parseBleachSeriesPart(body.seriesPart);
  if (body.seriesPart != null && (!seriesPart || tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });

  const result = await requestMedia(user, "series", tmdbId, body.qualityProfileId, body.seasonNumbers, { skipSearch: body.skipSearch === true, queueSearch: true, seriesPart: seriesPart ?? undefined });
  if ("blocked" in result) return NextResponse.json(result, { status: 403 });
  if ("quotaReached" in result) return NextResponse.json(result, { status: 429 });
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  if ("alreadyInLibrary" in result) return NextResponse.json(result, { status: 200 });
  if ("duplicateRequest" in result) return NextResponse.json(result, { status: 200 });
  if ("added" in result) return NextResponse.json({ ...result.added, searchResult: result.searchResult, readded: result.readded === true }, { status: 201 });
  return NextResponse.json({ pendingRequest: result.pendingRequest }, { status: 202 });
}
