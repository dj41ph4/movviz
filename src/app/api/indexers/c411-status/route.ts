import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadC411ListsConfig, probeC411Login } from "@/lib/c411/session";
import { loadIndexers } from "@/lib/indexers/store";

export const dynamic = "force-dynamic";

/**
 * Server-side truth about the C411 Discover lists: whether the indexer row
 * actually holds listsEnabled + site credentials (the real toggle status,
 * not the form's local state) and whether a live login succeeds. Used by the
 * settings screen to diagnose "the lists don't show up" cases.
 */
export async function GET(_req: NextRequest) {
  if (!requireAdmin(_req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ix = loadIndexers().find((i) => i.baseUrl.toLowerCase().includes("c411.org"));
  const cfg = loadC411ListsConfig();
  if (!cfg) {
    return NextResponse.json({
      configured: false,
      indexerExists: !!ix,
      listsEnabled: !!ix?.listsEnabled,
      hasUsername: !!ix?.username,
      hasPassword: !!ix?.password,
      baseUrl: ix?.baseUrl ?? null,
    });
  }

  const probe = await probeC411Login(cfg);
  return NextResponse.json({ configured: true, loginOk: probe.ok, detail: probe.detail });
}
