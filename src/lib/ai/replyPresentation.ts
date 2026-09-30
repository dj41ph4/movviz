import type { AiRecommendIntentItem } from "./intentParser";
import type { AiChatMessage, AiRecommendation } from "./types";

const HISTORY_CARDS_RE = /\[Cartes proposées dans ce message\s*:\s*[\s\S]*?\]/gi;
const NUMBERED_TITLE_RE = /^\s*\d+[.)]\s+(.+?)(?:\s+\((\d{4})\))?,\s*(film|s[ée]rie)\s*$/i;

/** Internal model markers are never part of the conversation shown to a user. */
export function cleanAiReply(text: string): string {
  return text
    .replace(/\\([\[\]*_`])/g, "$1")
    .replace(/\[\[[\s\S]*?\]\]/g, "")
    .replace(HISTORY_CARDS_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Recover a model's numbered movie list when it omitted the recommend JSON. */
export function extractListedRecommendations(text: string): { items: AiRecommendIntentItem[]; intro: string; fromHistory: boolean } | null {
  const normalized = text.replace(/\\([\[\]])/g, "$1");
  const marker = normalized.match(HISTORY_CARDS_RE)?.[0];
  const list = marker ? marker.slice(1, -1).replace(/^Cartes proposées dans ce message\s*:\s*/i, "") : normalized;
  const lines = list.split(/\r?\n/);
  const matches = lines.map((line) => line.match(NUMBERED_TITLE_RE)).filter((match): match is RegExpMatchArray => !!match);
  if (matches.length < 2 || matches.length > 25) return null;
  const items = matches.map((match) => ({
    title: match[1].trim(),
    ...(match[2] ? { year: Number(match[2]) } : {}),
    type: /^film$/i.test(match[3]) ? "movie" as const : "series" as const,
  }));
  const intro = cleanAiReply(marker ? normalized.replace(marker, "") : normalized.replace(/^\s*\d+[.)]\s+.+?(?:\s+\(\d{4}\))?,\s*(?:film|s[ée]rie)\s*$/gim, ""));
  return { items, intro, fromHistory: !!marker };
}

/** Reuse the exact cards named in an echoed history block, without another TMDb lookup. */
export function matchHistoryRecommendationCards(items: AiRecommendIntentItem[], messages: AiChatMessage[]): AiRecommendation[] {
  const previous = messages.flatMap((message) => message.role === "assistant" ? message.recommendations ?? [] : []).reverse();
  return items
    .map((item) => previous.find((card) => card.title.toLocaleLowerCase() === item.title.toLocaleLowerCase()
      && card.year === item.year && card.type === item.type))
    .filter((card): card is AiRecommendation => !!card);
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
