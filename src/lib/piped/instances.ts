const OFFICIAL_LIST_URL =
  "https://raw.githubusercontent.com/TeamPiped/documentation/refs/heads/main/content/docs/public-instances/index.md";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DISABLE_DURATION_MS = 5 * 60 * 1000;
const FAILURE_THRESHOLD = 3;
const FETCH_TIMEOUT_MS = 5_000;

const FALLBACK_SEED: readonly string[] = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.nosebs.ru",
  "https://pipedapi-libre.kavin.rocks",
  "https://piped-api.privacy.com.de",
  "https://pipedapi.adminforge.de",
  "https://api.piped.yt",
  "https://pipedapi.drgns.space",
  "https://pipedapi.owo.si",
  "https://pipedapi.ducks.party",
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
  __movvizPipedInstancesCache?: InstancesCache;
  __movvizPipedHealth?: Map<string, Health>;
  __movvizPipedFetchInFlight?: Promise<string[]> | null;
};

function healthMap(): Map<string, Health> {
  if (!(g.__movvizPipedHealth instanceof Map)) g.__movvizPipedHealth = new Map<string, Health>();
  return g.__movvizPipedHealth as Map<string, Health>;
}

function normalizeInstanceUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (!host) return null;
    if (host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
    if (/^127\./.test(host)) return null;
    if (/^10\./.test(host)) return null;
    if (/^192\.168\./.test(host)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function parseEnvUrls(): string[] | null {
  const raw = process.env.PIPED_API_URLS;
  if (!raw || typeof raw !== "string") return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizeInstanceUrl(s))
    .filter((s): s is string => s != null);
  if (!parts.length) return null;
  return [...new Set(parts)];
}

function parseMarkdownForUrls(md: string): string[] {
  const urls: string[] = [];
  const re = /\|\s*[^|]+\|\s*(https:\/\/[^\s|]+)\s*\|/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const candidate = m[1].trim().replace(/\/+$/, "");
    const normalized = normalizeInstanceUrl(candidate);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }
  return urls;
}

async function fetchOfficialList(): Promise<string[]> {
  try {
    const res = await fetch(OFFICIAL_LIST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/plain, text/markdown, */*" },
    });
    if (!res.ok) return [...FALLBACK_SEED];
    const text = await res.text();
    const parsed = parseMarkdownForUrls(text);
    if (parsed.length >= 2) return parsed;
    return [...FALLBACK_SEED];
  } catch {
    return [...FALLBACK_SEED];
  }
}

async function getInstanceListCached(): Promise<string[]> {
  const env = parseEnvUrls();
  if (env) return env;

  const now = Date.now();
  const cached = g.__movvizPipedInstancesCache;
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS && cached.urls.length) {
    return cached.urls;
  }
  if (g.__movvizPipedFetchInFlight) {
    return g.__movvizPipedFetchInFlight;
  }
  const p = fetchOfficialList()
    .then((urls) => {
      const normalized = urls.map((u) => normalizeInstanceUrl(u)).filter((u): u is string => u != null);
      const deduped = [...new Set(normalized.length ? normalized : [...FALLBACK_SEED])];
      g.__movvizPipedInstancesCache = { urls: deduped, fetchedAt: Date.now() };
      return deduped;
    })
    .catch(() => {
      const fallback = [...FALLBACK_SEED];
      g.__movvizPipedInstancesCache = { urls: fallback, fetchedAt: Date.now() };
      return fallback;
    })
    .finally(() => {
      g.__movvizPipedFetchInFlight = null;
    });
  g.__movvizPipedFetchInFlight = p;
  return p;
}

export function markSuccess(instanceUrl: string, latencyMs: number): void {
  const key = normalizeInstanceUrl(instanceUrl) ?? instanceUrl;
  const map = healthMap();
  map.set(key, {
    consecutiveFailures: 0,
    disabledUntil: null,
    latencyMs: Math.max(0, Math.round(latencyMs)),
    lastSeenAt: Date.now(),
  });
}

export function markFailure(instanceUrl: string): void {
  const key = normalizeInstanceUrl(instanceUrl) ?? instanceUrl;
  const map = healthMap();
  const prev = map.get(key);
  const consecutive = (prev?.consecutiveFailures ?? 0) + 1;
  const disabledUntil = consecutive >= FAILURE_THRESHOLD ? Date.now() + DISABLE_DURATION_MS : prev?.disabledUntil ?? null;
  map.set(key, {
    consecutiveFailures: consecutive,
    disabledUntil,
    latencyMs: prev?.latencyMs ?? null,
    lastSeenAt: Date.now(),
  });
}

function isHealthy(entry: Health | undefined): boolean {
  if (!entry) return true;
  if (entry.disabledUntil != null && entry.disabledUntil > Date.now()) return false;
  return true;
}

export async function getHealthyPipedInstances(): Promise<string[]> {
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
    // All instances in cooldown — return 2 with earliest expiry to avoid total outage
    const sorted = [...list].sort((a, b) => {
      const da = map.get(a)?.disabledUntil ?? 0;
      const db = map.get(b)?.disabledUntil ?? 0;
      return da - db;
    });
    return sorted.slice(0, 2);
  }
  const withLatency = healthy.map((url) => ({ url, latency: map.get(url)?.latencyMs ?? Infinity }));
  withLatency.sort((a, b) => a.latency - b.latency);
  return withLatency.map((x) => x.url);
}

export function __resetPipedInstancesForTests(): void {
  g.__movvizPipedInstancesCache = undefined;
  g.__movvizPipedHealth = new Map();
  g.__movvizPipedFetchInFlight = null;
}
