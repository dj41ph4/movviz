import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadImportLists, saveImportList, removeImportList } from "@/lib/importLists/store";
import { syncImportList } from "@/lib/importLists/sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ lists: loadImportLists() });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (body.action === "sync") {
    const count = await syncImportList(body.id);
    return NextResponse.json({ synced: count });
  }
  saveImportList(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = requireUser(req);
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await req.json();
  removeImportList(id);
  return NextResponse.json({ ok: true });
}
