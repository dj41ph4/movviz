import type { AiAddItem } from "./types";

/**
 * Intent parser — the single gate between the LLM's free-form output and
 * Movviz's deterministic action engine. The model NEVER controls the
 * backend directly: it only emits a JSON intent which is validated here
 * field by field (schema + bounds). Anything malformed is dropped and the
 * model's text is treated as a plain chat reply.
 */

export interface AiRecommendIntentItem extends AiAddItem {
  reason?: string;
}

export interface ParsedIntent {
  action: "add_media" | "recommend" | null;
  items: AiRecommendIntentItem[];
  /** The part of the model's reply that is NOT the JSON intent (free text). */
  rawText: string;
}

const MAX_ITEMS = 25;
const MAX_TITLE_LEN = 200;
const MAX_REASON_LEN = 500;

/** Extracts the first balanced JSON object from a model reply. The models
 *  sometimes wrap the intent in prose or code fences — we only take the
 *  object, validate it, and ignore the rest.
 *
 *  Also repairs the single most common real-world break: a `reason` string
 *  quoting a word or title inline (`"...l'aspect "mythologie moderne" de
 *  Lucifer."`) without escaping those inner quotes — confirmed live, this
 *  silently broke the strict version of this parser (it treated the first
 *  inner quote as the string's end, desynced the whole object, JSON.parse
 *  threw, and the ENTIRE raw JSON dumped to the user as if it were a normal
 *  reply instead of rendering as recommendation cards). While scanning a
 *  string, a `"` is only treated as the real terminator when the next
 *  non-space character is a JSON structural one (`,`/`:`/`}`/`]`/end of
 *  text); anything else is a stray literal quote, escaped on the fly so the
 *  final JSON.parse succeeds instead of failing on it. */
/** Same as {@link extractJsonObject} but also reports how much of the
 *  ORIGINAL text was consumed by the match — `end` is the index right
 *  after the last original character that's part of the JSON (the
 *  original text may run past `end` when the model kept writing prose
 *  after the JSON; `end` sits at `text.length` when the JSON itself was
 *  the thing that got cut off). `parseIntent` needs this to correctly
 *  strip the JSON out of a truncated reply — `text.lastIndexOf("}")`
 *  doesn't work once the JSON never got its closing brace. */
function extractJsonObjectSpan(text: string): { value: unknown; end: number } | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  const stack: string[] = [];
  // Checkpoint = a point where some nested `{...}`/`[...]` just fully
  // closed (e.g. one completed item in an "items" array) while the object
  // as a whole is still open — recorded so a token-limit cutoff mid-list
  // (confirmed live on a long "recommend" reply) can roll back to the last
  // complete item instead of discarding the entire reply.
  const checkpoints: { text: string; stack: string[]; end: number }[] = [];
  let inString = false;
  let escaped = false;
  let repaired = "";
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { repaired += ch; escaped = false; continue; }
      if (ch === "\\") { repaired += ch; escaped = true; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        const next = text[j];
        const isTerminator = next === undefined || ",:}]".includes(next);
        if (isTerminator) { inString = false; repaired += ch; continue; }
        repaired += '\\"';
        continue;
      }
      repaired += ch;
      continue;
    }
    if (ch === '"') { inString = true; repaired += ch; continue; }
    repaired += ch;
    if (ch === "{" || ch === "[") { stack.push(ch); continue; }
    if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) {
        try {
          return { value: JSON.parse(repaired), end: i + 1 };
        } catch {
          return null;
        }
      }
      checkpoints.push({ text: repaired, stack: [...stack], end: i + 1 });
    }
  }
  // Reached the end of the text with the object still open — try the most
  // recent checkpoint first (closest to what the model actually finished),
  // closing whatever brackets were still open at that point. The JSON was
  // itself the thing that got cut off, so it consumes the rest of `text`.
  for (let k = checkpoints.length - 1; k >= 0; k--) {
    const { text: partial, stack: openStack } = checkpoints[k];
    let attempt = partial.replace(/,\s*$/, "");
    for (let j = openStack.length - 1; j >= 0; j--) attempt += openStack[j] === "{" ? "}" : "]";
    try {
      return { value: JSON.parse(attempt), end: text.length };
    } catch {
      // try an earlier checkpoint
    }
  }
  return null;
}

export function extractJsonObject(text: string): unknown | null {
  return extractJsonObjectSpan(text)?.value ?? null;
}

function validItem(raw: unknown): AiRecommendIntentItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title || title.length > MAX_TITLE_LEN) return null;
  const item: AiRecommendIntentItem = { title };
  if (typeof r.year === "number" && Number.isFinite(r.year) && r.year >= 1880 && r.year <= 2100) {
    item.year = Math.round(r.year);
  }
  if (r.type === "movie" || r.type === "series") item.type = r.type;
  if (typeof r.reason === "string") {
    const reason = r.reason.trim().slice(0, MAX_REASON_LEN);
    if (reason) item.reason = reason;
  }
  return item;
}

// The repair in extractJsonObject handles the common case (an unescaped
// inner quote), but the model can still occasionally emit JSON broken in
// some other way — this must never fall through to showing raw `{"action":
// "recommend","items":[...]}` syntax to the user as if it were a normal
// reply, confirmed live as a real failure mode. Whenever the text clearly
// ATTEMPTED a structured action but nothing usable came out of it, swap in
// a short apology instead of the broken JSON.
const ACTION_JSON_HINT_RE = /"action"\s*:\s*"(?:add_media|recommend)"/;
export const BROKEN_ACTION_FALLBACK = "Désolé, j'ai eu un souci pour formuler ma réponse — tu peux reformuler ta demande ?";

function fallbackRawText(text: string, rawText: string): string {
  return ACTION_JSON_HINT_RE.test(text) ? BROKEN_ACTION_FALLBACK : rawText;
}

