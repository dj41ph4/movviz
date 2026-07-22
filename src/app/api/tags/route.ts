import { NextResponse } from "next/server";
import { loadMovies, loadSeries } from "@/lib/library/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const movies = loadMovies();
  const series = loadSeries();

  const tagSet = new Set<string>();
  for (const m of movies) for (const t of m.tags ?? []) tagSet.add(t);
  for (const s of series) for (const t of s.tags ?? []) tagSet.add(t);

  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ tags });
}
