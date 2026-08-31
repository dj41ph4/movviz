import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { engineRoots } from "@/lib/library/indexScan";
import { scanEmptyDirs, deleteEmptyDirs } from "@/lib/library/cleanDirs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const movieRoots = await engineRoots("movie");
  const seriesRoots = await engineRoots("series");
  const allRoots = [...new Set([...movieRoots, ...seriesRoots])];

  const emptyDirs = scanEmptyDirs(allRoots);
  return NextResponse.json({ emptyDirs });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const paths = body.paths as string[] | undefined;
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 });
  }

  const result = deleteEmptyDirs(paths);
  return NextResponse.json(result);
}
