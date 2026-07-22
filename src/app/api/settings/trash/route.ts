import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getTrashConfig, setTrashConfig, loadTrashManifest } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ...getTrashConfig(), itemCount: loadTrashManifest().length });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const patch: { moviesPath?: string | null; seriesPath?: string | null; retentionDays?: number } = {};
  if ("moviesPath" in body) patch.moviesPath = typeof body.moviesPath === "string" && body.moviesPath.trim() ? body.moviesPath.trim() : null;
  if ("seriesPath" in body) patch.seriesPath = typeof body.seriesPath === "string" && body.seriesPath.trim() ? body.seriesPath.trim() : null;
  if ("retentionDays" in body) {
    const n = Number(body.retentionDays);
    if (Number.isFinite(n) && n >= 1) patch.retentionDays = Math.round(n);
  }
  return NextResponse.json({ ...setTrashConfig(patch), itemCount: loadTrashManifest().length });
}
