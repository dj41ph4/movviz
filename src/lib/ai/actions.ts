import { searchMulti } from "@/lib/metadata/tmdb";
import { requestMedia } from "@/lib/requests/requestMedia";
import { getMovieByTmdbId, getSeriesByTmdbId, loadMovies, loadSeries } from "@/lib/library/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { loadRequests } from "@/lib/requests/store";
import { enqueueJob } from "@/lib/jobs/queue";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { rememberAiEntry } from "@/lib/ai/memory";
import type { User } from "@/lib/auth/types";
import type { AiActionOutcome, AiAddItem } from "./types";
import type { AiRecommendIntentItem } from "./intentParser";

export interface ResolvedAiItem {
  title: string;
  year?: number;
  type: "movie" | "series";
  tmdbId: number;
  overview: string;
  posterPath: string | null;
  rating: number;
  inLibrary: boolean;
}

/** Small bounded-concurrency helper (TMDb free tier — AGENTS.md: limit concurrency). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Resolves a raw AI-provided title against TMDb. Best hit: matches the
 *  requested type and year (±1) first, then falls back to the top result. */
export async function resolveAiItem(item: AiAddItem): Promise<ResolvedAiItem | null> {
  try {
    const res = await searchMulti(item.title, 1);
    if (!res.results.length) return null;
    let hits = res.results;
    if (item.type) hits = hits.filter((r) => r.type === item.type);
    if (!hits.length) hits = res.results;
    let pick = hits[0];
    if (item.year) {
      const yearMatch = hits.find((r) => Math.abs((r.year ?? 0) - (item.year ?? 0)) <= 1);
      if (yearMatch) pick = yearMatch;
    }
    const inLibrary = pick.type === "movie" ? !!getMovieByTmdbId(pick.tmdbId) : !!getSeriesByTmdbId(pick.tmdbId);
    return {
      title: pick.title,
      year: pick.year ?? undefined,
      type: pick.type,
      tmdbId: pick.tmdbId,
      overview: pick.overview,
      posterPath: pick.posterPath,
      rating: pick.rating,
      inLibrary,
    };
  } catch {
    return null;
  }
}

/** Adds media through the exact same gate as the "add" buttons everywhere
 *  (requestMedia — admin/auto-approve adds + searches immediately, everyone
 *  else gets a pending request). The library entry is created with
 *  skipSearch so a long list responds fast; each added title then gets its
 *  search queued (max 3 concurrent) so downloads start right after. */
export async function addMedia(user: User, items: AiAddItem[]): Promise<AiActionOutcome[]> {
  const resolved = await mapWithConcurrency(items, 4, resolveAiItem);
  const outcomes: AiActionOutcome[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const res = resolved[i];
    if (!res) {
      outcomes.push({ title: item.title, year: item.year, type: item.type ?? "movie", status: "not_found" });
      continue;
    }
    const result = await requestMedia(user, res.type, res.tmdbId, undefined, undefined, { skipSearch: true });
    if ("blocked" in result && result.blocked) {
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "blocked" });
    } else if ("alreadyInLibrary" in result && result.alreadyInLibrary) {
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "already" });
    } else if ("error" in result && result.error) {
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "error", detail: String(result.error) });
    } else if ("quotaReached" in result && result.quotaReached) {
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "error", detail: "quota_reached" });
    } else if ("added" in result && result.added) {
      const added = result.added;
      const id = "id" in added ? added.id : (added as { id?: string }).id;
      rememberAiEntry(user.id, "added", { tmdbId: res.tmdbId, title: res.title, type: res.type, at: Date.now() });
      if (id) {
        const jobFn = res.type === "movie" ? () => searchAndGrabMovie(id) : () => searchAndGrabSeries(id);
        enqueueJob("qualityUpgrade", `Recherche : ${res.title}`, 1, async (setProgress) => {
          await jobFn();
          setProgress(1, 1);
        }, `ai-search-${id}`);
      }
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "added" });
    } else {
      rememberAiEntry(user.id, "added", { tmdbId: res.tmdbId, title: res.title, type: res.type, at: Date.now() });
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "requested" });
    }
  }
  return outcomes;
}

