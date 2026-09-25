import fs from "node:fs";
import path from "node:path";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { getComputedGenreTraits, getFavoritePeople } from "@/lib/userContext/taste";
import { getChangelogEntry } from "@/lib/changelog";
import { getSeenKeys, getSeenTitles } from "./seen";
import { isSeriesFullyWatched } from "./recommendationScore";
import type { AiChatMessage, AiRecommendation } from "./types";

/*
 * Deterministic helpers for the chat (chat/route.ts): everything here is
 * decided by code from real data, never left to the model — the small free
 * models this runs on don't reliably follow prompt-only rules (see the
 * history of every retry in chat/route.ts), but they use good material well.
 */

// ── « Déjà vu » commands ────────────────────────────────────────────────

/** « mets-le en vu », « marque-la comme vue », « je l'ai déjà vu, note-le »
 *  → the title being talked about. */
const MARK_SUBJECT_SEEN_RE = /\b(?:mets?|mettre|marquer?|passer?|noter?|cocher?)[\s-]*(?:le|la|les|l['’])?\s*(?:en|comme|à)\s+vu(?:e|s|es)?\b/i;
/** « j'ai déjà tout vu », « je les ai tous vus », « déjà vu tout ça »
 *  → every card of the last recommendation. */
const ALL_LAST_SEEN_RE = /\b(?:d[ée]j[aà]\s+)?tout\s+vu\b|\bje\s+les\s+ai\s+(?:d[ée]j[aà]\s+)?(?:tous|toutes)?\s*(?:d[ée]j[aà]\s+)?vu(?:e|s|es)?\b|\bd[ée]j[aà]\s+vu\s+tout\b|\btous?\s+d[ée]j[aà]\s+vu/i;

export type SeenCommand = "subject" | "all_last" | null;

export function detectSeenCommand(message: string): SeenCommand {
  if (/\b(?:pas|jamais)\s+(?:encore\s+)?(?:tout\s+)?vu/i.test(message)) return null;
  if (ALL_LAST_SEEN_RE.test(message)) return "all_last";
  if (MARK_SUBJECT_SEEN_RE.test(message)) return "subject";
  return null;
}

/** The cards of the most recent assistant message that had some. */
export function lastRecommendations(messages: AiChatMessage[]): AiRecommendation[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const recos = messages[i].role === "assistant" ? messages[i].recommendations : undefined;
    if (recos?.length) return recos;
  }
  return [];
}

/** The conversation as the model reads it. A recommendation turn is stored
 *  as its one-line intro, the titles living in the cards: sent as is, the
 *  model never saw what it had proposed, so « le deuxième », « celui-là » or
 *  « pourquoi celui-ci ? » a few messages later pointed at nothing and it
 *  seemed to lose the thread. Each such turn now carries its titles (and the
 *  outcome of an add), in the order the cards were shown. */
export function historyForModel(messages: AiChatMessage[], scrub?: (text: string) => string): AiChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant") return m;
    if (scrub) m = { ...m, content: scrub(m.content) };
    const lines: string[] = [];
    (m.recommendations ?? []).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title}${r.year ? ` (${r.year})` : ""}, ${r.type === "series" ? "série" : "film"}`);
    });
    const cards = lines.length ? `\n[Cartes proposées dans ce message :\n${lines.join("\n")}]` : "";
    const actions = (m.actions ?? []).length
      ? `\n[Actions : ${m.actions!.map((a) => `${a.title}${a.year ? ` (${a.year})` : ""} — ${a.status}`).join(" ; ")}]`
      : "";
    return cards || actions ? { ...m, content: `${m.content}${cards}${actions}` } : m;
  });
}

/** Every title already shown as a card in this conversation. */
export function proposedKeys(messages: AiChatMessage[]): Set<string> {
  const keys = new Set<string>();
  for (const m of messages) for (const r of m.recommendations ?? []) keys.add(`${r.type}:${r.tmdbId}`);
  return keys;
}

// ── Act instead of asking ───────────────────────────────────────────────

const RECO_REQUEST_RE = /\b(?:conseill\w*|recommand\w*|propos(?:e|es|ez|er)\b|sugg[èée]r\w*|surprends|fais[- ]moi d[ée]couvrir)|\b(?:m[êe]me|dans le|dans ce)\s+(?:genre|style|d[ée]lire|trip|mood|ambiance)\b|\btu sais ce que j['’]?aime\b|\b(?:quoi|un truc|quelque chose)\s+(?:à|a)\s+(?:regarder|voir|mater)\b|\bj['’]?ai (?:d[ée]j[aà] )?tout vu\b/i;
const PAST_RECO_RE = /\b(?:m['’]?as|m['’]?avais|as|avais|a|avait)\s+(?:conseill|recommand|propos|sugg[ée]r)\w*/i;
// No \b: JavaScript's \b ignores accented letters (« ça », « plutôt »).
const OFFER_QUESTION_RE = /tu veux|ça te tente|ça te dit|on part sur|on reste sur|on cherche|plutôt|ou bien|tu as envie|t['’]as envie|je te sors|je t['’]envoie|je te propose/i;
const DECLINE_RE = /^\s*(?:non|nan|nope|pas maintenant|plus tard|bof|laisse tomber)\b/i;
const OFFER_TOPIC_RE = /\b(?:films?|s[ée]ries?|anim\w*|s[ée]lections?|listes?|genres?|ambiances?|suggestions?|recommandations?|p[ée]pites?|trucs?)\b/i;

/** True when this message asks for titles, or answers the assistant's own
 *  « tu veux une sélection ? / plutôt film ou série ? » with a short reply
 *  (« vas-y », « animation », « oui ») — the moment to give cards now, not
 *  another clarifying question. Seen live: three confirmation round-trips
 *  before the first card. */
export function isDirectRecommendationRequest(message: string, previousAssistant?: string): boolean {
  // « tu m'as recommandé X, c'était nul » is a reaction, not a request.
  if (PAST_RECO_RE.test(message)) return false;
  if (RECO_REQUEST_RE.test(message)) return true;
  if (!previousAssistant) return false;
  if (DECLINE_RE.test(message)) return false;
  const words = message.trim().split(/\s+/).filter(Boolean);
  return words.length <= 4 && OFFER_QUESTION_RE.test(previousAssistant) && OFFER_TOPIC_RE.test(previousAssistant);
}

// ── Context sections ────────────────────────────────────────────────────

/** Compact, code-computed taste profile: what the model needs to pick with
 *  confidence and to banter with something true to say. */
export async function buildTasteProfileSection(userId: string): Promise<string> {
  const seen = getSeenKeys(userId);
  let movies = 0;
  let series = 0;
  for (const key of seen) {
    if (key.startsWith("movie:")) movies++;
    else series++;
  }
  const lines: string[] = [];
  if (movies || series) lines.push(`- Déjà vus : ${movies} film${movies > 1 ? "s" : ""} et ${series} série${series > 1 ? "s" : ""}.`);

  const traits = getComputedGenreTraits(userId, 6);
  if (traits.length) {
    lines.push(`- Genres qui reviennent le plus (du plus fort au moins fort) : ${traits.map((t) => `${t.label} (${Math.round(t.strength * 100)} %)`).join(", ")}.`);
  }
  try {
    const people = await getFavoritePeople(userId, 4);
    if (people.length) lines.push(`- Personnes qui reviennent souvent : ${people.map((p) => `${p.name} (${p.role === "director" ? "réalisation" : "acteur·rice"})`).join(", ")}.`);
  } catch {
    /* optionnel */
  }

  const status = getWatchStatus(userId);
  const episodesBySeries = new Map<number, Set<string>>();
  for (const e of status?.episodes ?? []) {
    const set = episodesBySeries.get(e.tmdbId) ?? new Set<string>();
    set.add(`${e.season}.${e.episode}`);
    episodesBySeries.set(e.tmdbId, set);
  }
  const inProgress: string[] = [];
  const recentlyWatched: string[] = [];
  for (const r of status?.recent ?? []) {
    if (r.type === "series") {
      const eps = episodesBySeries.get(r.tmdbId);
      if (eps && !isSeriesFullyWatched(r.tmdbId, eps)) {
        if (inProgress.length < 5) inProgress.push(r.title);
        continue;
      }
    }
    if (recentlyWatched.length < 5 && r.title) recentlyWatched.push(r.title);
  }
  if (inProgress.length) lines.push(`- Séries en cours : ${inProgress.join(", ")}.`);
  if (recentlyWatched.length) lines.push(`- Regardés récemment : ${recentlyWatched.join(", ")}.`);
  if (movies + series >= 150) {
    lines.push("- Très gros consommateur : les classiques évidents de ses genres favoris sont presque tous déjà vus. Va chercher des titres moins connus, plus pointus ou venus d'ailleurs — c'est là que tu l'impressionneras.");
  }
  if (!lines.length) return "";
  return `\n\nPROFIL DE GOÛTS (calculé par Movviz à partir de ce qu'il a réellement regardé et noté — fiable, sers-t'en pour choisir sans lui reposer la question, et pour des remarques qui tombent juste) :\n${lines.join("\n")}`;
}

/** Every title already seen, so a suggestion written in plain text never
 *  proposes one (cards are filtered by code anyway). */
export function buildSeenListSection(userId: string): string {
  const titles = getSeenTitles(userId, 200);
  if (!titles.length) return "";
  return `\n\nDÉJÀ VUS PAR L'UTILISATEUR (${titles.length} titres, du plus récent au plus ancien) — ne propose JAMAIS l'un d'eux comme découverte, ni en texte ni en JSON (il peut en parler, toi aussi, mais pas le lui conseiller comme s'il ne l'avait pas vu) : ${titles.join(" · ")}`;
}