export function parseIntent(text: string): ParsedIntent {
  const rawText = text.trim();
  const span = extractJsonObjectSpan(text);
  const json = span?.value ?? null;
  if (!json || typeof json !== "object") return { action: null, items: [], rawText: fallbackRawText(text, rawText) };

  const obj = json as Record<string, unknown>;
  const action = obj.action;
  if (action !== "add_media" && action !== "recommend") return { action: null, items: [], rawText: fallbackRawText(text, rawText) };

  if (!Array.isArray(obj.items)) return { action: null, items: [], rawText: fallbackRawText(text, rawText) };
  const items: AiRecommendIntentItem[] = [];
  for (const raw of obj.items) {
    if (items.length >= MAX_ITEMS) break;
    const item = validItem(raw);
    if (item) items.push(item);
  }
  if (!items.length) return { action: null, items: [], rawText: fallbackRawText(text, rawText) };

  // Strip the JSON block from the reply so rawText keeps only the prose.
  // Uses the span's own consumed range rather than text.lastIndexOf("}") —
  // a truncated reply never has a trailing "}" in the original text at all.
  const start = text.indexOf("{");
  const end = span!.end;
  let stripped = (start >= 0 && end > start ? text.slice(0, start) + text.slice(end) : text).trim();
  // Bug fix (confirmed live, reproducible on ~7/10 "recommend" replies): the
  // model frequently wraps its JSON in a ```json ... ``` fence. The span
  // above only captures the `{...}` object itself, so the fence markers
  // sit just outside it on both sides and survive the slice — concatenating
  // to a literal "```json\n\n```" (or an unclosed "```json\n") left dangling
  // in what the user sees, right before the "Voici ce qui devrait bien
  // coller :" line built elsewhere. Strip any leftover fence markers next
  // to where the JSON used to be — never legitimate content here, this
  // assistant's replies are conversational prose, not code blocks.
  stripped = stripped.replace(/```(?:json)?/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return { action, items, rawText: stripped };
}

const FACT_MAX_LEN = 150;
// Matches the prompt's own "jamais plus de 2 par réponse" (actions.ts) —
// audit finding #5 (minor): these had drifted apart (2 vs 3).
const FACT_MAX_COUNT = 2;
// No line anchors (^...$) — the model doesn't reliably put the marker on
// its own line (observed in practice tacked onto the end of a sentence),
// and an anchored regex silently fails to match/strip it there, leaking
// the raw "[[FAIT: ...]]" text into what the user sees.
const FACT_RE = /\[\[FAIT:\s*(.+?)\]\]/gi;
// The model sometimes uses the marker to note its own IGNORANCE ("prénom
// inconnu", "je ne sais pas encore son prénom") instead of only for new
// information it was actually just given — that's the opposite of a fact
// worth remembering. Filtered out defensively rather than trusted to the
// prompt instruction alone.
//
// Bug fix (audit finding #6, confirmed live): the original alternation
// included bare "n['e]a pas" and "pas encore", which also match perfectly
// legitimate NEW negative facts the model correctly wants to remember —
// "n'a pas aimé Interstellar", "n'a pas de compte Netflix", "pas encore vu
// la saison 2" — silently dropping real dislikes/constraints, exactly the
// kind of fact a user expects retained. Narrowed to genuine
// ignorance-markers only (the actual predicate is "I don't know", not any
// negation anywhere in the sentence).
const NEGATIVE_FACT_RE = /\b(inconnu|je ne sais pas|aucune idée|j'ignore)\b/i;

/** Pulls the model's own inline `[[FAIT: ...]]` markers out of a plain-text
 *  reply — piggybacks on the chat call already made instead of a separate
 *  "analyze this conversation" LLM round-trip (AI.MD: no background work,
 *  only what the user's own request triggers). Markers are stripped from
 *  the text the user actually sees either way, even outside mode 3 — the
 *  model is only INSTRUCTED to use them there, but nothing enforces it. */
export function extractFacts(text: string): { facts: string[]; cleaned: string } {
  const facts: string[] = [];
  const cleaned = text
    .replace(FACT_RE, (_, raw: string) => {
      const fact = raw.trim().slice(0, FACT_MAX_LEN);
      if (fact && !NEGATIVE_FACT_RE.test(fact) && facts.length < FACT_MAX_COUNT) facts.push(fact);
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { facts, cleaned };
}

const WATCHED_MAX_COUNT = 2;
const WATCHED_TITLE_MAX_LEN = 200;
// No line anchors, same reasoning as FACT_RE — the model doesn't reliably
// isolate the marker on its own line.
const WATCHED_RE = /\[\[VU:\s*(.+?)\]\]/gi;

/** Pulls the model's own inline `[[VU: titre|type]]` markers — mirrors
 *  extractFacts exactly (same "piggyback on the reply already generated,
 *  never a separate LLM round-trip" discipline). Emitted when the user
 *  states in conversation that they've watched/finished something ("j'ai
 *  regardé X hier", "je viens de finir la saison 2 de Y") — resolved
 *  against TMDb by the caller (actions.ts resolveAiItem, same matching used
 *  for add_media) and recorded via watchStore, never trusted as a raw
 *  title/tmdbId pair from the model itself. */
export function extractWatched(text: string): { watched: { title: string; type: "movie" | "series" }[]; cleaned: string } {
  const watched: { title: string; type: "movie" | "series" }[] = [];
  const cleaned = text
    .replace(WATCHED_RE, (_, raw: string) => {
      const [titlePart, typePart] = raw.split("|").map((s) => s.trim());
      const title = (titlePart ?? "").slice(0, WATCHED_TITLE_MAX_LEN);
      const type = typePart?.toLowerCase() === "series" ? "series" : "movie";
      if (title && watched.length < WATCHED_MAX_COUNT) watched.push({ title, type });
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { watched, cleaned };
}

// Volontairement PLUS ÉLEVÉ que FACT/WATCHED_MAX_COUNT (2) — confirmé en
// direct : à la demande "passe en revue mes vues récentes et demande-moi si
// j'ai aimé", puis "j'ai adoré, mets 5 étoiles à tous", un plafond de 2
// rendait la notation en lot structurellement impossible. Le modèle
// listait les 8 titres en texte, affirmait "c'est noté", et rien n'était
// réellement enregistré — exactement le mensonge sur action que le prompt
// interdit par ailleurs. 12 couvre une passe complète de vues récentes
// (buildUserContext en expose au plus une dizaine) sans ouvrir la porte à
// une réponse entièrement composée de marqueurs.
const RATING_MAX_COUNT = 10;
const RATING_TITLE_MAX_LEN = 200;
const RATING_OPINION_MAX_LEN = 200;
// No line anchors, same reasoning as FACT_RE/WATCHED_RE.
const RATING_RE = /\[\[NOTE:\s*(.+?)\]\]/gi;

/** Pulls the model's own inline `[[NOTE: titre|type|étoiles|opinion]]`
 *  markers — mirrors extractFacts/extractWatched exactly (same "piggyback
 *  on the reply already generated" discipline, no separate LLM call).
 *  Emitted when the user gives a clear conversational opinion the model can
 *  confidently translate to a 1-5 intensity ("j'ai adoré" → 5, "quelle
 *  merde" → 1) — the model is instructed (actions.ts) to NEVER emit this
 *  when genuinely unsure, so `stars` here is trusted as the model's best
 *  read, but always stored as source "inferred" (tasteProfile.setRating),
 *  never able to override an explicit widget/chat rating the user already
 *  gave. `opinion` (optional) is the snippet that justified the number —
 *  kept for the "why", separate from the number itself. */
export function extractRatings(text: string): {
  ratings: { title: string; type: "movie" | "series"; stars: number; opinion?: string }[];
  cleaned: string;
} {
  const ratings: { title: string; type: "movie" | "series"; stars: number; opinion?: string }[] = [];
  const cleaned = text
    .replace(RATING_RE, (_, raw: string) => {
      const parts = raw.split("|").map((s) => s.trim());
      const title = (parts[0] ?? "").slice(0, RATING_TITLE_MAX_LEN);
      const type = parts[1]?.toLowerCase() === "series" ? "series" : "movie";
      const stars = Math.round(Number(parts[2]));
      const opinion = parts[3] ? parts[3].slice(0, RATING_OPINION_MAX_LEN) : undefined;
      if (title && Number.isInteger(stars) && stars >= 1 && stars <= 5 && ratings.length < RATING_MAX_COUNT) {
        ratings.push({ title, type, stars, opinion });
      }
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { ratings, cleaned };
}

// "je m'appelle Seb", "je me nomme Léa", "moi c'est Max"/"c'est Max", "mon
// prénom est/c'est Alex", "appelle-moi Théo" — one alternation, name in the
// capture group. Accented/hyphenated first names allowed (Léa, Jean-Paul),
// capped at a plausible first-name length. "moi" is optional in "c'est X"
// — bug fix (confirmed live): a bare "c'est Seb" reply (no "moi") to the
// assistant's own "comment tu t'appelles ?" didn't match, the fact never
// got stored, and needsName stayed true forever — while the model still
// "saw" the name in its own conversation history (session.messages),
// producing a self-contradictory reply ("tu ne m'as pas donné ton
// prénom... Seb !").
// Bug confirmé en direct : la variante "c'est X" SANS "moi" devant capturait
// n'importe quel mot suivant un "c'est" au fil d'une phrase ordinaire — la
// phrase « The Northman, non j'ai pas vu, c'est avec dicaprio ? » a enregistré
// « Prénom : Avec » et ÉCRASÉ le vrai prénom (les faits "prénom" se
// remplacent, voir rememberFact/NAME_FACT_RE). "moi" est donc redevenu
// OBLIGATOIRE pour cette forme : le cas légitime "c'est Seb" en réponse
// directe à « comment tu t'appelles ? » reste couvert, mais par
// extractNameFromDirectAnswer (qui, lui, exige que la question ait
// réellement été posée au tour précédent) — pas par ce détecteur-ci, qui
// s'applique à n'importe quelle phrase.
const NAME_INTRO_RE =
  /\b(?:je\s+m[e']\s*(?:appelle|nomme)|moi\s*,?\s*c'?est|mon\s+pr[ée]nom\s*(?:est|c'?est)|appelle[- ]moi)\s+([a-zà-öø-ÿ][a-zà-öø-ÿ'-]{1,29})\b/i;
// La forme "c'est X" SANS "moi" reste acceptée — mais UNIQUEMENT quand elle
// constitue tout le début du message ("c'est Seb" en réponse à « comment tu
// t'appelles ? »), jamais au fil d'une phrase où "c'est" est un simple verbe
// ("...je l'ai pas vu, c'est avec DiCaprio ?" → capturait "Avec").
const NAME_INTRO_BARE_RE = /^\s*c'?est\s+([a-zà-öø-ÿ][a-zà-öø-ÿ'-]{1,29})\b/i;
// Filet de sécurité complémentaire : même avec "moi c'est", un mot purement
// grammatical n'est jamais un prénom.
const NOT_A_NAME = new Set([
  "qui", "quoi", "cool", "ok", "bon", "super", "genial", "génial", "sympa", "gentil", "gentille",
  "parti", "fini", "clair", "sûr", "sur", "vrai", "faux",
  "avec", "sans", "pour", "dans", "chez", "vers", "par", "pas", "plus", "moins", "trop", "très",
  "de", "du", "en", "au", "aux", "sur", "sous", "entre", "depuis", "après", "avant", "et", "ou",
  "juste", "quand", "comme", "aussi", "encore", "déjà", "jamais", "toujours", "bien", "mal",
  "un", "une", "le", "la", "les", "du", "des", "ce", "cette", "ces", "mon", "ma", "mes",
  "son", "sa", "ses", "leur", "leurs", "tout", "toute", "tous", "toutes", "rien", "quelque",
  "moi", "toi", "lui", "elle", "nous", "vous", "eux", "ça", "cela", "celui", "celle",
  "peut", "doit", "va", "vais", "fait", "dit", "vu", "pareil", "dommage", "marrant", "drôle",
]);

// "comment tu t'appelles", "quel est ton prénom", "ton prénom ?" — the
// assistant's own onboarding question (buildProactiveNudgeTrigger/
// buildSystemPrompt's needsName instruction always phrases it this way).
// Used to recognize a BARE one-word reply ("Seb") as a name answer even
// when it doesn't match any of NAME_INTRO_RE's sentence patterns — only
// fires when the assistant's immediately preceding turn actually asked,
// so a random one-word message elsewhere in the conversation is never
// misread as a name.
const NAME_QUESTION_RE = /pr[ée]nom|t'appelles|appelles-tu/i;

/** Bare-word reply to the assistant's own "what's your name" question —
 *  companion to extractSelfIntroName, which only catches a self-contained
 *  sentence pattern. `previousAssistantMessage` is the turn right before
 *  the current user message (session.messages[length-2] at the call site,
 *  since the current user message is already pushed by then). */
export function extractNameFromDirectAnswer(previousAssistantMessage: string | undefined, userMessage: string): string | null {
  if (!previousAssistantMessage || !NAME_QUESTION_RE.test(previousAssistantMessage)) return null;
  const trimmed = userMessage.trim().replace(/[.!?]+$/, "");
  if (!/^[a-zà-öø-ÿ][a-zà-öø-ÿ'-]{1,29}$/i.test(trimmed)) return null;
  if (NOT_A_NAME.has(trimmed.toLowerCase())) return null;
  const name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return `Prénom : ${name}`;
}

// Matches the assistant's PRIOR turn claiming a title is absent from the
// user's library — the exact confirmed-live failure shape ("tu n'as encore
// rien ajouté de X", "Les Duos Impossible n'est pas dans ta bibliothèque",
// "tu n'as jamais regardé ça"). Deliberately narrow to the "absence of a
// title" claim shape, not any assistant mistake — a large taxonomy isn't
// reliably detectable from regex alone (see tasteProfile.ts module doc).
const LIBRARY_ABSENCE_CLAIM_RE = /\b(tu n'as (?:pas|jamais|rien|encore rien)|n'(?:est|êtes?) pas dans ta biblioth[eè]que|ne (?:figure|figurent|sont?) pas dans ta biblioth[eè]que|pas encore ajout[ée]|il te manque)\b/i;

// User disagreeing with that claim right after it was made — "ben si",
// "mais si", "en fait si", "je l'ai déjà", "c'est faux", "tu te trompes"...
// Confirmed-live example: "ben si, j'ai les duo impossible".
const LIBRARY_CORRECTION_RE = /\b(ben si|mais si|en fait si|si,? (?:je|j')|c'est faux|tu te trompes|tu as tort|non c'est pas vrai|je (?:l'|les )?ai (?:d[ée]j[aà]|deja)?)\b/i;

/** Companion to extractNameFromDirectAnswer: same shape (previous assistant
 *  turn + current user message, checked against a fixed claim pattern),
 *  different purpose — detects when the user is correcting the assistant on
 *  a library-presence claim ("tu n'as pas X") it just made, so the mistake
 *  can be logged (tasteProfile.recordCorrection) instead of only ever
 *  surviving as an in-context apology the model forgets next session.
 *  `previousAssistantMessage` is session.messages[length-2] at the call
 *  site, exactly like extractNameFromDirectAnswer. Returns a short excerpt
 *  of the user's correction (for the log), or null if this doesn't look
 *  like that specific correction shape. */
export function detectLibraryFalseNegativeCorrection(previousAssistantMessage: string | undefined, userMessage: string): string | null {
  if (!previousAssistantMessage || !LIBRARY_ABSENCE_CLAIM_RE.test(previousAssistantMessage)) return null;
  if (!LIBRARY_CORRECTION_RE.test(userMessage)) return null;
  return userMessage.trim().slice(0, 200);
}

/** True when a mode-3 reply has no real sentence left after `[[FAIT:...]]`/
 *  `[[VU:...]]` markers are stripped — either the model's ENTIRE reply was
 *  marker lines (a documented prompt-following miss on small/free-tier
 *  models, confirmed live), or some other degenerate/empty output. Pure
 *  check, used by chat/route.ts to trigger a single bounded retry instead
 *  of silently falling back to a non-responsive placeholder. */
export function isDegenerateReply(cleaned: string): boolean {
  return cleaned.trim().length === 0;
}

// Confirmed live : pour une mention de titre déjà présent/déjà vu, le
// modèle a répondu en mode 3 (pas de JSON, pas de fuite du libellé
// "VÉRIFICATION RÉELLE" littéral — donc ni isDegenerateReply ni
// containsLeakedInternalBlock ne l'attrapent) mais avec une ligne unique
// au format "• Déjà dans la bibliothèque — X (année)" — une IMITATION du
// format technique interne (summarizeAdd, dans chat/route.ts) que le
// modèle a manifestement repris du style de ses propres tours précédents
// dans la même conversation, au lieu d'une vraie phrase. Même famille de
// bug que "NE JAMAIS PARLER COMME UNE BASE DE DONNÉES", sous une forme que
// la détection de fuite littérale ne couvre pas.
const MECHANICAL_BULLET_LINE_RE = /^[•\-*]\s/;

/** True when EVERY non-empty line of a mode-3 reply looks like a mechanical
 *  "• Field — Value" bullet rather than a real sentence — see doc above. */
export function isMechanicalBulletReply(cleaned: string): boolean {
  const lines = cleaned.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((l) => MECHANICAL_BULLET_LINE_RE.test(l));
}

// Confirmed live: the retry above (chat/route.ts) doesn't reliably fix
// this — a small model can reproduce the exact same mechanical bullet even
// after being told explicitly not to. Rather than a second LLM round-trip
// (against this session's own "bounded retry, then a deterministic
// fallback" discipline), this deterministically reformats the KNOWN bullet
// shapes (mirrors summarizeAdd's own templates in chat/route.ts) into a
// plain sentence — never as warm as a real model reply, but always a real
// sentence instead of raw internal formatting shown to the user.
const BULLET_LINE_CAPTURE_RE = /^[•\-*]\s*(.+?)\s*—\s*(.+)$/;

export function sanitizeMechanicalBulletReply(text: string): string {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const sentences = lines.map((line) => {
    const m = line.match(BULLET_LINE_CAPTURE_RE);
    if (!m) return line.replace(/^[•\-*]\s*/, "");
    const [, label, value] = m;
    const l = label.toLowerCase();
    if (l.includes("déjà dans la bibliothèque")) return `Tu l'as déjà — ${value} est dans ta bibliothèque.`;
    if (l.includes("ajouté")) return `${value} est ajouté(e), la recherche démarre.`;
    if (l.includes("demande envoyée")) return `Demande envoyée pour ${value}.`;
    if (l.includes("introuvable")) return `Je n'ai pas trouvé de correspondance fiable pour ${value}.`;
    if (l.includes("non autorisé")) return `Pas possible pour ${value} — une règle existante l'en empêche.`;
    if (l.includes("échec")) return `Ça a échoué pour ${value}.`;
    return `${label} — ${value}.`;
  });
  return sentences.join(" ");
}

