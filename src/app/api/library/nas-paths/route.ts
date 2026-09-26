import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { toPlexSidePath } from "@/lib/plex/pathMappingStore";

export const dynamic = "force-dynamic";

/** Admin: Movviz paths (inside its container) → the paths the NAS/Plex see.
 *  GET /api/library/nas-paths?p=/data/série/X&p=… → { paths: { "/data/…": "/volume1/…" } } */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const paths = req.nextUrl.searchParams.getAll("p").slice(0, 200);
  return NextResponse.json({ paths: Object.fromEntries(paths.map((p) => [p, toPlexSidePath(p)])) });
}
