import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAppVersion } from "@/lib/updates/version";
import { getChangelogRange } from "@/lib/changelog";

export const dynamic = "force-dynamic";

/** `?since=1.0.30` returns every release between 1.0.30 (exclusive) and the running version — everything the caller missed, not just the latest. Omit `since` (first-ever launch) to get just the current version. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const version = getAppVersion();
  const since = req.nextUrl.searchParams.get("since");
  const entries = getChangelogRange(since, version);
  return NextResponse.json({ version, entries, entry: entries[0] ?? null });
}