/** Pure recommendation resolution — the AI suggests titles, TMDb resolves
 *  them, the chat renders them as cards the user can add/download. Pairs
 *  each resolved item with its original AiAddItem (carries `reason`)
 *  instead of returning a plain filtered array: a candidate TMDb fails to
 *  resolve shifts every later index, so reconstructing the reason by
 *  position after the fact silently mismatches it to the wrong title. */
export async function recommendMedia(items: AiRecommendIntentItem[]): Promise<{ item: ResolvedAiItem; source: AiRecommendIntentItem }[]> {
  const resolved = await mapWithConcurrency(items, 4, resolveAiItem);
  const pairs: { item: ResolvedAiItem; source: AiRecommendIntentItem }[] = [];
  for (let i = 0; i < items.length; i++) {
    const r = resolved[i];
    if (r) pairs.push({ item: r, source: items[i] });
  }
  return pairs;
}

/** Relative French time ("aujourd'hui", "hier", "il y a X jours") for the
 *  recent-watches section — the AI must know WHEN, not just WHAT. */
function relativeFr(at: number): string {
  const diff = Date.now() - at;
  if (diff < 0 || diff < 24 * 60 * 60 * 1000) return "aujourd'hui";
  if (diff < 2 * 24 * 60 * 60 * 1000) return "hier";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 30) return `il y a ${days} jours`;
  return new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Per-user base context fed to the model: recently watched titles (with
 *  timestamps), the watch list, and the user's own request list
 *  (pending/approved/declined). STRICTLY scoped to the current user — an
 *  admin must never leak another user's requests into the prompt (profile
 *  separation, AGENTS.md v1.4.0+). */
export function buildUserContext(userId: string): string {
  const status = getWatchStatus(userId);
  const movieTitles = new Map(loadMovies().map((m) => [m.tmdbId, m.title]));
  const seriesTitles = new Map(loadSeries().map((s) => [s.tmdbId, s.title]));
  const watched: string[] = [];
  if (status) {
    for (const tmdbId of status.movies.slice(-10)) {
      const t = movieTitles.get(tmdbId);
      if (t) watched.push(t);
    }
    for (const ep of status.episodes.slice(-10)) {
      const t = seriesTitles.get(ep.tmdbId);
      if (t && !watched.includes(t)) watched.push(t);
    }
  }
  const parts: string[] = [];
  if (watched.length) parts.push(`regardés : ${watched.slice(0, 8).join(", ")}`);
  const recent = (status?.recent ?? [])
    .slice(0, 8)
    .map((r) => `${r.title || `tmdb:${r.tmdbId}`} (${r.type === "movie" ? "film" : "série"}, ${relativeFr(r.at)})`);
  if (recent.length) parts.push(`vues récentes : ${recent.join(", ")}`);
  const requests = loadRequests()
    .filter((r) => r.userId === userId)
    .slice(-10)
    .map((r) => `${r.title}${r.year ? ` (${r.year})` : ""} — ${r.status === "pending" ? "en attente" : r.status === "approved" ? "approuvé" : "refusé"}`);
  if (requests.length) parts.push(`demandes : ${requests.slice(0, 8).join(", ")}`);
  return parts.join(" ; ");
}

