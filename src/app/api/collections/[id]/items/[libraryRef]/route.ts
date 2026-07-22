import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { addItemToCollection, removeItemFromCollection } from "@/lib/collections/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; libraryRef: string }> }) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, libraryRef } = await params;

  try {
    addItemToCollection(id, {
      libraryRef: decodeURIComponent(libraryRef),
      addedAt: Date.now(),
      addedBy: admin.username,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding item:", error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; libraryRef: string }> }) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, libraryRef } = await params;
  removeItemFromCollection(id, decodeURIComponent(libraryRef));
  return NextResponse.json({ success: true });
}
