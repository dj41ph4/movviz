import { getCurrentWatchState, applyWatchDecision } from "@/lib/userContext/watchBridge";
import type { WatchSource } from "@/lib/userContext/watchBridge";
import type { PlexObservedState } from "./plexObservedState";
import type { CanonicalMediaIdentity } from "./mediaIdentityMap";

export type ReconcileDecision =
  | "UNCHANGED"
  | "ACK_LOCAL_WRITE" // Plex observation matches pending local intent
  | "REMOTE_WATCHED"
  | "REMOTE_UNWATCHED"
  | "CONFLICT" // both local and remote changed, need resolution
  | "BASELINE" // first observation, no prior
  | "STALE_OBSERVATION" // observed state older than canonical, ignore
  | "IGNORED_MISSING_MEDIA"; // ratingKey removed from library, not a watch transition

export interface ReconcileInput {
  userId: string;
  canonicalIdentity: CanonicalMediaIdentity;
  ratingKey: string;
  machineIdentifier: string;
  currentCanonicalState: "watched" | "unwatched" | "unknown";
  currentCanonicalAt: number | null;
  previousPlexObserved: PlexObservedState | null;
  currentPlexObserved: PlexObservedState | null;
  pendingIntent?: { desiredState: "watched" | "unwatched"; revision: number; sourceEventId: string } | null;
  // Whether this is the very first snapshot for this user (baseline handling)
  isBaseline?: boolean;
}

export interface ReconcileResult {
  decision: ReconcileDecision;
  shouldApply: boolean;
  newCanonicalState?: "watched" | "unwatched";
  reason: string;
  // For ACK case, the pendingIntent is considered fulfilled
}

/**
 * Single decision point for all watch-state transitions (§40).
 * No observer writes directly to canonical store — everything passes through here.
 *
 * Rules:
 * - Baseline: first observation is recorded but not treated as transition unless it confirms watched that wasn't known
 * - UNCHANGED: currentPlex == previousPlex
 * - REMOTE_*: currentPlex differs from previousPlex and differs from canonical (-> apply)
 * - ACK_LOCAL_WRITE: currentPlex matches pendingIntent desiredState
 * - If currentPlex == null (media gone): IGNORED_MISSING_MEDIA (don't interpret removal as UNWATCHED §25)
 * - If observedAt is stale (older than canonical's watched_updated_at): STALE
 */
