import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { callAi } from "@/lib/ai/providers";
import { extractJsonObject } from "@/lib/ai/intentParser";
import type { AiConfig, AiMoodCategories, AiMoodProfile, AiTitleAnalysisStore } from "./types";

/**
 * Mood Engine, first pass (AI.MD §2.B/C/P) — "analyse différée + cache":
 * a title's mood profile is computed by the LLM ONCE, the first time it's
 * needed as a recommendation candidate or reference, then persisted to
 * ai-title-analysis.json (GLOBAL, keyed by title — never per-user) and
 * reused forever after. This is the only place in the AI feature that
 * calls the model outside of a direct chat reply, and it only ever runs
 * as part of a recommend request the user actually made — never a
 * background job (AI.MD's closing instruction).
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-title-analysis.json");

const MAX_CATEGORIES = 5;
const MAX_TRAITS_PER_CATEGORY = 6;
const MAX_KEY_LEN = 40;

function read(): AiTitleAnalysisStore {
  const raw = readJsonCached<AiTitleAnalysisStore | null>(FILE, null);
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function write(store: AiTitleAnalysisStore): void {
  writeJsonCached(FILE, store);
}

function cacheKey(type: "movie" | "series", tmdbId: number): string {
  return `${type}:${tmdbId}`;
}

export function getCachedMoodProfile(type: "movie" | "series", tmdbId: number): AiMoodProfile | null {
  return read()[cacheKey(type, tmdbId)] ?? null;
}

function sanitizeKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().slice(0, MAX_KEY_LEN);
  return key || null;
}

/** Validates the model's raw JSON into a bounded AiMoodCategories — never
 *  trusts category/trait names, counts or value ranges from the model. */
function validateCategories(raw: unknown): AiMoodCategories | null {
  if (!raw || typeof raw !== "object") return null;
  const categories: AiMoodCategories = {};
  let catCount = 0;
  for (const [rawCat, rawTraits] of Object.entries(raw as Record<string, unknown>)) {
    if (catCount >= MAX_CATEGORIES) break;
    const cat = sanitizeKey(rawCat);
    if (!cat || !rawTraits || typeof rawTraits !== "object") continue;
    const traits: Record<string, number> = {};
    let traitCount = 0;
    for (const [rawTrait, rawValue] of Object.entries(rawTraits as Record<string, unknown>)) {
      if (traitCount >= MAX_TRAITS_PER_CATEGORY) break;
      const trait = sanitizeKey(rawTrait);
      const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.max(0, Math.min(1, rawValue)) : null;
      if (!trait || value === null) continue;
      traits[trait] = value;
      traitCount++;
    }
    if (traitCount === 0) continue;
    categories[cat] = traits;
    catCount++;
  }
  return catCount > 0 ? categories : null;
}

const ANALYSIS_SYSTEM_PROMPT = `Tu analyses le "mood" d'un film ou d'une série pour un moteur de recommandation. Réponds UNIQUEMENT avec un objet JSON de la forme {"categories":{"nom_categorie":{"trait":0.8}}} — aucun texte autour, aucune balise de code.

RÈGLES :
- Choisis 3 à 5 catégories PERTINENTES pour CE titre précis (ex. humour/énergie/tonalité pour une comédie, tension/violence/ambiguïté morale pour un thriller — jamais les mêmes catégories imposées à tout) — le modèle n'est PAS figé à une liste fixe.
- 3 à 6 traits par catégorie, valeurs entre 0 et 1, deux décimales.
- Sois précis et différenciant : le but est de distinguer ce titre d'un autre du même genre TMDb, pas de décrire le genre lui-même. Exemple pour Scary Movie : humour: {absurde:0.94, parodie:0.99, humour_visuel:0.86, degre_wtf:0.95}, energie: {rapide:0.89, chaotique:0.91}, tonalite: {leger:0.92, seriosite:0.08}.`;

/** Calls the model once for this title, validates the response, caches it,
 *  and returns it. Returns null on ANY failure (no key, quota, malformed
 *  JSON) — the caller degrades gracefully (mood term simply omitted from
 *  scoring), this must never break the surrounding recommend flow. */
export async function analyzeMoodProfile(
  config: AiConfig,
  type: "movie" | "series",
  tmdbId: number,
  title: string,
  overview: string,
  genres?: string[]
): Promise<AiMoodProfile | null> {
  if (!config.enabled) return null;
  try {
    const userMsg = `Titre : ${title}\nSynopsis : ${overview || "(non disponible)"}${genres?.length ? `\nGenres : ${genres.join(", ")}` : ""}`;
    const { text } = await callAi(config, ANALYSIS_SYSTEM_PROMPT, [{ role: "user", content: userMsg }]);
    const json = extractJsonObject(text);
    if (!json || typeof json !== "object") return null;
    const categories = validateCategories((json as Record<string, unknown>).categories);
    if (!categories) return null;
    const profile: AiMoodProfile = { tmdbId, type, title, categories, analyzedAt: Date.now() };
    const store = read();
    store[cacheKey(type, tmdbId)] = profile;
    write(store);
    return profile;
  } catch {
    return null;
  }
}

/** Cache-first lookup — the "analyse différée" half of §2.P: only calls the
 *  model when this exact title has never been analyzed before. */
export async function getOrAnalyzeMoodProfile(
  config: AiConfig,
  type: "movie" | "series",
  tmdbId: number,
  title: string,
  overview: string,
  genres?: string[]
): Promise<AiMoodProfile | null> {
  const cached = getCachedMoodProfile(type, tmdbId);
  if (cached) return cached;
  return analyzeMoodProfile(config, type, tmdbId, title, overview, genres);
}

/** Plain average absolute-difference similarity over the categories/traits
 *  BOTH profiles share (0..1, higher = closer mood). Traits present in only
 *  one profile are ignored rather than penalized — the two titles simply
 *  weren't analyzed along that exact axis, that's not evidence of a mood
 *  mismatch. No embeddings/vector math, just a plain inspectable average
 *  (AI.MD: pragmatic, no ML machinery). */
export function moodSimilarity(a: AiMoodCategories, b: AiMoodCategories): number {
  let sum = 0;
  let n = 0;
  for (const [cat, traits] of Object.entries(a)) {
    const bTraits = b[cat];
    if (!bTraits) continue;
    for (const [trait, value] of Object.entries(traits)) {
      const bValue = bTraits[trait];
      if (bValue === undefined) continue;
      sum += 1 - Math.abs(value - bValue);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}
