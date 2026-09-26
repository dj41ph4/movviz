import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import type { User } from "@/lib/auth/types";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { syncUserWatchStatusForMedia, syncUserWatchStatusForSeries, syncUserWatchStatusIfDue } from "@/lib/plex/watchSync";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";

export const dynamic = "force-dynamic";

/** A title page re-checked against Plex at most this often. */
const TARGETED_COOLDOWN_MS = 2 * 60_000;

const g = globalThis as typeof globalThis & {
  __movvizWatchStatusChecks?: Map<string, { running: boolean; doneAt: number }>;
};
const checks = (g.__movvizWatchStatusChecks ??= new Map());

/**
 * Checks this title (or the whole profile) against Plex in the background.
 * The answer used to wait for it: for the Plex server owner, a series page
 * read every episode from Plex in sequential batches of 50 — 10 to 50 s on a
 * long show — so Android TV gave up at 20 s while the server went on, every
 * page opened started another full check, and the TV's own requests queued
 * behind them: pages that never came, pictures stuck from the previous page.
 * Now the page gets the known state at once; a real change found by Plex
 * reaches every device through the live « watch » event (emitWatchChanged).
 * One check at a time per title, and not again within the cooldown.
 */
function checkInBackground(key: string, run: () => Promise<unknown>): void {
  const entry = checks.get(key);
  if (entry?.running) return;
  if (entry && Date.now() - entry.doneAt < TARGETED_COOLDOWN_MS) return;
  checks.set(key, { running: true, doneAt: entry?.doneAt ?? 0 });
  void run()
    .catch(() => { /* best effort: the next page visit after the cooldown retries */ })
    .finally(() => checks.set(key, { running: false, doneAt: Date.now() }));
}

function startPlexCheck(user: User, type: string | null, tmdbId: number): void {
  if (type === "movie" && Number.isInteger(tmdbId) && tmdbId > 0) {
    checkInBackground(`${user.id}:movie:${tmdbId}`, () => syncUserWatchStatusForMedia(user, { type: "movie", tmdbId }));
  } else if (type === "series" && Number.isInteger(tmdbId) && tmdbId > 0) {
    checkInBackground(`${user.id}:series:${tmdbId}`, () => syncUserWatchStatusForSeries(user, tmdbId));
  } else {
    // The per-user gate inside prevents every card from triggering a full scan.
    void syncUserWatchStatusIfDue(user).catch(() => {});
  }
}

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  startPlexCheck(user, req.nextUrl.searchParams.get("type"), Number(req.nextUrl.searchParams.get("tmdbId")));
  // Phase 4 du plan de finalisation (2026-09) : la réponse client vient
  // désormais de user_media_state (la vraie source de vérité), pas du
  // miroir JSON legacy — qui peut rester périmé pour des raisons qui
  // n'affectent pas SQLite. Repli JSON uniquement si le moteur de contexte
  // est indisponible (MOVVIZ_CONTEXT_ENGINE_DISABLED, ou runtime sans
  // node:sqlite) — jamais un repli silencieux vers une liste vide.
  const canonical = getCanonicalWatchStatus(user.id);
  const status = canonical ?? getWatchStatus(user.id);
  return NextResponse.json(
    { movies: status?.movies ?? [], episodes: status?.episodes ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
