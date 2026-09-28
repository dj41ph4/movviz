import type { AiRecommendation } from "@/lib/ai/types";

/** « ajoute à ma liste », « mets-le dans ma watchlist », « garde-le pour
 *  plus tard » — the user's own list (Ma liste), never a download. */
const MY_LIST_RE = /\b(?:ma|mes)\s+(?:liste|watch\s?list|favoris)\b|\bwatch\s?list\b|\b(?:voir|regarder|mater)\s+plus\s+tard\b/i;
const LIST_VERB_RE = /\b(?:ajout\w*|rajout\w*|mets?|mettre|garde\w*|enregistr\w*|sauvegard\w*|note\w*|colle\w*)\b|\bdans\s+(?:ma|mes)\s+(?:liste|watch\s?list|favoris)\b/i;

export function asksToAddToWatchlist(message: string): boolean {
  return MY_LIST_RE.test(message) && LIST_VERB_RE.test(message);
}

const ORDINALS: [RegExp, number][] = [[/^premi/, 1], [/^(?:deuxi|second)/, 2], [/^troisi/, 3], [/^quatri/, 4], [/^cinqui/, 5], [/^sixi/, 6], [/^derni/, -1]];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Which of the cards just shown the message points at: a title it names,
 *  « le deuxième », « les 3 premiers », or all of them (« ajoute-les »). */
export function pickShownCards(message: string, cards: AiRecommendation[]): AiRecommendation[] {
  if (!cards.length) return [];
  const m = ` ${normalize(message)} `;
  const named = cards.filter((c) => {
    const t = normalize(c.title);
    return t.length > 1 && m.includes(` ${t} `);
  });
  if (named.length) return named;
  const firstN = message.match(/\b(\d{1,2})\s+premi\w*|\bles\s+(\d{1,2})\b/i);
  const n = Number(firstN?.[1] ?? firstN?.[2]);
  if (Number.isFinite(n) && n > 0) return cards.slice(0, n);
  const ordinal = message.toLowerCase().match(/\b(?:le|la)\s+(premi\w*|deuxi\w*|second\w*|troisi\w*|quatri\w*|cinqui\w*|sixi\w*|derni\w*)/);
  const index = ordinal ? ORDINALS.find(([re]) => re.test(ordinal[1]))?.[1] : undefined;
  if (index === -1) return cards.slice(-1);
  if (index && cards[index - 1]) return [cards[index - 1]];
  if (/\b(?:les|tous|toutes|ces|eux|elles)\b|-les\b/i.test(message)) return cards;
  return [];
}

/** The line shown after adding: what really went in the list. */
export function watchlistReply(added: { title: string; year?: number }[]): string {
  if (!added.length) return "Je ne vois pas quel titre mettre dans ta liste. Dis-moi lequel et je l'y range.";
  const names = added.map((a) => `${a.title}${a.year ? ` (${a.year})` : ""}`);
  return added.length === 1
    ? `C'est dans ta liste ✅ ${names[0]} t'attend pour plus tard.`
    : `C'est dans ta liste ✅ ${names.join(", ")}.`;
}
