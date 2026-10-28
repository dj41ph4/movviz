import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { resolveCanonical } from "@/lib/plex/mediaIdentityMap";

export const dynamic = "force-dynamic";

/** Ce que le code lit d'une session de lecture renvoyée par Plex (/status/sessions). */
interface PlexSessionRaw {
  ratingKey?: string;
  grandparentRatingKey?: string;
  title?: string;
  grandparentTitle?: string;
  type?: string;
  viewOffset?: number;
  duration?: number;
  grandparentThumb?: string;
  thumb?: string;
  User?: { title?: string; thumb?: string };
  Player?: { state?: string; title?: string };
  session?: { bitrate?: number; bandwidth?: number };
  Session?: { location?: string };
  Media?: { videoCodec?: string; audioCodec?: string; videoResolution?: string };
  TranscodeSession?: { videoDecision?: string };
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return NextResponse.json({ sessions: [] });

  const scheme = cfg.useSsl ? "https" : "http";
  const plexUrl = safePlexUrl(`${scheme}://${cfg.hostname}:${cfg.port}`);
  if (!plexUrl) return NextResponse.json({ sessions: [] });

  let data: { MediaContainer?: { Metadata?: PlexSessionRaw[] } };
  try {
    const res = await fetch(`${plexUrl}/status/sessions`, {
      headers: { "X-Plex-Token": cfg.adminToken, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    data = await res.json();
  } catch {
    return NextResponse.json({ sessions: [] });
  }

  const movies = loadMovies();
  const series = loadSeries();
  const sessions = (data.MediaContainer?.Metadata ?? []).map((s: PlexSessionRaw) => {
    const identity = s.ratingKey && cfg.machineIdentifier ? resolveCanonical(cfg.machineIdentifier, String(s.ratingKey)) : null;
    const seriesId = s.type === "episode" ? (identity?.type === "episode" ? identity.tmdbShowId : series.find((item) => item.plexRatingKey === String(s.grandparentRatingKey ?? ""))?.tmdbId) : null;
    const movieId = s.type === "movie" ? (identity?.type === "movie" ? identity.tmdbId : movies.find((item) => item.plexRatingKey === String(s.ratingKey ?? ""))?.tmdbId) : null;
    return {
      href: seriesId ? `/title/series/${seriesId}` : movieId ? `/title/movie/${movieId}` : null,
      title: s.title || s.grandparentTitle || "Inconnu",
      type: s.type,
      user: s.User?.title || "Inconnu",
      userThumb: s.User?.thumb || null,
      state: s.Player?.state || "paused",
      progress: s.viewOffset ? Math.round((s.viewOffset / (s.duration as number)) * 100) : 0,
      duration: s.duration || 0,
      bitrate: s.session?.bitrate || 0,
      bandwidth: s.session?.bandwidth || 0,
      device: s.Player?.title || "Inconnu",
      videoCodec: s.Media?.videoCodec || null,
      audioCodec: s.Media?.audioCodec || null,
      resolution: s.Media?.videoResolution || null,
      thumb: s.grandparentThumb || s.thumb || null,
      transcodeDecision: s.TranscodeSession?.videoDecision || "directplay",
      location: s.Session?.location === "wan" ? "wan" : "lan",
    };
  });

  return NextResponse.json({ sessions });
}
