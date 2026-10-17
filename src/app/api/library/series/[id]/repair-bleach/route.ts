import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries, updateSeries } from "@/lib/library/store";
import { planBleachRepair } from "@/lib/library/bleachRepair";
import { inspectBleachRepairState } from "@/lib/library/bleachRepairState";
import { withKeyLock } from "@/lib/library/locks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function preview(id: string) {
  const series = getSeries(id);
  if (!series) return null;
  const state = inspectBleachRepairState(id, series.seasons.flatMap((s) => s.episodes.map((e) => e.plexRatingKey).filter((key): key is string => !!key)));
  const plan = planBleachRepair(series, state.tracked, state.fingerprint);
  plan.blockers.push(...state.blockers);
  plan.applicable = plan.blockers.length === 0;
  return plan;
}

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
    const dir = path.join(process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"), "repair-snapshots");
    fs.mkdirSync(dir, { recursive: true });
    const snapshot = `bleach-${Date.now()}-${plan.fingerprint.slice(0, 12)}.json`;
    fs.writeFileSync(path.join(dir, snapshot), JSON.stringify({ series: getSeries(id), plan: { ...plan, next: undefined }, createdAt: Date.now() }), { encoding: "utf8", flag: "wx" });
    updateSeries(id, { seasons: plan.next.seasons, episodeOrder: "tvdb" });
    return NextResponse.json({ ok: true, snapshot, preservedFiles: plan.preservedFiles, preservedTracking: plan.preservedTracking });
  });
}
