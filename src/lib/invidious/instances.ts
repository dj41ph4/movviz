const INVIDIOUS_API_LIST = "https://api.invidious.io/instances.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DISABLE_DURATION_MS = 5 * 60 * 1000;
const FAILURE_THRESHOLD = 3;
const FETCH_TIMEOUT_MS = 5_000;

const FALLBACK_SEED: readonly string[] = [
  "https://invidious.snopyta.org",
  "https://y.com.sb",
  "https://invidious.kavin.rocks",
  "https://vid.puffyan.us",
  "https://invidious.namazso.eu",
];

interface Health {
  consecutiveFailures: number;
  disabledUntil: number | null;
  latencyMs: number | null;
  lastSeenAt: number;
}

type InstancesCache = {
  urls: string[];
  fetchedAt: number;
};

const g = globalThis as typeof globalThis & {
  __movvizInvidiousInstancesCache?: InstancesCache;
  __movvizInvidiousHealth?: Map<string, Health>;
  __movvizInvidiousFetchInFlight?: Promise<string[]> | null;
};

function healthMap(): Map<string, Health> {
  if (!(g.__movvizInvidiousHealth instanceof Map)) g.__movvizInvidiousHealth = new Map<string, Health>();
  return g.__movvizInvidiousHealth as Map<string, Health>;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function parseEnvUrls(): string[] | null {
  const raw = process.env.INVIDIOUS_API_URLS;
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(",").map((s) => normalizeUrl(s.trim())).filter((s): s is string => s != null);
  if (!parts.length) return null;
  return [...new Set(parts)];
}

async function fetchOfficialList(): Promise<string[]> {
  try {
    const res = await fetch(INVIDIOUS_API_LIST, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: "application/json" } });
    if (!res.ok) return [...FALLBACK_SEED];
    const data = (await res.json()) as Array<[string, { uptime?: boolean }]>;
    const urls: string[] = [];
    for (const [url, info] of data) {
      if (!info?.uptime) continue;
      const n = normalizeUrl(url);
      if (n && !urls.includes(n)) urls.push(n);
      if (urls.length >= 10) break;
    }
    return urls.length >= 2 ? urls : [...FALLBACK_SEED];
  } catch {
    return [...FALLBACK_SEED];
  }
}

async function getInstanceListCached(): Promise<string[]> {
  const env = parseEnvUrls();
  if (env) return env;
  const now = Date.now();
  const cached = g.__movvizInvidiousInstancesCache;
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS && cached.urls.length) return cached.urls;
  if (g.__movvizInvidiousFetchInFlight) return g.__movvizInvidiousFetchInFlight;
  const p = fetchOfficialList()
    .then((urls) => {
      const normalized = urls.map((u) => normalizeUrl(u)).filter((u): u is string => u != null);
      const deduped = [...new Set(normalized.length ? normalized : [...FALLBACK_SEED])];
      g.__movvizInvidiousInstancesCache = { urls: deduped, fetchedAt: Date.now() };
      return deduped;
    })
    .catch(() => {
      const fallback = [...FALLBACK_SEED];
      g.__movvizInvidiousInstancesCache = { urls: fallback, fetchedAt: Date.now() };
      return fallback;
    })
    .finally(() => {
      g.__movvizInvidiousFetchInFlight = null;
    });
  g.__movvizInvidiousFetchInFlight = p;
  return p;
}

export function markSuccess(instanceUrl: string, latencyMs: number): void {
  const key = normalizeUrl(instanceUrl) ?? instanceUrl;
  const map = healthMap();
  map.set(key, { consecutiveFailures: 0, disabledUntil: null, latencyMs: Math.max(0, Math.round(latencyMs)), lastSeenAt: Date.now() });
}

export function markFailure(instanceUrl: string): void {
  const key = normalizeUrl(instanceUrl) ?? instanceUrl;
  const map = healthMap();
  const prev = map.get(key);
  const consecutive = (prev?.consecutiveFailures ?? 0) + 1;
  const disabledUntil = consecutive >= FAILURE_THRESHOLD ? Date.now() + DISABLE_DURATION_MS : prev?.disabledUntil ?? null;
  map.set(key, { consecutiveFailures: consecutive, disabledUntil, latencyMs: prev?.latencyMs ?? null, lastSeenAt: Date.now() });
}

export async function getHealthyInvidiousInstances(): Promise<string[]> {
  const list = await getInstanceListCached();
  const now = Date.now();
  const map = healthMap();
  const healthy = list.filter((url) => {
    const h = map.get(url);
    if (!h) return true;
    if (h.disabledUntil != null && h.disabledUntil > now) return false;
    return true;
  });
  if (!healthy.length) {
    const sorted = [...list].sort((a, b) => (map.get(a)?.disabledUntil ?? 0) - (map.get(b)?.disabledUntil ?? 0));
    return sorted.slice(0, 2);
  }
  const withLatency = healthy.map((url) => ({ url, latency: map.get(url)?.latencyMs ?? Infinity }));
  withLatency.sort((a, b) => a.latency - b.latency);
  return withLatency.map((x) => x.url);
}

export function __resetInvidiousInstancesForTests(): void {
  g.__movvizInvidiousInstancesCache = undefined;
  g.__movvizInvidiousHealth = new Map();
  g.__movvizInvidiousFetchInFlight = null;
}
