import { matchesBlockedWord, type ReleaseRules } from "@/lib/library/releaseRules";
import { recordDecision } from "@/lib/library/decisionLog";

/**
 * The final, unbypassable gate before an AUTOMATIC grab — title/year/season/
 * episode/resolution/score are already enforced by the candidate filter
 * chains in autoGrab.ts/autoGrabSeries.ts (releaseTitleMatches now also
 * rejects a sequel-number conflict — see matching.ts's sequelNumbersConflict).
 * What was missing is a genuine hard veto for blocked words: `ReleaseRules
 * .blockedWords` used to only apply a -70 score penalty inside torznab.ts's
 * score() — a high enough base score (resolution/seeders/custom-format
 * bonuses) could still clear a profile's minScore and get auto-grabbed
 * despite containing a blocked term, contradicting ReleaseRulesPanel's own
 * copy ("rejected regardless of score"). This makes that promise true.
 *
 * Deliberately scoped to the automatic pipeline only — manual search
 * (ManualSearchModal / /api/indexers/search) never calls this, so a blocked
 * release still shows up there (just visibly penalized), matching the
 * standing rule: automatic downloads never get a blocked release, manual
 * search always lets the user see and override.
 */
export function isBlockedForAutoGrab(
  releaseTitle: string,
  rules: ReleaseRules,
  refTitle?: string
): { blocked: boolean; matchedTerm: string | null } {
  const matchedTerm = matchesBlockedWord(releaseTitle, rules);
  if (matchedTerm && refTitle) {
    recordDecision({
      refTitle,
      releaseTitle,
      decision: "rejected",
      reasons: [{ type: "blocked_word", message: `Terme interdit détecté : "${matchedTerm}"` }],
    });
  }
  return { blocked: !!matchedTerm, matchedTerm };
}

/** Structured explanation of an automatic-grab decision — one candidate at a
 *  time. Only the two checks decisionGuard itself owns (release date via the
 *  caller-supplied `releasedYet`, and the blocked-word veto) are represented
 *  here for now; the upstream filter chains that already ran before a
 *  candidate reaches this point (title/year/season/episode/resolution/score)
 *  are summarized as a single "matched profile" reason on acceptance. */
export interface DecisionReason {
  decision: "accepted" | "rejected" | "waiting";
  reasons: { type: string; impact?: string; message: string }[];
}

export function evaluateAutomaticCandidate(params: {
  releaseTitle: string;
  releasedYet: boolean;
  rules: ReleaseRules;
}): DecisionReason {
  if (!params.releasedYet) {
    return { decision: "waiting", reasons: [{ type: "release_date", message: "Date de sortie pas encore atteinte" }] };
  }
  const { blocked, matchedTerm } = isBlockedForAutoGrab(params.releaseTitle, params.rules);
  if (blocked) {
    return { decision: "rejected", reasons: [{ type: "blocked_word", message: `Terme interdit détecté : "${matchedTerm}"` }] };
  }
  return { decision: "accepted", reasons: [{ type: "profile_match", message: "Correspond au profil de qualité" }] };
}
