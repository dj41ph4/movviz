import { loadAiConfig } from "./store";
import { callAi } from "./providers";
import { extractJsonObject } from "./intentParser";
import { rememberFact, rememberExplicitPreferenceFact } from "./tasteProfile";
import { resolveAiItem } from "./actions";
import { upsertExplicitTitlePreference } from "@/lib/userContext/preferences";

/**
 * Apprentissage conversationnel continu — demande explicite user ("il doit
 * enregistrer plus de contexte, même d'une conversation : mes questions, mes
 * ressentiments… la moindre chose qu'il apprend sur moi doit devenir du
 * contexte").
 *
 * Le mécanisme historique (marqueurs [[FAIT: ...]] que le modèle doit émettre
 * dans SA réponse, parsés par extractFacts) dépend du bon vouloir du modèle
 * et ne capturait qu'une fraction des apprentissages. Ici : UN petit appel
 * LLM dédié par message utilisateur, lancé EN PARALLÈLE de la réponse du chat
 * (latence invisible, écriture garantie), qui lit le message et renvoie les
 * faits stables à mémoriser — goûts, préférences, ressentis, habitudes,
 * informations personnelles.
 *
 * Garde-fous :
 * - cooldown court par utilisateur (1 message/min max) : une rafale de
 *   messages ne déclenche qu'un seul apprentissage, jamais un appel par tour ;
 * - best-effort total : une panne d'extraction n'affecte jamais la réponse ;
 * - le prompt refuse le trivial/éphémère (météo, politesse, demande en cours)
 *   et les généralités sans contenu — seuls des faits stables et exploitables
 *   pour de futures recommandations sont retenus ;
 * - dédoublonnage et plafond gérés par rememberFact (tasteProfile).
 */

// Cooldown en mémoire process (le bundling Next.js ne partage pas les
// modules entre routes — un timestamp perdu au redémarrage n'est qu'un
// apprentissage de plus, jamais un risque).
const lastRun: Record<string, number> = {};
const COOLDOWN_MS = 60_000;

interface ExplicitTitlePreferenceStatement {
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

const FACTS_SYSTEM_PROMPT = `Tu es le module de mémoire d'une application de films/séries. Tu lis le dernier message d'un utilisateur et tu en extrais TOUT ce qui est un apprentissage durable sur lui : goûts, préférences, ressentiments, habitudes, informations personnelles.

EXTRACTION — exemples de faits à retenir :
- "j'adore les films de Nolan, la structure non-linéaire" → {"facts":["Apprécie les films de Christopher Nolan et les récits non-linéaires"]}
- "je déteste les jump scares" → {"facts":["Déteste les jump scares"]}
- "j'aime les comédies françaises des années 90" → {"facts":["Apprécie les comédies françaises des années 90"]}
- "je suis du genre à binge une saison en un week-end" → {"facts":["Regarde les saisons en binge (une saison en un week-end)"]}
- "je regarde toujours en VF" → {"facts":["Préfère regarder en VF"]}
- "je m'appelle Alex" → {"facts":["Prénom : Alex"]}
- "Inception c'est mon film préféré" → {"facts":["Inception est son film préféré"]}
- "les films de 3h ça me saoule" → {"facts":["N'aime pas les films très longs (3h+)"]}

NE PAS extraire :
- le trivial ou l'éphémère : météo, heure, politesse, état du moment ("je suis fatigué"), questions sans contenu perso, demandes d'action ("ajoute Inception", "recommande-moi un film") sans indication de goût ;
- une simple mention de titre sans opinion ou contexte personnel ;
- des généralités vides ("j'aime les bons films").

FORMAT : réponds UNIQUEMENT avec un objet JSON {"facts":["...","..."]}, sans texte autour, sans balise de code. Maximum 4 faits, chacun UNE phrase courte et concrète, formulé à la 3e personne, en français. Si rien à retenir, réponds {"facts":[]}.`;

/**
 * Extraction des faits d'un message utilisateur — à lancer en parallèle de
 * la réponse du chat (fire-and-forget, ne bloque jamais la réponse). Ne
 * lève jamais d'exception.
 */
export async function extractConversationFacts(userId: string, message: string): Promise<void> {
  const explicitPreference = parseExplicitTitlePreferenceStatement(message);
  if (explicitPreference) await persistExplicitTitlePreference(userId, explicitPreference);

  const now = Date.now();
  if (now - (lastRun[userId] ?? 0) < COOLDOWN_MS) return;
  lastRun[userId] = now;
  const config = loadAiConfig();
  if (!config.enabled) return;
  try {
    const { text } = await callAi(config, FACTS_SYSTEM_PROMPT, [{ role: "user", content: message }]);
    const json = extractJsonObject(text);
    if (!json || typeof json !== "object") return;
    const list = (json as Record<string, unknown>).facts;
    if (!Array.isArray(list)) return;
    for (const raw of list.slice(0, 4)) {
      if (typeof raw !== "string") continue;
      const fact = raw.trim().slice(0, 300);
      if (fact) rememberFact(userId, fact);
    }
  } catch {
    // Best-effort : une extraction ratée n'affecte jamais le chat.
  }
}