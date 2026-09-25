// « Appelle-moi maître » n'est pas une présentation : un titre de rang ou de
// domination n'est jamais un prénom (il devenait « Prénom : Maître » et
// l'assistant le servait ensuite à chaque phrase). La réaction elle-même
// est laissée au modèle (dialogueDirector, intent "submission").
const TITLE_OF_ADDRESS = new Set([
  "maitre", "maître", "maitresse", "maîtresse", "seigneur", "saigneur", "monseigneur", "sire", "roi", "reine",
  "majeste", "majesté", "altesse", "empereur", "imperatrice", "impératrice", "dieu", "deesse", "déesse",
  "patron", "patronne", "boss", "chef", "master", "lord", "king", "queen", "sensei", "senpai", "senpaï",
  "monsieur", "madame", "mademoiselle", "commandant", "capitaine", "general", "général", "prince", "princesse",
  "tyran", "pacha", "daddy", "mommy", "papa", "maman",
]);

export function isTitleOfAddress(word: string): boolean {
  return TITLE_OF_ADDRESS.has(word.trim().toLowerCase());
}

/** How a title asked for is remembered: never as the first name (which
 *  would replace the real one and be served at every sentence), but kept,
 *  so the assistant still knows — sessions later — who wanted to be its
 *  « maître ». Deliberately free of the word « prénom » (NAME_FACT_RE). */
export function titleDemandFact(title: string): string {
  const word = title.trim().charAt(0).toUpperCase() + title.trim().slice(1).toLowerCase();
  return `A exigé qu'on l'appelle « ${word} » — un titre, pas son nom ; son vrai nom reste inconnu tant qu'il ne l'a pas donné`;
}

const NAME_FACT_VALUE_RE = /^pr[ée]nom\s*:\s*(\S+?)[.!]?$/i;

/** A "Prénom : X" fact whose X is a title, not a name. */
export function isTitleNameFact(fact: string): boolean {
  const match = fact.match(NAME_FACT_VALUE_RE);
  return !!match && isTitleOfAddress(match[1]);
}

const strip = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ADDRESS_VERB_RE = /appel|nomm|surnom|titre|s'adresse/i;

/** The title a fact is about when it records how the user wants to be
 *  addressed — « Prénom : Maître », or the model's own wording (« Veut qu'on
 *  l'appelle Maître », « Souhaite être nommé Seigneur »). */
function titleInFact(fact: string): string | null {
  const named = fact.match(NAME_FACT_VALUE_RE);
  if (named) return isTitleOfAddress(named[1]) ? named[1] : null;
  if (!ADDRESS_VERB_RE.test(fact)) return null;
  for (const word of fact.match(/[\p{L}]+/gu) ?? []) if (isTitleOfAddress(strip(word)) || isTitleOfAddress(word)) return word;
  return null;
}

/** « Prénom : Maître » or « Veut qu'on l'appelle Maître » → the demand it
 *  really was (never an instruction the model follows); other facts unchanged. */
export function reframeTitleNameFact(fact: string): string {
  const title = titleInFact(fact);
  return title ? titleDemandFact(title) : fact;
}

const DEMAND_FACT_RE = /A exigé qu'on l'appelle « ([^»]+) »/;
const TITLE_REQUEST_RE = /(?:app?ell?e?[sz]?[- ]moi|app?ell?ez[- ]moi|nomme[sz]?[- ]moi|je\s+m['’]?\s*appelle|je\s+suis\s+(?:ton|votre|ta))\s+(?:mon\s+|ma\s+|votre\s+|le\s+|la\s+)?["«“]?\s*([\p{L}'-]+)/iu;

/** Titles this user demanded to be called by — remembered facts (sessions
 *  ago) and their own messages in this conversation. */
export function demandedTitles(facts: string[], userMessages: string[]): string[] {
  const titles = new Set<string>();
  for (const fact of facts) {
    const match = fact.match(DEMAND_FACT_RE);
    if (match) titles.add(strip(match[1].trim()));
  }
  for (const message of userMessages) {
    const match = message.match(TITLE_REQUEST_RE);
    if (match && isTitleOfAddress(strip(match[1]))) titles.add(strip(match[1]));
  }
  return [...titles];
}

/** « maitre » → a pattern matching Maître / maître / MAITRE. */
function titlePattern(title: string): string {
  const accents: Record<string, string> = { a: "[aàâä]", e: "[eéèêë]", i: "[iîï]", o: "[oôö]", u: "[uùûü]", c: "[cç]" };
  return [...strip(title)].map((ch) => accents[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
}

// Words after which the title is talked ABOUT, not used to address him:
// « tu n'es pas mon maître », « je ne suis pas ton seigneur ».
const NOT_ADDRESS_BEFORE = String.raw`(?<!\b(?:pas|plus|jamais|ton|votre|un|une|le|la|du|de|ce|cet|son|sa|leur|aucun|mon|ma)\s+)`;

/** Removes the title used to ADDRESS the user (« Oui Maître », « Bien noté,
 *  maître ! », « Maître, voici… ») — a model that sees its own past « oui
 *  maître » in the history keeps imitating it whatever the instructions say.
 *  A sentence ABOUT the title (« tu n'es pas mon maître ») is left alone. */
export function scrubTitleAddress(text: string, titles: string[]): string {
  let out = text;
  for (const title of titles) {
    const word = `(?:(?:mon|ma|ô|o)\\s+)?${titlePattern(title)}(?![\\p{L}])`;
    // In the middle or at the end of a sentence: « Oui Maître, » / « noté, maître. »
    out = out.replace(new RegExp(`,?\\s+${NOT_ADDRESS_BEFORE}${word}(?=\\s*(?:[!?.,…:;)]|$|\\p{Extended_Pictographic}))`, "giu"), "");
    // Opening a sentence: « Maître, voici… » → « Voici… »
    out = out.replace(new RegExp(`(^|[.!?…]\\s+)${word}\\s*[,!]\\s*(\\p{L})?`, "giu"), (_m, lead: string, next?: string) => `${lead}${next ? next.toUpperCase() : ""}`);
  }
  return out.replace(/ {2,}/g, " ").replace(/\s+([,.!?…])/g, (m, p: string) => (p === "!" || p === "?" ? ` ${p}` : p)).trim();
}
