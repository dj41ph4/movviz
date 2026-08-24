import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { isLocalRequest } from "@/lib/network/isLocalRequest";

export const dynamic = "force-dynamic";

/** Read once per session by useIsLocalNetwork() — the network doesn't
 *  change mid-session, so this is deliberately not polled. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ isLocal: isLocalRequest(req) });
}
