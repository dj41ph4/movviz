import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { startLifehubImportJob, getLifehubImportJob } from "@/lib/lifehub/importJobs";

export const dynamic = "force-dynamic";

const MAX_JSON_LENGTH = 10 * 1024 * 1024;

/** LifeHub → Movviz (demande explicite user). Per-user, background job —
 *  same contract as /api/netflix/import. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const json = typeof body?.json === "string" ? body.json : "";
  if (!json) return NextResponse.json({ error: "json_required" }, { status: 400 });
  if (json.length > MAX_JSON_LENGTH) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed?.titres)) throw new Error("bad");
  } catch {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const started = startLifehubImportJob(user, json);
  if (!started) return NextResponse.json({ error: "already_running" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ job: getLifehubImportJob(user.id) });
}