function currentVersion(): string | null {
  try {
    return (JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/** What the assistant knows about Movviz itself. Seen live: asked about
 *  « la refonte du backend », it answered « Carrément ! » with nothing to
 *  go on. Now it has the real version and the real latest release notes. */
export function buildMovvizSelfSection(): string {
  const version = currentVersion();
  if (!version) return "";
  const entry = getChangelogEntry(version);
  const notes = entry?.sections
    .flatMap((s) => [s.heading ? `« ${s.heading} »` : "", ...s.items.map((item) => `• ${item}`)])
    .filter(Boolean)
    .join("\n")
    .slice(0, 1500);
  return `\n\nMOVVIZ LUI-MÊME — tu tournes dans Movviz version ${version}.${notes ? ` Nouveautés de cette version (notes de mise à jour réelles) :\n${notes}` : ""}\nSi on te demande ce qui a changé dans Movviz, appuie-toi UNIQUEMENT sur ces notes ; pour tout le reste de l'historique de Movviz (anciennes versions, travaux en cours, détails techniques), tu n'en sais rien — dis-le avec humour plutôt que de faire semblant d'être au courant.`;
}

// ── Quick replies ───────────────────────────────────────────────────────

/** Chips under the reply: one tap sends the text as the next message. */
const ABOUT_ONE_TITLE_RE = /\b(?:le|la|l['’])\s*(?:lancer|regarder|voir|mettre|ajouter|garder|commencer)\b|\bcelui-(?:l[àa]|ci)\b|\bcelle-(?:l[àa]|ci)\b/i;

export function buildQuickReplies(assistant: AiChatMessage): string[] {
  const recos = assistant.recommendations ?? [];
  if (recos.length) {
    const seriesCount = recos.filter((r) => r.type === "series").length;
    return [
      "Plus sombre",
      "Plus léger",
      seriesCount > recos.length / 2 ? "Plutôt un film" : "Plutôt une série",
      "Des pépites moins connues",
      "Autre chose",
    ];
  }
  if (assistant.actions?.length) return [];
  const text = assistant.content;
  // About one precise title (« Prêt à le lancer ce soir ? »): « Un film / Une
  // série » would answer a question nobody asked.
  if (extractSuggestedTitle(text) || ABOUT_ONE_TITLE_RE.test(text)) return [];
  if (OFFER_QUESTION_RE.test(text) && OFFER_TOPIC_RE.test(text)) {
    return ["Vas-y", "Un film", "Une série", "Surprends-moi"];
  }
  return [];
}

// The model's own quick replies: it knows what it just asked, so it writes
// the answers (« Oui, ce soir », « Plutôt demain », « Un autre du même
// genre »), in a hidden [[CHOIX: a | b | c]] line at the end of its reply.
const CHOICES_RE = /\[\[\s*CHOIX\s*:([^\]]*)\]\]/gi;

/** The quick replies the model offered (2-4 short ones), if any. */
export function extractQuickChoices(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(CHOICES_RE)) {
    for (const raw of match[1].split("|")) {
      const choice = raw.trim().replace(/^["«“]\s*|\s*["»”]$/g, "");
      if (choice && choice.length <= 40 && !found.some((c) => c.toLowerCase() === choice.toLowerCase())) found.push(choice);
    }
  }
  return found.length >= 2 ? found.slice(0, 4) : [];
}

/** The reply without its hidden [[CHOIX: …]] line. */
export function stripQuickChoices(text: string): string {
  return text.replace(CHOICES_RE, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Recommendation intro ────────────────────────────────────────────────

const FALLBACK_INTROS = [
  "Tiens, voilà de quoi faire :",
  "J'ai creusé pour toi :",
  "Regarde-moi ça :",
  "Ma sélection du moment pour toi :",
  "Allez, je te sors ça :",
];

/** One line above the cards. The model's own `intro` (its voice) when it
 *  wrote one, otherwise a short varied line — never the same one twice in a
 *  row. */
export function recommendationIntro(modelIntro: string | undefined, previousReplies: string[]): string {
  const own = modelIntro?.trim();
  if (own) return own;
  const last = previousReplies[0] ?? "";
  const pool = FALLBACK_INTROS.filter((line) => !last.startsWith(line));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** First title the assistant put forward in plain text (*Titre* or
 *  « Titre »), so a follow-up such as « dans le même genre » or « mets-le en
 *  vu » refers to it. */
export function extractSuggestedTitle(text: string): string | null {
  const m = text.match(/\*([^*\n]{2,80})\*/) ?? text.match(/«\s*([^»\n]{2,80}?)\s*»/);
  return m ? m[1].trim() : null;
}

// ── « Tu peux faire quoi pour moi ? » ───────────────────────────────────

const CAPABILITIES_RE = /\b(?:tu (?:peux|sais|sers [àa]) (?:faire )?quoi|qu['’]?est[- ]ce que tu (?:peux|sais) faire|que (?:peux|sais)[- ]tu faire|tu sers [àa] quoi|tes (?:capacit[ée]s|fonctionnalit[ée]s|pouvoirs)|comment tu (?:peux )?m['’]aider|t['’]es capable de quoi|what can you do)\b/i;

export function isCapabilitiesQuestion(message: string): boolean {
  return CAPABILITIES_RE.test(message);
}

/** The real list of what the assistant can do — handed to the model only
 *  when asked, so it answers in its own voice without inventing features. */
export function buildCapabilitiesSection(webSearchEnabled: boolean): string {
  const items = [
    "te conseiller des films et des séries selon TES goûts (tout ce que tu as vu et noté), dans une ambiance, un genre, une durée, ou « comme X mais sans Y »",
    "ajouter un film ou une série à ta bibliothèque : il est cherché et téléchargé tout seul",
    "te dire si tu as déjà un titre, si tu l'as vu, qui joue dedans ou l'a réalisé, et si une série est terminée",
    "te dire ce qui te manque d'une saga, ou dans la filmographie d'un acteur ou d'un réalisateur, comparé à ta bibliothèque",
    "marquer un titre comme vu (« mets-le en vu », « j'ai déjà tout vu ») et retenir tes notes (« je mets 4/5 à X ») pour affiner les suggestions",
    "sur la fiche que tu regardes : durée, qualité (4K, HDR), liste des épisodes et ceux que tu as vus",
    "se souvenir de toi d'une conversation à l'autre (ton prénom, ce que tu aimes ou pas)",
    ...(webSearchEnabled ? ["retrouver la musique d'un film ou d'une série, ou une scène culte, grâce à la recherche web"] : []),
    "te dire ce qui a changé dans la dernière version de Movviz",
    "sous chaque suggestion : « Déjà vu » ou 👎 la remplace aussitôt par une autre",
  ];
  return `\n\nCE QUE TU SAIS VRAIMENT FAIRE — l'utilisateur te demande ce que tu peux faire pour lui. Réponds en MODE 3 par une courte liste à puces en langage courant (une ligne par point, pas de jargon, pas de noms techniques), avec ta personnalité, tirée UNIQUEMENT de cette liste — n'invente aucune autre capacité. Termine par une idée concrète adaptée à ses goûts pour démarrer :\n${items.map((item) => `- ${item}`).join("\n")}`;
}
