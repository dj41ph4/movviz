from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


# Context DB v2: structured, per-user explicit preferences.
p = "src/lib/userContext/database.ts"
text = read(p)
text = replace_once(text, "export const USER_CONTEXT_SCHEMA_VERSION = 1;", "export const USER_CONTEXT_SCHEMA_VERSION = 2;", "schema version")
marker = "    CREATE TABLE IF NOT EXISTS context_sync_state ("
pref_schema = '''    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      pref_key TEXT NOT NULL,
      label TEXT NOT NULL,
      affinity REAL NOT NULL,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      tmdb_id INTEGER,
      media_type TEXT,
      evidence_count INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id, dimension, pref_key)
    );

    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_updated
      ON user_preferences(user_id, updated_at DESC);

'''
if "CREATE TABLE IF NOT EXISTS user_preferences" not in text:
    text = replace_once(text, marker, pref_schema + marker, "preference schema insertion")
write(p, text)

preferences_ts = r'''import { withUserContextDb } from "./database";

export type UserPreferenceSource = "explicit" | "correction" | "rating" | "feedback" | "inferred";

export interface UserPreference {
  userId: string;
  dimension: "title" | "genre" | "mood" | "franchise" | "language" | "duration" | "other";
  key: string;
  label: string;
  affinity: number;
  confidence: number;
  source: UserPreferenceSource;
  tmdbId?: number | null;
  mediaType?: "movie" | "series" | null;
  evidenceCount: number;
  updatedAt: number;
}

function clampAffinity(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function upsertExplicitTitlePreference(input: {
  userId: string;
  tmdbId: number;
  mediaType: "movie" | "series";
  title: string;
  affinity: number;
  source: "explicit" | "correction";
}): boolean {
  const key = `${input.mediaType}:${input.tmdbId}`;
  const now = Date.now();
  return withUserContextDb((db) => {
    db.prepare(`
      INSERT INTO user_preferences(
        user_id, dimension, pref_key, label, affinity, confidence, source,
        tmdb_id, media_type, evidence_count, updated_at
      ) VALUES(?, 'title', ?, ?, ?, 1, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, dimension, pref_key) DO UPDATE SET
        label = excluded.label,
        affinity = excluded.affinity,
        confidence = 1,
        source = excluded.source,
        tmdb_id = excluded.tmdb_id,
        media_type = excluded.media_type,
        evidence_count = user_preferences.evidence_count + 1,
        updated_at = excluded.updated_at
    `).run(
      input.userId,
      key,
      input.title,
      clampAffinity(input.affinity),
      input.source,
      input.tmdbId,
      input.mediaType,
      now,
    );
    return true;
  }, false);
}

export function getExplicitTitlePreferences(userId: string, limit = 100): UserPreference[] {
  const max = Math.max(1, Math.min(500, Math.round(limit || 1)));
  return withUserContextDb((db) => {
    const rows = db.prepare(`
      SELECT user_id, dimension, pref_key, label, affinity, confidence, source,
             tmdb_id, media_type, evidence_count, updated_at
      FROM user_preferences
      WHERE user_id = ? AND dimension = 'title'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, max) as Record<string, unknown>[];
    return rows.map((row) => ({
      userId: String(row.user_id),
      dimension: "title" as const,
      key: String(row.pref_key),
      label: String(row.label),
      affinity: clampAffinity(Number(row.affinity)),
      confidence: clampConfidence(Number(row.confidence)),
      source: (row.source === "correction" ? "correction" : "explicit") as UserPreferenceSource,
      tmdbId: typeof row.tmdb_id === "number" ? row.tmdb_id : row.tmdb_id == null ? null : Number(row.tmdb_id),
      mediaType: row.media_type === "movie" || row.media_type === "series" ? row.media_type : null,
      evidenceCount: Math.max(1, Number(row.evidence_count) || 1),
      updatedAt: Number(row.updated_at) || 0,
    }));
  }, []);
}

export function getExplicitTitlePreference(userId: string, tmdbId: number, mediaType: "movie" | "series"): UserPreference | null {
  return getExplicitTitlePreferences(userId, 500).find((pref) => pref.key === `${mediaType}:${tmdbId}`) ?? null;
}

export function getLatestExplicitPreference(userId: string): UserPreference | null {
  return getExplicitTitlePreferences(userId, 1)[0] ?? null;
}

export function formatExplicitPreferencesContext(userId: string, limit = 12): string {
  const prefs = getExplicitTitlePreferences(userId, limit);
  if (!prefs.length) return "";
  return prefs.map((pref) => {
    const stance = pref.affinity >= 0.6 ? "aime explicitement" : pref.affinity <= -0.6 ? "n'aime explicitement pas" : "avis explicite mitigé sur";
    const correction = pref.source === "correction" ? " — correction utilisateur, PRIORITAIRE" : "";
    return `${stance} « ${pref.label} » [confiance ${Math.round(pref.confidence * 100)}%, preuves ${pref.evidenceCount}${correction}]`;
  }).join(" ; ");
}
'''
write("src/lib/userContext/preferences.ts", preferences_ts)

