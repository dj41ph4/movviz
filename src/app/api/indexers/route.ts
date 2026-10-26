import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadIndexers, addIndexer, updateIndexer, redact } from "@/lib/indexers/store";
import { catalogEntry } from "@/lib/indexers/catalog";
import { testIndexer } from "@/lib/indexers/torznab";
import type { ConfiguredIndexer } from "@/lib/indexers/types";
import { randomBytes } from "node:crypto";

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
  const baseUrl = entry?.key === "extto" ? "https://ext.to" : String(body.baseUrl ?? entry?.baseUrl ?? "").trim();
  if (!baseUrl) return NextResponse.json({ error: "baseUrl required" }, { status: 400 });
  if (entry?.key === "extto" && (!String(body.username ?? "").trim() || !String(body.password ?? ""))) {
    return NextResponse.json({ error: "EXT.to login and password required" }, { status: 400 });
  }

  const authType = entry?.key === "extto" ? "credentials" : body.authType ?? entry?.authType ?? "apikey";

  const ix: ConfiguredIndexer = {
    id: `ix_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: String(body.name ?? entry?.name ?? "Indexer").trim(),
    key: body.key ?? entry?.key,
    kind: body.kind ?? entry?.kind ?? "torznab",
    protocol: body.protocol ?? entry?.protocol ?? "torrent",
    baseUrl,
    authType,
    apiKey: entry?.key === "extto" ? randomBytes(32).toString("hex") : String(body.apiKey ?? "").trim(),
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? ""),
    categories: body.categories ?? entry?.categories ?? [2000, 5000],
    enabled: body.enabled ?? (entry?.key === "extto" ? false : true),
    useFlareResolver: entry?.key === "extto" ? false : !!body.useFlareResolver,
    listsEnabled: body.listsEnabled === undefined ? undefined : !!body.listsEnabled,
    priority: Number(body.priority ?? 1),
    addedAt: Date.now(),
  };

  addIndexer(ix);

  // The integrated EXT.to indexer starts only when the user enables it.
  if (entry?.key === "extto") return NextResponse.json(redact(ix), { status: 201 });

  // Learn the indexer's real search capabilities right away instead of waiting
  // for the periodic health-check task, so movie/series search modes work immediately.
  const result = await testIndexer(ix);
  const lastTest = { ok: result.ok, at: Date.now(), detail: result.detail };
  const updated = updateIndexer(ix.id, { lastTest, caps: result.caps }) ?? { ...ix, lastTest, caps: result.caps };

  return NextResponse.json(redact(updated), { status: 201 });
}
