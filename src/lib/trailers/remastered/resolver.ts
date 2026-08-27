import { isRemasteredTrailersEnabled } from "@/lib/settings/remasteredTrailers";
import { getCache } from "@/lib/cache/registry";
import type { PremiumTrailerCandidate, ResolveRemasteredParams } from "./types";
import { probeYoutubeResolution } from "./youtubeProbe";
import { deduplicateCandidates, rankPremiumCandidates } from "./ranking";
import { resolveDigitalCine } from "./providers/digitalCine";
import { resolveHdRetroTrailers } from "./providers/hdRetroTrailers";
import { resolveCasu } from "./providers/casu";
import { resolveFilmsActu } from "./providers/filmsActu";
import { resolveDigitalTheater } from "./providers/digitalTheater";

// Cache séparé — ne doit jamais interférer avec trailerResolver
// TTL: 7 jours positif, 18h vide (médiane 12-24h). On utilise deux entrées
// avec TTL différents via un petit cache custom (registry TTL unique ne suffit pas).
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 18 * 60 * 60 * 1000;
const GLOBAL_DEADLINE_MS = 2800;
const PROVIDER_TIMEOUT_MS = 3500;

type CacheEntry = { value: PremiumTrailerCandidate[]; expiresAt: number };
const g = globalThis as typeof globalThis & { __movvizRemasteredCache?: Map<string, CacheEntry> };
const remasteredCache: Map<string, CacheEntry> = (g.__movvizRemasteredCache ??= new Map());

function cacheGet(key: string): PremiumTrailerCandidate[] | undefined {
  const e = remasteredCache.get(key);
  if (!e || e.expiresAt < Date.now()) {
    if (e) remasteredCache.delete(key);
    return undefined;
  }
  return e.value;
}
function cacheSet(key: string, value: PremiumTrailerCandidate[], isEmpty: boolean) {
  const ttl = isEmpty ? EMPTY_TTL_MS : POSITIVE_TTL_MS;
  remasteredCache.set(key, { value, expiresAt: Date.now() + ttl });
  // Also mirror into registry for observability in CachePanel if needed (no persistence)
  try {
    getCache("remasteredTrailerResolver", POSITIVE_TTL_MS).set(key, value);
  } catch {}
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export async function resolveRemasteredTrailers(params: ResolveRemasteredParams): Promise<PremiumTrailerCandidate[]> {
  const { type, tmdbId, title, originalTitle, year, locale, originalLanguage, context } = params;
  const key = `${type}:${tmdbId}:${locale}:${context}`;

  const cached = cacheGet(key);
  if (cached) return cached;

  // Hard guarantee: toggle OFF => 0 requete premium, 0 impact
  // This also protects direct calls without API check.
  if (!isRemasteredTrailersEnabled()) return [];

  // Deadline globale — si les providers dépassent, fallback immédiat
  const providerWork = (async (): Promise<{ candidates: PremiumTrailerCandidate[]; hadTransientFailure: boolean }> => {
    const results = await Promise.allSettled([
      resolveDigitalCine(title, originalTitle ?? null, year, locale),
      resolveHdRetroTrailers(title, originalTitle ?? null, year, locale),
      resolveCasu(title, originalTitle ?? null, year, locale),
      resolveFilmsActu(title, originalTitle ?? null, year, locale),
      resolveDigitalTheater(title, originalTitle ?? null, year, locale),
    ]);
    const hadTransientFailure = results.some((r) => r.status === "rejected");
    const flat = results
      .filter((r): r is PromiseFulfilledResult<PremiumTrailerCandidate[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);
    return { candidates: flat, hadTransientFailure };
  })();

  let providerResult: { candidates: PremiumTrailerCandidate[]; hadTransientFailure: boolean };
  try {
    providerResult = await withTimeout(providerWork, GLOBAL_DEADLINE_MS, "remastered-global");
  } catch {
    // Global deadline exceeded => treat as transient, no negative cache, fallback
    console.log(`[trailers:premium] ${key} timeout global fallback`);
    return [];
  }

  const { candidates: rawCandidates, hadTransientFailure } = providerResult;

  if (rawCandidates.length === 0) {
    // Empty — cache only if no transient failure, with shorter TTL
    console.log(`[trailers:premium] ${key} no_match fallback=current hadTransient=${hadTransientFailure}`);
    if (!hadTransientFailure) cacheSet(key, [], true);
    return [];
  }

  const deduped = deduplicateCandidates(rawCandidates);
  // Probe resolution for youtube candidates — parallel, capped
  const toProbe = deduped.slice(0, 8);
  const probeResults = await Promise.allSettled(
    toProbe.map(async (c) => {
      if (c.kind === "direct") return c;
      const probe = await withTimeout(probeYoutubeResolution(c.key), PROVIDER_TIMEOUT_MS, `probe:${c.key}`).catch(() => ({ ok: false as const, reason: "timeout" }));
      if (!probe.ok) {
        console.log(`[trailers:premium] ${key} provider=${c.provider} candidate=${c.key} quality=unknown rejected=quality reason=${probe.reason}`);
        return null;
      }
      if (probe.height < 1080) {
        console.log(`[trailers:premium] ${key} provider=${c.provider} candidate=${c.key} quality=${probe.height} rejected=quality`);
        return null;
      }
      console.log(`[trailers:premium] ${key} provider=${c.provider} candidate=${c.key} quality=${probe.height} lang=${c.language} score=${c.confidence.toFixed(2)} accepted`);
      return { ...c, width: probe.width ?? c.width, height: probe.height } as PremiumTrailerCandidate;
    }),
  );

  const probed = probeResults
    .filter((r): r is PromiseFulfilledResult<PremiumTrailerCandidate | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is PremiumTrailerCandidate => v != null);

  if (probed.length === 0) {
    console.log(`[trailers:premium] ${key} all_probed_rejected fallback=current`);
    if (!hadTransientFailure) cacheSet(key, [], true);
    return [];
  }

  const ranked = rankPremiumCandidates(probed, { locale, originalLanguage, context });
  console.log(`[trailers:premium] ${key} ranked=${ranked.length} top=${ranked[0]?.kind === "youtube" ? (ranked[0] as any).key : "direct"}`);
  if (!hadTransientFailure) cacheSet(key, ranked, false);
  return ranked;
}

// For tests / API: allow clearing cache
export function clearRemasteredCache() {
  remasteredCache.clear();
}