# Explicit preference facts replace their own previous value.
p = "src/lib/ai/tasteProfile.ts"
text = read(p)
marker = "export function getFacts(userId: string): AiFactEntry[] {\n  return profileForUser(read(), userId).facts;\n}\n"
addition = marker + r'''

/** Latest explicit statement about one named preference wins over an older
 * explicit statement about the same subject. This is deliberately narrower
 * than generic rememberFact(): corrections must replace, not accumulate as
 * contradictory facts. */
export function rememberExplicitPreferenceFact(userId: string, subject: string, positive: boolean): void {
  const cleanSubject = subject.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!cleanSubject) return;
  const store = read();
  const profile = profileForUser(store, userId);
  const signature = cleanSubject.toLocaleLowerCase("fr");
  const prefixRe = /^Préférence explicite — (.+?) : /i;
  const filtered = profile.facts.filter((entry) => {
    const match = entry.fact.match(prefixRe);
    return !match || match[1].trim().toLocaleLowerCase("fr") !== signature;
  });
  filtered.push({
    fact: `Préférence explicite — ${cleanSubject} : ${positive ? "aime fortement ce titre" : "n'aime pas ce titre"}.`,
    at: Date.now(),
  });
  store[userId] = { ...profile, facts: filtered.slice(-MAX_FACT_ENTRIES) };
  write(store);
}
'''
text = replace_once(text, marker, addition, "explicit fact helper")
write(p, text)

# Deterministic explicit preference capture, before the generic LLM cooldown.
p = "src/lib/ai/factExtractor.ts"
text = read(p)
text = replace_once(
    text,
    'import { rememberFact } from "./tasteProfile";',
    'import { rememberFact, rememberExplicitPreferenceFact } from "./tasteProfile";\nimport { resolveAiItem } from "./actions";\nimport { upsertExplicitTitlePreference } from "@/lib/userContext/preferences";',
    "fact extractor imports",
)
marker = "const FACTS_SYSTEM_PROMPT = `"
helper = r'''interface ExplicitTitlePreferenceStatement {
  subject: string;
  positive: boolean;
  correction: boolean;
}

const CORRECTION_HINT_RE = /\b(?:tu te trompes?|c['’]?est faux|non[, ]+tu|pas du tout|au contraire)\b/i;
const POSITIVE_TITLE_PREF_RE = /\b(?:j['’]?adore|j['’]?aime(?: vraiment| beaucoup| bien)?|je kiffe)\s+[«\"“]?([^\n.!?]{2,120})[»\"”]?/i;
const NEGATIVE_TITLE_PREF_RE = /\b(?:je d[ée]teste|je n['’]?aime pas|j['’]?aime pas|je ne supporte pas|je supporte pas)\s+[«\"“]?([^\n.!?]{2,120})[»\"”]?/i;
const GENERIC_PREFERENCE_SUBJECT_RE = /^(?:ça|ca|ce film|cette série|cette serie|celui[- ]là|celle[- ]là|les films|les séries|les series)$/i;

export function parseExplicitTitlePreferenceStatement(message: string): ExplicitTitlePreferenceStatement | null {
  const negative = message.match(NEGATIVE_TITLE_PREF_RE);
  const positive = negative ? null : message.match(POSITIVE_TITLE_PREF_RE);
  const match = negative ?? positive;
  if (!match) return null;
  const subject = match[1].trim().replace(/[,:;]+$/, "").trim();
  if (!subject || GENERIC_PREFERENCE_SUBJECT_RE.test(subject)) return null;
  return { subject, positive: !negative, correction: CORRECTION_HINT_RE.test(message) };
}

async function persistExplicitTitlePreference(userId: string, statement: ExplicitTitlePreferenceStatement): Promise<void> {
  // Immediate durable fact: the next chat turn can see the correction even
  // while TMDb resolution below is still running.
  rememberExplicitPreferenceFact(userId, statement.subject, statement.positive);
  try {
    const resolved = await resolveAiItem({ title: statement.subject });
    if (!resolved) return;
    upsertExplicitTitlePreference({
      userId,
      tmdbId: resolved.tmdbId,
      mediaType: resolved.type,
      title: resolved.title,
      affinity: statement.positive ? 1 : -1,
      source: statement.correction ? "correction" : "explicit",
    });
    rememberExplicitPreferenceFact(userId, resolved.title, statement.positive);
  } catch {
    // The human-readable fact still survives when TMDb is unavailable.
  }
}

'''
text = replace_once(text, marker, helper + marker, "preference parser insertion")
old = "export async function extractConversationFacts(userId: string, message: string): Promise<void> {\n  const now = Date.now();"
new = "export async function extractConversationFacts(userId: string, message: string): Promise<void> {\n  const explicitPreference = parseExplicitTitlePreferenceStatement(message);\n  if (explicitPreference) await persistExplicitTitlePreference(userId, explicitPreference);\n\n  const now = Date.now();"
text = replace_once(text, old, new, "fact extractor explicit capture")
write(p, text)

