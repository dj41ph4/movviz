import type { AiRecommendation } from "@/lib/ai/types";

/** « montre-moi ses films », « les 10 meilleurs », « montre en 8 » — a list
 *  request about the person the conversation is on, without naming them.
 *  Seen live: none of these reached the TMDb filmography search, the model
 *  answered from memory with no cards, and even claimed it had no access to
 *  an online catalogue. The caller only acts on it when a person really was
 *  resolved just before (AiChatSession.activePerson). */
export interface PersonListFollowUp {
  count?: number;
  best: boolean;
  scope: "movie" | "series" | "all";
  /** « ses films » / « sa filmographie »: the person is named by a pronoun. */
  pronoun: boolean;
}

const PRONOUN_RE = /\b(?:ses|leurs?)\s+(?:films?|s[ée]ries?|[œo]e?uvres?|r[ée]alisations?)\b|\bsa\s+filmographie\b/i;
const SHOW_LIST_RE = /\b(?:re)?montr\w*(?:[- ]?moi)?[- ](?:les\b|en\s+\d|tous\b|toutes\b|\d)|\bles\s+\d{1,2}\s+(?:meilleur|plus|premier|derni)|\b(?:liste|top\s*\d{1,2})\b/i;
const NOT_A_LIST_RE = /bande[- ]?annonce|trailer|\bfiche\b|\blance\b|\bjoue\b|\bnote\b/i;
const MAX_WORDS = 12;

export function extractPersonListFollowUp(message: string): PersonListFollowUp | null {
  const m = message.replace(/[’‘]/g, "'").trim();
  if (!m || m.split(/\s+/).length > MAX_WORDS || NOT_A_LIST_RE.test(m)) return null;
  const pronoun = PRONOUN_RE.test(m);
  if (!pronoun && !SHOW_LIST_RE.test(m)) return null;
  const n = Number(m.match(/\b(\d{1,2})\b/)?.[1]);
  const scope = /s[ée]ries?/i.test(m) && !/films?/i.test(m)
    ? "series" as const
    : /films?/i.test(m) && !/s[ée]ries?/i.test(m) ? "movie" as const : "all" as const;
  return {
    count: Number.isFinite(n) && n > 0 ? n : undefined,
    best: /meilleur|mieux not|\btop\b/i.test(m),
    scope,
    pronoun,
  };
}

/** One person credit, as getPerson() returns it (already sorted by popularity). */
export interface PersonCredit {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  year?: number | null;
  overview: string;
  posterPath: string | null;
  rating: number;
  inLibrary: boolean;
}

/** A person's list as cards, like any genre recommendation. */
export const PERSON_LIST_MAX = 30;

export function buildPersonListCards(credits: PersonCredit[], options: { count?: number; best: boolean }): AiRecommendation[] {
  const pool = options.best
    ? credits.filter((c) => c.rating > 0).sort((a, b) => b.rating - a.rating)
    : credits;
  const limit = Math.min(options.count ?? PERSON_LIST_MAX, PERSON_LIST_MAX);
  return pool.slice(0, limit).map((c) => ({
    title: c.title,
    year: c.year ?? undefined,
    type: c.type,
    tmdbId: c.tmdbId,
    overview: c.overview,
    posterPath: c.posterPath,
    rating: c.rating,
    inLibrary: c.inLibrary,
  }));
}

/** The line above the cards — plain facts (what is shown, out of how many,
 *  how many the user already owns); the model never has to make them up. */
export function personListIntro(name: string, cards: AiRecommendation[], total: number, options: { count?: number; best: boolean; scope: "movie" | "series" | "all"; directorOnly: boolean }): string {
  if (!cards.length) return `Je n'ai trouvé aucun titre fiable pour ${name} dans les données TMDb.`;
  const kind = options.scope === "movie" ? "films" : options.scope === "series" ? "séries" : "titres";
  const owned = cards.filter((c) => c.inLibrary).length;
  const ownedNote = owned === 0
    ? " Aucun n'est encore dans ta bibliothèque."
    : owned === cards.length ? " Tu les as déjà tous." : ` Tu en as déjà ${owned} dans ta bibliothèque.`;
  const role = options.directorOnly ? " réalisés par" : " de";
  const head = options.best
    ? `Les ${cards.length} ${kind} les mieux notés${role} ${name}`
    : cards.length < total
      ? `Les ${cards.length} ${kind} les plus connus${role} ${name} (sur ${total})`
      : `Les ${total} ${kind}${role} ${name}`;
  return `${head} 🎬${ownedNote}`;
}
