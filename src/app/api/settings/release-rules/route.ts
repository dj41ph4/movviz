import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadReleaseRules, saveReleaseRules } from "@/lib/library/releaseRules";
import { markWizardWritten, markManuallyEdited, type WizardTrackedField } from "@/lib/setup/wizardProvenance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadReleaseRules());
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.blockedWords)) {
    patch.blockedWords = body.blockedWords.map((w: unknown) => String(w).trim()).filter(Boolean);
  }
  for (const key of ["maxMovieSizeMb", "maxEpisodeSizeMb", "maxSeasonSizeMb"] as const) {
    if (key in body) patch[key] = body[key] == null ? null : Math.max(0, Number(body[key])) || null;
  }
  if (body.codecScores && typeof body.codecScores === "object") {
    const cur = loadReleaseRules().codecScores;
    patch.codecScores = {
      x264: Number.isFinite(body.codecScores.x264) ? Number(body.codecScores.x264) : cur.x264,
      x265: Number.isFinite(body.codecScores.x265) ? Number(body.codecScores.x265) : cur.x265,
      av1: Number.isFinite(body.codecScores.av1) ? Number(body.codecScores.av1) : cur.av1,
    };
  }
  if ("preferredLanguageUpgrade" in body) {
    const allowed = ["VF", "VFQ", "MULTI · VF", "VOSTFR", "VOST", "VO"];
    patch.preferredLanguageUpgrade = allowed.includes(body.preferredLanguageUpgrade) ? body.preferredLanguageUpgrade : null;
  }
  const next = saveReleaseRules(patch);

  // Provenance: only the fields the setup wizard's hardware step actually
  // writes are tracked, distinguishing a wizard-set default from a value the
  // user later edits by hand in the Qualité settings tab — see
  // wizardProvenance.ts for how LOT4.2's smart re-optimization uses this.
  const touched: WizardTrackedField[] = [];
  if ("codecScores" in patch) touched.push("codecScores.x264", "codecScores.x265", "codecScores.av1");
  if ("maxMovieSizeMb" in patch) touched.push("maxMovieSizeMb");
  if ("maxEpisodeSizeMb" in patch) touched.push("maxEpisodeSizeMb");
  if ("maxSeasonSizeMb" in patch) touched.push("maxSeasonSizeMb");
  if (touched.length > 0) {
    if (body.source === "wizard") markWizardWritten(touched);
    else markManuallyEdited(touched);
  }

  return NextResponse.json(next);
}