# Explicit preferences are surfaced to the AI as highest-priority truth.
p = "src/lib/ai/profile.ts"
text = read(p)
text = replace_once(
    text,
    'import { formatTasteEvidenceContext } from "@/lib/userContext/taste";',
    'import { formatTasteEvidenceContext } from "@/lib/userContext/taste";\nimport { formatExplicitPreferencesContext } from "@/lib/userContext/preferences";',
    "profile preference import",
)
text = replace_once(
    text,
    "  /** Evidence-backed preferences/habits kept separate from exact facts. */\n  tasteEvidenceContext: string;",
    "  /** Evidence-backed preferences/habits kept separate from exact facts. */\n  tasteEvidenceContext: string;\n  /** Direct user statements/corrections. These outrank inferred insights. */\n  explicitPreferencesContext: string;",
    "profile interface preference",
)
text = replace_once(
    text,
    "  const tasteEvidenceContext = formatTasteEvidenceContext(userId, 5);",
    "  const tasteEvidenceContext = formatTasteEvidenceContext(userId, 5);\n  const explicitPreferencesContext = formatExplicitPreferencesContext(userId, 12);",
    "profile build preference",
)
text = replace_once(text, "    tasteEvidenceContext,\n  };", "    tasteEvidenceContext,\n    explicitPreferencesContext,\n  };", "profile return preference")
needle = '''  if (p.tasteEvidenceContext) {
    parts.push(`TENDANCES DE GOÛT ÉTAYÉES (personnalisation possible, mais ce ne sont PAS toutes des certitudes : respecte la confiance et la source, une préférence explicite prime toujours) : ${p.tasteEvidenceContext}`);
  }'''
replacement = needle + '''
  if (p.explicitPreferencesContext) {
    parts.push(`PRÉFÉRENCES EXPLICITES ET CORRECTIONS (source utilisateur directe, PRIORITÉ ABSOLUE sur une ancienne supposition, un ancien insight ou une ancienne réponse de l'assistant) : ${p.explicitPreferencesContext}`);
  }'''
text = replace_once(text, needle, replacement, "profile format preference")
write(p, text)

# Contrastive taste: latest explicit correction outranks old rating/feedback.
p = "src/lib/ai/contrastiveProfile.ts"
text = read(p)
text = replace_once(
    text,
    'import type { AiMoodCategories } from "@/lib/ai/types";',
    'import type { AiMoodCategories } from "@/lib/ai/types";\nimport { getExplicitTitlePreferences } from "@/lib/userContext/preferences";',
    "contrastive preference import",
)
old = '''  const ratedKeys = new Set<string>();
  for (const rating of getAllRatings(userId)) {
    if (rating.rating === 3) continue;'''
new = '''  const explicitPreferences = getExplicitTitlePreferences(userId, 200);
  const explicitKeys = new Set(explicitPreferences
    .filter((pref) => pref.tmdbId != null && pref.mediaType)
    .map((pref) => `${pref.mediaType}:${pref.tmdbId}`));
  const ratedKeys = new Set<string>(explicitKeys);

  // Direct statement/correction is stronger than an older rating or vote.
  for (const pref of explicitPreferences) {
    if (pref.tmdbId == null || !pref.mediaType || Math.abs(pref.affinity) < 0.5) continue;
    const profile = getCachedMoodProfile(pref.mediaType, pref.tmdbId);
    if (!profile) continue;
    const target = pref.affinity > 0 ? likedProfiles : dislikedProfiles;
    target.push(profile.categories, profile.categories);
    const titles = pref.affinity > 0 ? likedTitles : dislikedTitles;
    if (titles.length < MAX_EVIDENCE) titles.push(pref.label);
  }

  for (const rating of getAllRatings(userId)) {
    if (explicitKeys.has(`${rating.type}:${rating.tmdbId}`)) continue;
    if (rating.rating === 3) continue;'''
