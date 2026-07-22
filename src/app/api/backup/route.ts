import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

/** Every JSON store Movviz owns — the full configuration, in one exportable snapshot. */
const FILES = [
  "library-movies.json",
  "library-series.json",
  "requests.json",
  "watchlist.json",
  "users.json",
  "indexers.json",
  "naming.json",
  "tmdb.json",
  "webhook.json",
  "notifications.json",
  "tokens.json",
];

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const snapshot: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const file of FILES) {
    try {
      snapshot[file] = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, file), "utf8"));
    } catch {
      snapshot[file] = null;
    }
  }
  return NextResponse.json(snapshot, {
    headers: { "content-disposition": `attachment; filename="movviz-backup.json"` },
  });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid backup file" }, { status: 400 });

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  for (const file of FILES) {
    if (body[file] == null) continue;
    fs.writeFileSync(path.join(CONFIG_DIR, file), JSON.stringify(body[file], null, 2), "utf8");
  }
  return NextResponse.json({ ok: true });
}
