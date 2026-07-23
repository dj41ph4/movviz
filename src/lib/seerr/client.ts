import type { SeerrConfig, SeerrUser, SeerrRequest } from "./types";

/**
 * Seerr (Overseerr/Jellyseerr) REST API client — read-only, used once for a
 * manual import. No SDK dependency, just typed fetch against their public
 * `/api/v1` surface, authenticated with the per-user API key from Settings.
 */

function baseFor(cfg: SeerrConfig): string {
  return cfg.baseUrl.replace(/\/+$/, "");
}

function headers(cfg: SeerrConfig) {
  return { accept: "application/json", "X-Api-Key": cfg.apiKey };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function testSeerrConnection(cfg: SeerrConfig): Promise<{ ok: boolean; detail?: string }> {
  if (!cfg.baseUrl || !cfg.apiKey) return { ok: false, detail: "missing_config" };
  try {
    const res = await fetchWithTimeout(`${baseFor(cfg)}/api/v1/user?take=1`, { headers: headers(cfg), cache: "no-store" });
    if (!res.ok) return { ok: false, detail: `http_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

function mapUser(raw: Record<string, unknown>): SeerrUser {
  return {
    id: Number(raw.id),
    email: (raw.email as string) || null,
    username: (raw.username as string) || null,
    displayName: (raw.displayName as string) || null,
    plexUsername: (raw.plexUsername as string) || null,
    plexId: raw.plexId != null ? String(raw.plexId) : null,
  };
}

/** Every account known to the Seerr instance, paginated 100 at a time. */
export async function getSeerrUsers(cfg: SeerrConfig): Promise<SeerrUser[]> {
  const users: SeerrUser[] = [];
  let skip = 0;
  const take = 100;
  for (;;) {
    const res = await fetchWithTimeout(`${baseFor(cfg)}/api/v1/user?take=${take}&skip=${skip}`, {
      headers: headers(cfg),
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = await res.json();
    const results: unknown[] = data.results ?? [];
    users.push(...results.map((r) => mapUser(r as Record<string, unknown>)));
    if (results.length < take) break;
    skip += take;
  }
  return users;
}

function mapRequest(raw: Record<string, unknown>): SeerrRequest | null {
  const media = raw.media as Record<string, unknown> | undefined;
  const requestedBy = raw.requestedBy as Record<string, unknown> | undefined;
  if (!media || !requestedBy || media.tmdbId == null) return null;

  // raw.seasons is the request-level SeasonRequest[] — only the specific
  // seasons the user actually checked. raw.media.seasons is the Sonarr-level
  // season config (ALL known seasons for the series), which is wrong here.
  const requestSeasons = raw.seasons;
  const seasonsRaw = Array.isArray(requestSeasons) ? requestSeasons : media.seasons;
  const seasons = Array.isArray(seasonsRaw)
    ? seasonsRaw.map((s: unknown) => Number((s as Record<string, unknown>)?.seasonNumber)).filter((n: number) => !isNaN(n))
    : undefined;

  return {
    id: Number(raw.id),
    status: Number(raw.status) as SeerrRequest["status"],
    createdAt: String(raw.createdAt ?? ""),
    requestedBy: mapUser(requestedBy),
    media: {
      id: Number(media.id),
      tmdbId: Number(media.tmdbId),
      mediaType: media.mediaType === "tv" ? "tv" : "movie",
      status: Number(media.status) as SeerrRequest["media"]["status"],
      seasons: seasons && seasons.length > 0 ? seasons : undefined,
    },
  };
}

/** Every request ever made on the Seerr instance, paginated 100 at a time. */
export async function getSeerrRequests(cfg: SeerrConfig): Promise<SeerrRequest[]> {
  const requests: SeerrRequest[] = [];
  let skip = 0;
  const take = 100;
  for (;;) {
    const res = await fetchWithTimeout(
      `${baseFor(cfg)}/api/v1/request?take=${take}&skip=${skip}&filter=all&sort=added`,
      { headers: headers(cfg), cache: "no-store" }
    );
    if (!res.ok) break;
    const data = await res.json();
    const results: unknown[] = data.results ?? [];
    for (const r of results) {
      const mapped = mapRequest(r as Record<string, unknown>);
      if (mapped) requests.push(mapped);
    }
    if (results.length < take) break;
    skip += take;
  }
  return requests;
}
