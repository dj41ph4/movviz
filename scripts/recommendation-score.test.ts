import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCandidates, type MoodContext } from "@/lib/ai/recommendationScore";
import type { ResolvedAiItem } from "@/lib/ai/actions";

/**
 * The "Scary Movie → Naked Gun" reference case from AI.MD §2.X: the moment
 * the whole v2 spec is built around ("if the engine gets there for the
 * RIGHT reasons — humor mechanics, not TMDb genre — the bar is cleared").
 * This can only test the Movviz-side half of that (does the scoring
 * pipeline actually rank a mood-matching candidate above a generic one,
 * given the kind of mood profile the Mood Engine would produce?) — it
 * does NOT test whether the LLM itself proposes Naked Gun as a candidate
 * in the first place, which needs a live authenticated session this repo
 * has no way to exercise from a test file. Honest partial coverage, not a
 * substitute for the real end-to-end check.
 */
const userId = "test-user-scary-movie";

const scaryMovieMood = {
  humour: { absurde: 0.97, parodie: 0.99, humour_visuel: 0.86, wtf: 0.95 },
  energie: { rapide: 0.91 },
  tonalite: { leger: 0.92, seriosite: 0.08 },
};

const nakedGun: ResolvedAiItem = {
  title: "Naked Gun", year: 1988, type: "movie", tmdbId: 999001,
  overview: "", posterPath: null, rating: 7.5, inLibrary: false,
};
const nakedGunMood = {
  humour: { absurde: 0.9, parodie: 0.95, humour_visuel: 0.8, wtf: 0.85 },
  energie: { rapide: 0.85 },
  tonalite: { leger: 0.9, seriosite: 0.1 },
};

const genericComedy: ResolvedAiItem = {
  title: "Comédie Lambda", year: 2015, type: "movie", tmdbId: 999002,
  overview: "", posterPath: null, rating: 7.5, inLibrary: false,
};
const genericComedyMood = {
  humour: { absurde: 0.2, parodie: 0.1, humour_visuel: 0.3, wtf: 0.1 },
  energie: { rapide: 0.3 },
  tonalite: { leger: 0.5, seriosite: 0.6 },
};

test("scoring: à note TMDb identique, un candidat au mood proche de la référence (Naked Gun / Scary Movie) bat une comédie générique sans lien de ton", () => {
  const candidates = [genericComedy, nakedGun]; // deliberately listed with the wrong one first
  const reasons = new Map<string, string | undefined>([
    ["movie:999001", "Même humour absurde, enchaînement de gags parodiques"],
    ["movie:999002", "Une comédie sans rapport particulier"],
  ]);
  const mood: MoodContext = {
    reference: scaryMovieMood,
    candidates: new Map([
      ["movie:999001", nakedGunMood],
      ["movie:999002", genericComedyMood],
    ]),
  };

  const ranked = scoreCandidates(userId, candidates, reasons, 6, mood);

  assert.equal(ranked[0].tmdbId, 999001, "Naked Gun doit sortir en tête, pas la comédie générique");
  const nakedGunScore = ranked.find((r) => r.tmdbId === 999001)!.score;
  const genericScore = ranked.find((r) => r.tmdbId === 999002)!.score;
  assert.ok(nakedGunScore > genericScore, "l'écart de score doit refléter la proximité de mood, pas juste la note TMDb (identique ici)");
});