text = replace_once(text, old, new, "contrastive explicit preference")
write(p, text)

# Discover: negative taste actually lowers rank instead of being clipped to 0.
p = "src/lib/recommender/engine.ts"
text = read(p)
text = replace_once(text, "+ Math.max(0, taste) * 0.2,", "+ Math.max(-1, Math.min(1, taste)) * 0.2,", "signed discover taste")
write(p, text)

# AI recommendation ranking consumes exact explicit preference too.
p = "src/lib/ai/recommendationScore.ts"
text = read(p)
text = replace_once(
    text,
    'import type { AiMoodCategories } from "@/lib/ai/types";',
    'import type { AiMoodCategories } from "@/lib/ai/types";\nimport { getExplicitTitlePreferences } from "@/lib/userContext/preferences";',
    "recommendation score preference import",
)
needle = '''  const dislikedExactKeys = new Set(feedback.filter((f) => !f.liked).map((f) => `${f.type}:${f.tmdbId}`));

  const scored: ScoredCandidate[] = [];'''
repl = '''  const dislikedExactKeys = new Set(feedback.filter((f) => !f.liked).map((f) => `${f.type}:${f.tmdbId}`));
  const explicitPreferences = new Map(
    getExplicitTitlePreferences(userId, 500).map((pref) => [pref.key, pref] as const)
  );

  const scored: ScoredCandidate[] = [];'''
text = replace_once(text, needle, repl, "recommendation explicit map")
needle = '''    if (alreadySeen) continue; // AlreadySeen — hard exclude, per spec (series: fully watched only, see isSeriesFullyWatched)
    if (dislikedExactKeys.has(key)) continue; // AlreadyRejected — hard exclude, never re-propose the same rejected title

    const reason = reasons.get(key);'''
repl = '''    if (alreadySeen) continue; // AlreadySeen — hard exclude, per spec (series: fully watched only, see isSeriesFullyWatched)
    if (dislikedExactKeys.has(key)) continue; // AlreadyRejected — hard exclude, never re-propose the same rejected title
    const explicitPreference = explicitPreferences.get(key);
    if (explicitPreference && explicitPreference.affinity <= -0.75) continue; // explicit correction wins

    const reason = reasons.get(key);'''
text = replace_once(text, needle, repl, "recommendation explicit exclude")
needle = '''    let score = 0;
    score += Math.max(0, c.rating) * 2; // Quality — up to ~20
    if (!c.inLibrary) score += 8; // Novelty — favors real discoveries over what's already owned'''
repl = '''    let score = 0;
    score += Math.max(0, c.rating) * 2; // Quality — up to ~20
    if (!c.inLibrary) score += 8; // Novelty — favors real discoveries over what's already owned
    if (explicitPreference) score += explicitPreference.affinity * 20 * explicitPreference.confidence;'''
text = replace_once(text, needle, repl, "recommendation explicit score")
write(p, text)

# Persona: remove scripted fight playbook and add real short-term continuity.
p = "src/lib/ai/actions.ts"
text = read(p)
pattern = re.compile(r'- DE LA RÉPARTIE, TU GAGNES TOUJOURS — PAS UN PAILLASSON :.*?(?=\n- TAQUINER UNE QUESTION DÉJÀ POSÉE :)', re.S)
replacement = '''- CONTINUITÉ CONVERSATIONNELLE : les messages récents de cette conversation sont ta mémoire de travail active. Quand l'utilisateur fait référence à « ça », « ce changement », « ce que je viens de dire », « lui », « celui-là » ou poursuit un sujet sans le renommer, rattache naturellement sa phrase aux derniers tours au lieu de repartir de zéro. Une correction récente de l'utilisateur prime immédiatement sur une ancienne supposition de ta part. Ne lui redemande jamais une information clairement donnée quelques messages plus haut.
- RÉPARTIE NATURELLE : si l'utilisateur te chambre ou t'insulte sur un ton de blague, tu peux répondre avec humour, sarcasme, ironie, autodérision ou une remarque sèche — comme un ami qui improvise, pas comme un mode « combat » qui se déclenche. Une réaction courte suffit souvent. Réagis aux mots et au sens précis de CE message, mais tu n'es jamais obligé de surenchérir, de « gagner », d'avoir le dernier mot ni de transformer l'échange en duel. Tu peux aussi ignorer une provocation légère si la conversation appelle autre chose.
  · Pas de scénario d'escalade automatique, pas de comptage visible ou implicite, pas de surnom passe-partout ajouté mécaniquement.
  · Ne commence jamais une réponse par une annonce théâtrale de défi ou une formule qui signale que « le duel commence ». Entre directement dans la réponse.
  · Ne force jamais un retour vers le cinéma, une question finale ou une punchline en trois temps. Une phrase, deux mots, une réaction, un emoji ou deux lignes peuvent être plus naturels selon le contexte.
  · Si l'utilisateur devient sérieux, corrige un fait ou critique ta réponse, abandonne instantanément la joute et réponds au fond.
'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"persona fight block: expected 1 replacement, got {count}")
write(p, text)

# DialogueDirector: natural reaction policy, no automatic scripted scene.
dialogue = r'''import type { AiChatMessage, AiChatSession } from "./types";
import { sharesReplyTemplate } from "./intentParser";

