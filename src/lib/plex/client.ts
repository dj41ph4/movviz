import type { PlexAccount, PlexFriend, PlexHomeUser, PlexWatchlistItem, PlexServerConfig, PlexSection, PlexLibraryItem, PlexEpisodeItem, PlexMediaInfo, PlexVideoStream, PlexAudioStream, PlexSubtitleStream, PlexChapter } from "./types";
import { loadPlexConfig } from "./store";

/**
 * Plex.tv API v2 client — real endpoints, no external SDK. Every request needs
 * a stable client identifier (one per Movviz install) so Plex can tell OAuth
 * sessions apart; see plex/store.ts for where that's minted and persisted.
 */

const PRODUCT = "Movviz";

function headers(clientId: string, extra?: Record<string, string>) {
  return {
    accept: "application/json",
    "x-plex-product": PRODUCT,
    "x-plex-client-identifier": clientId,
    ...extra,
  };
}

/**
 * plain fetch() never times out on its own — a media server that stalls on
 * one request (overloaded, network hiccup) would otherwise hang a sync run
 * forever. Every media-server call below goes through this instead.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Home-server Plex instances routinely drop a reused keep-alive connection
 * under sustained load (large TV libraries especially) — a plain
 * `SocketError: other side closed`, not a real failure. Retry transient
 * network errors a couple of times before giving up on a page.
 */
