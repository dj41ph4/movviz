/**
 * Réparation ciblée d'un compte contaminé (phase 15 du plan de
 * finalisation watch-state, §92-98) — jamais automatique, jamais globale.
 *
 * Ce script ne touche QUE la projection JSON (plex-watch-status.json).
 * Il ne touche JAMAIS le ledger SQLite (context_events) ni l'état courant
 * (user_media_state) : ces tables sont indexées par userId, et si deux
 * comptes ont historiquement partagé le même userId (bug corrigé, voir
 * randomUUID() dans src/lib/auth/store.ts), on ne peut pas savoir après
 * coup quels événements appartiennent à qui. Les mélanger serait pire que
 * les laisser en l'état — on se contente de signaler l'ambiguïté.
 *
 * Étapes :
 *   1. Backup horodaté de plex-watch-status.json, users.json et
 *      user-context.sqlite (si présent) avant toute modification.
 *   2. Vide la projection JSON du compte ciblé (films/épisodes vus).
 *   3. Avertit si le compte a des lignes SQLite (context_events /
 *      user_media_state) : ambiguïté non résolue, à signaler à
 *      l'utilisateur, jamais à effacer automatiquement ici.
 *   4. Relance une synchro Plex fraîche pour reconstruire depuis la
 *      source de vérité (l'historique réel du compte Plex de l'utilisateur).
 *
 * Usage (dry-run par défaut — n'écrit rien) :
 *   node --experimental-transform-types --no-warnings \
 *     --import ./scripts/movviz-test-loader.mjs \
 *     scripts/repair-watch-user-contamination.ts --user <userId>
 *
 * Pour appliquer réellement (après avoir confirmé la collision avec
 * scripts/audit-watch-user-contamination.ts) :
 *   ... scripts/repair-watch-user-contamination.ts --user <userId> --apply
 */
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, USERS_FILE, getUserById } from "@/lib/auth/store";
import { getWatchStatus, clearWatchStatusForUser, PLEX_WATCH_STATUS_FILE } from "@/lib/plex/watchStore";
import { syncUserWatchStatus } from "@/lib/plex/watchSync";
import { withUserContextDb, getUserContextHealth, USER_CONTEXT_DB_FILE } from "@/lib/userContext/database";

function parseArgs(argv: string[]): { userId: string | null; apply: boolean } {
  let userId: string | null = null;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--user") userId = argv[++i] ?? null;
    else if (argv[i] === "--apply") apply = true;
  }
  return { userId, apply };
}

function countContextEvents(userId: string): number {
  return withUserContextDb((db) => {
    const row = db.prepare("SELECT COUNT(*) as c FROM context_events WHERE user_id = ?").get(userId) as { c: number };
    return row.c;
  }, -1);
}

function countUserMediaState(userId: string): number {
  return withUserContextDb((db) => {
    const row = db.prepare("SELECT COUNT(*) as c FROM user_media_state WHERE user_id = ?").get(userId) as { c: number };
    return row.c;
  }, -1);
}

function backupFile(filePath: string, backupDir: string): void {
  if (!fs.existsSync(filePath)) return;
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(filePath, path.join(backupDir, path.basename(filePath)));
}

async function main() {
  const { userId, apply } = parseArgs(process.argv.slice(2));
  if (!userId) {
    console.error("Usage: repair-watch-user-contamination.ts --user <userId> [--apply]");
    process.exit(1);
  }

  const user = getUserById(userId);
  if (!user) {
    console.error(`Aucun utilisateur avec l'id ${userId}.`);
    process.exit(1);
  }

  console.log(`Compte ciblé : ${user.username} (${user.id}, plexId:${user.plexId ?? "-"})`);
  console.log(apply ? "MODE : APPLICATION RÉELLE" : "MODE : DRY-RUN (aucune écriture — relancer avec --apply pour agir)");
  console.log("");

  const before = getWatchStatus(user.id);
  console.log(`Avant réparation : ${before?.movies.length ?? 0} films vus, ${before?.episodes.length ?? 0} épisodes vus (projection JSON).`);

  const engineOk = getUserContextHealth().database === "ok";
  const eventCount = engineOk ? countContextEvents(user.id) : -1;
  const stateCount = engineOk ? countUserMediaState(user.id) : -1;
  if (eventCount > 0 || stateCount > 0) {
    console.log("");
    console.log(`⚠ AMBIGUÏTÉ NON RÉSOLUE : ${eventCount} événement(s) dans le ledger SQLite et ${stateCount} ligne(s) d'état courant existent pour cet id.`);
    console.log("  Ce script ne les touche PAS (voir en-tête). Si ces lignes appartiennent réellement à la");
    console.log("  contamination (partage d'id historique avec un autre compte), elles resteront visibles via");
    console.log("  /api/watch-status (lecture canonique SQLite) même après le nettoyage JSON ci-dessous, jusqu'à");
    console.log("  ce qu'une nouvelle décision (resync Plex) les remplace pour ce tmdbId précis.");
  } else if (!engineOk) {
    console.log("");
    console.log("⚠ Moteur SQLite indisponible dans cet environnement : impossible de vérifier context_events/user_media_state.");
  }

  if (!apply) {
    console.log("");
    console.log("Dry-run terminé. Aucune modification effectuée. Relancer avec --apply pour réparer réellement ce compte.");
    return;
  }

  const backupDir = path.join(CONFIG_DIR, "backups", `repair-${user.id}-${Date.now()}`);
  console.log("");
  console.log(`Backup avant modification -> ${backupDir}`);
  backupFile(PLEX_WATCH_STATUS_FILE, backupDir);
  backupFile(USERS_FILE, backupDir);
  backupFile(USER_CONTEXT_DB_FILE, backupDir);

  const cleared = clearWatchStatusForUser(user.id);
  console.log(`Projection JSON vidée : ${cleared.moviesCleared} film(s), ${cleared.episodesCleared} épisode(s) retirés.`);

  console.log("Resynchronisation Plex en cours...");
  try {
    await syncUserWatchStatus(user);
    console.log("Resynchronisation terminée.");
  } catch (error) {
    console.error("La resynchronisation Plex a échoué :", error);
    console.error("La projection JSON reste vide pour ce compte tant qu'une synchro (planifiée ou manuelle) ne réussit pas.");
  }

  const after = getWatchStatus(user.id);
  console.log("");
  console.log(`Après réparation : ${after?.movies.length ?? 0} films vus, ${after?.episodes.length ?? 0} épisodes vus (projection JSON).`);
  console.log(`Backup conservé dans : ${backupDir}`);
}

main();
