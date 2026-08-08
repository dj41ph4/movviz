import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getLibrarySections, getSectionRawItems, resolveTmdbIdForDebug } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/**
 * Diagnostic Plex — montre ce que le serveur rapporte réellement pour un
 * titre (GUIDs bruts + tmdbId résolu) afin d'expliquer pourquoi une série
 * n'est pas liée par la synchronisation.
 *
 * GET /api/plex/diagnostic?title=Le%20coeur%20a%20ses%20raisons
 */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const title = (req.nextUrl.searchParams.get("title") ?? "").toLowerCase().trim();
  if (!title) return NextResponse.json({ error: "missing_title" }, { status: 400 });

  const sections = await getLibrarySections(cfg, cfg.adminToken);
  const items: unknown[] = [];

  for (const section of sections) {
    try {
      const raw = await getSectionRawItems(cfg, section.key, cfg.adminToken);
      for (const item of raw) {
        if (!item.title.toLowerCase().includes(title)) continue;
        items.push({
          section: section.title,
          type: item.type ?? "unknown",
          title: item.title,
          year: item.year ?? null,
          ratingKey: item.ratingKey,
          guid: item.guid ?? null,
          guidArray: (item.Guid ?? []).map((g) => g.id),
          resolvedTmdbId: await resolveTmdbIdForDebug(item.Guid, item.guid, item.type === "show" ? "series" : "movie"),
        });
      }
    } catch {
      // section inaccessible — on passe
    }
  }

  return NextResponse.json({ items });
}
