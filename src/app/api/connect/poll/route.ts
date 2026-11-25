import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { waitCommands } from "@/lib/connect/registry";
import { DEVICE_ID_RE } from "@/lib/connect/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Attente longue (20 s) des ordres Connect, pour les appareils sans flux temps réel (TV Samsung). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const device = req.nextUrl.searchParams.get("device") ?? "";
  if (!DEVICE_ID_RE.test(device)) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw !== null && /^\d{1,12}$/.test(afterRaw) ? Number(afterRaw) : null;
  const result = await waitCommands(user.id, device, after, 20_000, req.signal);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
