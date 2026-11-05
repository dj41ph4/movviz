import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { configuredQualityProfile } from "@/lib/library/defaultQualityProfile";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "@/lib/library/store";

export const dynamic = "force-dynamic";

/** Applique le profil de qualité par défaut actuel à toutes les séries et à tous les films déjà présents. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const profileId = configuredQualityProfile().id;
  const series = loadSeries().filter((s) => s.qualityProfileId !== profileId);
  const movies = loadMovies().filter((m) => m.qualityProfileId !== profileId);
  updateSeriesList(new Map(series.map((s) => [s.id, { qualityProfileId: profileId }])));
  updateMovies(new Map(movies.map((m) => [m.id, { qualityProfileId: profileId }])));
  return NextResponse.json({ profileId, series: series.length, movies: movies.length });
}
