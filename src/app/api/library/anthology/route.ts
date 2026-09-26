import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { relocateAllAnthologies, type AnthologyMoveReport } from "@/lib/library/anthology";
import { refreshPlexLibraryFor } from "@/lib/plex/librarySync";

export const dynamic = "force-dynamic";

/** Admin: range maintenant les séries d'anthologie (Monster) là où Plex les
 *  attend, et renvoie le détail fichier par fichier. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const report: AnthologyMoveReport[] = [];
  const moved = await relocateAllAnthologies(report);
  if (moved) void refreshPlexLibraryFor("tv").catch(() => {});
  return NextResponse.json({ moved, report });
}
