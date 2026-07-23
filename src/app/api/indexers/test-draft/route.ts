import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { testIndexer } from "@/lib/indexers/torznab";
import type { ConfiguredIndexer } from "@/lib/indexers/types";

export const dynamic = "force-dynamic";

/**
 * Tests connection details before the indexer has been saved — used by the
 * "add indexer" form so its category picker can show the indexer's real
 * categories (via t=caps) right after the API key is entered, instead of
 * only after the first save+auto-test round trip.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const baseUrl = String(body.baseUrl ?? "").trim();
  if (!baseUrl) return NextResponse.json({ error: "baseUrl required" }, { status: 400 });

  const draft: ConfiguredIndexer = {
    id: "draft",
    name: "",
    kind: body.kind === "newznab" ? "newznab" : "torznab",
    protocol: body.protocol === "usenet" ? "usenet" : "torrent",
    baseUrl,
    authType: body.authType === "credentials" ? "credentials" : "apikey",
    apiKey: String(body.apiKey ?? "").trim(),
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? ""),
    categories: [],
    enabled: true,
    priority: 1,
    addedAt: Date.now(),
    useFlareResolver: !!body.useFlareResolver,
  };

  const result = await testIndexer(draft);
  return NextResponse.json(result);
}
