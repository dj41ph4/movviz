import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getCollection, saveCollection, deleteCollection } from "@/lib/collections/store";

export const dynamic = "force-dynamic";

function checkOwnership(user: { id: string; role: string }, collection: { createdBy: string }): boolean {
  return user.role === "admin" || collection.createdBy === user.id;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = getCollection(id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!checkOwnership(user, collection)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ collection });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = getCollection(body.id);
    if (existing && !checkOwnership(user, existing)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const updated = saveCollection(body);
    return NextResponse.json({ collection: updated });
  } catch (error) {
    console.error("Error updating collection:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const collection = getCollection(id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!checkOwnership(user, collection)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  deleteCollection(id);
  return NextResponse.json({ success: true });
}

