/**
 * « Propose-moi 10 films de production belge sortis du 1er janvier 2025 à
 * aujourd'hui, les mieux notés » — une demande à CRITÈRES (période, pays de
 * production, nombre, tri). Vu en direct : le modèle répondait de mémoire,
 * hors période (Casa Amor 2015, Le Tout Nouveau Testament 2015…), hors pays
 * (un film coréen présenté comme belge) et sans tenir le nombre ni le tri.
 * Un petit modèle ne tient pas ces contraintes : elles sont lues ici par le
 * code, puis exécutées sur les vraies données TMDb (criteriaSearch.ts) — le
 * modèle n'est plus consulté pour ce type de demande.
 */

export interface CriteriaRequest {
  scope: "movie" | "series" | "all";
  /** ISO 3166-1 alpha-2 : au moins un de ces pays dans la production. */
  countries: string[];
  /** AAAA-MM-JJ, bornes incluses. */
  from?: string;
  to?: string;
  count: number;
  best: boolean;
}

export const CRITERIA_DEFAULT_COUNT = 10;
export const CRITERIA_MAX_COUNT = 30;

function normalize(message: string): string {
  return message.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[’‘`]/g, "'");
}

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

interface DateExpr {
  start: string;
  end: string;
  index: number;
  length: number;
}

// « 1er janvier 2025 », « janvier 2025 », « 2025 », « aujourd'hui ».
const DATE_EXPR_RE = /(?:(\d{1,2})(?:er)?\s+)?(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})|\b((?:19|20)\d{2})\b|aujourd'?hui|maintenant|ce jour/g;

function parseDateExprs(text: string, now: Date): DateExpr[] {
  const out: DateExpr[] = [];
  for (const m of text.matchAll(DATE_EXPR_RE)) {
    const index = m.index ?? 0;
    const length = m[0].length;
    if (m[2]) {
      const month = MONTHS.indexOf(m[2]);
      const year = Number(m[3]);
      if (m[1]) {
        const day = Math.min(Math.max(Number(m[1]), 1), lastDayOfMonth(year, month));
        out.push({ start: iso(year, month, day), end: iso(year, month, day), index, length });
      } else {
        out.push({ start: iso(year, month, 1), end: iso(year, month, lastDayOfMonth(year, month)), index, length });
      }
    } else if (m[4]) {
      const year = Number(m[4]);
      out.push({ start: iso(year, 0, 1), end: iso(year, 11, 31), index, length });
    } else {
      const today = todayIso(now);
      out.push({ start: today, end: today, index, length });
    }
  }
  return out;
}

const FROM_CONTEXT_RE = /(?:depuis|a partir (?:de|du|d')|apres|des)\s*(?:le\s+|l'\s*|d'\s*|de\s+)?(?:annee\s+)?$/;
const TO_CONTEXT_RE = /(?:avant|jusqu'?(?:a|au|en))\s*(?:le\s+|la\s+)?(?:fin\s+(?:de\s+)?)?(?:annee\s+)?$/;
const IN_CONTEXT_RE = /(?:sortis?|sorties|sorti|en|annee|durant|pendant|publies?|produits?)\s*(?:le\s+|l'\s*)?(?:annee\s+)?$/;

function parsePeriod(text: string, now: Date): { from?: string; to?: string } {
  const today = todayIso(now);
  if (/cette annee/.test(text)) return { from: iso(now.getUTCFullYear(), 0, 1), to: today };
  const exprs = parseDateExprs(text, now);
  if (exprs.length >= 2) {
    const first = exprs[0];
    const last = exprs[exprs.length - 1];
    const from = first.start <= last.start ? first.start : last.start;
    const to = last.end >= first.end ? last.end : first.end;
    return { from, to };
  }
  if (exprs.length === 1) {
    const e = exprs[0];
    const before = text.slice(Math.max(0, e.index - 24), e.index);
    if (FROM_CONTEXT_RE.test(before)) return { from: e.start, to: today };
    if (TO_CONTEXT_RE.test(before)) return { to: e.end };
    // Une date seule n'est un critère que dans « sortis en 2025 », jamais
    // dans « un film comme Pulp Fiction de 1994 ».
    if (IN_CONTEXT_RE.test(before) && e.length >= 4 && e.start !== today) return { from: e.start, to: e.end };
  }
  return {};
}

// [code ISO, adjectifs (après « film/production »), noms (après « de/en »)].
const COUNTRY_TERMS: Array<[string, string, string]> = [
  ["BE", "belges?", "belgique"],
  ["FR", "francais(?:es?)?", "france"],
  ["DE", "allemand(?:es?)?", "allemagne"],
  ["IT", "italien(?:ne)?s?", "italie"],
  ["ES", "espagnol(?:es?)?", "espagne"],
  ["GB", "britanniques?|anglais(?:es?)?", "royaume-uni|angleterre"],
  ["US", "americain(?:es?)?", "etats-unis|usa"],
  ["CA", "canadien(?:ne)?s?|quebecois(?:es?)?", "canada|quebec"],
  ["CH", "suisses?", "suisse"],
  ["NL", "neerlandais(?:es?)?|hollandais(?:es?)?", "pays-bas|hollande"],
  ["LU", "luxembourgeois(?:es?)?", "luxembourg"],
  ["JP", "japonais(?:es?)?", "japon"],
  ["KR", "coreen(?:ne)?s?", "coree"],
  ["CN", "chinois(?:es?)?", "chine"],
  ["IN", "indien(?:ne)?s?", "inde"],
  ["SE", "suedois(?:es?)?", "suede"],
  ["DK", "danois(?:es?)?", "danemark"],
  ["NO", "norvegien(?:ne)?s?", "norvege"],
  ["FI", "finlandais(?:es?)?", "finlande"],
  ["PL", "polonais(?:es?)?", "pologne"],
  ["PT", "portugais(?:es?)?", "portugal"],
  ["IE", "irlandais(?:es?)?", "irlande"],
  ["AU", "australien(?:ne)?s?", "australie"],
  ["BR", "bresilien(?:ne)?s?", "bresil"],
  ["MX", "mexicain(?:es?)?", "mexique"],
  ["AR", "argentin(?:es?)?", "argentine"],
  ["TR", "turcs?|turque", "turquie"],
  ["IL", "israelien(?:ne)?s?", "israel"],
  ["IR", "iranien(?:ne)?s?", "iran"],
  ["RU", "russes?", "russie"],
  ["TH", "thailandais(?:es?)?", "thailande"],
];

// Le pays n'est une contrainte que dans un contexte de production : « en
// français » (la langue de la réponse) ou « j'aime la France » n'en sont pas.
const ORIGIN_WORD = "(?:productions?|coproductions?|co-productions?|films?|series?|cinema|origine|nationalite|tournes?|realises?|produits?)";

function extractCountries(text: string): string[] {
  const codes: string[] = [];
  for (const [code, demonyms, names] of COUNTRY_TERMS) {
    const afterOrigin = new RegExp(String.raw`\b${ORIGIN_WORD}\s+(?:(?:de|d'|du|des|ou|et)\s+)*(?:${ORIGIN_WORD}\s+)?(?:\w+\s+){0,2}?(?:${demonyms})\b`);
    const afterPreposition = new RegExp(String.raw`\b${ORIGIN_WORD}\s+(?:\w+\s+){0,2}?(?:de|d'|du|en|au|aux)\s*(?:${names})\b`);
    if (afterOrigin.test(text) || afterPreposition.test(text)) codes.push(code);
  }
  return codes;
}

const REQUEST_RE = /\b(?:propos\w*|donn\w*|cherch\w*|trouv\w*|list\w*|montr\w*|recommand\w*|sugg[eè]r\w*|conseil\w*|veux|voudrais|aimerais|top)\b|\bmeilleurs?\b|mieux not[ée]s?|mieux cot[ée]s?|\bpepites?\b/;
const MEDIA_RE = /\b(?:films?|series?|longs?[- ]metrages?|cinema)\b/;
const BEST_RE = /meilleurs?|mieux not\w*|mieux cot\w*|\btop\b|pepites?|plus (?:apprecie|beaux)/;

export function extractCriteriaRequest(message: string, now: Date = new Date()): CriteriaRequest | null {
  const text = normalize(message);
  if (!MEDIA_RE.test(text) || !REQUEST_RE.test(text)) return null;
  const period = parsePeriod(text, now);
  const countries = extractCountries(text);
  // Ni période ni pays : ce n'est pas une demande à critères (genre,
  // ambiance… restent au modèle).
  if (!period.from && !period.to && countries.length === 0) return null;

  const wantsFilms = /\bfilms?\b|longs?[- ]metrages?|cinema/.test(text);
  const wantsSeries = /\bseries?\b/.test(text);
  const scope = wantsSeries && !wantsFilms ? "series" : wantsFilms && !wantsSeries ? "movie" : wantsFilms && wantsSeries ? "all" : "movie";
  const n = Number(text.match(/\b(\d{1,2})\s+(?:meilleur(?:e)?s?\s+)?(?:films?|series?)\b/)?.[1] ?? text.match(/\b(?:top|les)\s+(\d{1,2})\b/)?.[1]);
  const count = Number.isFinite(n) && n > 0 ? Math.min(n, CRITERIA_MAX_COUNT) : CRITERIA_DEFAULT_COUNT;
  return { scope, countries, from: period.from, to: period.to, count, best: BEST_RE.test(text) };
}

// « tu n'as pas respecté mes conditions », « tu te trompes dans les dates »,
// « c'est pas belge » : un reproche court, sans nouvelle demande. Les critères
// sont alors ceux de la dernière demande qui en avait.
const COMPLAINT_RE = /\b(?:pas respecte\w*|conditions?|criteres?|te trompes?|dates?|periode|faux|rate\w*|pas belges?|pas bon\w*|refais|recommence)\b/;
const COMPLAINT_MAX_WORDS = 14;

export function resolveCriteriaRequest(message: string, previousUserMessages: string[], now: Date = new Date()): CriteriaRequest | null {
  const direct = extractCriteriaRequest(message, now);
  if (direct) return direct;
  const text = normalize(message);
  if (text.split(/\s+/).filter(Boolean).length > COMPLAINT_MAX_WORDS || !COMPLAINT_RE.test(text)) return null;
  for (let i = previousUserMessages.length - 1; i >= Math.max(0, previousUserMessages.length - 6); i--) {
    const earlier = extractCriteriaRequest(previousUserMessages[i], now);
    if (earlier) return earlier;
  }
  return null;
}
