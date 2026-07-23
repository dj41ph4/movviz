import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { removeIndexer, updateIndexer, redact } from "@/lib/indexers/store";

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
    "enabled", "priority", "name", "categories",
    "baseUrl", "authType", "apiKey", "username", "password",
    "minSizeMb", "maxSizeMb", "maxAgeDays",
    "useFlareResolver",
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const updated = updateIndexer((await params).id, clean);
  return updated
    ? NextResponse.json(redact(updated))
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
