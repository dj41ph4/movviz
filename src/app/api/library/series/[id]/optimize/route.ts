import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { grabEpisodeUpgradeCandidate } from "@/lib/library/searchAndReplaceSeries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Find all available monitored episodes with files — same eligibility check
  // as findEpisodeUpgradeCandidates()
  const eligible: { seasonNumber: number; episodeNumber: number }[] = [];
  for (const season of series.seasons) {
    for (const ep of season.episodes) {
      if (ep.status === "available" && ep.monitored && ep.file) {
        eligible.push({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber });
      }
    }
  }
  if (eligible.length === 0) return NextResponse.json({ error: "no_file_to_replace" }, { status: 400 });

  // Walk every eligible episode and grab the first upgrade candidate found.
  // grabEpisodeUpgradeCandidate mirrors the movie-side grabUpgradeCandidate's
  // language-upgrade path (same preferredLanguageUpgrade setting, same
  // languageSatisfies rule, same live-fallback to direct indexer search).
  // Codec/format upgrades per-episode are not offered here — their signal is
  // too noisy on per-episode basenames compared to per-movie basenames; the
  // "Rechercher et remplacer" panel handles the full three-path scan for
  // episodes across the whole library.
  for (const { seasonNumber, episodeNumber } of eligible) {
    try {
      const result = await grabEpisodeUpgradeCandidate(id, seasonNumber, episodeNumber);
      if (result.ok) {
        return NextResponse.json({ ok: true, seasonNumber, episodeNumber });
      }
    } catch (e) {
      // Continue to next episode on individual failure
      continue;
    }
  }

  return NextResponse.json({ error: "no_candidate" }, { status: 404 });
}
