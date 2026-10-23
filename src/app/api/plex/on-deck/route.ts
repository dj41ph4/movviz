import { NextRequest, NextResponse } from "next/server";
import { compressedJson } from "@/lib/http/compressedJson";
import { requireUser } from "@/lib/auth/guard";
import type { User } from "@/lib/auth/types";
import { eventBus } from "@/lib/events/EventBus";
import { listOnDeckEntries, type OnDeckEntry } from "@/lib/plex/onDeckService";
import { loadPlexConfig } from "@/lib/plex/store";
import { getVerifiedOnDeck } from "@/lib/plex/watchWrite";

export const dynamic = "force-dynamic";
export type { OnDeckEntry } from "@/lib/plex/onDeckService";

/**
 * « Reprendre » asks Plex live (its onDeck, then the TMDb ids of each title):
 * 2 to 5 s on every call, twice per title page on Android TV — a slow request
 * holding a slot while the page itself waited behind it. The last answer is
 * now served at once and refreshed in the background. It is dropped the
 * moment this profile's views or resume positions change (« watch » event),
 * so a title marked seen never comes back from the cache.
 */
const FRESH_MS = 15_000;
const MAX_AGE_MS = 10 * 60_000;

const g = globalThis as typeof globalThis & {
  __movvizOnDeckValidatedCache?: Map<string, { items: OnDeckEntry[]; at: number }>;
  __movvizOnDeckValidatedInFlight?: Map<string, Promise<OnDeckEntry[]>>;
  __movvizOnDeckValidatedTail?: Map<string, Promise<void>>;
  __movvizOnDeckValidatedGeneration?: Map<string, number>;
  __movvizOnDeckValidatedInvalidation?: boolean;
};
// Do not retain entries from the previous unvalidated policy on a hot upgrade.
const cache = (g.__movvizOnDeckValidatedCache ??= new Map());
const inFlight = (g.__movvizOnDeckValidatedInFlight ??= new Map());
const tails = (g.__movvizOnDeckValidatedTail ??= new Map());
const generations = (g.__movvizOnDeckValidatedGeneration ??= new Map());
if (!g.__movvizOnDeckValidatedInvalidation) {
  g.__movvizOnDeckValidatedInvalidation = true;
  eventBus.on((event) => {
    if (event.type === "watch_changed") {
      cache.delete(event.userId);
      inFlight.delete(event.userId);
      generations.set(event.userId, (generations.get(event.userId) ?? 0) + 1);
    }
  });
}

function publish(userId: string, generation: number, items: OnDeckEntry[], notify: boolean): boolean {
  if ((generations.get(userId) ?? 0) !== generation) return false;
  cache.set(userId, { items, at: Date.now() });
  if (notify) eventBus.emit({ type: "on_deck_refreshed", userId });
  return true;
}

function refresh(user: User): Promise<OnDeckEntry[]> {
  const running = inFlight.get(user.id);
  if (running) return running;
  if (tails.has(user.id) && cache.has(user.id)) return Promise.resolve(cache.get(user.id)!.items);
  const generation = generations.get(user.id) ?? 0;
  const hadCache = cache.has(user.id);
  const job = (async () => {
    // A warm response remains visible while the complete Plex sync runs.
    if (hadCache) {
      const items = await listOnDeckEntries(user);
      publish(user.id, generation, items, true);
      return cache.get(user.id)?.items ?? [];
    }

    const cfg = loadPlexConfig();
    if (!cfg.hostname) {
      const items = await listOnDeckEntries(user);
      publish(user.id, generation, items, true);
      return cache.get(user.id)?.items ?? [];
    }

    // Fetch and verify the profile's Plex list once. Only the five newest
    // entries need metadata before the cold request can answer.
    const verifiedPlexItems = await getVerifiedOnDeck(user, cfg);
    const first = await listOnDeckEntries(user, {
      verifiedPlexItems,
      maxPlexItems: 5,
      includeStills: false,
    });
    if (!publish(user.id, generation, first, false)) return cache.get(user.id)?.items ?? [];

    // Resolve the rest in small batches. Each successful batch becomes
    // visible to web clients by SSE and to other platforms on their next GET.
    if (verifiedPlexItems.length > 5 || first.some((item) => item.type === "episode")) {
      const tail = new Promise<void>((resolve) => setImmediate(resolve))
        .then(async () => {
          for (let count = 10; count < verifiedPlexItems.length; count += 10) {
            if ((generations.get(user.id) ?? 0) !== generation) return;
            const items = await listOnDeckEntries(user, {
              verifiedPlexItems,
              maxPlexItems: count,
              includeStills: false,
            });
            if (!publish(user.id, generation, items, true)) return;
          }
          if ((generations.get(user.id) ?? 0) !== generation) return;
          const complete = await listOnDeckEntries(user, { verifiedPlexItems });
          publish(user.id, generation, complete, true);
        })
        .catch((error) => console.error("[on-deck] progressive Plex refresh failed:", error))
        .finally(() => { if (tails.get(user.id) === tail) tails.delete(user.id); });
      tails.set(user.id, tail);
    }
    return first;
  })().finally(() => { if (inFlight.get(user.id) === job) inFlight.delete(user.id); });
  inFlight.set(user.id, job);
  return job;
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cached = cache.get(user.id);
  const age = cached ? Date.now() - cached.at : Infinity;
  let items: OnDeckEntry[];
  if (cached && age < MAX_AGE_MS) {
    if (age > FRESH_MS) void refresh(user).catch(() => {});
    items = cached.items;
  } else {
    items = await refresh(user);
  }
  return compressedJson(req, { items }, { headers: { "Cache-Control": "private, no-store" } });
}
