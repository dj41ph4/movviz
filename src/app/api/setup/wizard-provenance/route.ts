import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadWizardProvenance } from "@/lib/setup/wizardProvenance";

export const dynamic = "force-dynamic";

/** Read-only — lets the wizard's smart re-optimization mode know which fields it's still allowed to overwrite. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadWizardProvenance());
}
