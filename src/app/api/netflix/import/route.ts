import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { importNetflixHistory } from "@/lib/netflix/importHistory";

export const dynamic = "force-dynamic";

// Netflix's own export can run to several thousand rows for a long-time
// account, but the file itself is plain text (title,date) — this is a
// generous ceiling against abuse, not a realistic size.
const MAX_CSV_LENGTH = 5 * 1024 * 1024;

/**
 * Netflix → Movviz (demande explicite user). Strictly per-user: the CSV the
 * caller uploads is only ever matched against THEIR OWN watched status
 * (requireUser → user.id), never mixed with another account's — same
 * isolation guarantee as everything else keyed on watchStore.ts.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv) return NextResponse.json({ error: "csv_required" }, { status: 400 });
  if (csv.length > MAX_CSV_LENGTH) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const result = await importNetflixHistory(user, csv);
  return NextResponse.json(result);
}
