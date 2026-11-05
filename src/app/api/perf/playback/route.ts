import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { recordSample, recordStall } from "@/lib/playbackTelemetry";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;

/** Lot de coupures et d'échantillons de tampon remontés par le lecteur. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const events = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const base = {
      t: num(e.t, 0, Date.now() + 60_000) || Date.now(),
      mode: str(e.mode, 24) || "?",
      device: str(e.device, 60) || "?",
      bufAhead: Math.round(num(e.bufAhead, 0, 36_000) * 10) / 10,
      pos: Math.round(num(e.pos, 0, 1_000_000)),
      net: str(e.net, 16) || null,
      sid: str(e.sid, 40) || null,
    };
    if (e.type === "stall") {
      const cause = e.cause === "stalled" || e.cause === "seek" ? e.cause : "waiting";
      recordStall({
        ...base,
        cause,
        ms: typeof e.ms === "number" && Number.isFinite(e.ms) ? Math.round(num(e.ms, 0, 3_600_000)) : null,
        readyState: num(e.readyState, 0, 4),
        networkState: num(e.networkState, 0, 3),
      });
    } else if (e.type === "sample") {
      recordSample(base);
    }
  }
  return NextResponse.json({ ok: true });
}