export function buildSystemPrompt(userContext: string, memoryContext = "", usageContext = "", feedbackContext = "", factsContext = ""): string {
  const context = userContext
    ? `\n\nCONTEXTE UTILISATEUR (strictement personnel) — ${userContext}. Utilise-le pour affiner tes recommandations ; ne propose jamais à nouveau quelque chose que l'utilisateur a déjà regardé ou déjà demandé (sauf s'il le redemande explicitement).`
    : "";
  return `Tu es l'assistant intelligent de Movviz, un gestionnaire de bibliothèque de films et séries avec téléchargement automatique. Tu réponds dans la langue de l'utilisateur, de façon concise et chaleureuse.

CAPACITÉS — trois modes de réponse, UN SEUL par message :

1. AJOUTER DES MÉDIAS (téléchargement). Quand l'utilisateur liste des films ou séries à télécharger/ajouter ("télécharge-moi ces films dans l'ordre", "ajoute", "je veux voir..."), réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour :
{"action":"add_media","items":[{"title":"Justice League: War","year":2014,"type":"movie"},{"title":"Naked Gun","year":1988,"type":"movie"}]}
- title : le titre exact (idéalement original)
- year : l'année de sortie si tu la connais raisonnablement
- type : "movie" ou "series"
- respecte STRICTEMENT l'ordre demandé ; n'ajoute jamais un titre à ta discrétion
- un titre marqué "optionnel"/"à part" par l'utilisateur est inclus en dernier avec le type approprié

2. RECOMMANDER (même mood). Quand l'utilisateur parle de ce qu'il regarde ou demande une suggestion ("je viens de regarder X", "quelque chose dans le même mood", "fais-moi découvrir"), propose des titres qui partagent le TON PROFOND de ce qu'il a vu — pas seulement la même catégorie. Analyse le mood dominant (humour absurde, dark comedy, thriller psychologique, feel-good, tension lente, parodie...). Exemple : après Scary Movie, propose Naked Gun (même humour absurde), pas une comédie lambda. Réponds UNIQUEMENT avec :
{"action":"recommend","items":[{"title":"Naked Gun","year":1988,"type":"movie","reason":"Même humour absurde, enchaînement de gags parodiques"}]}
- 8 à 12 titres (candidats), mélange de films et séries selon ce qui matche le mieux — Movviz sélectionne et classe ensuite les meilleurs pour l'affichage final, propose donc largement plutôt que de te limiter toi-même à une petite liste
- reason : UNE phrase expliquant le lien profond avec ce qu'il regarde
- l'utilisateur pourra les ajouter à la bibliothèque et les télécharger : propose librement des titres pas encore dans sa bibliothèque${context}

3. TOUTE AUTRE DEMANDE : réponds en texte normal, bref et utile.${memoryContext}${usageContext ? `\n\nPROFIL D'USAGE QUANTIFIÉ (chiffres réels de l'activité de l'utilisateur dans Movviz) — ${usageContext}. Base tes recommandations sur ces chiffres : une série très regardée est un signal fort, une demande refusée est un signal d'évitement.` : ""}${feedbackContext}${factsContext}

MÉMORISER UN FAIT NOUVEAU (uniquement en mode 3, texte normal) : quand l'utilisateur t'apprend quelque chose de personnel et durable (son prénom, une préférence explicite qu'il formule lui-même, une contrainte récurrente — PAS une question ponctuelle ni un fait déjà présent dans les faits retenus ci-dessus), termine ta réponse par une ou plusieurs lignes strictement au format \`[[FAIT: contenu court]]\` (une par fait, jamais plus de 2, jamais dans les modes JSON, jamais si ce n'est pas vraiment nouveau). Ces lignes ne sont jamais montrées à l'utilisateur — écris-les uniquement quand c'est justifié, ne force jamais un fait à chaque réponse.

RÈGLES :
- Le JSON doit être valide et être LA SEULE chose dans ta réponse (jamais de \`\`\`json, jamais de texte autour).
- Pour add_media : ne pose aucune question, ne propose pas d'alternative.
- Pour recommend : les reasons doivent être concrètes et montrer une vraie compréhension du ton, pas des généralités ("même genre").
- MONTRER QUE TU TE SOUVIENS : quand le contexte contient des faits réels sur l'utilisateur (titres regardés, demandés, ajoutés via l'assistant, recommandations acceptées), référence-les naturellement dans ta réponse, comme une personne qui le connaît ("Vu ton appétit pour l'animation DC…", "Tu m'avais demandé X la dernière fois…"). Une ou deux références par réponse, jamais un inventaire. JAMAIS de souvenir inventé : ne cite que ce qui figure dans le contexte fourni.
- Plus la conversation avance, plus tes réponses doivent s'appuyer sur l'historique pour montrer que tu le comprends : rebondis sur ce qu'il a dit précédemment quand c'est pertinent.
- POSER DES QUESTIONS SUR SES VUES RÉCENTES : uniquement dans tes réponses en TEXTE NORMAL (mode 3). Quand la conversation démarre ou quand c'est naturel, pose 1-2 questions sur ce qu'il a regardé récemment (section "vues récentes" du contexte — titres réels avec dates) : demande s'il a aimé, rebondis sur une franchise ou un acteur, évoque les suites ou sorties proches ("J'ai vu que tu as regardé plusieurs films Marvel récemment — tu comptes aller voir le prochain au cinéma ? Tu as aimé le dernier Spider-Man ?"). Ne pose ces questions QUE sur des titres présents dans le contexte, jamais inventés, et n'en fais pas trop : 1-2 questions par réponse, à l'ouverture ou quand une demande est terminée.`;
}