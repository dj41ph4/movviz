import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import type { User } from "@/lib/auth/types";
import { eventBus } from "@/lib/events/EventBus";
import { listOnDeckEntries, type OnDeckEntry } from "@/lib/plex/onDeckService";

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
  __movvizOnDeckCache?: Map<string, { items: OnDeckEntry[]; at: number }>;
  __movvizOnDeckInFlight?: Map<string, Promise<OnDeckEntry[]>>;
  __movvizOnDeckInvalidation?: boolean;
};
const cache = (g.__movvizOnDeckCache ??= new Map());
const inFlight = (g.__movvizOnDeckInFlight ??= new Map());
if (!g.__movvizOnDeckInvalidation) {
  g.__movvizOnDeckInvalidation = true;
  eventBus.on((event) => {
    if (event.type === "watch_changed") cache.delete(event.userId);
  });
}

function refresh(user: User): Promise<OnDeckEntry[]> {
  const running = inFlight.get(user.id);
  if (running) return running;
  const startedAt = Date.now();
  const job = listOnDeckEntries(user)
    .then((items) => {
      // A change during the Plex call made this answer stale already.
      const current = cache.get(user.id);
      if (!current || current.at <= startedAt) cache.set(user.id, { items, at: Date.now() });
      return items;
    })
    .finally(() => inFlight.delete(user.id));
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
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
