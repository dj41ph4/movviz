import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/auth/guard";
import { getCdnImagesConfig, setCdnImagesEnabled, setLocalNetworkPriorityEnabled } from "@/lib/settings/cdnImages";

export const dynamic = "force-dynamic";

/** Read by every authenticated user (it decides which route their own image
 *  requests take) — write is admin-only, it's a server-wide bandwidth/load
 *  decision, not a personal preference. */
export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(getCdnImagesConfig());
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  let cfg = getCdnImagesConfig();
  if (typeof body?.enabled === "boolean") cfg = setCdnImagesEnabled(body.enabled);
  if (typeof body?.localNetworkPriorityEnabled === "boolean") cfg = setLocalNetworkPriorityEnabled(body.localNetworkPriorityEnabled);
  return NextResponse.json(cfg);
}
