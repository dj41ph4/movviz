/**
 * Phase 1 — pure contracts for the new playback engine (see
 * PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md). Nothing in this directory is wired
 * to the live player yet — that starts at Phase 9 (Direct Play), gated
 * behind the `playbackDecisionV2` feature flag from §67 once it exists.
 * Import from here rather than the individual files once more than one
 * contract is needed.
 */

export * from "./mediaDescriptor";
export * from "./clientProfile";
export * from "./serverCapabilities";
export * from "./playbackPlan";
