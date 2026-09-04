import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listOnDeckEntries } from "@/lib/plex/onDeckService";

export const dynamic = "force-dynamic";
export type { OnDeckEntry } from "@/lib/plex/onDeckService";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ items: await listOnDeckEntries(user) }, { headers: { "Cache-Control": "private, no-store" } });
}
