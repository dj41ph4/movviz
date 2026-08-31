/**
 * Phase 1 — pure, isomorphic contracts for the new playback engine (see
 * PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md). Nothing in this directory is wired
 * to the live player yet — that starts at Phase 9 (Direct Play), gated
 * behind the `playbackDecisionV2` feature flag from §67 once it exists.
 * Import from here rather than the individual files once more than one
 * contract is needed.
 *
 * Deliberately NOT re-exported here: mediaProbe.ts / mediaProbeCache.ts
 * (Phase 2) — they pull in node:child_process/node:fs and must stay
 * server-only. A future client-side capability detector (Phase 3) will want
 * ClientPlaybackProfile from this exact barrel, so it can never bundle
 * those. Import the probe modules directly from their own path instead.
 */

export * from "./mediaDescriptor";
export * from "./clientProfile";
export * from "./serverCapabilities";
export * from "./playbackPlan";
export * from "./decidePlayback";
