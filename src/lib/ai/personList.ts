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
// « ma liste » is the user's own list (watchlistAction.ts), never a request
// for a list of titles — seen live: « ajoute le deuxième à ma liste » put a
// whole filmography in the user's list.
const NOT_A_LIST_RE = /bande[- ]?annonce|trailer|\bfiche\b|\blance\b|\bjoue\b|\bnote\b|\b(?:ma|mes)\s+(?:liste|watch\s?list|favoris)\b|\bwatch\s?list\b/i;
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

/** « 10 films de Dupieux », « 3 films des Dupieux », « les 5 meilleurs films
 *  de Nolan » — a counted list naming the person. Seen live: « 10 film de
 *  dupieux » matched no filmography phrasing and the model recommended
 *  Détour mortel. The caller must confirm the name against TMDb
 *  (personNameMatches), so « 10 films d'horreur » never becomes a person. */
export function extractCountedPersonRequest(message: string): { count: number; best: boolean; scope: "movie" | "series"; entity: string } | null {
  const m = message.replace(/[’‘]/g, "'").trim();
  if (m.split(/\s+/).length > MAX_WORDS) return null;
  const match = m.match(/\b(\d{1,2})\s+(?:meilleur(?:e)?s?\s+)?(films?|s[ée]ries?)\s+(?:de\s+la\s+|de\s+|des\s+|du\s+|d')([^.!?\n]{2,40})$/i);
  if (!match) return null;
  const entity = match[3].trim().replace(/\s+(?:stp|s'il te pla[iî]t|please)$/i, "").trim();
  if (entity.length < 2) return null;
  return { count: Number(match[1]), best: /meilleur|mieux not|\btop\b/i.test(m), scope: /^s/i.test(match[2]) ? "series" : "movie", entity };
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Every word the user typed is in the TMDb name (« dupieux » ⊂ « quentin
 *  dupieux »; « horreur » is in no one's name). */
export function personNameMatches(entity: string, personName: string): boolean {
  const name = ` ${normalizeName(personName)} `;
  const words = normalizeName(entity).split(" ").filter((w) => w.length > 1);
  return words.length > 0 && words.every((w) => name.includes(` ${w} `));
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