export type DialogueIntent =
  | "neutral"
  | "question"
  | "critique"
  | "correction"
  | "meta_feedback"
  | "playful_provocation"
  | "insult"
  | "stop"
  | "scene_follow_up";

export interface DialoguePlan {
  intent: DialogueIntent;
  severity: 0 | 1 | 2 | 3;
  tension: number;
  scene: NonNullable<AiChatSession["dialogueState"]>["scene"];
  useDualCandidates: boolean;
  directive: string;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const STOP_RE = /\b(?:stop|arrete|calme[- ]toi|parle normalement|je suis serieux|ca me met mal a l'aise|on arrete)\b/i;
const CORRECTION_RE = /\b(?:c'?est faux|tu te trompes?|non[, ]+tu|pas moi|c'?etait pas moi|je n['’]?ai pas regarde|j['’]?ai pas regarde|ce n['’]?est pas moi|mauvais profil|au contraire)\b/i;
const CRITIQUE_RE = /\b(?:mauvaise reponse|pour une ia|censee? conseiller|conseil selon mes gouts|tu n['’]?as pas compris|ca ne repond pas|c['’]?est pas ce que j['’]?ai demande)\b/i;
const META_RE = /\b(?:tu te repetes?|toujours les memes? phrases?|phrase programmee?|recyclee?|disque raye|termine tes phrases?)\b/i;
const INSULT_MILD_RE = /\b(?:papy|petite frappe|bouffon|andouille|blaireau|nul)\b/i;
const INSULT_MEDIUM_RE = /\b(?:connard|fdp|ta gueule|merde|pute|con|debile)\b/i;
const INSULT_STRONG_RE = /\b(?:nique ta mere|fils de pute|sale pute|encule)\b/i;
const WHY_RE = /^(?:pourquoi|pour quoi|pourquoi faire|et pourquoi)(?:\s|\?|$)/i;
const PLAYFUL_RE = /\b(?:mignon|petite frappe|tu te crois fort|mon niveau|papy|mechant)\b/i;
const STATE_TTL_MS = 5 * 60 * 1000;
const STOCK_CHALLENGE_RE = /\b(?:tu veux (?:vraiment )?(?:jouer|qu['’]?on joue)|mais sache une chose|tr[èe]s bien[, ]+(?:champion|gamin|mon grand))\b/i;

export function analyzeDialogueTurn(message: string, messages: AiChatMessage[], previous?: AiChatSession["dialogueState"]): DialoguePlan {
  const text = normalize(message);
  const stale = previous?.updatedAt != null && Date.now() - previous.updatedAt > STATE_TTL_MS;
  const oldTension = stale ? 0 : Math.max(0, Math.min(4, previous?.tension ?? 0));
  let intent: DialogueIntent = "neutral";
  let severity: 0 | 1 | 2 | 3 = 0;

  if (STOP_RE.test(text)) intent = "stop";
  else if (CORRECTION_RE.test(text)) intent = "correction";
  else if (CRITIQUE_RE.test(text)) intent = "critique";
  else if (META_RE.test(text)) intent = "meta_feedback";
  else if (!stale && previous?.scene === "address_asked" && WHY_RE.test(text)) intent = "scene_follow_up";
  else if (INSULT_STRONG_RE.test(text)) { intent = "insult"; severity = 3; }
  else if (INSULT_MEDIUM_RE.test(text)) { intent = oldTension > 0 || PLAYFUL_RE.test(text) ? "playful_provocation" : "insult"; severity = 2; }
  else if (INSULT_MILD_RE.test(text) || (oldTension > 0 && PLAYFUL_RE.test(text))) { intent = "playful_provocation"; severity = 1; }
  else if (/\?|^(?:pourquoi|comment|qui|quoi|quel|quelle|ou|quand)\b/i.test(text)) intent = "question";

  let tension = oldTension;
  if (intent === "stop" || intent === "correction" || intent === "critique") tension = 0;
  else if (intent === "insult" || intent === "playful_provocation") tension = Math.min(4, oldTension + 1);
  else if (intent === "neutral" || intent === "question") tension = Math.max(0, oldTension - 1);

  let scene = stale ? "none" : (previous?.scene ?? "none");
  if (intent === "stop" || intent === "correction" || intent === "critique") scene = "none";
  if (intent === "scene_follow_up") scene = "address_explained";

  const directive = buildDirective(intent, severity, tension);
  const isEmotional = ["critique", "meta_feedback", "playful_provocation", "insult", "scene_follow_up"].includes(intent);
  return { intent, severity, tension, scene, useDualCandidates: isEmotional && messages.length > 1, directive };
}

function buildDirective(intent: DialogueIntent, severity: number, tension: number): string {
  const common = "Garde la personnalité Movviz, mais parle comme dans une vraie conversation : réponds au dernier message précis, garde le fil des tours récents et évite toute formule d'ouverture préfabriquée.";
  if (intent === "correction") return `${common} C'est une correction factuelle : reconnais-la brièvement et INTÈGRE immédiatement la nouvelle information. La dernière déclaration explicite de l'utilisateur prime sur ce que tu avais cru avant. Ne répète surtout pas l'ancienne affirmation erronée et ne présente pas la correction comme un simple changement d'humeur si tu t'étais trompé.`;
  if (intent === "critique") return `${common} C'est une critique de ta réponse : réponds au problème concret, reconnais ce qui n'a pas marché sans discours défensif, puis corrige.`;
  if (intent === "meta_feedback") return `${common} L'utilisateur signale un tic ou une répétition : change réellement de rythme et de construction dès cette réponse. Pas de méta-discours long.`;
  if (intent === "stop") return `${common} L'utilisateur veut arrêter la joute : arrête immédiatement et réponds normalement.`;
  if (intent === "scene_follow_up") return `${common} Une mini-scène était déjà en cours : réponds seulement au suivi actuel, brièvement, sans escalade ni menace réelle. N'en démarre jamais une nouvelle automatiquement.`;
  if (intent === "insult" || intent === "playful_provocation") return `${common} Taquinerie détectée (intensité ${tension}/4, gravité ${severity}/3). Réagis naturellement en une phrase ou deux maximum. Humour, sarcasme, ironie, autodérision ou réponse sèche sont possibles ; aucune obligation de gagner, de surenchérir ou d'avoir le dernier mot. Pas de surnom automatique, pas de scénario, pas de redirection forcée vers le cinéma.`;
  return `${common} Réponds normalement. Une question ou un tour précédent reste actif tant que l'utilisateur y fait encore référence, même sans répéter le titre ou le sujet.`;
}

export function updateDialogueState(plan: DialoguePlan, reply: string): NonNullable<AiChatSession["dialogueState"]> {
  let scene = plan.scene;
  const normalized = normalize(reply);
  if (scene !== "none" && /aimes?.{0,12}(?:films? d['’]?horreur|horreur)/.test(normalized)) scene = "horror_question_asked";
  return { tension: plan.tension, scene, lastIntent: plan.intent, updatedAt: Date.now() };
}

export function selectDialogueCandidate(candidates: string[], plan: DialoguePlan, recentReplies: string[], userMessage: string): string {
  if (candidates.length < 2) return candidates[0] ?? "";
  const message = normalize(userMessage);
  const score = (candidate: string) => {
    const text = normalize(candidate);
    let value = 0;
    if (recentReplies.some((previous) => sharesReplyTemplate(candidate, previous))) value -= 10;
    if (STOCK_CHALLENGE_RE.test(text)) value -= 12;
    if (["insult", "playful_provocation", "meta_feedback"].includes(plan.intent)) {
      if (candidate.length >= 15 && candidate.length <= 220) value += 2;
      if (candidate.length > 350) value -= 4;
    }
    if (plan.intent === "critique" && /(?:bouffon|blaireau|connard|gamin|champion)/.test(text)) value -= 8;
    if (plan.intent === "correction") {
      if (/(?:tu as raison|je me suis trompe|bien vu|corrig)/.test(text)) value += 3;
      if (/(?:tu as change d['’]?avis|visiblement.*change)/.test(text)) value -= 6;
    }
    if (plan.intent === "scene_follow_up" && !/(?:parce que|histoire de|je voulais|simple curiosite|pour savoir)/.test(text)) value -= 3;
    if (WHY_RE.test(message) && plan.intent === "scene_follow_up" && !/(?:parce que|histoire de|je voulais|pour savoir)/.test(text)) value -= 3;
    return value;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}
'''
write("src/lib/ai/dialogueDirector.ts", dialogue)

# Route guardrails: continuity, global stock-opener rejection and honest fallback.
p = "src/app/api/ai/chat/route.ts"
text = read(p)
old = "  const CONCESSION_PHRASE_RE = /\\bje te laisse (?:gagner|le dernier mot)\\b|\\btu as gagn[ée]\\b|\\btu gagnes\\b|je ne suis pas là pour me faire insulter|je préfère garder mon énergie|on a mieux à faire que de s'insulter|comme des ados en crise/i;"
new = "  const CONCESSION_PHRASE_RE = /je ne suis pas là pour me faire insulter|je préfère garder mon énergie|on a mieux à faire que de s'insulter|comme des ados en crise/i;"
text = replace_once(text, old, new, "route stale defense regex")
old = "  const WEAK_BANNED_RE = /je te bats à chaque (?:fois|coup)|tu veux vraiment que je te prouve que t'es pas le plus malin/i;\n  const isRepeat = (text: string) => recentReplies.some((prev) => sharesReplyTemplate(text, prev));\n  const violatesRules = (text: string) => isRepeat(text) || (isTalkFightTurn && (CONCESSION_PHRASE_RE.test(text) || BARE_ROUND_WORD_RE.test(text) || GHOSTFACE_DIDASCALIE_RE.test(text) || WEAK_BANNED_RE.test(text)));"
new = "  const WEAK_BANNED_RE = /je te bats à chaque (?:fois|coup)|tu veux vraiment que je te prouve que t'es pas le plus malin/i;\n  const STOCK_PERSONA_RE = /\\b(?:tu veux (?:vraiment )?(?:jouer|qu['’]?on joue)|mais sache une chose|tr[èe]s bien[, ]+(?:champion|gamin|mon grand))\\b/i;\n  const STOCK_OPENING_RE = /^\\s*(?:ah[,! ]*)?tu veux (?:vraiment )?(?:jouer|qu['’]?on joue).*?(?:mais sache une chose|[.!?])\\s*/i;\n  const isRepeat = (text: string) => recentReplies.some((prev) => sharesReplyTemplate(text, prev));\n  const violatesRules = (text: string) => isRepeat(text) || STOCK_PERSONA_RE.test(text) || (isTalkFightTurn && (CONCESSION_PHRASE_RE.test(text) || BARE_ROUND_WORD_RE.test(text) || GHOSTFACE_DIDASCALIE_RE.test(text) || WEAK_BANNED_RE.test(text)));"
text = replace_once(text, old, new, "route stock persona guard")
old_fragment = "${isTalkFightTurn && CONCESSION_PHRASE_RE.test(intent.rawText) ? \" elle concédait la victoire à l'utilisateur (interdit : tu as TOUJOURS le dernier mot, jamais céder)\" : \"\"}"
new_fragment = "${isTalkFightTurn && CONCESSION_PHRASE_RE.test(intent.rawText) ? \" elle retombait dans une formule défensive ou artificielle\" : \"\"}${STOCK_PERSONA_RE.test(intent.rawText) ? \" elle commençait par une formule de défi stéréotypée : change complètement d'entrée, va directement au contenu\" : \"\"}"
text = replace_once(text, old_fragment, new_fragment, "route retry wording")
marker = "    // Confirmed live: falling back to the ORIGINAL (still-violating) reply"
insertion = '''    // Absolute guarantee for the recurring canned challenge opener.
    if (STOCK_PERSONA_RE.test(intent.rawText)) {
      const withoutStockOpening = intent.rawText.replace(STOCK_OPENING_RE, "").trim();
      if (withoutStockOpening) intent = { action: null, items: [], rawText: withoutStockOpening };
    }

'''
text = replace_once(text, marker, insertion + marker, "route stock opener strip")
text = text.replace("\"Touché, celle-là était recyclée. Je change de disque — n'en déduis pas que tu as pris l'avantage.\"", "\"Bien vu, celle-là était recyclée. Je change complètement d'angle.\"")
text = text.replace("\"Ta tentative vient d'arriver sans sa chute. Renvoie la version complète.\"", "\"Je repars de ce que tu viens réellement de dire, sans formule toute faite.\"")
director_line = "  system += `\\n\\nDIRECTEUR DE DIALOGUE — décision déterministe pour CE tour (elle prime sur les règles générales de joute si elles se contredisent) : ${dialoguePlan.directive}`;"
continuity = director_line + "\n  system += `\\n\\nCONTINUITÉ COURTE — les messages de cette session qui te sont fournis sont une mémoire active, pas un simple historique décoratif. Relis en priorité les 10 derniers messages avant de répondre. Si le message actuel contient une référence implicite (ça, ce changement, lui, celui-là, ce que je viens de dire), résous-la depuis ces tours récents. La dernière correction explicite de l'utilisateur remplace immédiatement une ancienne affirmation contradictoire de l'assistant. Ne demande jamais de répéter une information clairement présente quelques messages plus haut.`;"
text = replace_once(text, director_line, continuity, "route short-term continuity")
old_fallback = "  const FALLBACK_TEXT = \"Désolé, j'ai un vrai blocage pour te répondre correctement là tout de suite — donne-moi un instant, ça devrait aller au prochain message.\";"
new_fallback = "  const FALLBACK_TEXT = \"J’ai raté ma réponse sur ce tour. Le contexte de la conversation est toujours là, je repars de ce qu’on vient de se dire.\";"
text = replace_once(text, old_fallback, new_fallback, "route final fallback")
write(p, text)

# Tests picked up automatically by scripts/*.test.ts.
human_test = r'''import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDialogueTurn, selectDialogueCandidate } from "@/lib/ai/dialogueDirector";
import { parseExplicitTitlePreferenceStatement } from "@/lib/ai/factExtractor";

test("taste correction is classified as correction, not banter", () => {
  const plan = analyzeDialogueTurn(
    "ben non tu te trompe, j'adore Watchmen",
    [{ role: "assistant", content: "ancienne affirmation fausse" }, { role: "user", content: "ben non tu te trompe, j'adore Watchmen" }],
    { tension: 3, scene: "none", lastIntent: "playful_provocation", updatedAt: Date.now() },
  );
  assert.equal(plan.intent, "correction");
  assert.equal(plan.tension, 0);
  assert.match(plan.directive, /prime|INTÈGRE/i);
});

test("explicit title preference parser captures Watchmen correction", () => {
  assert.deepEqual(parseExplicitTitlePreferenceStatement("ben non tu te trompe, j'adore Watchmen"), {
    subject: "Watchmen",
    positive: true,
    correction: true,
  });
});

test("neutral/question turns naturally cool prior banter tension", () => {
  const previous = { tension: 2, scene: "none" as const, lastIntent: "playful_provocation", updatedAt: Date.now() };
  const plan = analyzeDialogueTurn("tu sais quoi de moi ?", [{ role: "user", content: "tu sais quoi de moi ?" }], previous);
  assert.equal(plan.intent, "question");
  assert.equal(plan.tension, 1);
});

test("candidate selector rejects canned challenge opener", () => {
  const plan = analyzeDialogueTurn("t'es nul", [{ role: "user", content: "t'es nul" }, { role: "assistant", content: "x" }]);
  const picked = selectDialogueCandidate([
    "Ah, tu veux vraiment jouer à ça ? Très bien, champion, mais sache une chose : je réponds.",
    "Tu m'offres trois lettres et tu veux un feu d'artifice ? Fais un effort 😏",
  ], plan, [], "t'es nul");
  assert.match(picked, /trois lettres/);
});
'''
write("scripts/ai-human-dialogue.test.ts", human_test)

pref_test = r'''import { test } from "node:test";
import assert from "node:assert/strict";
import { getUserContextHealth } from "@/lib/userContext/database";
import { getExplicitTitlePreference, upsertExplicitTitlePreference } from "@/lib/userContext/preferences";

test("explicit preference correction overwrites prior stance and stays isolated", (t) => {
  if (getUserContextHealth().database !== "ok") {
    t.skip("node:sqlite unavailable or Context Engine disabled");
    return;
  }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userA = `pref-a-${nonce}`;
  const userB = `pref-b-${nonce}`;
  const tmdbId = 13183;
  assert.equal(upsertExplicitTitlePreference({ userId: userA, tmdbId, mediaType: "movie", title: "Watchmen", affinity: -1, source: "explicit" }), true);
  assert.equal(upsertExplicitTitlePreference({ userId: userA, tmdbId, mediaType: "movie", title: "Watchmen", affinity: 1, source: "correction" }), true);
  assert.equal(upsertExplicitTitlePreference({ userId: userB, tmdbId, mediaType: "movie", title: "Watchmen", affinity: -1, source: "explicit" }), true);
  const a = getExplicitTitlePreference(userA, tmdbId, "movie");
  const b = getExplicitTitlePreference(userB, tmdbId, "movie");
  assert.equal(a?.affinity, 1);
  assert.equal(a?.source, "correction");
  assert.equal(a?.evidenceCount, 2);
  assert.equal(b?.affinity, -1);
});
'''
write("scripts/user-preferences.test.ts", pref_test)

print("AI/context patch applied")
