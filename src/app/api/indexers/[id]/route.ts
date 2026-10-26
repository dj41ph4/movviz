import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getIndexer, removeIndexer, updateIndexer, redact } from "@/lib/indexers/store";
import { bootstrapResolver } from "@/lib/resolver/bootstrap";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  removeIndexer((await params).id);
  return NextResponse.json({ removed: true });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const patch = await req.json();
  // Only mutable operational fields — never let the client rewrite ids.
  const allowed = [
    "key", "enabled", "priority", "name", "categories",
    "baseUrl", "authType", "apiKey", "username", "password",
    "minSizeMb", "maxSizeMb", "maxAgeDays",
    "useFlareResolver", "listsEnabled",
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const id = (await params).id;
  const current = getIndexer(id);
  if (current?.key === "extto") {
    clean.key = "extto";
    clean.baseUrl = "https://ext.to";
    clean.authType = "credentials";
    clean.useFlareResolver = false;
    delete clean.apiKey;
  }
  const updated = updateIndexer(id, clean);
  if (updated?.key === "extto" && updated.enabled) await bootstrapResolver();
  return updated
    ? NextResponse.json(redact(updated))
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