// Confirmed live: a genuine recommend-shaped request ("surprends-moi, sors
// moi de ma zone de confort") got a mode-3 prose reply that TALKS as if a
// list follows ("Voici ce qui devrait te surprendre...") but the model
// never actually switched to mode 1/2's JSON format — no items were ever
// generated, so no recommendation cards ever render and the user is left
// with an unfulfilled promise instead of an error OR real results. A short
// reply ending in ":" with nothing after it is the signature of this
// specific failure (a real prose reply essentially never ends there) —
// narrow enough not to fire on legitimate short answers.
const PROMISED_LIST_RE = /:\s*$/;
// Confirmed live: a reply combining an insult-exchange joke with the exit-
// framing ("Bon, allez, je te laisse avec ça pour te calmer :\n\nVoici ce
// qui devrait bien coller :") ran to ~212 chars and slipped straight past
// the original 200-char cap, un-flagged. The colon-ending signal itself
// doesn't get less suspicious just because more text came before it — a
// genuine complete reply essentially never ends on a bare colon regardless
// of length — so this is raised generously rather than narrowly patched to
// this one case's length.
const PROMISED_LIST_MAX_LEN = 500;

export function promisesListWithNothing(cleaned: string): boolean {
  const t = cleaned.trim();
  return t.length > 0 && t.length <= PROMISED_LIST_MAX_LEN && PROMISED_LIST_RE.test(t);
}

// The prompt tells the model to reformulate the "VÉRIFICATION RÉELLE"/
// "RECHERCHE RÉELLE" blocks (actions.ts) into a natural sentence and never
// surface their internal label/structure — confirmed live, a small/
// free-tier model can still just copy the block verbatim into its reply
// (the exact same failure mode as isDegenerateReply above: a prompt-only
// instruction that isn't reliably followed). Detected here so chat/route.ts
// can retry once with an explicit correction, same shape as the degenerate-
// reply retry, before falling back to sanitizeLeakedBlock as a last resort.
const LEAKED_BLOCK_RE = /VÉRIFICATION RÉELLE|RECHERCHE RÉELLE/;

export function containsLeakedInternalBlock(text: string): boolean {
  return LEAKED_BLOCK_RE.test(text);
}

/** Last-resort safety net when even the corrective retry still leaked the
 *  raw block (chat/route.ts) — strips the internal label and structural
 *  markers so the user never sees "VÉRIFICATION RÉELLE"/"RECHERCHE RÉELLE"
 *  literally, even though the resulting sentence is rougher than a real
 *  paraphrase. The underlying facts are left untouched — only the
 *  formatting that reveals this was a technical note gets removed. */
