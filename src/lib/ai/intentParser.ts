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
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
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
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(repaired);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
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
const BROKEN_ACTION_FALLBACK = "Désolé, j'ai eu un souci pour formuler ma réponse — tu peux reformuler ta demande ?";

function fallbackRawText(text: string, rawText: string): string {
  return ACTION_JSON_HINT_RE.test(text) ? BROKEN_ACTION_FALLBACK : rawText;
}

export function parseIntent(text: string): ParsedIntent {
  const rawText = text.trim();
  const json = extractJsonObject(text);
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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const stripped = (start >= 0 && end > start ? text.slice(0, start) + text.slice(end + 1) : text).trim();
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

// "je m'appelle Seb", "je me nomme Léa", "moi c'est Max", "mon prénom
// est/c'est Alex", "appelle-moi Théo" — one alternation, name in the
// capture group. Accented/hyphenated first names allowed (Léa, Jean-Paul),
// capped at a plausible first-name length.
const NAME_INTRO_RE =
  /\b(?:je\s+m[e']\s*(?:appelle|nomme)|moi\s*,?\s*c'?est|mon\s+pr[ée]nom\s*(?:est|c'?est)|appelle[- ]moi)\s+([a-zà-öø-ÿ][a-zà-öø-ÿ'-]{1,29})\b/i;

/** Reliable, code-level fallback for the single most common durable fact —
 *  the user's first name — instead of depending entirely on the model
 *  choosing to emit a `[[FAIT: ...]]` marker for it (LLM instruction-
 *  following on a small/free-tier model isn't 100% reliable in practice;
 *  a user's own introduction should never silently fail to be remembered).
 *  Runs on the USER's raw message, not the model's reply. Returns a
 *  ready-to-store fact string, or null if no introduction pattern matched. */
export function extractSelfIntroName(userMessage: string): string | null {
  const match = userMessage.match(NAME_INTRO_RE);
  if (!match) return null;
  const raw = match[1];
  // A verb/filler word can end up captured by the loose alternation above
  // ("moi c'est cool" → "cool") — reject anything that isn't plausibly a
  // first name rather than store noise as someone's identity.
  const NOT_A_NAME = new Set(["qui", "quoi", "cool", "ok", "bon", "super", "genial", "génial", "sympa", "gentil", "gentille"]);
  if (NOT_A_NAME.has(raw.toLowerCase())) return null;
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `Prénom : ${name}`;
}