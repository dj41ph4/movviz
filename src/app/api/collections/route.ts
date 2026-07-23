import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadCollections } from "@/lib/collections/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const collections = user.role === "admin" ? loadCollections() : loadCollections().filter((c) => c.createdBy === user.id);
  return NextResponse.json({ collections });
}
