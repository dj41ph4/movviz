import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { previewBleachRepair as preview, commitBleachRepair } from "@/lib/library/bleachRepairService";
import { withKeyLock } from "@/lib/library/locks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const plan = preview((await params).id);
  if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ...plan, next: undefined });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const { id } = await params;
  return withKeyLock(`series:${id}`, async () => {
    const plan = preview(id);
    if (!plan) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (body?.confirm !== true || body?.fingerprint !== plan.fingerprint) return NextResponse.json({ error: "preview_changed" }, { status: 409 });
    if (!plan.applicable) return NextResponse.json({ error: "repair_blocked", blockers: plan.blockers }, { status: 409 });
    // No awaits after the fingerprint check: update the cached library in the
    // same turn. The affected user states all retain their exact identities.
    const snapshot = commitBleachRepair(plan);
    return NextResponse.json({ ok: true, snapshot, preservedFiles: plan.preservedFiles, preservedTracking: plan.preservedTracking });
  });
}
