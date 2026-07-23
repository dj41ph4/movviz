import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getCollection, addItemToCollection, removeItemFromCollection } from "@/lib/collections/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; libraryRef: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, libraryRef } = await params;
  const collection = getCollection(id);
  if (!collection || (user.role !== "admin" && collection.createdBy !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    addItemToCollection(id, {
      libraryRef: decodeURIComponent(libraryRef),
      addedAt: Date.now(),
      addedBy: user.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding item:", error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; libraryRef: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, libraryRef } = await params;
  const collection = getCollection(id);
  if (!collection || (user.role !== "admin" && collection.createdBy !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  removeItemFromCollection(id, decodeURIComponent(libraryRef));
  return NextResponse.json({ success: true });
}