import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadIndexers, addIndexer, updateIndexer, redact } from "@/lib/indexers/store";
import { catalogEntry } from "@/lib/indexers/catalog";
import { testIndexer } from "@/lib/indexers/torznab";
import type { ConfiguredIndexer } from "@/lib/indexers/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ indexers: loadIndexers().map(redact) });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const entry = body.key ? catalogEntry(body.key) : null;

  // A predefined catalog entry already knows its endpoint; a generic entry
  // requires the user to supply one.
  const baseUrl = String(body.baseUrl ?? entry?.baseUrl ?? "").trim();
  if (!baseUrl) return NextResponse.json({ error: "baseUrl required" }, { status: 400 });

  const authType = body.authType ?? entry?.authType ?? "apikey";

  const ix: ConfiguredIndexer = {
    id: `ix_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(body.name ?? entry?.name ?? "Indexer").trim(),
    kind: body.kind ?? entry?.kind ?? "torznab",
    protocol: body.protocol ?? entry?.protocol ?? "torrent",
    baseUrl,
    authType,
    apiKey: String(body.apiKey ?? "").trim(),
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? ""),
    categories: body.categories ?? entry?.categories ?? [2000, 5000],
    enabled: body.enabled ?? true,
    useFlareResolver: !!body.useFlareResolver,
    priority: Number(body.priority ?? 1),
    addedAt: Date.now(),
  };

  addIndexer(ix);

  // Learn the indexer's real search capabilities right away instead of waiting
  // for the periodic health-check task, so movie/series search modes work immediately.
  const result = await testIndexer(ix);
  const lastTest = { ok: result.ok, at: Date.now(), detail: result.detail };
  const updated = updateIndexer(ix.id, { lastTest, caps: result.caps }) ?? { ...ix, lastTest, caps: result.caps };

  return NextResponse.json(redact(updated), { status: 201 });
}
