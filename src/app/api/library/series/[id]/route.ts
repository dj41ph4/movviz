import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getSeries, updateSeries, removeSeries } from "@/lib/library/store";
import { requireUser, requireAdmin } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity/store";
import { emitNotification } from "@/lib/notifications/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { trashSeriesFiles } from "@/lib/library/trashDelete";
import { addTrashEntry } from "@/lib/library/trashStore";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { parseBleachSeriesPart, bleachEpisodeInScope } from "@/lib/library/bleachScope";
import { patchBleachArtwork, type BleachArtworkSelection } from "@/lib/metadata/bleachArtwork";
import { projectBleachLibrary } from "@/lib/metadata/bleachPresentation";
import { withKeyLock } from "@/lib/library/locks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const stored = getSeries((await params).id);
  if (!stored) return NextResponse.json({ error: "not found" }, { status: 404 });
  const partParam = req.nextUrl.searchParams.get("seriesPart");
  const seriesPart = parseBleachSeriesPart(partParam);
  if (partParam != null && (!seriesPart || stored.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  const series = seriesPart ? { ...projectBleachLibrary(stored, seriesPart), bleachRepairRequired: needsBleachRepair(stored) } : stored;
  const cfg = loadPlexConfig();
  const urlFor = (ratingKey: string | null) => (ratingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, ratingKey) : null);
  const seasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((ep) => ({ ...ep, plexUrl: urlFor(ep.plexRatingKey) })),
  }));
  return NextResponse.json({ ...series, ...(series.bleachPlexKeys ? { bleachPlexUrls: Object.fromEntries(Object.entries(series.bleachPlexKeys).map(([part, key]) => [part, urlFor(key ?? null)])) } : {}), seasons, plexUrl: urlFor(series.plexRatingKey) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const patch = await req.json();
  const id = (await params).id;
  return withKeyLock(`series:${id}`, async () => {
    const current = getSeries(id);
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    const seriesPart = parseBleachSeriesPart(patch.seriesPart);
    if (patch.seriesPart != null && (!seriesPart || current.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
    const allowed = ["monitored", "qualityProfileId", "aliases", "customBackdropPath", "customLogoPath"] as const;
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    // See the movie route: aliases feeds release matching, so it's validated
    // rather than passed through raw.
    if ("aliases" in clean) {
      if (!Array.isArray(clean.aliases)) delete clean.aliases;
      else clean.aliases = (clean.aliases as unknown[]).filter((a): a is string => typeof a === "string" && a.trim() !== "").map((a) => a.trim());
    }
    // TMDb image file_path only ("/abc123.jpg") — see the movie route for why.
    for (const k of ["customBackdropPath", "customLogoPath"] as const) {
      if (k in clean && clean[k] !== null && !(typeof clean[k] === "string" && /^\/[\w.-]+\.(jpg|jpeg|png|svg)$/i.test(clean[k] as string))) {
        delete clean[k];
      }
    }
    if (seriesPart) {
      const preferences: { qualityProfileId?: string; aliases?: string[] } = {};
      if (typeof clean.qualityProfileId === "string") { preferences.qualityProfileId = clean.qualityProfileId; delete clean.qualityProfileId; }
      if (Array.isArray(clean.aliases)) { preferences.aliases = clean.aliases as string[]; delete clean.aliases; }
      if (Object.keys(preferences).length) clean.bleachSettings = { ...current.bleachSettings, [seriesPart]: { ...current.bleachSettings?.[seriesPart], ...preferences } };
      const artwork: BleachArtworkSelection = {};
      for (const key of ["customBackdropPath", "customLogoPath"] as const) {
        if (key in clean) { artwork[key] = clean[key] as string | null; delete clean[key]; }
      }
      if (Object.keys(artwork).length) clean.bleachArtwork = patchBleachArtwork(current.bleachArtwork, seriesPart, artwork);
    }
    if (seriesPart && typeof patch.monitored === "boolean") {
      if (needsBleachRepair(current)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });
      const seasons = current.seasons.map(s => ({ ...s, monitored: s.episodes.some(e => bleachEpisodeInScope(s.seasonNumber, e.episodeNumber, seriesPart)) ? patch.monitored : s.monitored,
        episodes: s.episodes.map(e => bleachEpisodeInScope(s.seasonNumber, e.episodeNumber, seriesPart) ? { ...e, monitored: patch.monitored } : e) }));
      clean.seasons = seasons;
      clean.monitored = seasons.some(s => s.monitored);
    }
    const updated = updateSeries(id, clean);
    return updated ? NextResponse.json(updated) : NextResponse.json({ error: "not found" }, { status: 404 });
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = (await params).id;
  const stored = getSeries(id);
  const partParam = req.nextUrl.searchParams.get("seriesPart") ?? req.nextUrl.searchParams.get("part");
  const part = parseBleachSeriesPart(partParam);
  if (partParam != null && (!part || stored?.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  const series = stored && part ? { ...stored, seasons: stored.seasons.filter(s => part === "tybw" ? s.seasonNumber === 17 : s.seasonNumber < 17) } : stored;
  if (part && series && needsBleachRepair(series) && needsBleachRepair(stored!)) return NextResponse.json({ error: "bleach_repair_required" }, { status: 409 });
  const deleteFiles = req.nextUrl.searchParams.get("deleteFiles") === "true";
  if (deleteFiles) {
    const paths = new Set<string>();
    for (const season of series?.seasons ?? []) {
      for (const ep of season.episodes) {
        if (ep.file?.path) paths.add(ep.file.path);
      }
    }

    // Trash (when configured) always wins over a permanent delete — moving
    // must succeed before the library record is removed, so a failed move
    // surfaces as an error instead of silently leaving files behind while
    // the app thinks they're gone. See trashMovieFile's comment for why.
    let trashedTo: string[];
    try {
      trashedTo = await trashSeriesFiles([...paths]);
    } catch (err) {
      return NextResponse.json({ error: "trash_failed", detail: (err as Error).message }, { status: 500 });
    }

    if (trashedTo.length > 0) {
      trashedTo.forEach((trashPath, i) => {
        addTrashEntry({ id: `${id}:${i}`, kind: "series", title: series!.title, trashPath, deletedAt: Date.now() });
      });
    } else if (paths.size > 0) {
      for (const p of paths) { try { fs.unlinkSync(p); } catch { /* already gone */ } }
      const cleanedDirs = new Set<string>();
      series?.seasons.forEach((s) => {
        s.episodes.forEach((ep) => {
          if (ep.file?.path) {
            const dir = path.resolve(path.dirname(ep.file.path));
            // Safety: only delete directories that are at least 3 levels deep
            // (e.g. /data/tv/ShowName/Season01) to prevent accidental root wipes.
            const depth = dir.split(path.sep).filter(Boolean).length;
            if (depth >= 3) {
              cleanedDirs.add(dir);
            }
          }
        });
      });
      for (const dir of cleanedDirs) {
        try { fs.rmdirSync(dir); } catch { /* Keep directories containing unrelated files. */ }
      }
    }
  }
  const remaining = part && stored ? stored.seasons.filter(s => part === "tybw" ? s.seasonNumber !== 17 : s.seasonNumber >= 17) : [];
  if (part && remaining.length) updateSeries(id, { seasons: remaining, episodeOrder: "tvdb", monitored: remaining.some(s => s.monitored) });
  else removeSeries(id);
  if (series) {
    logActivity("removed", user.username, series.title, null);
    if (deleteFiles) emitNotification("library_item_deleted", `${series.title} supprimé de la bibliothèque`, "/library", { title: series.title });
  }
  return NextResponse.json({ removed: true, filesDeleted: deleteFiles });
}
