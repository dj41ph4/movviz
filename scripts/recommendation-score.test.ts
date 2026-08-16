import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCandidates, type MoodContext, type FranchiseContext, type FatigueContext } from "@/lib/ai/recommendationScore";
import type { TasteVector } from "@/lib/ai/contrastiveProfile";
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

// --- Vague 2 : paliers de distance, continuation de franchise, fatigue, confiance ---

const franchiseMovie2: ResolvedAiItem = {
  title: "Saga 2", year: 2020, type: "movie", tmdbId: 998002,
  overview: "", posterPath: null, rating: 7, inLibrary: false,
};
const franchiseMovie4: ResolvedAiItem = {
  title: "Saga 4", year: 2024, type: "movie", tmdbId: 998004,
  overview: "", posterPath: null, rating: 7, inLibrary: false,
};

test("distance : même franchise => very_close, quel que soit le mood", () => {
  const franchise: FranchiseContext = { tmdbIds: new Set([998002, 998004]), nextTmdbId: 998002 };
  const ranked = scoreCandidates(
    "test-user-distance", [franchiseMovie2], new Map(), 6, undefined, undefined, franchise
  );
  assert.equal(ranked[0].distance, "very_close");
});

test("distance : mood proche sans franchise => close/mood_match/conceptual_match selon la similarité, discovery sans référence", () => {
  const c: ResolvedAiItem = { title: "X", type: "movie", tmdbId: 998010, overview: "", posterPath: null, rating: 7, inLibrary: false };
  const mood: MoodContext = {
    reference: { humour: { absurde: 0.9 } },
    candidates: new Map([["movie:998010", { humour: { absurde: 0.85 } }]]), // très proche
  };
  const close = scoreCandidates("test-user-distance-2", [c], new Map(), 6, mood);
  assert.equal(close[0].distance, "close");

  const noMood = scoreCandidates("test-user-distance-3", [c], new Map(), 6);
  assert.equal(noMood[0].distance, "discovery", "sans mood du tout, jamais 'close' — pas de référence exploitable");
});

test("continuation de franchise : le PROCHAIN épisode non vu bat un autre épisode de la même saga, à tout le reste égal", () => {
  const franchise: FranchiseContext = { tmdbIds: new Set([998002, 998004]), nextTmdbId: 998004 };
  const ranked = scoreCandidates(
    "test-user-franchise", [franchiseMovie2, franchiseMovie4], new Map(), 6, undefined, undefined, franchise
  );
  const next = ranked.find((r) => r.tmdbId === 998004)!;
  const other = ranked.find((r) => r.tmdbId === 998002)!;
  assert.ok(next.score > other.score, "le prochain épisode (+20) doit dominer le reste de la saga (+10)");
});

test("fatigue de contenu : un candidat au mood très proche de ce qui vient d'être beaucoup regardé perd des points, sans jamais être exclu", () => {
  const c: ResolvedAiItem = { title: "Encore pareil", type: "movie", tmdbId: 998020, overview: "", posterPath: null, rating: 7, inLibrary: false };
  const mood: MoodContext = {
    reference: { tonalite: { sombre: 0.9 } },
    candidates: new Map([["movie:998020", { tonalite: { sombre: 0.9 } }]]),
  };
  const fatigue: FatigueContext = { profile: { tonalite: { sombre: 0.9 } }, strength: 1 };

  const withoutFatigue = scoreCandidates("test-user-fatigue-1", [c], new Map(), 6, mood);
  const withFatigue = scoreCandidates("test-user-fatigue-2", [c], new Map(), 6, mood, undefined, undefined, fatigue);

  assert.ok(withFatigue[0].score < withoutFatigue[0].score, "la fatigue doit réduire le score");
  assert.equal(withFatigue.length, 1, "jamais une exclusion dure — juste une pénalité légère");
});

test("TasteCompatibility : la confiance du TasteVector module l'ampleur de l'effet, jamais tout ou rien", () => {
  const c: ResolvedAiItem = { title: "Y", type: "movie", tmdbId: 998030, overview: "", posterPath: null, rating: 7, inLibrary: false };
  const mood: MoodContext = {
    reference: { humour: { absurde: 0.5 } },
    candidates: new Map([["movie:998030", { humour: { absurde: 0.9 } }]]),
  };
  const lowConfidence: TasteVector = { liked: { humour: { absurde: 0.9 } }, disliked: {}, confidence: 0.2, evidence: { liked: [], disliked: [] } };
  const highConfidence: TasteVector = { ...lowConfidence, confidence: 1 };

  const low = scoreCandidates("test-user-conf-1", [c], new Map(), 6, mood, lowConfidence)[0].score;
  const baseline = scoreCandidates("test-user-conf-2", [c], new Map(), 6, mood)[0].score;
  const high = scoreCandidates("test-user-conf-3", [c], new Map(), 6, mood, highConfidence)[0].score;

  assert.ok(low > baseline, "même une confiance faible ajoute un peu de signal");
  assert.ok(high > low, "une confiance plus forte doit peser plus lourd");
});
