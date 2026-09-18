/**
 * Diagnostic ponctuel, LECTURE SEULE (phase 14 du plan de finalisation
 * watch-state, 2026-09) — aucune modification de données, jamais.
 *
 * Produit, pour chaque compte Movviz :
 *   - identité (id, username, plexId, plexManagedUserId)
 *   - nombre de films/épisodes vus (JSON legacy, plex-watch-status.json)
 *   - nombre d'événements dans le ledger (context_events)
 *   - nombre de lignes d'état courant (user_media_state)
 *   - collisions possibles : deux comptes DIFFÉRENTS dont les listes de
 *     films vus sont IDENTIQUES (pas juste de même taille — comparaison
 *     réelle du contenu) sont signalés comme suspects, exactement le
 *     symptôme de la collision d'id réelle trouvée en production
 *     (issah7130/gmpm78, 138 films / 4753 épisodes chacun).
 *
 * Usage (depuis la racine du dépôt, ou sur le NAS avec les mêmes variables
 * d'environnement que le serveur en production — MOVVIZ_CONFIG_DIR /
 * MOVVIZ_DATA_DIR) :
 *
 *   node --experimental-transform-types --no-warnings \
 *     --import ./scripts/movviz-test-loader.mjs \
 *     scripts/audit-watch-user-contamination.ts
 *
 * Ce script ne répare rien — voir docs/WATCH_STATE_FINALIZATION.md pour la
 * procédure de réparation manuelle par compte une fois une collision
 * confirmée (§93-97 du plan : backup, scope précis, resync, rapport).
 */
import { loadUsers } from "@/lib/auth/store";
import { getWatchStatus } from "@/lib/plex/watchStore";
import { withUserContextDb, getUserContextHealth } from "@/lib/userContext/database";

interface UserRow {
  id: string;
  username: string;
  plexId: string | null;
  plexManagedUserId: string | null;
  movieCount: number;
  episodeCount: number;
  contextEventCount: number;
  userMediaStateCount: number;
  moviesSignature: string; // tmdbId triés, joints — pour détecter une identité de contenu, pas juste de taille
}

function countContextEvents(userId: string): number {
  return withUserContextDb((db) => {
    const row = db.prepare("SELECT COUNT(*) as c FROM context_events WHERE user_id = ?").get(userId) as { c: number };
    return row.c;
  }, -1); // -1 = moteur indisponible, distinct de 0 réel
}

function countUserMediaState(userId: string): number {
  return withUserContextDb((db) => {
    const row = db.prepare("SELECT COUNT(*) as c FROM user_media_state WHERE user_id = ?").get(userId) as { c: number };
    return row.c;
  }, -1);
}

function main() {
  const engineOk = getUserContextHealth().database === "ok";
  console.log(`Moteur de contexte SQLite : ${engineOk ? "disponible" : "INDISPONIBLE — les comptes d'événements/état seront à -1"}`);
  console.log("");

  const users = loadUsers();
  const rows: UserRow[] = users.map((u) => {
    const status = getWatchStatus(u.id);
    const movies = status?.movies ?? [];
    return {
      id: u.id,
      username: u.username,
      plexId: u.plexId,
      plexManagedUserId: u.plexManagedUserId,
      movieCount: movies.length,
      episodeCount: status?.episodes.length ?? 0,
      contextEventCount: countContextEvents(u.id),
      userMediaStateCount: countUserMediaState(u.id),
      moviesSignature: [...movies].sort((a, b) => a - b).join(","),
    };
  });

  console.log("=== Table par compte ===");
  console.log("id | username | plexId | plexManagedUserId | films vus | épisodes vus | événements ledger | lignes état courant");
  for (const r of rows) {
    console.log(`${r.id} | ${r.username} | ${r.plexId ?? "-"} | ${r.plexManagedUserId ?? "-"} | ${r.movieCount} | ${r.episodeCount} | ${r.contextEventCount} | ${r.userMediaStateCount}`);
  }

  console.log("");
  console.log("=== Collisions possibles (comptes distincts, même id, ou même contenu exact) ===");

  // 1) Collision d'id littérale (le bug déjà corrigé — vérifie qu'aucune
  //    trace résiduelle ne subsiste dans users.json lui-même).
  const idCounts = new Map<string, number>();
  for (const u of users) idCounts.set(u.id, (idCounts.get(u.id) ?? 0) + 1);
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);
  if (duplicateIds.length > 0) {
    console.log("⚠ COLLISION D'ID LITTÉRALE DÉTECTÉE (users.json) :");
    for (const [id] of duplicateIds) console.log(`  - ${id} apparaît ${idCounts.get(id)} fois dans users.json`);
  } else {
    console.log("Aucune collision littérale d'id dans users.json (attendu après le correctif randomUUID()).");
  }

  // 2) Contenu de films vus rigoureusement identique entre deux comptes
  //    différents ET non vide — c'est le symptôme réel observé en
  //    production (mêmes 138 films pour deux comptes distincts).
  const bySignature = new Map<string, UserRow[]>();
  for (const r of rows) {
    if (!r.moviesSignature) continue; // liste vide : rien à comparer, pas suspect
    const list = bySignature.get(r.moviesSignature) ?? [];
    list.push(r);
    bySignature.set(r.moviesSignature, list);
  }
  const suspicious = [...bySignature.values()].filter((list) => list.length > 1);
  if (suspicious.length === 0) {
    console.log("Aucun contenu de films vus identique entre deux comptes distincts.");
  } else {
    for (const group of suspicious) {
      console.log(`⚠ CONTENU IDENTIQUE (${group[0].movieCount} films) entre ${group.length} comptes distincts :`);
      for (const r of group) console.log(`  - ${r.username} (${r.id}, plexId:${r.plexId ?? "-"})`);
      console.log("  -> Répare un compte à la fois (§94 du plan) : ne jamais réinitialiser aveuglément les deux sans confirmer lequel des deux (voire aucun) reflète vraiment sa propre histoire Plex.");
    }
  }

  console.log("");
  console.log("Rappel : ce script ne modifie RIEN. Voir docs/WATCH_STATE_FINALIZATION.md pour la procédure de réparation manuelle.");
}

main();
