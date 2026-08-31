import type { AiChatMessage, AiChatSession } from "./types";
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
  const stale = previous?.updatedAt != null && previous.updatedAt > 0 && Date.now() - previous.updatedAt > STATE_TTL_MS;
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