export function reconcile(input: ReconcileInput): ReconcileResult {
  const { previousPlexObserved, currentPlexObserved, currentCanonicalState, currentCanonicalAt, pendingIntent, isBaseline } = input;

  // Media removed from Plex? (§25) Don't interpret as UNWATCHED.
  if (!currentPlexObserved) {
    if (previousPlexObserved) {
      return { decision: "IGNORED_MISSING_MEDIA", shouldApply: false, reason: "media_removed_from_library" };
    }
    return { decision: "UNCHANGED", shouldApply: false, reason: "no_observation" };
  }
  if (currentPlexObserved.state === "UNKNOWN") {
    return { decision: "STALE_OBSERVATION", shouldApply: false, reason: "unknown_observation" };
  }

  const curState = currentPlexObserved.state === "WATCHED" ? "watched" : "unwatched";
  const prevState = previousPlexObserved
    ? previousPlexObserved.state === "UNKNOWN"
      ? null
      : previousPlexObserved.state === "WATCHED"
        ? "watched"
        : "unwatched"
    : null;

  // Baseline handling (§26, §2): first time we see this ratingKey for this user.
  // Must remain prudent but not block definitively a recent Plex WATCHED when Movviz is UNWATCHED.
  if (isBaseline || !previousPlexObserved) {
    if (currentCanonicalState === "unknown") {
      if (curState === "watched") {
        return { decision: "BASELINE", shouldApply: true, newCanonicalState: "watched", reason: "baseline_watched_import" };
      }
      return { decision: "BASELINE", shouldApply: false, reason: "baseline_unwatched_noop" };
    }
    // If Plex is WATCHED and canonical is UNWATCHED with a reliable newer timestamp, treat as real remote change
    if (curState === "watched" && currentCanonicalState === "unwatched") {
      const plexTime = currentPlexObserved.lastViewedAt ?? currentPlexObserved.observedAt;
      const canonicalTime = currentCanonicalAt ?? 0;
      // lastViewedAt is the real watch time, not snapshot time – if it's newer than canonical, it's a genuine newer event
      if (plexTime != null && plexTime > canonicalTime) {
        // Also ensure no pending local intent would be ACKed instead – pendingIntent check is done later, but baseline with pending is rare
        if (!pendingIntent || pendingIntent.desiredState !== "watched") {
          return { decision: "REMOTE_WATCHED", shouldApply: true, newCanonicalState: "watched", reason: "baseline_watched_newer_than_canonical" };
        }
      }
    }
    // Canonical already has a decision; baseline otherwise stays conservative.
    return { decision: "BASELINE", shouldApply: false, reason: "baseline_conservative_no_overwrite" };
  }

  // Check staleness: if observedAt < canonicalAt, ignore? But observedAt is snapshot time, not event time.
  // Use lastViewedAt if available as the "occurredAt" for watched; for unwatched we have no event time, use observedAt.
  const observedEventAt = curState === "watched" ? (currentPlexObserved.lastViewedAt ?? currentPlexObserved.observedAt) : currentPlexObserved.observedAt;
  if (currentCanonicalAt != null && observedEventAt < currentCanonicalAt) {
    // But if curState differs from canonical, could still be stale remote change that is older than canonical decision.
    // Don't apply stale remote that is older than canonical LWW winner.
    // However for ACK we still want to match.
    if (!pendingIntent || pendingIntent.desiredState !== curState) {
      // If remote state is same as canonical, it's just stale confirmation -> UNCHANGED
      if (curState === currentCanonicalState) {
        return { decision: "STALE_OBSERVATION", shouldApply: false, reason: "stale_but_same_state" };
      }
      // If remote differs but is stale, it's a stale conflict – ignore in favor of newer canonical.
      return { decision: "STALE_OBSERVATION", shouldApply: false, reason: "stale_remote_differs" };
    }
  }

  // ACK check: does current observation match pending local intent?
  if (pendingIntent && pendingIntent.desiredState === curState) {
    // Also ensure observation is not older than intent's occurredAt (but we don't have intent time here)
    // For now, any matching observation after intent qualifies as ACK.
    return { decision: "ACK_LOCAL_WRITE", shouldApply: false, reason: `ack_rev${pendingIntent.revision}` };
  }

  // Stale intent check §48: pending is for older revision than current canonical? That's handled by caller,
  // but if we are here and pending doesn't match current observation, it may be that remote changed before ACK.
  if (pendingIntent && pendingIntent.desiredState !== curState && prevState === pendingIntent.desiredState) {
    // We tried to go WATCHED, but Plex is still UNWATCHED after write – could be failure, keep pending for retry.
    // But if Plex changed to opposite of pending, and canonical is still at pending's desired state, this is a conflict.
    // Let's return CONFLICT so caller can decide to keep retrying or accept remote.
    // For now, treat as REMOTE transition if it differs from canonical.
    if (curState !== currentCanonicalState) {
      // Remote moved opposite to our intent before ACK – accept remote as new truth (conflict resolution: remote wins if newer)
      return {
        decision: "CONFLICT",
        shouldApply: true,
        newCanonicalState: curState,
        reason: `conflict_pending_${pendingIntent.desiredState}_observed_${curState}`,
      };
    }
  }

  // No change from previous observation
  if (prevState === curState) {
    return { decision: "UNCHANGED", shouldApply: false, reason: "no_transition" };
  }

  // Transition detected: previous -> current, and we are not in ACK state
  if (curState !== currentCanonicalState) {
    if (curState === "watched") {
      return { decision: "REMOTE_WATCHED", shouldApply: true, newCanonicalState: "watched", reason: `remote_${prevState}_to_${curState}` };
    } else {
      return { decision: "REMOTE_UNWATCHED", shouldApply: true, newCanonicalState: "unwatched", reason: `remote_${prevState}_to_${curState}` };
    }
  }

  // Remote changed but canonical already matches new remote (e.g., canonical was updated via another path)
  return { decision: "UNCHANGED", shouldApply: false, reason: "already_in_desired_state" };
}

/**
 * Apply the reconciler decision to the canonical store (if needed).
 * Returns true if canonical was updated.
 */
export function applyReconcileDecision(input: ReconcileInput, result: ReconcileResult, title?: string | null): boolean {
  if (!result.shouldApply || !result.newCanonicalState) return false;
  const canon = input.canonicalIdentity;
  const at = input.currentPlexObserved?.lastViewedAt ?? input.currentPlexObserved?.observedAt ?? Date.now();
  const source: WatchSource = "plex_history"; // observer-sourced, but represents watch state – use plex_history for compatibility with existing LWW
  // Use a deterministic sourceEventId for de-duplication: plex:<machine>:<ratingKey>:<observedState>
  const sourceEventId = `plex:state:${input.machineIdentifier}:${input.ratingKey}:${result.newCanonicalState}:${at}`;

  const res = applyWatchDecision({
    userId: input.userId,
    tmdbId: canon.type === "movie" ? canon.tmdbId : canon.type === "episode" ? canon.tmdbShowId : 0,
    mediaType: canon.type === "movie" ? "movie" : "episode",
    seasonNumber: canon.type === "episode" ? canon.seasonNumber : undefined,
    episodeNumber: canon.type === "episode" ? canon.episodeNumber : undefined,
    title: title ?? null,
    state: result.newCanonicalState,
    occurredAt: at,
    source,
    sourceEventId,
  });
  return res.accepted;
}
