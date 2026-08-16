import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { searchTitleScene } from "@/lib/ai/providers";
import { extractJsonObject } from "@/lib/ai/intentParser";
import type { AiConfig } from "./types";

/**
 * "Scène mémorable" — web-grounded candidate scenes for a title, found via
 * Mistral's web_search connector (providers.ts searchTitleScene), cached
 * GLOBALLY per title (a fact about the title, not about any one user — same
 * reasoning as the Mood Engine's ai-title-analysis.json) so the same title
 * is only ever searched ONCE, no matter how many users/conversations later
 * reference it. The actual conversational use (whether/how to mention a
 * scene) is entirely the chat prompt's job (actions.ts "SCÈNE MÉMORABLE"
 * rule) — this file only owns "have we looked this title up, and what did
 * we find", nothing about tone or timing.
 *
 * Two searches instead of one (demande explicite user — "découverte
 * autonome", pas juste la scène la plus célèbre) : un angle "largement
 * connu" et un angle "spécifique/communautaire, même sans grande couverture
 * médiatique" (l'exemple donné — Dwight et la dinde dans Scary Movie 2 —
 * n'apparaîtrait jamais sur le premier angle seul). Toujours UNE SEULE fois
 * par titre, jamais par conversation — le coût reste borné.
 */
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "ai-scene-cache.json");
const MAX_SCENES = 4;
const MAX_SCENE_TEXT_LEN = 220;

interface AiSceneCandidate {
  text: string;
  /** Composite conversational score (0..~5) — see scoreScene() below.
   *  Self-reported sub-scores from the model, same trust posture as the
   *  Mood Engine's trait weights: clamped, never taken as ground truth. */
  score: number;
}

interface AiSceneCacheEntry {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  scenes: AiSceneCandidate[];
  /** Pre-formatted for prompt injection (numbered, one per line) — built
   *  once at cache time so chat/route.ts doesn't reformat on every message. */
  findings: string;
  searchedAt: number;
}

type AiSceneCacheStore = Record<string, AiSceneCacheEntry>;

function read(): AiSceneCacheStore {
  const raw = readJsonCached<AiSceneCacheStore | null>(FILE, null);
  return raw && typeof raw === "object" ? raw : {};
}

function cacheKey(type: "movie" | "series", tmdbId: number): string {
  return `${type}:${tmdbId}`;
}

export function getCachedScene(type: "movie" | "series", tmdbId: number): AiSceneCacheEntry | null {
  return read()[cacheKey(type, tmdbId)] ?? null;
}

const SCENE_JSON_INSTRUCTION = `Réponds UNIQUEMENT avec un objet JSON de la forme {"scenes":[{"text":"...","specificity":0.8,"humor":0.6,"emotion":0.2,"wtf":0.4,"communityBuzz":0.7}]}, sans texte autour, sans balise de code. Si tu ne trouves vraiment rien de fiable, réponds {"scenes":[]}.
Pour chaque scène : "text" = une seule phrase très concrète et immédiatement reconnaissable (personnage + action + objet/situation si possible), SANS raconter comment elle se termine, en français. Les autres champs sont TON estimation entre 0 et 1 : specificity (à quel point c'est un détail précis et pas une généralité), humor, emotion, wtf (potentiel absurde/choc), communityBuzz (à quel point les spectateurs en parlent/la citent, même dans des discussions communautaires plutôt que des listes officielles "meilleures scènes").`;

const BROAD_PROMPT = (title: string, type: "movie" | "series") =>
  `Tu as accès à une recherche web. Trouve 2 à 3 scènes ${type === "movie" ? "du film" : "de la série"} « ${title} » largement considérées comme cultes ou emblématiques par la critique et le grand public.\n\n${SCENE_JSON_INSTRUCTION}`;

const NICHE_PROMPT = (title: string, type: "movie" | "series") =>
  `Tu as accès à une recherche web. Cherche maintenant, pour ${type === "movie" ? "le film" : "la série"} « ${title} », des scènes ou moments PLUS SPÉCIFIQUES et moins évidents que les scènes "cultes" habituelles — un personnage secondaire, un objet insolite, une réplique ou une situation absurde que les spectateurs mentionnent souvent entre eux (forums, discussions, listes de moments sous-estimés) même si ce n'est pas dans les classements officiels. L'objectif est un détail que quelqu'un qui a vu l'œuvre reconnaîtra immédiatement rien qu'en le lisant.\n\n${SCENE_JSON_INSTRUCTION}`;

function scoreScene(raw: Record<string, unknown>): AiSceneCandidate | null {
  const text = typeof raw.text === "string" ? raw.text.trim().slice(0, MAX_SCENE_TEXT_LEN) : "";
  if (!text) return null;
  const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const specificity = clamp(raw.specificity);
  const humor = clamp(raw.humor);
  const emotion = clamp(raw.emotion);
  const wtf = clamp(raw.wtf);
  const communityBuzz = clamp(raw.communityBuzz);
  // Composite score (demande explicite user — "algorithme de sélection") :
  // spécificité et buzz communautaire pèsent le plus (c'est ce qui distingue
  // "la scène la plus célèbre" de "la scène qu'on a envie de nommer"),
  // humour/émotion/wtf ajoutent du relief sans dominer.
  const score = specificity * 1.4 + communityBuzz * 1.3 + humor * 0.8 + emotion * 0.7 + wtf * 0.8;
  return { text, score };
}

function parseScenes(text: string): AiSceneCandidate[] {
  const json = extractJsonObject(text);
  const list = (json as { scenes?: unknown[] })?.scenes;
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => (raw && typeof raw === "object" ? scoreScene(raw as Record<string, unknown>) : null))
    .filter((s): s is AiSceneCandidate => !!s);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9à-öø-ÿ]+/g, " ").trim();
}

/** Calls the web search TWICE for this title (broad + niche angle) and
 *  caches the merged, scored, deduped result — never called directly by
 *  the chat route, always through getOrFetchScene's cache-first check
 *  (same "analyse différée" discipline as the Mood Engine). */
async function fetchAndCacheScene(config: AiConfig, type: "movie" | "series", tmdbId: number, title: string): Promise<AiSceneCacheEntry | null> {
  const [broadText, nicheText] = await Promise.all([
    searchTitleScene(config, BROAD_PROMPT(title, type)),
    searchTitleScene(config, NICHE_PROMPT(title, type)),
  ]);
  const candidates = [...(broadText ? parseScenes(broadText) : []), ...(nicheText ? parseScenes(nicheText) : [])];
  if (candidates.length === 0) return null;

  const deduped: AiSceneCandidate[] = [];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    if (deduped.some((d) => normalize(d.text) === normalize(c.text))) continue;
    deduped.push(c);
    if (deduped.length >= MAX_SCENES) break;
  }

  const findings = deduped.map((s, i) => `${i + 1}. ${s.text}`).join("\n");
  const entry: AiSceneCacheEntry = { tmdbId, type, title, scenes: deduped, findings, searchedAt: Date.now() };
  const store = read();
  store[cacheKey(type, tmdbId)] = entry;
  writeJsonCached(FILE, store);
  return entry;
}

/** Cache-first lookup — only ever calls the web search the first time a
 *  given title is looked up. */
export async function getOrFetchScene(config: AiConfig, type: "movie" | "series", tmdbId: number, title: string): Promise<AiSceneCacheEntry | null> {
  const cached = getCachedScene(type, tmdbId);
  if (cached) return cached;
  if (!config.webSearchEnabled) return null;
  return fetchAndCacheScene(config, type, tmdbId, title);
}
