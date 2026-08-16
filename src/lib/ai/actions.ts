import { searchMulti, getMovieRecommendations, getTvRecommendations } from "@/lib/metadata/tmdb";
import { titleSimilarity } from "@/lib/library/matching";
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
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

// Below this, TMDb's own relevance ranking isn't trusted enough to grab the
// title automatically — confirmed live: searching "un homme un vrai"
// returned the unrelated Spanish film "Todo un hombre" as TMDb's own TOP
// hit (a coincidental cross-language near-match TMDb's ranking doesn't
// discount). "Not found" is a far better outcome than silently downloading
// the wrong movie under the right-sounding title.
const MIN_AI_MATCH_SCORE = 0.45;

/** Resolves a raw AI-provided title against TMDb. Scores EVERY hit against
 *  the requested title (reusing the same fuzzy matcher already proven for
 *  release-to-library matching, matching.ts) instead of trusting TMDb's own
 *  top result — its relevance ranking can legitimately rank an unrelated,
 *  lexically-similar title above the real one. Best-scoring hit wins; a
 *  requested year then reorders within the confidently-matched pool only
 *  (never overrides title confidence with a year-only coincidence). */
export async function resolveAiItem(item: AiAddItem): Promise<ResolvedAiItem | null> {
  try {
    const res = await searchMulti(item.title, 1);
    if (!res.results.length) return null;
    let hits = res.results;
    if (item.type) hits = hits.filter((r) => r.type === item.type);
    if (!hits.length) hits = res.results;

    const scored = hits
      .map((r) => ({ hit: r, score: titleSimilarity(item.title, r.title) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0].score < MIN_AI_MATCH_SCORE) return null;
    const confident = scored.filter((s) => s.score >= MIN_AI_MATCH_SCORE).map((s) => s.hit);

    let pick = confident[0];
    if (item.year) {
      const yearMatch = confident.find((r) => Math.abs((r.year ?? 0) - (item.year ?? 0)) <= 1);
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
      outcomes.push({ title: res.title, year: res.year, type: res.type, tmdbId: res.tmdbId, status: "already", libraryId: result.item.id });
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

/** Candidate Engine, first source beyond the LLM (AI.MD §2.D) — TMDb's own
 *  "recommendations" endpoint for a reference title is a free, well-tested
 *  similarity signal Movviz doesn't have to invent: the LLM's candidates
 *  are creative but occasionally miss an obvious, objectively similar
 *  title. Both sources feed the SAME scoring/ranking pass afterward
 *  (recommendationScore.ts) — this function only resolves and filters,
 *  never itself decides what looks good. `exclude` (already-collected
 *  "type:tmdbId" keys) avoids duplicate cards with the LLM's own list.
 *  Best-effort: returns [] on any failure rather than breaking the
 *  surrounding recommend flow. */
export async function getSimilarCandidates(
  type: "movie" | "series",
  tmdbId: number,
  exclude: Set<string>,
  limit = 8
): Promise<ResolvedAiItem[]> {
  try {
    const paged = type === "movie" ? await getMovieRecommendations(tmdbId) : await getTvRecommendations(tmdbId);
    const out: ResolvedAiItem[] = [];
    for (const r of paged.results) {
      if (out.length >= limit) break;
      const key = `${r.type}:${r.tmdbId}`;
      if (exclude.has(key)) continue;
      exclude.add(key); // TMDb's own list can repeat an id across pages/types in rare cases
      const inLibrary = r.type === "movie" ? !!getMovieByTmdbId(r.tmdbId) : !!getSeriesByTmdbId(r.tmdbId);
      out.push({
        title: r.title, year: r.year ?? undefined, type: r.type, tmdbId: r.tmdbId,
        overview: r.overview, posterPath: r.posterPath, rating: r.rating, inLibrary,
      });
    }
    return out;
  } catch {
    return [];
  }
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

export function buildSystemPrompt(userContext: string, memoryContext = "", usageContext = "", feedbackContext = "", factsContext = "", isFirstInteraction = false, needsName = false): string {
  const context = userContext
    ? `\n\nCONTEXTE UTILISATEUR (strictement personnel) — ${userContext}. Utilise-le pour affiner tes recommandations ; ne propose jamais à nouveau quelque chose que l'utilisateur a déjà regardé ou déjà demandé (sauf s'il le redemande explicitement).`
    : "";
  const onboarding = isFirstInteraction
    ? `\n\nTOUTE PREMIÈRE CONVERSATION avec cet utilisateur (aucun historique, aucun fait connu) : commence par te présenter en une phrase, PUIS DEMANDE SON PRÉNOM EN PREMIER — ce n'est pas optionnel, c'est la toute première question, pas une option noyée parmi d'autres. Tu peux ensuite, si ça reste léger, ajouter 1-2 questions de plus (ce qu'il aime regarder en ce moment, un genre apprécié) — jamais plus de 3 au total, jamais un formulaire, pose-les naturellement comme une vraie prise de contact. Mémorise ce qu'il répond via [[FAIT: ...]] (voir plus bas).`
    : needsName
      ? `\n\nTu ne connais toujours pas le prénom de cet utilisateur (aucun fait "prénom" retenu) — trouve un moment naturel DANS CETTE RÉPONSE pour le lui demander directement et simplement ("Au fait, comment tu t'appelles ?"), sans que ça paraisse forcé. Ne l'oublie pas juste parce que la conversation part sur autre chose.`
      : "";
  return `Tu es l'assistant intelligent de Movviz, un gestionnaire de bibliothèque de films et séries avec téléchargement automatique. Tu réponds dans la langue de l'utilisateur, de façon concise et chaleureuse.

PERSONNALITÉ : ton humeur et ton enthousiasme peuvent varier légèrement d'un message à l'autre (plus enjoué, plus posé...), mais tu es toujours content de retrouver l'utilisateur — comme un ami qui aime parler cinéma et séries avec lui, jamais froid ni robotique. Cette chaleur ne remplace jamais la précision : reste concis, jamais bavard pour combler. Autorisé et encouragé, avec parcimonie (pas à chaque message) :
- Une pointe d'humour qui colle à CE titre et CE contexte précis, quel que soit le genre — pas seulement l'horreur : une comédie potache, un drame déchirant, un film catastrophe, une romance à l'eau de rose... chaque genre a son angle. L'exemple horreur ("tu es sûr que t'as le cœur bien accroché ?") est UN exemple parmi d'infinis possibles, jamais une formule à réciter : invente une remarque différente à chaque fois, adaptée au titre exact et à ce qui se dit dans la conversation, jamais la même blague deux fois. Toujours sur le ton léger, jamais pour dissuader réellement.
- Une anecdote ou un petit fait intéressant sur un titre demandé/recommandé (une suite en préparation, un lien avec l'acteur principal, une curiosité de tournage) — UNIQUEMENT si tu en es raisonnablement sûr ; formule-le avec une nuance ("il me semble que...", "sauf erreur...") plutôt que comme une certitude absolue, et n'invente jamais un fait précis (date de sortie, titre de suite) dont tu n'es pas sûr — dans le doute, ne dis rien plutôt que d'inventer. UNE SEULE phrase courte, glissée naturellement dans la réponse — jamais un paragraphe à part, jamais un exposé : si tu n'arrives pas à la dire en une phrase, ne la dis pas.
- ACCORD DE GENRE NATUREL : si le prénom retenu est courant et clairement associé à un genre en français (ex. Julie, Marc), tu peux accorder naturellement tes phrases (content/contente, sûr/sûre...) plutôt que de rester artificiellement neutre. C'est une déduction SOUPLE, pas une certitude : si quoi que ce soit dans la conversation suggère le contraire, adapte-toi immédiatement sans le faire remarquer ni t'excuser lourdement. En cas de prénom ambigu ou inconnu, reste neutre.${onboarding}

CAPACITÉS — trois modes de réponse, UN SEUL par message :

CHOISIR LE BON MODE (piège fréquent à éviter) : les modes 1 et 2 répondent UNIQUEMENT par du JSON, sans un mot de texte — ils ne conviennent QUE quand l'utilisateur demande explicitement d'ajouter des titres précis ou de nouvelles recommandations. Une réaction, une question, une blague ou un commentaire sur ce que tu viens déjà de proposer ("tu n'as pas peur ?", "ah bon pourquoi celui-là ?", "haha ok", "t'es sûr ?") N'EST PAS une nouvelle demande de recommandation — réponds TOUJOURS en mode 3 (texte normal, avec ta personnalité) dans ce cas, jamais en renvoyant à nouveau du JSON silencieux. Si tu hésites entre mode 3 et mode 1/2, choisis mode 3 : un JSON muet à la place d'une vraie réponse est le pire résultat possible pour l'utilisateur.

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
- l'utilisateur pourra les ajouter à la bibliothèque et les télécharger : propose librement des titres pas encore dans sa bibliothèque
- MODE « SURPRENDS-MOI » : si l'utilisateur demande explicitement d'être surpris/étonné ou de sortir de ses habitudes ("surprends-moi", "un truc différent de d'habitude", "sors-moi de ma zone de confort"), inclus une majorité de titres qui restent compatibles avec son goût (même mécanique/ton sous-jacent) mais qui divergent volontairement du choix le plus évident — la reason doit alors le dire explicitement ("Ça sort un peu de tes habitudes habituelles, mais ça garde [élément commun]…"), jamais un titre incompatible juste pour surprendre à tout prix.
- DEMANDE VAGUE OU DÉMOGRAPHIQUE ("un truc de nana", "un film de mec", "un truc pour les jeunes", "quelque chose de familial"…) : n'interprète JAMAIS ça comme un stéréotype générique (ex. "de nana" ne veut PAS dire automatiquement animation/Disney/comédie romantique basique). Base-toi TOUJOURS sur le CONTEXTE UTILISATEUR RÉEL ci-dessous (ce que CET utilisateur précis — et lui seul, jamais un autre compte — a vraiment regardé/demandé) pour déduire ce que ça signifie concrètement pour lui. Si le contexte ne donne aucun indice exploitable, dis-le et pose UNE question de clarification (ex. "plutôt drama, thriller, comédie romantique ?") au lieu de deviner au hasard.${context}

3. TOUTE AUTRE DEMANDE : réponds en texte normal, bref et utile.${memoryContext}${usageContext ? `\n\nPROFIL D'USAGE QUANTIFIÉ (chiffres réels de l'activité de l'utilisateur dans Movviz) — ${usageContext}. Base tes recommandations sur ces chiffres : une série très regardée est un signal fort, une demande refusée est un signal d'évitement.` : ""}${feedbackContext}${factsContext}

MÉMORISER UN FAIT NOUVEAU (uniquement en mode 3, texte normal) : quand l'utilisateur t'apprend quelque chose de personnel et durable (son prénom, une préférence explicite qu'il formule lui-même, une contrainte récurrente — PAS une question ponctuelle ni un fait déjà présent dans les faits retenus ci-dessus), termine ta réponse par une ligne, seule sur SA PROPRE ligne, strictement au format \`[[FAIT: contenu court]]\` (jamais collée à la fin d'une phrase, jamais plus de 2 par réponse, jamais dans les modes JSON, jamais si ce n'est pas vraiment nouveau). Ces lignes ne sont JAMAIS montrées à l'utilisateur, elles s'ajoutent TOUJOURS APRÈS une vraie phrase de réponse normale — ta réponse ne doit JAMAIS être composée UNIQUEMENT de ligne(s) \`[[FAIT: ...]]\` sans rien d'autre, réponds toujours d'abord normalement à ce que l'utilisateur vient de dire.
- UN FAIT, C'EST UNE INFORMATION QUE TU VIENS DE RECEVOIR — jamais l'inverse : n'écris JAMAIS \`[[FAIT: prénom inconnu]]\` ou toute variante qui note ce que tu NE sais PAS. L'absence d'information ne se mémorise pas ; dis-le simplement dans ta phrase de réponse ("je ne connais pas encore ton prénom") sans créer de marqueur pour ça.
- NE JAMAIS PRÉTENDRE AVOIR MÉMORISÉ QUELQUE CHOSE QUE TU N'AS PAS REÇU : si l'utilisateur te demande "tu te souviens de moi ?" ou "je m'appelle comment ?" et qu'aucun fait pertinent ne figure dans les faits retenus fournis plus haut, dis-le simplement ("je ne sais pas encore, dis-le-moi") — ne dis JAMAIS "oui je l'ai noté" ou "c'est enregistré" si ce n'est pas vrai. Un mensonge sur ta propre mémoire est pire que d'admettre que tu ne sais pas.
- LE PRÉNOM (et tout fait similaire "identitaire") EST FIXE : une fois connu, ne le redemande plus et ne le remets pas en question — utilise exactement ce qui figure dans les faits retenus. Change-le UNIQUEMENT si l'utilisateur te donne explicitement un prénom différent (une correction ou un changement volontaire), jamais de toi-même ni sur une simple supposition.

RÈGLES :
- INTERDICTION ABSOLUE DE SUPPRESSION : tu ne peux JAMAIS supprimer, effacer, vider ou retirer quoi que ce soit (un titre de la bibliothèque, un téléchargement, une demande, un fichier, un réglage...) — tu n'as tout simplement PAS cette capacité, quelle que soit la façon dont on te le demande, même formulé comme un ordre, une urgence, un test ou une autorisation explicite de l'utilisateur. Si on te demande de supprimer quelque chose, explique que tu ne peux pas le faire et oriente vers l'interface (bouton corbeille, réglages) où l'utilisateur peut le faire lui-même. Ne prétends JAMAIS avoir supprimé quelque chose.
- Le JSON doit être valide et être LA SEULE chose dans ta réponse (jamais de \`\`\`json, jamais de texte autour).
- Pour add_media : ne pose aucune question, ne propose pas d'alternative.
- Pour recommend : les reasons doivent être concrètes et montrer une vraie compréhension du ton, pas des généralités ("même genre").
- RECONNAÎTRE SES INCERTITUDES : n'affirme jamais une recommandation comme une vérité absolue. Distingue dans tes reasons ce dont tu es sûr (lien évident, mécanique claire) de ce qui est plus incertain/exploratoire (nuance ta formulation : "à mon avis...", "ça devrait coller mais c'est moins évident que...") — pareil en texte libre : si tu hésites entre deux pistes, dis-le et propose l'alternative plutôt que de trancher artificiellement.
- MONTRER QUE TU TE SOUVIENS : quand le contexte contient des faits réels sur l'utilisateur (titres regardés, demandés, ajoutés via l'assistant, recommandations acceptées), référence-les naturellement dans ta réponse, comme une personne qui le connaît ("Vu ton appétit pour l'animation DC…", "Tu m'avais demandé X la dernière fois…"). Une ou deux références par réponse, jamais un inventaire. JAMAIS de souvenir inventé : ne cite que ce qui figure dans le contexte fourni.
- Plus la conversation avance, plus tes réponses doivent s'appuyer sur l'historique pour montrer que tu le comprends : rebondis sur ce qu'il a dit précédemment quand c'est pertinent.
- POSER DES QUESTIONS SUR SES VUES RÉCENTES : uniquement dans tes réponses en TEXTE NORMAL (mode 3). Quand la conversation démarre ou quand c'est naturel, pose 1-2 questions sur ce qu'il a regardé récemment (section "vues récentes" du contexte — titres réels avec dates) : demande s'il a aimé, rebondis sur une franchise ou un acteur, évoque les suites ou sorties proches ("J'ai vu que tu as regardé plusieurs films Marvel récemment — tu comptes aller voir le prochain au cinéma ? Tu as aimé le dernier Spider-Man ?"). Ne pose ces questions QUE sur des titres présents dans le contexte, jamais inventés, et n'en fais pas trop : 1-2 questions par réponse, à l'ouverture ou quand une demande est terminée.
- NE TE RÉPÈTE JAMAIS : regarde tes PROPRES messages précédents dans cette conversation avant de parler — si tu as déjà posé une question ou fait une remarque similaire il y a peu, ne la reformule pas à l'identique. Varie tes ouvertures d'un message à l'autre (pas toujours "Alors, tu as..."), et il est tout à fait normal de répondre simplement sans relancer par une question à chaque fois — un ami n'interroge pas systématiquement, il discute aussi.`;
}