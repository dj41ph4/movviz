import type { PlaybackMarker, PlaybackMarkerType } from "./types.ts";

/**
 * Client TheIntroDB (https://theintrodb.org) — API v4, lecture publique et
 * anonyme : `GET /v4/media?tmdb_id=…[&season=…&episode=…][&duration_ms=…]`.
 *
 * Données échangées : l'identifiant TMDb du titre, la saison/l'épisode et la
 * durée du fichier. Rien de personnel (ni utilisateur, ni chemin, ni IP
 * Movviz autre que celle du serveur).
 */
const BASE = "https://api.theintrodb.org/v4";

export type TheIntroDbTarget =
  | { kind: "movie"; tmdbId: number; durationMs?: number | null }
  | { kind: "episode"; tmdbId: number; season: number; episode: number; durationMs?: number | null };

export type TheIntroDbResult =
  /** Réponse valide — `markers` peut être vide (aucune soumission connue). */
  | { ok: true; markers: PlaybackMarker[] }
  /** Panne, limite atteinte ou réponse illisible : l'état distant est
   *  inconnu, l'appelant ne doit RIEN effacer. `retryAfterMs` si l'API l'indique. */
  | { ok: false; error: string; retryAfterMs?: number };

interface RawSegment {
  start_ms?: number | null;
  end_ms?: number | null;
}

const TYPES: PlaybackMarkerType[] = ["recap", "intro", "credits", "preview"];
/** Borne maximale d'un horodatage pour l'API (6 h). */
const MAX_MEDIA_MS = 21_600_000;

/**
 * Normalise la réponse `MediaResponse` en marqueurs Movviz.
 *  - recap/intro : `start_ms` null = début du média ;
 *  - credits/preview : `end_ms` null = fin du média : la durée si on la
 *    connaît, sinon 6 h (le maximum de l'API) — un saut vers cette borne
 *    tombe de toute façon sur la fin du média ;
 *  - `0`/inversé = « pas de segment ».
 */
export function normalizeTheIntroDb(json: unknown, durationMs?: number | null): PlaybackMarker[] {
  if (!json || typeof json !== "object") return [];
  const body = json as Record<string, unknown>;
  const out: PlaybackMarker[] = [];
  for (const type of TYPES) {
    const list = body[type];
    if (!Array.isArray(list)) continue;
    for (const raw of list as RawSegment[]) {
      if (!raw || typeof raw !== "object") continue;
      const toEnd = type === "credits" || type === "preview";
      const startMs = raw.start_ms ?? (toEnd ? null : 0);
      const endMs = raw.end_ms ?? (toEnd ? (durationMs && durationMs > 0 ? durationMs : MAX_MEDIA_MS) : null);
      if (typeof startMs !== "number" || typeof endMs !== "number") continue;
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
      const start = Math.round(startMs);
      const end = Math.round(endMs);
      if (start < 0 || end <= start) continue;
      out.push({
        id: `${type}-${start}-${end}`,
        source: "theintrodb",
        sourceMarkerId: null,
        type,
        startMs: start,
        endMs: end,
        // « jusqu'à la fin du média » = générique final.
        final: type === "credits" && raw.end_ms == null,
      });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** 404 `no_submissions` / `episode_not_found` / `media_not_found` : l'API a
 *  répondu, elle n'a simplement rien pour ce titre — ce n'est PAS une panne. */
const EMPTY_404 = new Set(["no_submissions", "episode_not_found", "media_not_found"]);

export async function fetchTheIntroDb(target: TheIntroDbTarget, fetchImpl: typeof fetch = fetch): Promise<TheIntroDbResult> {
  const params = new URLSearchParams({ tmdb_id: String(target.tmdbId) });
  if (target.kind === "episode") {
    params.set("season", String(target.season));
    params.set("episode", String(target.episode));
  }
  // Sélectionne la version du fichier (montage/durée) la plus proche.
  if (target.durationMs && target.durationMs > 0) params.set("duration_ms", String(Math.round(target.durationMs)));
  try {
    const res = await fetchImpl(`${BASE}/media?${params}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      return body?.code && EMPTY_404.has(body.code) ? { ok: true, markers: [] } : { ok: false, error: "HTTP 404" };
    }
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
      const header = Number(res.headers.get("x-ratelimit-reset"));
      const seconds = typeof body?.retry_after === "number" ? body.retry_after : Number.isFinite(header) && header > 0 ? header : 60;
      return { ok: false, error: "rate_limited", retryAfterMs: Math.min(Math.max(seconds, 1), 3600) * 1000 };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, markers: normalizeTheIntroDb(await res.json(), target.durationMs) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
