/**
 * Détection d'activité utilisateur (process-wide).
 *
 * Toute route API authentifiée passe par requireUser/requireAdmin
 * (auth/guard.ts) qui appelle markUserActivity() — MAIS uniquement si la
 * requête représente une vraie interaction : un poll silencieux du frontend
 * (statut du moteur toutes les 500 ms, /api/jobs toutes les 2 s, /api/perf
 * toutes les 5 s…) ne doit PAS maintenir l'utilisateur « actif », sinon
 * l'arrière-plan serait bridé à vie dès qu'une page est laissée ouverte.
 * isUserInteraction() filtre ces endpoints de polling (voir POLL_PREFIXES).
 *
 * Les boucles d'arrière-plan (bulk « Rechercher les manquants », tâches
 * planifiées RSS, upgrades qualité…) consultent yieldToUser() au début de
 * chaque itération : quand l'utilisateur clique ou navigue, elles cèdent la
 * main et reprennent après quelques secondes d'inactivité — le ralentissement
 * est toujours côté arrière-plan, jamais côté utilisateur. Chaque épisode de
 * ralentissement est tracé dans le log de diagnostic (priority.yield) avec
 * l'utilisateur actif responsable (nom + id) et sa durée — lisible dans le
 * panneau Diagnostics.
 *
 * Ancré sur globalThis (convention AGENTS.md) : partagé entre les bundles
 * Next.js du même processus, survit au HMR. Timestamp en mémoire seulement —
 * rien à persister ; au redémarrage la valeur tombe à zéro, ce qui est
 * exactement le comportement voulu (personne n'est actif à froid).
 */

import { recordSearchLog } from "@/lib/diagnostic/searchLog";

// Fenêtre pendant laquelle une interaction utilisateur est considérée
// « récente » (isUserActive).
const ACTIVE_WINDOW_MS = 2_500;
// Délai d'inactivité après lequel une boucle de fond reprend son travail.
const IDLE_RESUME_MS = 4_000;
// Plafond : une boucle ne cède jamais plus longtemps que ça, même si
// l'utilisateur continue de cliquer — l'arrière-plan finit toujours par
// progresser (au pire 30 s de latence sur une boucle, jamais bloqué à vie).
const MAX_YIELD_MS = 30_000;
const YIELD_STEP_MS = 1_000;

interface UserActivity {
  at: number;
  user: { id: string; username: string } | null;
}

const g = globalThis as typeof globalThis & { __movvizLastUserActivity?: UserActivity };

/**
 * Endpoints interrogés en boucle par le frontend (SWR refreshInterval,
 * setInterval, SSE) — jamais le signe d'une vraie interaction. Un GET vers un
 * préfixe listé ne marque PAS l'activité. Liste tenue à jour manuellement :
 * elle couvre tous les pollers connus (500 ms → 10 s) ; le volume réel des
 * requêtes, lui, n'a aucun effet.
 *
 * 500 ms  /api/engine/torrents (DownloadQueue), /api/activity/v2 (QueueTab)
 * 1,5 s   /api/cache (CachePanel), /api/library/rename (RenamePanel)
 * 2 s     /api/jobs (page bibliothèque)
 * 3 s     /api/engine/instances (DownloadClients), /api/resolver/logs
 * 5 s     /api/issues, /api/perf (PerfReporter, POST), /api/plex/activity
 *         (Topbar, admin — présent sur toutes les pages)
 * 10 s    /api/history, /api/stream/{ratingKey}/progress (VideoPlayer saveProgress)
 * 15 s    /api/tasks (TasksPanel)
 * 6 h     /api/system/update (Sidebar — négligeable, listé par précaution)
 * SSE     /api/events (keepalive, connexion ouverte en permanence)
 */
const POLL_PREFIXES = [
  "/api/activity",
  "/api/cache",
  "/api/diagnostic",
  "/api/engine",
  "/api/events",
  "/api/history",
  "/api/issues",
  "/api/jobs",
  "/api/library/rename",
  "/api/notifications",
  "/api/playback",
  "/api/plex/activity",
  "/api/resolver",
  "/api/settings",
  "/api/stream",
  "/api/system",
  "/api/tasks",
  "/api/watch-status",
];

/** POST silencieux du frontend (PerfReporter envoie ses mesures toutes les 5 s). */
const SILENT_MUTATION_PREFIXES = ["/api/perf"];

/** POST de sauvegarde de progression du player (VideoPlayer, toutes les 10 s). */
const PROGRESS_POST_RE = /^\/api\/stream\/[^/]+\/progress$/;

/**
 * La requête représente-t-elle une vraie interaction utilisateur ?
 * - Mutation (POST/PUT/DELETE…) : un bouton cliqué → OUI, sauf poll silencieux
 *   (/api/perf, progression de lecture).
 * - GET : navigation/recherche/content → OUI, sauf si c'est un endpoint de
 *   polling (POLL_PREFIXES). Une page laissée ouverte ne doit jamais maintenir
 *   l'activité à elle seule : la lecture = inactivité, la reprise de l'arrêt
 *   de l'arrière-plan se fait donc 4 s après le dernier clic réel.
 */
export function isUserInteraction(pathname: string, method: string): boolean {
  if (method !== "GET") {
    return (
      !SILENT_MUTATION_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !PROGRESS_POST_RE.test(pathname)
    );
  }
  return !POLL_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Enregistre une interaction utilisateur — appelé par requireUser/requireAdmin
 * avec l'utilisateur authentifié (nom + id) : c'est lui que les logs de
 * ralentissement désigneront.
 */
export function markUserActivity(user?: { id: string; username: string }) {
  g.__movvizLastUserActivity = { at: Date.now(), user: user ?? null };
}

/** Un utilisateur a-t-il interagi dans les ACTIVE_WINDOW_MS dernières ms ? */
export function isUserActive(): boolean {
  const last = g.__movvizLastUserActivity;
  if (last == null) return false;
  return Date.now() - last.at < ACTIVE_WINDOW_MS;
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/**
 * Cède la main à l'utilisateur : si personne n'a interagi depuis
 * IDLE_RESUME_MS, retour immédiat (coût nul — un simple check de timestamp,
 * utilisé à chaque itération de boucle). Sinon, dort par pas de
 * YIELD_STEP_MS jusqu'à ce qu'il y ait IDLE_RESUME_MS d'inactivité, plafonné
 * à MAX_YIELD_MS au total. La condition relit le timestamp à chaque pas :
 * si l'utilisateur continue de cliquer, le yield se prolonge (jusqu'au
 * plafond) au lieu de repartir en pleine activité.
 *
 * Un épisode de ralentissement réel (attente > 0) est tracé dans le log de
 * diagnostic : contexte de la tâche bridée, utilisateur actif et durée.
 * `context` est un libellé court et lisible (ex: "bulk manquants").
 */
export async function yieldToUser(context?: string): Promise<void> {
  const last = g.__movvizLastUserActivity;
  if (last == null || Date.now() - last.at >= IDLE_RESUME_MS) return;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    if (now - g.__movvizLastUserActivity!.at >= IDLE_RESUME_MS) break;
    if (now - start >= MAX_YIELD_MS) break;
    await new Promise<void>((resolve) => setTimeout(resolve, YIELD_STEP_MS));
  }
  const waited = Date.now() - start;
  const who = last.user ? `${last.user.username} (id:${last.user.id})` : "inconnu";
  recordSearchLog(
    "info",
    "priority.yield",
    `Arrière-plan bridé${context ? ` [${context}]` : ""} pendant ${formatDuration(waited)} par l'utilisateur actif ${who}`
  );
}
