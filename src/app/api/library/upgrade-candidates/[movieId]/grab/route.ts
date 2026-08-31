import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { grabUpgradeCandidate } from "@/lib/library/searchAndReplace";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ movieId: string }> };

/** Explicit user click only — never triggered automatically. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { movieId } = await params;
  const result = await grabUpgradeCandidate(movieId);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json(result, { status: result.error === "no_candidate" ? 404 : 502 });
}
