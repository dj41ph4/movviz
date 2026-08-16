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
 *  object, validate it, and ignore the rest. */
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
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

export function parseIntent(text: string): ParsedIntent {
  const rawText = text.trim();
  const json = extractJsonObject(text);
  if (!json || typeof json !== "object") return { action: null, items: [], rawText };

  const obj = json as Record<string, unknown>;
  const action = obj.action;
  if (action !== "add_media" && action !== "recommend") return { action: null, items: [], rawText };

  if (!Array.isArray(obj.items)) return { action: null, items: [], rawText };
  const items: AiRecommendIntentItem[] = [];
  for (const raw of obj.items) {
    if (items.length >= MAX_ITEMS) break;
    const item = validItem(raw);
    if (item) items.push(item);
  }
  if (!items.length) return { action: null, items: [], rawText };

  // Strip the JSON block from the reply so rawText keeps only the prose.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const stripped = (start >= 0 && end > start ? text.slice(0, start) + text.slice(end + 1) : text).trim();
  return { action, items, rawText: stripped };
}