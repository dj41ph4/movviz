import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { aggregatePerf, recordPerf, perfLabel, getPerfEntries } from "@/lib/perf";

export const dynamic = "force-dynamic";

/** Aggregated request timings for the Diagnostics panel. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  if (searchParams.has("errors")) {
    const label = searchParams.get("label") || undefined;
    const kind = searchParams.get("kind") as "client" | "outbound" | undefined;
    const entries = getPerfEntries().filter((e) => {
      if (e.status === null || e.status < 400) return false;
      if (kind && e.kind !== kind) return false;
      if (label && e.label !== label) return false;
      return true;
    });
    return NextResponse.json({ entries });
  }
  return NextResponse.json({ aggregates: aggregatePerf() });
}

/** Batch of client-side measurements reported by PerfReporter. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  for (const e of entries.slice(0, 200)) {
    if (typeof e?.label !== "string" || typeof e?.ms !== "number") continue;
    recordPerf({
      t: typeof e.t === "number" ? e.t : Date.now(),
      kind: "client",
      label: perfLabel(e.label),
      ms: Math.max(0, Math.round(e.ms)),
      status: typeof e.status === "number" ? e.status : null,
    });
  }
  return NextResponse.json({ ok: true });
}