async function fetchWithRetry(url: string, init: RequestInit, timeoutMs = 15000, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

export async function createPin(clientId: string): Promise<{ id: number; code: string } | null> {
  try {
    const res = await fetch("https://plex.tv/api/v2/pins?strong=true", {
      method: "POST",
      headers: headers(clientId),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, code: data.code };
  } catch {
    return null;
  }
}

export function buildAuthUrl(clientId: string, code: string): string {
  const params = new URLSearchParams({
    clientID: clientId,
    code,
    "context[device][product]": PRODUCT,
  });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

/** Poll after sending the user to buildAuthUrl(); returns the account token once they've authorized. */
export async function checkPin(clientId: string, pinId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: headers(clientId),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authToken || null;
  } catch {
    return null;
  }
}

export async function getPlexAccount(clientId: string, token: string): Promise<PlexAccount | null> {
  try {
    const res = await fetch("https://plex.tv/api/v2/user", {
      headers: headers(clientId, { "x-plex-token": token }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      id: String(d.id),
      uuid: d.uuid,
      username: d.username || d.title || d.email,
      email: d.email,
      thumb: d.thumb || null,
      authToken: token,
    };
  } catch {
    return null;
  }
}

/** Every account that has been granted access to the admin's Plex server(s). */
export async function getPlexFriends(clientId: string, adminToken: string): Promise<PlexFriend[]> {
  try {
    const res = await fetch("https://plex.tv/api/v2/friends", {
      headers: headers(clientId, { "x-plex-token": adminToken }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list.map((f: { id: number; username?: string; title?: string; email?: string; thumb?: string }) => ({
      id: String(f.id),
      username: f.username || f.title || f.email || `plex-${f.id}`,
      email: f.email ?? "",
      thumb: f.thumb ?? null,
    }));
  } catch {
    return [];
  }
}

/** Managed users (profiles) within a Plex Home — each has its own watch state but shares the admin token. */
export async function getPlexHomeUsers(adminToken: string): Promise<PlexHomeUser[]> {
  try {
    const res = await fetch("https://plex.tv/api/v2/home/users", {
      headers: { accept: "application/json", "x-plex-token": adminToken },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.users ?? [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((u: { guest: boolean }) => u.guest)
      .map((u: { id: number; title: string; thumb?: string }) => ({
        id: String(u.id),
        title: u.title,
        thumb: u.thumb ?? null,
      }));
  } catch {
    return [];
  }
}

export async function testPlexServer(cfg: PlexServerConfig): Promise<boolean> {
  if (!cfg.hostname) return false;
  const scheme = cfg.useSsl ? "https" : "http";
  try {
    const res = await fetch(`${scheme}://${cfg.hostname}:${cfg.port}/identity`, {
      headers: cfg.adminToken ? { "x-plex-token": cfg.adminToken } : {},
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** A user's real Plex watchlist (plex.tv Discover, separate from the media server itself). */
export async function getPlexWatchlist(userToken: string): Promise<PlexWatchlistItem[]> {
  const cfg = loadPlexConfig();
  try {
    const res = await fetch("https://discover.provider.plex.tv/library/sections/watchlist/all", {
      headers: headers(cfg.clientId, { "x-plex-token": userToken }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: RawWatchlistItem[] = data?.MediaContainer?.Metadata ?? [];
    return items
      .map((item) => {
        const guids: string[] = (item.Guid ?? []).map((g) => g.id);
        const tmdbGuid = guids.find((g) => g.startsWith("tmdb://"));
        const tmdbId = tmdbGuid ? Number(tmdbGuid.replace("tmdb://", "")) : null;
        return {
          title: item.title,
          type: item.type === "show" ? ("series" as const) : ("movie" as const),
          tmdbId,
        };
      })
      .filter((item) => item.tmdbId != null);
  } catch {
    return [];
  }
}

interface RawWatchlistItem {
  title: string;
  type: string;
  Guid?: { id: string }[];
}

// ---------------------------------------------------------------------------
// Media-server library scanning — the pieces that let Movviz match/import a
// real Plex library against its own records, and read per-account watch state.
// ---------------------------------------------------------------------------

function serverBase(cfg: PlexServerConfig): string {
  return `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
}

function serverHeaders(cfg: PlexServerConfig, token: string, managedUserId?: string) {
  return headers(cfg.clientId, {
    "x-plex-token": token,
    ...(managedUserId ? { "X-Plex-Profile": managedUserId } : {}),
  });
}

function extractTmdbId(guids: { id: string }[] | undefined): number | null {
  const g = (guids ?? []).find((x) => x.id.startsWith("tmdb://"));
  return g ? Number(g.id.replace("tmdb://", "")) : null;
}

interface RawStream {
  streamType: number;
  codec?: string;
  bitDepth?: number;
  chromaSubsampling?: string;
  frameRate?: number;
  width?: number;
  height?: number;
  channels?: number;
  audioChannelLayout?: string;
  bitrate?: number;
  language?: string;
  languageCode?: string;
  title?: string;
  selected?: boolean;
  forced?: boolean;
}
interface RawMediaPart {
  file?: string;
  size?: number;
  Stream?: RawStream[];
}
interface RawMedia {
  videoResolution?: string;
  bitrate?: number;
  container?: string;
  videoFrameRate?: string;
  width?: number;
  height?: number;
  Part?: RawMediaPart[];
}
interface RawChapter {
  title?: string;
  startTimeOffset: number;
}
interface RawLibraryItem {
  ratingKey: string;
  title: string;
  year?: number;
  viewCount?: number;
  addedAt?: number;
  updatedAt?: number;
  guid?: string;
  Guid?: { id: string }[];
  Media?: RawMedia[];
  Chapter?: RawChapter[];
  parentIndex?: number; // season number, on episodes
  index?: number; // episode number, on episodes
}

// Maps from Plex API codec names to the labels we display.
const VIDEO_CODEC_LABEL: Record<string, string> = {
  hevc: "HEVC",
  h265: "H.265",
  h264: "H.264",
  av1: "AV1",
  vc1: "VC-1",
  mpeg2video: "MPEG-2",
  mpeg4: "DivX",
  wmv3: "WMV",
};
const AUDIO_CODEC_LABEL: Record<string, string> = {
  dca: "DTS",
  truehd: "TrueHD",
  eac3: "EAC3",
  ac3: "AC3",
  aac: "AAC",
  flac: "FLAC",
  opus: "OPUS",
  mp3: "MP3",
  pcm: "PCM",
  dts: "DTS",
};

function parseStreamInfo(media: RawMedia[] | undefined): { videoCodec: string | null; audioCodec: string | null; hdr: string | null } {
  if (!media?.[0]?.Part?.[0]?.Stream) return { videoCodec: null, audioCodec: null, hdr: null };
  const streams = media[0].Part[0].Stream;
  let videoCodec: string | null = null;
  let audioCodec: string | null = null;
  let hdr: string | null = null;
  let bitDepth = 0;

  for (const s of streams) {
    if (s.streamType === 1) {
      const raw = s.codec?.toLowerCase() ?? "";
      videoCodec = raw ? (VIDEO_CODEC_LABEL[raw] ?? raw.toUpperCase()) : null;
      bitDepth = s.bitDepth ?? 0;
    } else if (s.streamType === 2) {
      const raw = s.codec?.toLowerCase() ?? "";
      let label = raw ? (AUDIO_CODEC_LABEL[raw] ?? raw.toUpperCase()) : null;
      // DTS: differentiate DTS-HD/DTS-X from plain DTS based on channel layout
      if (raw === "dca" && s.audioChannelLayout) {
        const layout = s.audioChannelLayout.toLowerCase();
        if (layout.includes("7.1") || layout.includes("6.1")) label = "DTS-HD";
        if (layout.includes("x") || layout.includes("xllx")) label = "DTS-X";
      }
      audioCodec = label;
    }
  }

  // HDR detection: bitDepth 10 on the video stream strongly suggests HDR
  if (bitDepth >= 10 && videoCodec) {
    hdr = "HDR10";
    // Dolby Vision can sometimes be detected from the codec string
    const videoStream = streams.find((s) => s.streamType === 1);
    if (videoStream?.codec?.toLowerCase().includes("dvhe") || videoStream?.codec?.toLowerCase().includes("dvh1")) {
      hdr = "Dolby Vision";
    }
  }

  return { videoCodec, audioCodec, hdr };
}

function parseChapters(raw: RawChapter[] | undefined): PlexChapter[] {
  if (!raw) return [];
  return raw.map((c) => ({
    title: c.title || null,
    startTimeOffset: c.startTimeOffset,
  }));
}

export function parseMediaDetail(item: RawLibraryItem): PlexMediaInfo {
  const media = item.Media?.[0] ?? null;
  const streams = media?.Part?.[0]?.Stream ?? [];
  const videoStreams: PlexVideoStream[] = [];
  const audioStreams: PlexAudioStream[] = [];
  const subtitleStreams: PlexSubtitleStream[] = [];

  for (const s of streams) {
    if (s.streamType === 1) {
      const raw = s.codec?.toLowerCase() ?? "";
      videoStreams.push({
        codec: raw ? (VIDEO_CODEC_LABEL[raw] ?? raw.toUpperCase()) : "",
        bitDepth: s.bitDepth ?? null,
        chromaSubsampling: s.chromaSubsampling ?? null,
        frameRate: s.frameRate?.toString() ?? null,
        width: s.width ?? null,
        height: s.height ?? null,
        language: s.language ?? s.languageCode ?? null,
      });
    } else if (s.streamType === 2) {
      const raw = s.codec?.toLowerCase() ?? "";
      let label = raw ? (AUDIO_CODEC_LABEL[raw] ?? raw.toUpperCase()) : "";
      if (raw === "dca" && s.audioChannelLayout) {
        const layout = s.audioChannelLayout.toLowerCase();
        if (layout.includes("7.1") || layout.includes("6.1")) label = "DTS-HD";
        if (layout.includes("x") || layout.includes("xllx")) label = "DTS-X";
      }
      audioStreams.push({
        codec: label,
        channels: s.channels ?? null,
        layout: s.audioChannelLayout ?? null,
        bitrate: s.bitrate ?? null,
        language: s.language ?? s.languageCode ?? null,
        title: s.title ?? null,
        selected: s.selected ?? false,
      });
    } else if (s.streamType === 3) {
      subtitleStreams.push({
        codec: s.codec ?? "",
        language: s.language ?? s.languageCode ?? null,
        title: s.title ?? null,
        forced: s.forced ?? false,
        selected: s.selected ?? false,
      });
    }
  }

  return {
    container: media?.container ?? null,
    bitrate: media?.bitrate ?? null,
    videoStreams,
    audioStreams,
    subtitleStreams,
    chapters: parseChapters(item.Chapter),
  };
}

function parseFile(item: RawLibraryItem): PlexLibraryItem["file"] {
  const media = item.Media?.[0];
  const part = media?.Part?.[0];
  if (!part?.file) return null;
  const resMap: Record<string, string> = { "4k": "2160p", "1080": "1080p", "720": "720p", "480": "480p" };
  return {
    path: part.file,
    size: part.size ?? 0,
    resolution: media?.videoResolution ? (resMap[media.videoResolution] ?? null) : null,
  };
}

function mapItem(item: RawLibraryItem, info: BatchItemInfo | null): PlexLibraryItem {
  return {
    ratingKey: item.ratingKey,
    tmdbId: info?.tmdbId ?? null,
    title: item.title,
    year: item.year ?? null,
    viewCount: item.viewCount ?? 0,
    addedAt: item.addedAt ?? 0,
    updatedAt: item.updatedAt ?? item.addedAt ?? 0,
    file: parseFile(item),
    videoCodec: info?.videoCodec ?? null,
    audioCodec: info?.audioCodec ?? null,
    hdr: info?.hdr ?? null,
    mediaDetail: info?.mediaDetail ?? null,
  };
}

/** The Plex web app deep link that opens this item straight from a browser tab. */
export function buildPlexWebUrl(machineIdentifier: string, ratingKey: string): string {
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`);
  return `https://app.plex.tv/desktop/#!/server/${machineIdentifier}/details?key=${key}`;
}

/** The server's own identity — needed to build "Watch on Plex" deep links (app.plex.tv/.../server/{id}/...). */
export async function getServerIdentity(cfg: PlexServerConfig): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${serverBase(cfg)}/identity`, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.MediaContainer?.machineIdentifier ?? null;
  } catch {
    return null;
  }
}

interface BatchItemInfo {
  tmdbId: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  mediaDetail: PlexMediaInfo;
}

/**
 * The bulk list endpoints (`/all`, `/allLeaves`) never include the `Guid`
 * array of external ids (tmdb/imdb/tvdb) on servers using Plex's newer
 * agents — only per-item (or batched) metadata lookups do. Batch ratingKeys
 * into `/library/metadata/{k1,k2,...}` calls to resolve them without one
 * request per title. Also parses codec/HDR from the stream info that only
 * the detail endpoint returns.
 */
export async function batchTmdbIds(cfg: PlexServerConfig, token: string, ratingKeys: string[], managedUserId?: string): Promise<Map<string, BatchItemInfo>> {
  const result = new Map<string, BatchItemInfo>();
  const chunkSize = 50;
  for (let i = 0; i < ratingKeys.length; i += chunkSize) {
    const chunk = ratingKeys.slice(i, i + chunkSize);
    try {
      const res = await fetchWithRetry(`${serverBase(cfg)}/library/metadata/${chunk.join(",")}`, {
        headers: serverHeaders(cfg, token, managedUserId),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw: RawLibraryItem[] = data?.MediaContainer?.Metadata ?? [];
      for (const item of raw) {
        const info = parseStreamInfo(item.Media);
        result.set(item.ratingKey, {
          tmdbId: extractTmdbId(item.Guid),
          ...info,
          mediaDetail: parseMediaDetail(item),
        });
      }
    } catch {
      continue;
    }
  }
  return result;
}

/** Ask the server to rescan a section now, instead of waiting for its own periodic scan interval. Best-effort. */
export async function refreshSection(cfg: PlexServerConfig, token: string, sectionKey: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${serverBase(cfg)}/library/sections/${sectionKey}/refresh`, {
      method: "GET",
      headers: serverHeaders(cfg, token),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Movie and show sections configured on the server — the entry point for a library scan. */
export async function getLibrarySections(cfg: PlexServerConfig, token: string, managedUserId?: string): Promise<PlexSection[]> {
  try {
    // The one Plex server call left on a plain fetch() with no timeout —
    // confirmed live as the actual cause of "Synchronisation des vues Plex"
    // hanging indefinitely (5+ minutes and still running) and starving the
    // whole job queue: one user with a stalled/unreachable connection here
    // blocks forever, since nothing ever aborts the request.
    const res = await fetchWithRetry(`${serverBase(cfg)}/library/sections`, { headers: serverHeaders(cfg, token, managedUserId), cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const dirs: { key: string; type: string; title: string }[] = data?.MediaContainer?.Directory ?? [];
    return dirs
      .filter((d) => d.type === "movie" || d.type === "show")
      .map((d) => ({ key: d.key, type: d.type as "movie" | "show", title: d.title }));
  } catch {
    return [];
  }
}

/**
 * Paginated fetch of every item directly in a section (movies, or shows
 * themselves — not episodes). When `sinceUnixSeconds` is given, sorts newest
 * (by updatedAt — new episodes/file changes bump it, not just new adds) first
 * and stops as soon as a page's items fall behind the watermark instead of
 * paginating the whole library — the classic "recently added" watermark trick.
 */
export async function getSectionItems(
  cfg: PlexServerConfig,
  sectionKey: string,
  token: string,
  opts?: { sinceUnixSeconds?: number },
  managedUserId?: string
): Promise<PlexLibraryItem[]> {
  const raw: RawLibraryItem[] = [];
  const pageSize = 200;
  let start = 0;
  const incremental = opts?.sinceUnixSeconds != null;
  // A stalled/failed page stops pagination but keeps whatever was already
  // collected — much better than one slow page silently discarding an
  // otherwise-successful scan of a large library.
  for (;;) {
    let page: RawLibraryItem[];
    let total: number;
    try {
      const url = new URL(`${serverBase(cfg)}/library/sections/${sectionKey}/all`);
      if (incremental) url.searchParams.set("sort", "updatedAt:desc");
      const res = await fetchWithRetry(url.toString(), {
        headers: {
          ...serverHeaders(cfg, token, managedUserId),
          "X-Plex-Container-Start": String(start),
          "X-Plex-Container-Size": String(pageSize),
        },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data = await res.json();
      page = data?.MediaContainer?.Metadata ?? [];
      total = data?.MediaContainer?.totalSize ?? page.length;
    } catch {
      break;
    }
    if (incremental) {
      const fresh = page.filter((i) => (i.updatedAt ?? i.addedAt ?? 0) >= opts!.sinceUnixSeconds!);
      raw.push(...fresh);
      // Sorted newest-first: once a page yields nothing fresh, everything after is older too.
      if (fresh.length < page.length) break;
    } else {
      raw.push(...page);
    }
    start += page.length;
    if (page.length === 0 || start >= total) break;
  }
  const infos = await batchTmdbIds(cfg, token, raw.map((i) => i.ratingKey), managedUserId);
  return raw.map((item) => mapItem(item, infos.get(item.ratingKey) ?? null));
}

/** Every episode of a show, flattened with season/episode numbers — one call, no per-season walk needed. */
export async function getShowEpisodes(cfg: PlexServerConfig, showRatingKey: string, token: string, managedUserId?: string): Promise<PlexEpisodeItem[]> {
  try {
    const res = await fetchWithRetry(`${serverBase(cfg)}/library/metadata/${showRatingKey}/allLeaves`, {
      headers: serverHeaders(cfg, token, managedUserId),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: RawLibraryItem[] = data?.MediaContainer?.Metadata ?? [];
    return raw
      .filter((e) => e.parentIndex != null && e.index != null)
      .map((e) => {
        const streams = parseStreamInfo(e.Media);
        return {
          ...mapItem(e, { tmdbId: null, ...streams, mediaDetail: parseMediaDetail(e) }),
          seasonNumber: e.parentIndex!,
          episodeNumber: e.index!,
        };
      });
  } catch {
    return [];
  }
}