// Belt-and-suspenders alongside parseIntent's own fallbackRawText (which
// already swaps a malformed add_media/recommend JSON for a friendly apology
// when extractJsonObjectSpan can't parse it): this catches the case where a
// VALID JSON action block somehow still ends up inside a mode-3 `cleaned`
// string after all the marker-stripping above (never reproduced against
// current code, but confirmed by the user as something they've actually
// seen — kept as a cheap final safety net rather than assuming it can't
// happen again). Never shown to the user under any circumstance.
const RAW_ACTION_JSON_RE = /\{[\s\S]*?"action"\s*:\s*"(?:add_media|recommend)"[\s\S]*\}/;

export function containsLeakedActionJson(text: string): boolean {
  return RAW_ACTION_JSON_RE.test(text);
}

export function sanitizeLeakedActionJson(text: string): string {
  return text.replace(RAW_ACTION_JSON_RE, "").trim();
}

export function sanitizeLeakedBlock(text: string): string {
  return text
    .replace(/VÉRIFICATION RÉELLE\s*(—\s*[^:«]+)?\s*pour\s*«[^»]*»\s*/gi, "")
    .replace(/RECHERCHE RÉELLE\s*pour\s*«[^»]*»\s*(\([^)]*\))?\s*:?\s*/gi, "")
    .replace(/→\s*identifié comme\s*/gi, "")
    .replace(/\[(?:film|série),\s*tmdb:\d+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s*[:—-]\s*/, "")
    .trim();
}

