import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getCachedPlexUserContext } from "@/lib/plex/plexUserContext";
import { getObservedStatesForUser, getAllObservedStates } from "@/lib/plex/plexObservedState";
import { getCircuitState } from "@/lib/plex/plexCircuitBreaker";
import { getHistoryCursor } from "@/lib/plex/plexHistoryObserver";
import { getBootstrapState } from "@/lib/plex/plexHistoryBootstrap";
import { getCanonicalWatchStatus } from "@/lib/userContext/watchBridge";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getPendingSyncStates } from "@/lib/userContext/syncState";
import { getSearchLog } from "@/lib/diagnostic/searchLog";

export const dynamic = "force-dynamic";

/**
 * Observability endpoint (§63) – per-user Plex sync diagnostics.
 * Admin only. Never exposes tokens, only fingerprints.
 */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  const machineIdentifier = cfg.machineIdentifier ?? null;
  const users = loadUsers();

  const perUser = users.map((u) => {
    const ctx = getCachedPlexUserContext(u.id);
    const canonical = getCanonicalWatchStatus(u.id);
    const legacy = getWatchStatus(u.id);
    const observed = machineIdentifier ? getObservedStatesForUser(u.id, machineIdentifier) : new Map();
    const watchedObserved = [...observed.values()].filter((s) => s.state === "WATCHED");
    const historyCursor = machineIdentifier ? getHistoryCursor(u.id, machineIdentifier) : null;
    const bootstrap = machineIdentifier ? getBootstrapState(u.id, machineIdentifier) : null;
    const circuit = getCircuitState(u.id);
    const pending = getPendingSyncStates({ target: "plex", field: "watched", capabilities: ["PENDING", "ERROR"] }).filter((s) => s.userId === u.id);

    // Counters from last searchLog lines for this user (best-effort)
    const logs = getSearchLog().filter((l) => l.message.includes(u.username)).slice(-5);

    return {
      movvizUserId: u.id,
      username: u.username,
      plexId: u.plexId,
      plexManagedUserId: u.plexManagedUserId,
      bindingType: u.plexManagedUserId ? "managed" : u.plexId ? (u.role === "admin" && u.plexToken === cfg.adminToken ? "owner" : "shared") : "none",
      bindingStatus: ctx ? "resolved" : (u.plexId || u.plexManagedUserId ? "unresolved" : "no_plex_identity"),
      plexDisplayName: ctx?.plexUsername ?? ctx?.plexTitle ?? null,
      plexAccountId: ctx?.plexAccountId ?? null,
      plexManagedUserIdResolved: ctx?.plexManagedUserId ?? null,
      machineIdentifier: ctx?.machineIdentifier ?? machineIdentifier,
      authSource: ctx?.authSource ?? null,
      tokenResolved: !!ctx,
      tokenFingerprint: ctx?.tokenFingerprint ?? null,
      resolvedAt: ctx?.resolvedAt ?? null,
      localAccountId: ctx?.localAccountId ?? null,
      localAccountName: ctx?.localAccountName ?? null,
      lastHistoryPoll: historyCursor?.updatedAt ?? null,
      lastHistoryViewedAt: historyCursor?.lastViewedAt ?? null,
      historyKeyCount: historyCursor?.historyKeyCount ?? 0,
      historyBootstrapStatus: bootstrap?.status ?? null,
      historyBootstrapProcessed: bootstrap?.processedEvents ?? 0,
      historyBootstrapTotal: bootstrap?.expectedTotal ?? null,
      historyBootstrapResolved: bootstrap?.resolvedEvents ?? 0,
      historyBootstrapUnresolved: bootstrap?.unresolvedEvents ?? 0,
      historyBootstrapStartedAt: bootstrap?.startedAt ?? null,
      historyBootstrapCompletedAt: bootstrap?.completedAt ?? null,
      historyBootstrapCurrentStart: bootstrap?.currentStart ?? 0,
      historyBootstrapError: bootstrap?.error ?? null,
      historyIncrementalCursor: historyCursor ? { lastViewedAt: historyCursor.lastViewedAt, seenKeys: historyCursor.seenEventKeysAtTimestamp ?? [] } : null,
      moviesObservedWatched: watchedObserved.filter((s) => s.ratingKey).length, // approximate
      episodesObservedWatched: watchedObserved.length, // includes both but filtered above is total; keep simple
      totalObserved: observed.size,
      canonicalMovies: canonical ? canonical.movies.length : (legacy?.movies.length ?? 0),
      canonicalEpisodes: canonical ? canonical.episodes.length : (legacy?.episodes.length ?? 0),
      legacyMovies: legacy?.movies.length ?? 0,
      legacyEpisodes: legacy?.episodes.length ?? 0,
      outboxPending: pending.filter((p) => p.capability === "PENDING").length,
      outboxErrors: pending.filter((p) => p.capability === "ERROR").length,
      circuitFailureCount: circuit?.failureCount ?? 0,
      circuitNextRetryAt: circuit?.nextRetryAt ?? null,
      circuitLastError: circuit?.lastError ?? null,
      recentLogs: logs.map((l) => ({ t: l.t, level: l.level, step: l.step, message: l.message.slice(0, 400) })),
    };
  });

  // Global snapshot stats
  const allObserved = getAllObservedStates();
  const global = {
    machineIdentifier,
    totalObservedEntries: allObserved.length,
    totalUsersWithPlex: users.filter((u) => u.plexId || u.plexManagedUserId).length,
    plexConfigured: !!cfg.hostname && !!cfg.adminToken,
  };

  return NextResponse.json({ global, users: perUser }, { headers: { "Cache-Control": "private, no-store" } });
}
