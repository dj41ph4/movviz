import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { setWatchedMovies, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { pushMovieWatchedToPlex, pushEpisodesWatchedToPlex } from "@/lib/plex/watchWrite";
import { triggerIncrementalContextIfDue } from "@/lib/ai/contextBuilder";

export const dynamic = "force-dynamic";

/** Manual "watched" toggle (per user, complements Plex sync) — marks movies
 *  or episodes (single, whole season or whole series, decided by the client
 *  sending the target list) as watched/unwatched, with a dated "recent"
 *  entry when watched. Feeds the AI's recent-watches memory. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    tmdbId?: unknown;
    type?: unknown;
    watched?: unknown;
    title?: unknown;
    episodes?: unknown;
  };
  const tmdbId = Number(b.tmdbId);
  const type = b.type;
  const watched = b.watched === true;
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
  if (type !== "movie" && type !== "series") return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  if (type === "movie") {
    setWatchedMovies(user.id, [tmdbId], watched, title);
    // Bidirectional sync (demande explicite user) — fire-and-forget, never
    // blocks the toggle response. Best-effort inside (no key/link → no-op),
    // so a Plex hiccup never breaks the local toggle.
    pushMovieWatchedToPlex(user, tmdbId, watched).catch(() => {});
    // Auto-learning réactif (demande explicite user) — le contexte
    // consolidé se met à jour près de chaque action réelle, pas seulement
    // quand le chat est ouvert (voir contextBuilder.ts pour le vrai gate :
    // toujours au plus un appel LLM, jamais un par action individuelle).
    triggerIncrementalContextIfDue(user.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(b.episodes) || b.episodes.length === 0) {
    return NextResponse.json({ error: "invalid_episodes" }, { status: 400 });
  }
  if (b.episodes.length > 5000) return NextResponse.json({ error: "too_many_episodes" }, { status: 400 });

  const episodes: { tmdbId: number; season: number; episode: number }[] = [];
  for (const raw of b.episodes) {
    const e = (raw ?? {}) as { season?: unknown; episode?: unknown };
    const season = Number(e.season);
    const episode = Number(e.episode);
    if (!Number.isInteger(season) || season <= 0 || !Number.isInteger(episode) || episode <= 0) {
      return NextResponse.json({ error: "invalid_episodes" }, { status: 400 });
    }
    episodes.push({ tmdbId, season, episode });
  }

  setWatchedEpisodes(user.id, episodes, watched, title);
  pushEpisodesWatchedToPlex(user, episodes, watched).catch(() => {});
  triggerIncrementalContextIfDue(user.id).catch(() => {});
  return NextResponse.json({ ok: true });
}