import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { getSeries, updateSeries, removeSeries } from "@/lib/library/store";
import { requireUser } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity/store";
import { emitNotification } from "@/lib/notifications/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { trashSeriesFiles } from "@/lib/library/trashDelete";
import { addTrashEntry } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const series = getSeries((await params).id);
  if (!series) return NextResponse.json({ error: "not found" }, { status: 404 });
  const cfg = loadPlexConfig();
  const urlFor = (ratingKey: string | null) => (ratingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, ratingKey) : null);
  const seasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((ep) => ({ ...ep, plexUrl: urlFor(ep.plexRatingKey) })),
  }));
  return NextResponse.json({ ...series, seasons, plexUrl: urlFor(series.plexRatingKey) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const patch = await req.json();
  const allowed = ["monitored", "qualityProfileId", "tags"] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const updated = updateSeries((await params).id, clean);
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = (await params).id;
  const series = getSeries(id);
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
      series?.seasons.forEach((s) => {
        s.episodes.forEach((ep) => {
          if (ep.file?.path) {
            const dir = ep.file.path.split(/[/\\]/).slice(0, -1).join("/");
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        });
      });
    }
  }
  removeSeries(id);
  if (series) {
    logActivity("removed", user.username, series.title, null);
    if (deleteFiles) emitNotification("library_item_deleted", `${series.title} supprimé de la bibliothèque`, "/library", { title: series.title });
  }
  return NextResponse.json({ removed: true, filesDeleted: deleteFiles });
}
