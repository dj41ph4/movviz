/** Internal model markers are never part of the conversation shown to a user. */
export function cleanAiReply(text: string): string {
  return text
    .replace(/\\([\[\]*_`])/g, "$1")
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A rating marker is actionable only after the user actually expressed a rating or opinion. */
export function userExpressedRating(message: string): boolean {
  return /(?:[1-5]\s*(?:\/\s*5|[ée]toiles?|sur\s*5)|\d\s*\/\s*10|(?:^|\s)(?:un\s+bon|plut[oô]t|je\s+dirais|allez)\s+[1-5](?=\s|[,!.?]|$)|^\s*[1-5]\s*$|je\s+(?:lui\s+)?(?:mets|donne|mettrais|donnerais|note)\b|j['’](?:ai\s+)?(?:ador[ée]?|aim[ée]?|d[ée]test[ée]?)|c['’][ée]tait\s+(?:g[ée]nial|nul|bien|sympa|mauvais)|chef[- ]d['’][œo]uvre|super\s+film|grosse?\s+d[ée]ception)/i.test(message);
}

/** Titles intentionally emphasized by the assistant, capped to avoid incidental TMDb searches. */
export function emphasizedTitles(text: string): string[] {
  return [...text.matchAll(/(?<!\*)\*([^*\n]{2,90})\*(?!\*)/g)]
    .map((match) => match[1].trim())
    .filter((title) => /^\p{Lu}/u.test(title) && title.length >= 4)
    .filter((title, index, all) => all.indexOf(title) === index)
    .slice(0, 2);
}
