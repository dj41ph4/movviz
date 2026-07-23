import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { seerrConfigured } from "@/lib/seerr/store";
import { importSeerrRequests } from "@/lib/seerr/importRequests";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!seerrConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 400 });

  const result = await importSeerrRequests();
  return NextResponse.json(result);
}
