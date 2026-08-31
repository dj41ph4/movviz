import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import {
  getIndexImportResults, isIndexImportRunning, getLatestIndexImportJob, startIndexImport,
  type IndexImportItem,
} from "@/lib/library/indexImport";

export const dynamic = "force-dynamic";

function parseType(value: unknown): "movie" | "series" | null {
  return value === "movie" || value === "series" ? value : null;
}

/** Status + per-item results of the last (or in-progress) bulk link-existing-files import. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const type = parseType(req.nextUrl.searchParams.get("type"));
  if (!type) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const job = getLatestIndexImportJob(type);
  return NextResponse.json({
    running: isIndexImportRunning(type),
    current: job?.current ?? 0,
    total: job?.total ?? 0,
    results: getIndexImportResults(type),
  });
}

/** Links the selected scanned folders into the library (creating or filling in existing entries) — no indexer search, the file is already on disk. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const type = parseType(body.type);
  const items: IndexImportItem[] = Array.isArray(body.items)
    ? body.items.filter((i: unknown): i is IndexImportItem =>
        !!i && typeof i === "object" && typeof (i as IndexImportItem).candidateId === "string" && typeof (i as IndexImportItem).tmdbId === "number"
      )
    : [];
  if (!type || items.length === 0) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  if (isIndexImportRunning(type)) return NextResponse.json({ queued: true });
  startIndexImport(type, items, typeof body.qualityProfileId === "string" ? body.qualityProfileId : undefined, body.monitored !== false);
  return NextResponse.json({ queued: true });
}
