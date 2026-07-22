import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const collection = await getCollection(id);
  if (!collection) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(collection);
}
