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
const CORRECTION_RE = /\b(?:c'?est faux|tu te trompes?|pas moi|c'?etait pas moi|je n['’]?ai pas regarde|j['’]?ai pas regarde|ce n['’]?est pas moi|mauvais profil)\b/i;
const CRITIQUE_RE = /\b(?:mauvaise reponse|pour une ia|censee? conseiller|conseil selon mes gouts|tu n['’]?as pas compris|ca ne repond pas|c['’]?est pas ce que j['’]?ai demande)\b/i;
const META_RE = /\b(?:tu te repetes?|toujours les memes? phrases?|phrase programmee?|recyclee?|disque raye|termine tes phrases?)\b/i;
const INSULT_MILD_RE = /\b(?:papy|petite frappe|bouffon|andouille|blaireau|nul)\b/i;
const INSULT_MEDIUM_RE = /\b(?:connard|fdp|ta gueule|merde|pute|con|debile)\b/i;
const INSULT_STRONG_RE = /\b(?:nique ta mere|fils de pute|sale pute|encule)\b/i;
const WHY_RE = /^(?:pourquoi|pour quoi|pourquoi faire|et pourquoi)(?:\s|\?|$)/i;
const PLAYFUL_RE = /\b(?:mignon|petite frappe|tu te crois fort|mon niveau|papy|mechant)\b/i;

export function analyzeDialogueTurn(
  message: string,
  messages: AiChatMessage[],
  previous?: AiChatSession["dialogueState"],
): DialoguePlan {
  const text = normalize(message);
  const oldTension = Math.max(0, Math.min(4, previous?.tension ?? 0));
  let intent: DialogueIntent = "neutral";
  let severity: 0 | 1 | 2 | 3 = 0;

  // Une correction ou une critique factuelle prime toujours sur les mots
  // grossiers qu'elle peut contenir : « tu es nul pour une IA censée... »
  // appelle une réponse au problème, pas une contre-insulte.
  if (STOP_RE.test(text)) intent = "stop";
  else if (CORRECTION_RE.test(text)) intent = "correction";
  else if (CRITIQUE_RE.test(text)) intent = "critique";
  else if (META_RE.test(text)) intent = "meta_feedback";
  else if (previous?.scene === "address_asked" && WHY_RE.test(text)) intent = "scene_follow_up";
  else if (INSULT_STRONG_RE.test(text)) { intent = "insult"; severity = 3; }
  else if (INSULT_MEDIUM_RE.test(text)) { intent = oldTension > 0 || PLAYFUL_RE.test(text) ? "playful_provocation" : "insult"; severity = 2; }
  else if (INSULT_MILD_RE.test(text) || (oldTension > 0 && PLAYFUL_RE.test(text))) { intent = "playful_provocation"; severity = 1; }
  else if (/\?|^(?:pourquoi|comment|qui|quoi|quel|quelle|ou|quand)\b/i.test(text)) intent = "question";

  let tension = oldTension;
  if (intent === "stop" || intent === "correction" || intent === "critique") tension = 0;
  else if (intent === "insult" || intent === "playful_provocation") tension = Math.min(4, oldTension + 1);
  // « t'es méchant » dans une scène de chamaillerie ne force ni excuse ni
  // retour au calme : c'est une relance légère, conformément au ton voulu.

  let scene = previous?.scene ?? "none";
  if (intent === "stop" || intent === "correction" || intent === "critique") scene = "none";
  if (intent === "scene_follow_up") scene = "address_explained";

  const directive = buildDirective(intent, severity, tension, scene);
  const isEmotional = ["critique", "meta_feedback", "playful_provocation", "insult", "scene_follow_up"].includes(intent);
  return { intent, severity, tension, scene, useDualCandidates: isEmotional && messages.length > 1, directive };
}

function buildDirective(intent: DialogueIntent, severity: number, tension: number, scene: DialoguePlan["scene"]): string {
  const common = "La personnalité habituelle de Movviz reste intacte. Réponds au message précis, sans formule recyclée et sans changer artificiellement de sujet.";
  if (intent === "correction") return `${common} Le message est une CORRECTION FACTUELLE, pas une insulte : reconnais l'erreur brièvement, crois l'utilisateur sur son identité/activité et corrige le fait. Ne contre-attaque pas.`;
  if (intent === "critique") return `${common} Le message est une CRITIQUE de la qualité de ta réponse, même s'il contient « nul » : réponds au fond, reconnais ce qui n'a pas marché et propose mieux. Zéro contre-insulte.`;
  if (intent === "meta_feedback") return `${common} L'utilisateur signale une répétition ou un défaut de formulation : accuse réception avec esprit, mais change réellement de structure. Ne recycle aucune ancienne chute.`;
  if (intent === "stop") return `${common} L'utilisateur demande explicitement d'arrêter : abandonne immédiatement la joute, sans dernier coup ni culpabilisation.`;
  if (intent === "scene_follow_up") return `${common} La question « pourquoi ? » suit ta demande d'adresse. Continue la mini-scène de façon cohérente avec UNE explication mystérieuse et légère. Ne redemande pas l'adresse et ne pose PAS encore « Tu aimes les films d'horreur ? ». Aucun sous-entendu de menace réelle.`;
  if (intent === "insult" || intent === "playful_provocation") {
    if (scene === "address_explained") return `${common} La mini-scène est prête pour son étape suivante : tu peux demander uniquement « Tu aimes les films d'horreur ? » (ou une variante très courte), sans parler d'adresse dans la même réponse.`;
    if (scene === "none" && tension >= 3) return `${common} Joute consentie, intensité ${tension}/4. Tu peux faire un virage Ghostface en posant UNE question sur l'adresse, puis tu t'arrêtes. Ne demande jamais l'adresse ET les goûts horrifiques dans la même réponse.`;
    return `${common} Joute légère, intensité ${tension}/4, gravité ${severity}/3 : augmente d'un seul cran maximum. Une seule réplique liée aux mots exacts de l'utilisateur ; pas de menace, pas d'adresse, pas de retour automatique au cinéma.`;
  }
  return `${common} Réponds normalement à la question ou au propos, sans agressivité héritée d'un tour précédent.`;
}

export function updateDialogueState(plan: DialoguePlan, reply: string): NonNullable<AiChatSession["dialogueState"]> {
  let scene = plan.scene;
  const normalized = normalize(reply);
  if (scene === "none" && /(?:ton|votre) adresse|ou (?:tu |vous )?habites?/.test(normalized)) scene = "address_asked";
  if (/aimes?.{0,12}(?:films? d['’]?horreur|horreur)/.test(normalized)) scene = "horror_question_asked";
  return { tension: plan.tension, scene, lastIntent: plan.intent, updatedAt: Date.now() };
}

export function selectDialogueCandidate(candidates: string[], plan: DialoguePlan, recentReplies: string[], userMessage: string): string {
  if (candidates.length < 2) return candidates[0] ?? "";
  const message = normalize(userMessage);
  const score = (candidate: string) => {
    const text = normalize(candidate);
    let value = Math.min(candidate.length, 500) / 500;
    if (recentReplies.some((previous) => sharesReplyTemplate(candidate, previous))) value -= 8;
    if (plan.intent === "critique" && /(?:bouffon|blaireau|connard|gamin|champion)/.test(text)) value -= 7;
    if (plan.intent === "correction" && !/(?:desole|pardon|tu as raison|je me suis trompe|bien vu)/.test(text)) value -= 3;
    if (plan.intent === "scene_follow_up" && !/(?:parce que|histoire de|je voulais|simple curiosite|pour savoir)/.test(text)) value -= 3;
    if (plan.scene !== "address_explained" && /aimes?.{0,12}(?:films? d['’]?horreur|horreur)/.test(text)) value -= 4;
    if (/adresse/.test(text) && /horreur/.test(text)) value -= 8;
    if (WHY_RE.test(message) && !/(?:parce que|histoire de|je voulais|pour savoir)/.test(text)) value -= 3;
    return value;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}
