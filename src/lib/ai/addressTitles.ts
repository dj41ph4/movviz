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

/** « Prénom : Maître » → the demand it really was; any other fact unchanged. */
export function reframeTitleNameFact(fact: string): string {
  const match = fact.match(NAME_FACT_VALUE_RE);
  return match && isTitleOfAddress(match[1]) ? titleDemandFact(match[1]) : fact;
}
