import { NextRequest, NextResponse } from "next/server";
import { getPerson, tmdbConfigured } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) return NextResponse.json({ error: "not configured" }, { status: 400 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const person = await getPerson(id);
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(person);
}
