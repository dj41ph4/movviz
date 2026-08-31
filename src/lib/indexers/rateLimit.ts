/**
 * In-memory rate-limit tracker for indexers. When an indexer responds with
 * HTTP 429 (Too Many Requests), we stop querying it for a cooldown period
 * instead of hammering it on every search cycle.
 *
 * Stored on globalThis so it survives HMR. Not persisted to disk — after a
 * restart every indexer starts fresh, which is better than staying locked
 * out for 10 minutes after an unexpected crash.
 *
 * Voies priorisées (voir priority/lane.ts) : chaque fenêtre glissante existe
 * en deux exemplaires — « all » (plafond réel, voie utilisateur ET fond) et
 * « bg » (quota réduit, voie arrière-plan seule). Une requête background doit
 * passer la fenêtre « bg » PUIS la fenêtre « all » : l'arrière-plan ne peut
 * donc jamais remplir la réserve utilisateur (USER_QUOTA_RESERVE slots/min
 * par hôte, GLOBAL_USER_RESERVE au global), tout en restant sous le plafond
 * réel. Une requête utilisateur ne passe que la fenêtre « all » — elle est
 * toujours servie en priorité.
 */

import { currentLane, type Lane } from "@/lib/priority/lane";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

const g = globalThis as typeof globalThis & { __movvizRateLimit?: Map<string, number> };
const limits: Map<string, number> = (g.__movvizRateLimit ??= new Map());

/**
 * Per-indexer request quotas (requests/minute), keyed by API hostname —
 * private trackers document these and will 429 (or ban) past them. Applied
 * BEFORE the request is sent, so the quota is never exceeded in the first
 * place: the call waits for a free slot in the sliding window.
 *
 * C411 (https://c411.org): max 15 requests per minute.
 */
export const INDEXER_REQUEST_QUOTAS: Record<string, number> = {
  "c411.org": 15,
};

// Quota générique par hôte pour tous les autres indexeurs. "Rechercher les
// manquants" enchaîne des dizaines de requêtes par indexeur (intégrale →
// saisons → épisodes) ; sans plafond, une seule grosse série suffit à faire
// 429 (mesuré live : ~35 requêtes en ~35 s). 20 req/min est invisible pour
// l'usage normal (RSS horaire, recherches manuelles) et borne la bulk.
const DEFAULT_INDEXER_QUOTA = 20;

// Cap global tous indexeurs confondus (fenêtre glissante 60 s) — empêche
// plusieurs jobs en parallèle (recherche manuelle + bulk + tâche planifiée)
// de saturer ensemble les indexeurs même quand chaque hôte reste sous sa
// propre quote.
const GLOBAL_QUOTA_PER_MIN = 40;

// Réserve garantie à la voie utilisateur : l'arrière-plan ne peut jamais
// consommer plus de (quota - USER_QUOTA_RESERVE) slots/min par hôte ni plus
// de (GLOBAL_QUOTA_PER_MIN - GLOBAL_USER_RESERVE) slots/min au global — les
// recherches utilisateur ont donc TOUJOURS ≥ 5 slots libres par hôte et ≥ 10
// au global, même pendant une bulk ou un scan RSS massif.
const USER_QUOTA_RESERVE = 5;
const GLOBAL_USER_RESERVE = 10;

interface QuotaState {
  /** Fenêtre « all » : plafond réel (utilisateur + arrière-plan). */
  window: number[];
  /** Fenêtre « bg » : quota de la voie arrière-plan (réserve utilisateur soustraite). */
  bgWindow: number[];
}

function quotaStateFor(hostname: string): QuotaState {
  const q = globalThis as typeof globalThis & { __movvizRequestQuotas?: Map<string, QuotaState> };
  const quotas = (q.__movvizRequestQuotas ??= new Map());
  let st = quotas.get(hostname);
  if (!st) {
    st = { window: [], bgWindow: [] };
    quotas.set(hostname, st);
  }
  // HMR peut laisser une ancienne forme sans bgWindow — compléter plutôt que planter.
  if (!st.bgWindow) st.bgWindow = [];
  return st;
}

function globalQuotaState(): QuotaState {
  const q = globalThis as typeof globalThis & { __movvizGlobalRequestQuota?: QuotaState };
  const st = (q.__movvizGlobalRequestQuota ??= { window: [], bgWindow: [] });
  if (!st.bgWindow) st.bgWindow = [];
  return st;
}

function hostnameOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return baseUrl;
  }
}

function quotaFor(baseUrl: string): number {
  return INDEXER_REQUEST_QUOTAS[hostnameOf(baseUrl)] ?? DEFAULT_INDEXER_QUOTA;
}

/** Wait for a free slot in a 60s sliding window, then consume one. */
async function waitForSlot(st: QuotaState, max: number, field: "window" | "bgWindow" = "window"): Promise<void> {
  const WINDOW_MS = 60_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    st[field] = st[field].filter((t) => now - t < WINDOW_MS);
    if (st[field].length < max) {
      st[field].push(Date.now());
      return;
    }
    const oldest = st[field][0];
    await new Promise<void>((resolve) => setTimeout(resolve, Math.max(250, oldest + WINDOW_MS - Date.now())));
  }
}

/**
 * Throttle one outgoing request against the indexer's per-minute quota.
 * Waits (async) until a slot is free in the 60s sliding window. Every
 * indexer gets the default quota (20 req/min) unless it has an entry in
 * INDEXER_REQUEST_QUOTAS.
 *
 * Voie background : fenêtre « bg » d'abord (quota − réserve utilisateur),
 * puis fenêtre « all » (plafond réel). Voie utilisateur (défaut) : fenêtre
 * « all » seule — la réserve lui est acquise.
 */
export async function throttleIndexerRequest(baseUrl: string, lane: Lane = currentLane()): Promise<void> {
  const max = quotaFor(baseUrl);
  if (max <= 0) return;
  const st = quotaStateFor(hostnameOf(baseUrl));
  if (lane === "background") {
    await waitForSlot(st, Math.max(1, max - USER_QUOTA_RESERVE), "bgWindow");
  }
  await waitForSlot(st, max);
}

/** Throttle against the global cross-indexer budget (40 req/min total). */
export async function throttleGlobalIndexerRequest(lane: Lane = currentLane()): Promise<void> {
  const st = globalQuotaState();
  if (lane === "background") {
    await waitForSlot(st, GLOBAL_QUOTA_PER_MIN - GLOBAL_USER_RESERVE, "bgWindow");
  }
  await waitForSlot(st, GLOBAL_QUOTA_PER_MIN);
}

/** Mark an indexer as rate-limited (cooldown starts now + 10 min). */
export function markRateLimited(indexerId: string) {
  limits.set(indexerId, Date.now() + COOLDOWN_MS);
}

/** Remove the rate-limit for an indexer (e.g. after a successful test). */
export function clearRateLimit(indexerId: string) {
  limits.delete(indexerId);
}

/** Remove ALL rate limits — called once at server boot so a 429 during the
 *  initial cache seed doesn't lock out every configured indexer for 10 min,
 *  making the RSS scan (and therefore every search) useless until the
 *  cooldown expires. Rate limits are in-memory only and don't survive a
 *  restart, so this starts fresh every boot anyway — this just makes sure
 *  the first cycle itself doesn't poison the 10 min window. */
export function clearAllRateLimits() {
  limits.clear();
}

/** Is this indexer currently in cooldown? */
export function isRateLimited(indexerId: string): boolean {
  const until = limits.get(indexerId);
  if (!until) return false;
  if (Date.now() >= until) {
    limits.delete(indexerId);
    return false;
  }
  return true;
}

/** Filter a list of indexers to only those not currently rate-limited. */
export function withoutRateLimited<T extends { id: string }>(indexers: T[]): T[] {
  return indexers.filter((i) => !isRateLimited(i.id));
}

/**
 * Of a set of indexers that were NOT rate-limited when a direct search
 * started (i.e. came out of withoutRateLimited), how many are rate-limited
 * right now? Since nothing else marks an indexer rate-limited except a 429
 * response inside that same search, a non-zero count here means a 429 was
 * actually hit during the search that just ran — as opposed to an indexer
 * that was already in cooldown before the search even started. Used by the
 * diagnostic search log so "0 résultat" can say *why*: a real 429 hit,
 * indexers already in cooldown, or genuinely nothing found.
 */
export function countNewlyRateLimited(queriedIndexers: { id: string }[]): number {
  return queriedIndexers.filter((i) => isRateLimited(i.id)).length;
}