// The prompt already forbids CLAIMING to have memorized something never
// received (buildSystemPrompt's "NE JAMAIS PRÉTENDRE AVOIR MÉMORISÉ..."
// rule) — this is the mirror-image failure, confirmed live: the user asks
// "tu te souviens de mon prénom ?" and the model denies knowing it ("je ne
// sais pas encore, dis-le-moi") even though a real "Prénom : X" fact IS
// present in the facts actually injected into this same request's system
// prompt (the model had used that exact name earlier in the SAME
// conversation). A false denial of real memory is just as dishonest as a
// fabricated one, so it gets the same code-level detect-and-retry
// treatment rather than staying a prompt-only hope.
const REMEMBERS_NAME_QUESTION_RE = /\btu\s+(?:te\s+souviens|sais|connais)\b[^.!?\n]*\b(?:mon\s+pr[ée]nom|moi|comment\s+je\s+m'appelle)\b|\bje\s+m'appelle\s+comment\b/i;
// No trailing \b after "dit"/"donn[ée]" — JS regex \b treats accented
// letters as non-word characters, so a boundary right after "donné" never
// matches (confirmed with a failing test: \b silently broke the whole
// alternative). The words themselves are distinctive enough not to need it.
const NAME_DENIAL_RE = /\bje\s+ne\s+(?:sais|connais)\s+pas(?:\s+encore)?\b|\btu\s+ne\s+(?:me\s+l['e]|m['e])\s*(?:l['e])?\s*as\s+pas\s+(?:dit|donn[ée])/i;

/** True when the user just asked "do you remember me/my name" and the
 *  reply denied it, even though `knownName` (the real "Prénom : ..." fact
 *  string already present in this user's profile) says otherwise. Pure
 *  check — chat/route.ts only calls this when a name fact genuinely
 *  exists, so a true result here is always a false denial, never a
 *  legitimate "I don't know". */
export function isFalseNameDenial(userMessage: string, reply: string, knownName: string | undefined): boolean {
  return !!knownName && REMEMBERS_NAME_QUESTION_RE.test(userMessage) && NAME_DENIAL_RE.test(reply);
}

// Confirmed live, TWICE, even after the prompt was given the real toggle
// state (buildSystemPrompt's webAccess block): with "Recherche web" ON in
// Réglages, the user asked "tu as accès à internet à présent ?" and the
// model still flatly denied any access at all ("je n'ai toujours pas accès
// à internet... Movviz ne me donne pas cette capacité") — a categorical
// denial that's simply false while the toggle is on (a real web search DOES
// happen for the memorable-scene feature). Same class of bug as the name-
// memory denial above: a prompt-only instruction about the model's own
// state isn't reliably followed, so it gets the same detect-and-retry
// treatment instead of staying a prompt-only hope.
const INTERNET_ACCESS_QUESTION_RE = /\b(tu|t')\s*(as|a)\s+(accès|acces)\s+(à\s+|a\s+)?internet\b|\baccès\s+(à\s+|a\s+)?internet\b[^.!?\n]*\?/i;
const INTERNET_ACCESS_DENIAL_RE = /\bpas\s+(d['e])?\s*accès\s+(à\s+|a\s+)?internet\b|\bne\s+(me\s+)?donne\s+pas\s+(cette\s+)?(capacit[ée]|option|acc[èe]s)\b/i;

/** True when the user asked about internet access and the reply denied it
 *  categorically, even though `webSearchEnabled` says a real (narrowly-
 *  scoped) web search capability does exist right now. Caller only needs
 *  to pass the real, current toggle value — a true result here is always a
 *  false denial while the toggle is on, never a legitimate "no" (when the
 *  toggle is off, a plain denial is correct and this returns false). */
export function isFalseInternetDenial(userMessage: string, reply: string, webSearchEnabled: boolean): boolean {
  return webSearchEnabled && INTERNET_ACCESS_QUESTION_RE.test(userMessage) && INTERNET_ACCESS_DENIAL_RE.test(reply);
}

// Confirmed live : "je vais vérifier ça tout de suite !" comme réponse
// ENTIÈRE — une promesse d'action que le modèle ne tient jamais, puisqu'un
// message de chat n'a pas de "deuxième temps" automatique : soit la
// vérification a vraiment lieu DANS ce même message (une "VÉRIFICATION
// RÉELLE"/"RECHERCHE RÉELLE" est déjà injectée plus haut dans le prompt à ce
// moment-là), soit elle n'aura jamais lieu et la promesse est un mensonge
// par omission. Même classe de bug que isFalseInternetDenial/
// isFalseNameDenial ci-dessus : une règle prompt-only ("ne promets jamais
// une action que tu ne tiens pas") ne suffit pas sur ce modèle, donc
// détection + retry côté code.
const UNRESOLVED_CHECK_PROMISE_RE = /\b(je (?:vais|dois)|laisse[- ]moi|un instant,?\s+je|attends?,?\s+je)\s+(v[ée]rifier?|regarder?|check(?:er)?|jette un [œoe]il)\b/i;

/** True when the reply's ONLY real content is a promise to go check
 *  something (no other substantial sentence) — never a legitimate answer,
 *  since Movviz has no async follow-up mechanism: the check must happen in
 *  THIS same reply or not at all. A promise mixed into a longer reply that
 *  already contains real content is left alone (not degenerate). */
const UNRESOLVED_CHECK_PROMISE_MAX_WORDS = 12;

export function isUnresolvedCheckPromise(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed || !UNRESOLVED_CHECK_PROMISE_RE.test(trimmed)) return false;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount <= UNRESOLVED_CHECK_PROMISE_MAX_WORDS;
}

// Confirmé en direct (huit titres, zéro note réellement enregistrée) : à la
// demande "mets 5 étoiles à tous", le modèle a affiché une belle liste
// "Titre : 5/5" et affirmé "voici les notes mises à jour" — sans émettre un
// seul marqueur [[NOTE: ...]]. Rien n'était noté, et l'utilisateur a dû
// vérifier lui-même pour s'en rendre compte. Même classe de bug que
// isUnresolvedCheckPromise (annoncer une action non exécutée), donc même
// traitement : détection code-level + retry, jamais une règle prompt seule.
const RATING_CLAIM_RE = /\b(c'est not[ée]|bien not[ée]|notes? (?:mise|mises) à jour|voici (?:les|tes) notes|j(?:e|')(?:ai|) ?(?:mis|mets|attribue|ajoute)\s+(?:un\s+)?\d\s*(?:\/\s*5|étoiles?)|je (?:vais )?(?:les? )?(?:mettre|noter) (?:à|en) \d)/i;
// Rappeler une note DÉJÀ existante ("tu lui avais mis 4/5") est parfaitement
// légitime et ne doit jamais déclencher de retry — c'est l'utilisateur qui
// a noté, pas le modèle qui prétend le faire maintenant.
const RATING_RECALL_RE = /\btu (?:lui )?(?:avais|as|avait) (?:mis|donn[ée]|attribu[ée])\b/i;
// Une liste "Titre : 5/5" / "Titre — 4/5" sur plusieurs lignes : la forme
// exacte prise par la fausse notation en lot observée en direct.
const RATING_LIST_LINE_RE = /^.{2,80}?\s*[:—-]\s*\d\s*\/\s*5\b/gim;

/** True quand la réponse ANNONCE avoir noté (ou liste des titres avec leur
 *  note) alors qu'AUCUN marqueur `[[NOTE: ...]]` n'a été émis — donc que
 *  rien n'a réellement été enregistré. `extractedCount` est le nombre de
 *  notes réellement extraites de cette même réponse (extractRatings). */
export function claimsRatingWithoutMarker(cleaned: string, extractedCount: number): boolean {
  if (extractedCount > 0) return false;
  const text = cleaned.trim();
  if (!text || RATING_RECALL_RE.test(text)) return false;
  if (RATING_CLAIM_RE.test(text)) return true;
  // Deux lignes ou plus au format "Titre : N/5" = une liste de notation,
  // jamais une simple mention en passant.
  return (text.match(RATING_LIST_LINE_RE) ?? []).length >= 2;
}

// "il me manque quel film/série de X", "il me manque quoi de X", "il me
// manque quoi comme film de X", "qu'est-ce qu'il me manque de X", "j'ai pas
// quoi comme film de X" — the entity (franchise/actor/director/character,
// one or several words) is captured in group 1. Each alternative anchors on
// a fixed French opener before "de X" so this stays narrow: a message that
// merely mentions a franchise name in passing never matches, only the
// explicit "what am I missing" question shape.
const MISSING_FROM_ENTITY_PATTERNS: RegExp[] = [
  /il me manque\s+(?:quels?|quoi)\s*(?:comme\s+)?(?:films?|s[ée]ries?)?\s*(?:de\s+|d')([^.!?\n]+)/i,
  /qu'est[- ]ce qu'il me manque\s*(?:comme\s+)?(?:films?|s[ée]ries?)?\s*(?:de\s+|d')([^.!?\n]+)/i,
  /j'ai pas\s+(?:quoi|quels?)\s*(?:comme\s+)?(?:films?|s[ée]ries?)?\s*(?:de\s+|d')([^.!?\n]+)/i,
];
// "quels films de X j'ai pas encore" — the entity sits BEFORE the "j'ai
// pas"/"je n'ai pas" clause instead of after "de", so it needs its own
// pattern shape (can't share the trailing-capture form above).
const MISSING_FROM_ENTITY_TRAILING_RE = /quels?\s+(?:films?|s[ée]ries?)\s+de\s+([^.!?\n]+?)\s+(?:j'ai pas|je n'ai pas)(?:\s+encore)?/i;

const MAX_ENTITY_LEN = 60;
// Pronouns/fillers the loose alternation above can still capture ("il me
// manque quoi de lui") — useless as a TMDb search query, and this exact
// phrasing already showed up in the confirmed-live Jeremy Ferrari
// conversation as a follow-up referring back to a name mentioned earlier,
// not a fresh entity. Rejected here so it falls back to the existing
// honesty prompt rule instead of firing a TMDb search on "lui".
const NOT_AN_ENTITY = new Set(["lui", "elle", "eux", "elles", "ça", "ca", "cela", "ce", "moi", "toi", "ici", "la"]);

/** Detects "what [film/series] of/from X am I missing" in its common French
 *  phrasings and extracts X. Companion to the "FILMOGRAPHIE D'UNE PERSONNE"
 *  honesty rule in actions.ts's buildSystemPrompt: that rule alone (a purely
 *  textual "don't invent, don't claim false grounding" instruction) was
 *  confirmed live to NOT reliably hold on a small/free-tier model — "Il me
 *  manque quel film de pokemon" still produced an invented "aucun film
 *  Pokémon" answer the user then had to correct ("j'ai énormément de
 *  pokemon"), the same failure shape as the earlier Jeremy Ferrari
 *  incident the rule was written for. When this returns a non-null entity,
 *  the caller runs a REAL search and injects verified results instead of
 *  leaving the model to guess — see buildMissingFromFranchiseContext
 *  (actions.ts). Returns null on no match (falls back to the honesty rule,
 *  a safety net) or on a pronoun/filler capture that isn't a usable query. */
export function extractMissingFromEntity(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  let raw: string | undefined;
  for (const re of MISSING_FROM_ENTITY_PATTERNS) {
    const m = normalized.match(re);
    if (m) { raw = m[1]; break; }
  }
  if (!raw) {
    const m = normalized.match(MISSING_FROM_ENTITY_TRAILING_RE);
    if (m) raw = m[1];
  }
  if (!raw) return null;
  const entity = raw.trim().replace(/^(de |d')/i, "").trim().slice(0, MAX_ENTITY_LEN).trim();
  if (entity.length < 2) return null;
  if (NOT_AN_ENTITY.has(entity.toLowerCase())) return null;
  return entity;
}

// "donne-moi la filmographie de X", "la filmographie de X", "quels films a
// fait/tourné/joué X", "tous les films de X" — a genuine "list everything
// this person made" request, distinct from extractMissingFromEntity's "what
// am I missing" framing above (that one requires "manque"/"j'ai pas"; this
// one is the plain listing request that was confirmed live to get an
// endlessly repeated, identical refusal — the model has no real data for
// it and no code path ever gave it any, so every retry landed on the exact
// same canned "je ne peux pas vérifier ça" line, word for word, even after
// being told "tu as accès à internet"). Deliberately does NOT match the
// "manque"/"pas encore" framing so the two detectors stay mutually
// exclusive rather than double-firing on the same message.
const FILMOGRAPHY_PATTERNS: RegExp[] = [
  /(?:donne[- ]moi|montre[- ]moi)\s+la\s+filmographie\s+(?:de\s+|d')([^.!?\n]+)/i,
  /\bla\s+filmographie\s+(?:complète\s+)?(?:de\s+|d')([^.!?\n]+)/i,
  /quels?\s+(?:films?|s[ée]ries?)\s+a\s+(?:fait|tourn[ée]|jou[ée]|r[ée]alis[ée])\s+([^.!?\n]+)/i,
  /(?:tous|toute)\s+les\s+films?\s+(?:de\s+|d')([^.!?\n]+)/i,
  // "combien de films j'ai de Snyder" / "combien de films de X j'ai" — a
  // COUNT question, not a listing one, but it needs the exact same real
  // cross-referenced-against-the-library search: confirmed live, asked
  // "combien de films j'ai de Snyder" got a confident "aucun" (none) despite
  // several being in the library, because this phrasing matched none of the
  // patterns above and the model fell back to its own unverified guess.
  /combien\s+(?:de\s+|d')(?:films?|s[ée]ries?)\s+(?:est-ce que\s+)?j'ai\s+(?:de\s+|d')([^.!?\n]+)/i,
  /combien\s+(?:de\s+|d')(?:films?|s[ée]ries?)\s+(?:de\s+|d')([^.!?\n]+?)\s+(?:est-ce que\s+)?j'ai\b/i,
  // Confirmed live: several other natural phrasings around "réalisé" all
  // missed every pattern above and fell through to an ungrounded model
  // guess ("qu'est-ce que Zack Snyder a réalisé que j'ai déjà" produced a
  // self-contradictory answer — "aucun film... Par contre tu as Justice
  // League" — because nothing ever gave the model real data to work with).
  /r[ée]alis[ée]\s+par\s+([^.!?\n]+)/i,
  /est-ce que\s+([^.!?\n]+?)\s+a\s+r[ée]alis[ée]/i,
  /qu['’]?a\s+r[ée]alis[ée]\s+([^.!?\n]+)/i,
  /([^.!?\n]+?)\s+a\s+(?:d[ée]j[àa]\s+)?r[ée]alis[ée]\b/i,
];

/** Detects a plain "give me X's filmography" request (X = actor/director/
 *  person) and extracts X. Companion to extractMissingFromEntity, same
 *  "code-level detection, real search injected, never left to the model to
 *  guess" shape — but this one resolves the entity as a TMDb PERSON
 *  specifically (searchMulti only ever returns movie/tv results, filtering
 *  people out entirely, so a bare name like "Brad Pitt" matched nothing
 *  there) and lists their real, cross-referenced-against-the-library
 *  filmography instead of just a "missing" search. See
 *  buildFilmographyContext (actions.ts). */
export function extractFilmographyQuestion(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  if (/manque|j'ai pas|je n'ai pas/i.test(normalized)) return null;
  let raw: string | undefined;
  for (const re of FILMOGRAPHY_PATTERNS) {
    const m = normalized.match(re);
    if (m) { raw = m[1]; break; }
  }
  if (!raw) return null;
  const entity = raw.trim().replace(/^(de |d')/i, "").trim().slice(0, MAX_ENTITY_LEN).trim();
  if (entity.length < 2) return null;
  if (NOT_AN_ENTITY.has(entity.toLowerCase())) return null;
  return entity;
}

/** Reliable, code-level fallback for the single most common durable fact —
 *  the user's first name — instead of depending entirely on the model
 *  choosing to emit a `[[FAIT: ...]]` marker for it (LLM instruction-
 *  following on a small/free-tier model isn't 100% reliable in practice;
 *  a user's own introduction should never silently fail to be remembered).
 *  Runs on the USER's raw message, not the model's reply. Returns a
 *  ready-to-store fact string, or null if no introduction pattern matched. */
export function extractSelfIntroName(userMessage: string): string | null {
  const match = userMessage.match(NAME_INTRO_RE) ?? userMessage.match(NAME_INTRO_BARE_RE);
  if (!match) return null;
  const raw = match[1];
  // A verb/filler word can end up captured by the loose alternation above
  // ("moi c'est cool" → "cool") — reject anything that isn't plausibly a
  // first name rather than store noise as someone's identity.
  if (NOT_A_NAME.has(raw.toLowerCase())) return null;
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `Prénom : ${name}`;
}

// ---------------------------------------------------------------------------
// "Single title question" detectors — presence / watch status / cast-crew /
// production status about ONE specific title. Same discipline as
// extractMissingFromEntity above (code-level regex, never LLM-decided), but
// these feed resolveTitleAgainstTmdb (a SPECIFIC title, fuzzy-scored) rather
// than a keyword search — a different resolution shape, so kept as separate
// detectors rather than forced into extractMissingFromEntity's pattern. They
// DO share one helper (cleanCapturedTitle) so trimming/false-positive
// filtering for a captured title string doesn't get duplicated four times.
// ---------------------------------------------------------------------------

const MAX_QUESTION_TITLE_LEN = 100;
// Pronoun/filler captures a loose alternation can still pick up ("j'ai ça ?")
// — useless as a TMDb title query, same reasoning as intentParser's
// NOT_AN_ENTITY guard above.
const NOT_A_QUESTION_TITLE = new Set(["ça", "ca", "cela", "ce", "lui", "elle", "eux", "elles", "moi", "toi", "ici", "la", "le", "les", "un", "une", "quoi", "ça ?"]);

function cleanCapturedTitle(raw: string | undefined): string | null {
  if (!raw) return null;
  const title = raw.trim().replace(/[?!.]+$/, "").trim().slice(0, MAX_QUESTION_TITLE_LEN).trim();
  if (title.length < 2) return null;
  if (NOT_A_QUESTION_TITLE.has(title.toLowerCase())) return null;
  return title;
}

// WATCH STATUS ("est-ce que j'ai vu X ?", "j'ai déjà vu X ?", "j'ai regardé
// X ?") — checked BEFORE the presence detector below in route.ts, since
// "j'ai vu X" is the more specific shape and must never also read as a bare
// presence question. The opener form ("est-ce que j'ai vu...") is
// unambiguous enough to not require a trailing "?"; the bare "j'ai vu X"
// form does, to avoid matching a plain statement ("j'ai vu X hier, c'était
// nul") that isn't a question at all.
const WATCHED_QUESTION_PATTERNS: RegExp[] = [
  /\best[- ]ce que j'ai\s+(?:d[ée]j[aà]\s+)?(?:vu|regard[ée])\s+([^?.!\n]+)/i,
  /\bj'ai\s+(?:d[ée]j[aà]\s+)?(?:vu|regard[ée])\s+([^?.!\n]+)\?/i,
];

/** Detects "have I watched X" and extracts X. Companion to
 *  extractLibraryPresenceQuestion below — a title can be OWNED without being
 *  WATCHED (or watched via Plex history without being owned), so this is a
 *  deliberately separate question shape/injected block, never merged with
 *  presence. Returns null on no match (falls back to the honesty rule). */
export function extractWatchStatusQuestion(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  for (const re of WATCHED_QUESTION_PATTERNS) {
    const m = normalized.match(re);
    if (m) return cleanCapturedTitle(m[1]);
  }
  return null;
}

// LIBRARY PRESENCE ("est-ce que j'ai X ?", "j'ai déjà X ?", "je possède
// X ?") — the flagship case ("Est-ce que j'ai Alien ?"). Excludes "vu"/
// "regardé" right after the verb so this never also fires for the WATCHED
// shape above (two separate questions: owning vs. having watched).
// Bug fix (caught by this module's own tests before shipping): the
// negative lookahead used to sit AFTER the optional "déjà " group
// ((?:d[ée]j[aà]\s+)?(?!vu\b|regard[ée])) — since that group is optional,
// the regex engine could skip matching "déjà" entirely and re-check the
// lookahead right after "j'ai ", where "déjà vu Dune" doesn't start with
// "vu"/"regard" and so wrongly PASSED, letting "j'ai déjà vu Dune ?" slip
// through as a presence question instead of being correctly rejected in
// favor of the watched-status shape. The lookahead now sits BEFORE the
// optional "déjà " group so it always checks the true verb position,
// regardless of whether "déjà" is present or backtracked away.
const PRESENCE_OPENER_PATTERNS: RegExp[] = [
  /\best[- ]ce que j'ai\s+(?!(?:d[ée]j[aà]\s+)?(?:vu\b|regard[ée]))(?:d[ée]j[aà]\s+)?([^?.!\n]+)/i,
  /\best[- ]ce que je poss[eè]de\s+(?:d[ée]j[aà]\s+)?([^?.!\n]+)/i,
];
// No unambiguous opener in these two forms — a trailing "?" is REQUIRED,
// since "j'ai X" without one is far more often an ordinary statement
// ("j'ai adoré X", "j'ai fini X hier soir") than a question about
// possession — confirmed risk: "j'ai" appears in a huge share of ordinary
// sentences, unlike "il me manque" (extractMissingFromEntity) which is
// already unambiguous on its own.
const PRESENCE_QUESTION_MARK_PATTERNS: RegExp[] = [
  /\bj'ai\s+(?!(?:d[ée]j[aà]\s+)?(?:vu\b|regard[ée]))(?:d[ée]j[aà]\s+)?([^?.!\n]+)\?/i,
  /\bje poss[eè]de\s+(?:d[ée]j[aà]\s+)?([^?.!\n]+)\?/i,
];

/** Detects "do I own X" and extracts X. Returns null on no match. */
export function extractLibraryPresenceQuestion(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  for (const re of PRESENCE_OPENER_PATTERNS) {
    const m = normalized.match(re);
    if (m) return cleanCapturedTitle(m[1]);
  }
  for (const re of PRESENCE_QUESTION_MARK_PATTERNS) {
    const m = normalized.match(re);
    if (m) return cleanCapturedTitle(m[1]);
  }
  return null;
}

// CAST/CREW ("qui joue dans X ?", "qui a réalisé X ?", "qui est le
// réalisateur de X ?") — Movviz injects ZERO cast/crew data today, so any
// answer here currently comes purely from the model's own training memory
// (a real wrong-actor/wrong-movie hallucination risk, distinct from the
// library-presence class already fixed this session).
const CAST_CREW_PATTERNS: RegExp[] = [
  /\bqui joue dans\s+([^?.!\n]+)/i,
  /\bqui (?:sont les acteurs|fait partie du casting)\s*(?:de |d')([^?.!\n]+)/i,
  /\bqui a r[ée]alis[ée]\s+([^?.!\n]+)/i,
  /\bqui r[ée]alise\s+([^?.!\n]+)/i,
  /\bqui est le r[ée]alisateur (?:de |d')([^?.!\n]+)/i,
];

/** Detects "who's in/directed X" and extracts X. Returns null on no match. */
export function extractCastCrewQuestion(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  for (const re of CAST_CREW_PATTERNS) {
    const m = normalized.match(re);
    if (m) return cleanCapturedTitle(m[1]);
  }
  return null;
}

// PRODUCTION STATUS ("X est-il terminé ?", "est-ce que X est fini ?") —
// explicit-title form. ".+?" is non-greedy so a leading "est-ce que" clause
// doesn't get swallowed into the captured title.
//
// Bug fix (caught by this module's own tests before shipping): the
// masculine forms ("terminé", "annulé", "renouvelé") end in an accented "é"
// — under JS's default (non-Unicode) \b, an accented letter isn't a "word"
// character, so a trailing \b right after it sees a non-word→non-word
// transition (é → space) and never matches, silently rejecting every
// masculine-adjective phrasing ("Dune est-il terminé ?") while the feminine
// forms ("terminée", ending in plain ASCII "e") worked fine. Replaced with
// an explicit lookahead for whitespace/punctuation/end-of-string, which
// doesn't depend on \w's ASCII-only definition of a "word" character.
const STATUS_END_RE = "(?=[\\s?.!,]|$)";
const STATUS_EXPLICIT_PATTERNS: RegExp[] = [
  new RegExp(`\\best[- ]ce que\\s+(.+?)\\s+est\\s+(?:fini(?:e)?|termin[ée]e?|annul[ée]e?|renouvel[ée]e?)${STATUS_END_RE}`, "i"),
  new RegExp(`\\b(.+?)\\s+est[- ](?:il|elle)\\s+(?:fini(?:e)?|termin[ée]e?|annul[ée]e?|renouvel[ée]e?)${STATUS_END_RE}`, "i"),
];
// A captured title that's actually just a reference to "the thing I'm
// looking at right now" rather than a real title — handled separately by
// isSeriesStatusAboutCurrentPage below (needs the caller's page context,
// never a TMDb search on the literal words "cette série").
const CURRENT_PAGE_REFERENCE_RE = /^(cette s[ée]rie|ce film|la s[ée]rie|le film|c'est|[çc]a)$/i;

/** Detects "is X finished/renewed/cancelled" with an EXPLICIT title and
 *  extracts it. Returns null when there's no explicit title (either no
 *  match at all, or the captured text is just "cette série"/"ce film" —
 *  see isSeriesStatusAboutCurrentPage for that case instead). */
export function extractSeriesStatusQuestion(message: string): string | null {
  const normalized = message.replace(/[’‘]/g, "'");
  for (const re of STATUS_EXPLICIT_PATTERNS) {
    const m = normalized.match(re);
    if (m) {
      const cleaned = cleanCapturedTitle(m[1]);
      if (cleaned && !CURRENT_PAGE_REFERENCE_RE.test(cleaned)) return cleaned;
    }
  }
  return null;
}

// Implicit form — "cette série est-elle terminée ?", "est-ce que ce film est
// fini ?" — no explicit title at all, refers to whatever title the caller's
// page context says the user is currently looking at. Deliberately narrow
// to "cette/la série|ce/le film" so a generic "c'est fini ?" (which could
// mean almost anything in conversation) never fires this.
// Same accent/\b fix as STATUS_END_RE above — a raw \b right after
// "terminé"/"annulé"/"renouvelé" (masculine, ends in accented "é") never
// matches under JS's ASCII-only \w.
const STATUS_CURRENT_PAGE_RE = new RegExp(
  `\\b(?:cette s[ée]rie|ce film|la s[ée]rie|le film)\\s+est[- ](?:il|elle)?\\s*(?:fini(?:e)?|termin[ée]e?|annul[ée]e?|renouvel[ée]e?)${STATUS_END_RE}` +
  `|\\best[- ]ce que\\s+(?:cette s[ée]rie|ce film|la s[ée]rie|le film)\\s+est\\s+(?:fini(?:e)?|termin[ée]e?|annul[ée]e?|renouvel[ée]e?)${STATUS_END_RE}`,
  "i"
);

/** True for the implicit "is THIS one finished" shape (see doc above) — the
 *  caller must combine this with actual page context (pageContext in
 *  chat/route.ts) to know which title it refers to; this function alone
 *  only tells the shape matched, never resolves a title itself. */
export function isSeriesStatusAboutCurrentPage(message: string): boolean {
  const normalized = message.replace(/[’‘]/g, "'");
  return STATUS_CURRENT_PAGE_RE.test(normalized);
}

// MENTION CASUELLE D'UN TITRE ("zootopie 2" tout seul, sans question ni
// phrase construite) — confirmé en direct : le modèle demandait "tu veux
// l'ajouter ?" ou "tu l'as vu ?" pour un titre déjà connu de Movviz, faute de
// vérification réelle disponible pour cette forme de message (les 4
// détecteurs ci-dessus exigent tous une QUESTION formulée, jamais une simple
// mention). Volontairement une whitelist HEURISTIQUE plutôt qu'une regex de
// titre (un titre de film n'a pas de forme grammaticale fixe) — le vrai
// filtre anti-faux-positif est resolveTitleAgainstTmdb lui-même (score de
// similarité ≥ 0.45, déjà éprouvé contre les faux amis, ex. "un homme un
// vrai" → rejeté). Cette fonction se contente d'écarter en amont ce qui
// coûterait un appel TMDb pour rien : salutations, accusés de réception,
// phrases longues/construites (probablement pas un titre isolé).
// Bug confirmé en direct : "hep" (une simple interpellation) a été résolu en
// « Hep! Hep! The Slap », un obscur film tchèque, et présenté comme si
// l'utilisateur en parlait. Les interjections/salutations sont donc
// listées largement — un titre de film ne se cache quasiment jamais
// derrière un de ces mots, alors qu'ils reviennent constamment en
// conversation.
// Confirmed live (same failure class as "hep" above): "bof" (a filler word
// meaning "meh") resolved to the real film "O Bofe", and "cretin" resolved
// to "Ce crétin de Malec" (obscure 1920s silent film) — a short, casual
// word or a bare insult can coincidentally be a substring of some obscure
// real title, and titleSimilarity's fuzzy scoring is lenient enough on
// short strings to clear MIN_AI_MATCH_SCORE. Filler words AND common
// standalone insults (same vocabulary the personality prompt in actions.ts
// already reacts to) are listed here for the same reason "hep" is: a real
// film title essentially never hides behind one of these on its own.
// Confirmed live AGAIN, same failure class: "va te faire foutre" (a common
// multi-word insult PHRASE, not a single word) resolved to the real film
// "Va te faire foutre Freddy" (2001) — the single-word list above can never
// catch this since CHITCHAT_ONLY_RE requires an exact whole-string match;
// common phrasal insults need their own alternatives, listed separately.
const CHITCHAT_ONLY_RE = /^(salut|bonjour|bonsoir|hello|hey|hé|he|hep|ho|oh|ah|eh|coucou|yo|wesh|slt|cc|hola|merci|merci beaucoup|ok|okay|d'accord|dac|cool|super|nickel|top|lol|mdr|ptdr|haha|hihi|oui|non|ouais|ouep|nan|si|ça va|ca va|comment ça va|comment tu vas|quoi de neuf|à bientôt|a bientot|bye|ciao|au revoir|bonne nuit|stop|arrête|arrete|attends|attend|hmm|hum|bref|voilà|voila|bof|bah|beh|pff|pfff|meh|mouais|bof bof|a[iï]e|ouille|zut|miam|hem|ouf|grrr|hop|ouste|con|connard|connasse|abruti|abrutie|d[ée]bile|cr[ée]tin|cr[ée]tine|nul|nulle|idiot|idiote|stupide|imb[ée]cile|tar[ée]|tar[ée]e|andouille|boulet|relou|naze|tocard|guignol|couillon|salaud|putain|merde|va te faire foutre|va te faire voir|va te faire encul[ée]r?|va te faire cuire (?:un [œo]euf|le cul)|casse[- ]toi|ta gueule|ferme[- ]la|d[ée]gage|nique ta m[èe]re|je t'emmerde|tu me fais chier|tu me gonfles|tu me soules|blaireau|bouffon|pourriture|ordure|malotru|casse[- ]pieds|casse[- ]bonbons)[\s!.?]*$/i;
// Réponses courtes / références implicites à ce qui vient d'être dit —
// jamais un titre, toujours une réaction/correction à résoudre par rapport
// au message précédent de Movviz et au sujet actif de la conversation (voir
// la règle "RÉPONSES COURTES ET RÉFÉRENCES IMPLICITES" du prompt système).
// Écarté ici pour ne jamais gaspiller une recherche TMDb dessus — le modèle
// garde l'historique complet de la conversation pour les résoudre lui-même.
const CONTEXTUAL_REFERENCE_RE = /^(pourtant si|mais si|en fait si|si,? (?:je|j'|c'est)|exactement|celui[- ]l[àa]|celle[- ]l[àa]|le premier|la première|le deuxième|la deuxième|le troisième|le dernier|celui d'avant|celui|celle|lui|elle|pareil|pas celui[- ]l[àa]|pas celle[- ]l[àa]|je l'ai d[ée]j[aà] vu|je l'ai d[ée]j[aà]|je ne l'ai pas vu|je ne l'ai pas)[\s!.?]*$/i;
const BARE_TITLE_MAX_LEN = 60;
const BARE_TITLE_MAX_WORDS = 8;

/**
 * A short affirmative or imperative is only ambiguous in isolation.  Right
 * after Movviz offered a selection (or said it was about to give one), it is
 * a continuation of that recommendation turn — never a film title.  This
 * prevents `donne` from being resolved as a title such as « Nouvelle donne ».
 */
const RECOMMENDATION_OFFER_RE = /\b(?:recommand(?:ation|e|er)|propos(?:e|er)|sugg[èe]r(?:e|er)|s[ée]lection|liste|dans le m[êe]me (?:style|mood|genre)|ce qui devrait (?:bien )?coller|je te (?:fais|sors|balance|envoie))/i;
const RECOMMENDATION_CONTINUATION_RE = /^(?:oui|ouais|ouep|ok(?:ay)?|d['’]accord|vas[- ]y|go|donne(?:-moi)?|balance(?:-moi)?|envoie(?:-moi)?|je veux(?: bien)?|pourquoi pas)[\s!.?]*$/i;

export function isRecommendationContinuation(previousAssistantMessage: string | undefined, userMessage: string): boolean {
  return !!previousAssistantMessage
    && RECOMMENDATION_OFFER_RE.test(previousAssistantMessage)
    && RECOMMENDATION_CONTINUATION_RE.test(userMessage.trim());
}

// Confirmed live, repeatedly: the prompt-only "no recommendation list
// during an insult exchange, unless 3-4 rounds in" rule (actions.ts,
// PERSONNALITÉ) is NOT reliably followed by the small/free-tier model — a
// single strong insult ("va te faire enculer", "t'es vraiment con") dumped
// a full 6-item recommend list on round 1, twice in a row. Unlike title-
// mention detection above (which must stay narrow to avoid false
// positives), this only needs to spot "does this message contain an
// insult", so a broader unanchored match is fine — false positives here
// just mean one extra retry, never a wrong title resolved. Not anchored to
// the whole string (unlike CHITCHAT_ONLY_RE) — a full sentence around the
// insult ("tu sais bien que j'ai tout vu abruti") must still count.
const INSULT_CONTENT_RE = /\b(con|connard|connasse|abruti|abrutie|d[ée]bile|cr[ée]tin|cr[ée]tine|nul|nulle|idiot|idiote|stupide|imb[ée]cile|tar[ée]|andouille|boulet|relou|naze|tocard|guignol|couillon|salaud|encul\w*|merde|putain|chier|emmerde|foutre|casse[- ]toi|gueule|f[ée]rme[- ]la|d[ée]gage|gonfles?|soules?|blaireau|bouffon|pourriture|ordure|malotru|casse[- ]pieds|casse[- ]bonbons)\b/i;

export function isInsultMessage(message: string): boolean {
  return INSULT_CONTENT_RE.test(message);
}

/** Counts how many of the most recent USER turns (walking back from just
 *  before the current message) were also insults, stopping at the first
 *  non-insult — the "combien de rounds d'affilée" signal the escalation-exit
 *  rule (actions.ts) needs to know whether a recommendation is actually due
 *  yet. Does not look at assistant turns at all: only the user's own
 *  pattern of repeated insults counts as "rounds", not how the AI replied. */
export function countConsecutiveInsultRounds(messages: { role: "user" | "assistant"; content: string }[]): number {
  let streak = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    if (!isInsultMessage(messages[i].content)) break;
    streak++;
  }
  return streak;
}

/** All assistant replies from the current insult streak (most recent
 *  first), up to `max`. Confirmed live: comparing a new reply only against
 *  the SINGLE immediately-previous one let an A/B/A/B pattern through
 *  undetected (round 2 and round 4 shared a template; round 3, different,
 *  broke the adjacency check) — the caller must check against this whole
 *  window, not just messages[length - 2]. Messages strictly alternate
 *  user/assistant within an insult streak, so assistant replies sit at
 *  length-2, length-4, length-6, ... */
export function recentInsultStreakReplies(messages: { role: "user" | "assistant"; content: string }[], max = 3): string[] {
  const out: string[] = [];
  for (let i = messages.length - 2; i >= 0 && out.length < max; i -= 2) {
    if (messages[i].role !== "assistant") break;
    out.push(messages[i].content);
  }
  return out;
}

// Confirmed live: two full recommendation dumps landed back to back (round
// 4 AND round 5 of the same insult exchange), even though the escalation-
// exit rule in actions.ts explicitly says "une seule fois" — once the exit
// has already happened, later rounds must go back to being blocked exactly
// like an under-3 streak, not treated as free to exit again and again.
// Walks the same alternating streak window as recentInsultStreakReplies,
// checking each prior assistant reply for a non-empty recommendations list.
export function hasAlreadyExitedInsultStreak(messages: { role: "user" | "assistant"; recommendations?: unknown[] }[]): boolean {
  for (let i = messages.length - 2; i >= 0; i -= 2) {
    if (messages[i].role !== "assistant") break;
    if ((messages[i].recommendations?.length ?? 0) > 0) return true;
  }
  return false;
}

const REPEATED_PHRASE_MIN_LEN = 25;
// Confirmed live: the prompt's own "never reuse the same sentence
// structure, even with one word swapped" rule (actions.ts, RÉPARTIE) was
// STILL violated on round 2 vs round 3 of a real insult exchange — nearly
// the identical sentence template ("T'as vraiment envie de... pas pour
// perdre mon temps... soit tu te calmes... punching-ball... reste focus
// sur ce qui compte") reused twice in a row, differing only in a couple of
// words. Prompt wording alone has already been tightened multiple times
// without eliminating this — a literal shared-substring check is a
// deterministic backstop for exactly this failure shape, distinct from
// (and complementary to) the recommend-list blocking above.
function normalizeForRepeatCheck(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** True when `text` and `previous` share a run of at least
 *  REPEATED_PHRASE_MIN_LEN normalized characters — a real reused sentence
 *  fragment, not just both replies containing a common short word. */
export function sharesRepeatedPhrase(text: string, previous: string): boolean {
  const a = normalizeForRepeatCheck(text);
  const b = normalizeForRepeatCheck(previous);
  if (a.length < REPEATED_PHRASE_MIN_LEN || b.length < REPEATED_PHRASE_MIN_LEN) return false;
  for (let i = 0; i + REPEATED_PHRASE_MIN_LEN <= a.length; i++) {
    if (b.includes(a.slice(i, i + REPEATED_PHRASE_MIN_LEN))) return true;
  }
  return false;
}

export interface ExplicitTasteRating {
  /** The named work/franchise, without conversational glue such as « aussi ». */
  subject: string;
  stars: number;
  /** « tout X confondu » is a taste signal about a whole universe, not one title. */
  isGlobal: boolean;
}

/**
 * Captures clear user ratings before the LLM replies.  The old marker-only
 * flow could forget « tout South Park confondu, 5 étoiles » if the model
 * reacted conversationally without emitting [[NOTE: ...]].  A global rating
 * is deliberately kept as a preference fact: it must not falsely rate only
 * the last film when the user explicitly includes the series/franchise.
 */
export function extractExplicitTasteRating(message: string): ExplicitTasteRating | null {
  const trimmed = message.trim().replace(/[.!?]+$/, "");
  const match = /^(.*?)\s+(?:c['’]est\s+)?([1-5])\s*(?:\/\s*5|[ée]toiles?)$/i.exec(trimmed);
  if (!match) return null;
  const stars = Number(match[2]);
  let subject = match[1].trim().replace(/\s+(?:aussi|pareil)$/i, "").trim();
  if (!subject || subject.length > BARE_TITLE_MAX_LEN) return null;

  const global = /^(?:tout(?:e)?|tous?|l['’]ensemble(?:\s+de)?)\s+(.+)$/i.exec(subject);
  if (global?.[1]) {
    subject = global[1].replace(/\s+(?:confondu(?:e)?s?|compris(?:e)?s?)$/i, "").trim();
  }
  if (subject.length < 2) return null;
  return { subject, stars, isGlobal: !!global };
}

/** Détecte une mention casuelle de titre (voir doc ci-dessus). Retourne le
 *  message nettoyé (candidat à résoudre contre TMDb) ou null si ça ressemble
 *  plutôt à du bavardage/une phrase construite. Le caller ne doit l'appeler
 *  que si AUCUN des détecteurs plus spécifiques (question) n'a déjà matché,
 *  pour ne jamais dupliquer le travail. */
// Confirmed live: "tu te fout de ma gueule en fait" (a full sentence, not a
// bare title, with an insult word woven in rather than standing alone) is
// too long/varied for CHITCHAT_ONLY_RE's exact-match list to ever cover —
// it slipped through to a real TMDb search and got a "no match found"
// reply. Chasing this by adding yet another word to a list doesn't
// generalize — the NEXT phrasing that isn't on the list breaks the same
// way. The real, generalizable signal isn't "contains an insult word", it's
// "reads as a conjugated French sentence addressed to someone" (subject
// pronoun + conjugated verb) — a title is a name, never a sentence like
// that, whether or not it happens to be insulting. This covers every
// present and future insult phrasing without ever needing another entry
// added, and also catches ordinary chatty remarks CHITCHAT_ONLY_RE's exact-
// match list was never going to enumerate either ("tu es sympa", "ça craint
// grave"). A real title can still contain one of these words in isolation
// ("C'est arrivé près de chez vous") — this only fires on the PAIRING of a
// subject pronoun with a conjugated verb form, not either alone.
const FRENCH_SENTENCE_MARKER_RE = /\b(tu\s+(?:es|es[t]?|as|te|me|m'|t'|fais|dis|crois|sers|vas)|t'es|t'as|j'ai|je\s+(?:suis|te|vous|crois|pense)|on\s+est|vous\s+(?:[êe]tes|me|te))\b/i;

export function extractBareTitleMention(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length < 2 || trimmed.length > BARE_TITLE_MAX_LEN) return null;
  if (trimmed.includes("?")) return null;
  if (CHITCHAT_ONLY_RE.test(trimmed)) return null;
  if (CONTEXTUAL_REFERENCE_RE.test(trimmed)) return null;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 3 && FRENCH_SENTENCE_MARKER_RE.test(trimmed)) return null;
  // Confirmed live: "gros con" (an adjective+insult-noun phrase, no pronoun
  // or conjugated verb) resolved to the real film "Les Gros Cons" — the
  // sentence-marker check above only catches insults phrased as a full
  // sentence, not a short bare phrase like this one. Rather than add yet
  // another specific exclusion pattern (adjective+noun, "espèce de X",
  // "bande de X"...), this generalizes the same way the sentence-marker
  // check does: ANY short message containing a known insult marker
  // (isInsultMessage, already covers single words AND phrases and keeps
  // growing) is essentially never someone naming a film — a user who
  // genuinely wants an obscure title that happens to double as an insult
  // phrase can always follow up more explicitly if misread. Capped at 5
  // words so this never reaches into legitimately long title queries.
  if (wordCount <= 5 && isInsultMessage(trimmed)) return null;
  if (wordCount > BARE_TITLE_MAX_WORDS) return null;
  return trimmed.replace(/[.!]+$/, "").trim();
}
