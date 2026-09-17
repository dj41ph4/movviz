# Centralisation du statut « vu / non vu » — résumé de la refonte

> Corrige le bug rapporté : une resynchronisation Plex tardive pouvait
> ressusciter un titre marqué « non vu » manuellement, parce qu'aucune des
> trois couches d'écriture (JSON legacy, bridge SQLite, backfill legacy)
> ne comparait réellement les dates avant d'écrire.

## Ce qui a été réutilisé (REUSE)

- `user_media_state` (SQLite) — schéma déjà quasi complet (`watched`,
  `watched_at`, `watched_updated_at`, `watched_source`) ; le mécanisme de
  migration idempotent (`additions` + `PRAGMA table_info`) était déjà en
  place et a servi tel quel pour la v4.
- `context_events` — ledger append-only déjà correct, dédupliqué par
  `(source, source_event_id)`, avec les event types `watched_marked`/
  `watched_unmarked` déjà présents.
- `getWatchStatus`/`setWatchedMovies`/`setWatchedEpisodes` — signatures
  publiques conservées à l'identique (un paramètre `source` optionnel
  ajouté en fin de liste, avec valeur par défaut, donc aucun appelant
  existant n'est cassé).
- `user_media_sync_state`/`syncState.ts` — table et capacités déjà prêtes
  pour le suivi Plex sortant, jamais utilisées pour `watched` avant.

## Ce qui a été modifié (MODIFY)

- **`src/lib/userContext/watchBridge.ts`** — remplace les deux upserts SQL
  à base de `CASE WHEN` répété 5 fois par une seule fonction
  `applyWatchDecision()` : lecture de l'état courant, comparaison
  `occurredAt` (LWW), tie-break par table de priorité explicite (fini le
  tri alphabétique accidentel sur `watched_source`), écriture atomique.
  Corrige aussi le hardcode `watched_source = 'watch_store'` qui perdait
  l'origine réelle de chaque décision.
- **`src/lib/userContext/ingest.ts`** — corrige un vrai bug d'un caractère
  (`upsertUserMediaState`) : la branche gagnante de la comparaison LWW
  écrivait `excluded.watched_updated_at` (un timestamp) dans la colonne
  `watched_source` au lieu de `excluded.watched_source`.
- **`src/lib/plex/watchStore.ts`** — `setWatchedMovies`/`setWatchedEpisodes`
  appellent désormais `applyWatchDecision()` en premier ; le JSON local
  n'est modifié QUE si la décision est acceptée. `mergePlexWatchedState()`
  ne fait plus un merge additif aveugle : elle revérifie l'état canonique
  courant via `getCurrentWatchState()` avant de refléter quoi que ce soit
  (garde-fou valable même si un futur appelant oublie de filtrer en amont
  — trouvé en testant l'intégration réelle, pas seulement le resolver).
- **`src/lib/plex/watchSync.ts`** — remplace l'ancien double-écriture
  (ledger brut par ligne + merge JSON séparé sans LWW) par un seul passage :
  chaque ligne d'historique Plex passe par `applyWatchDecision()` (triées
  du plus ancien au plus récent), puis seules les entrées acceptées sont
  reflétées dans le JSON via `mergePlexWatchedState()`.
- **`src/lib/userContext/bootstrap.ts`** — `syncLegacyWatchedState()` ne
  force plus `watched=1` sans condition : uniquement si aucune décision
  canonique n'existe déjà (`watched_updated_at IS NULL`), pour ne jamais
  écraser une décision réelle (y compris UNWATCHED) avec un backfill
  best-effort du JSON legacy.
- **`src/lib/plex/watchWrite.ts`** — `pushMovieWatchedToPlex`/
  `pushEpisodesWatchedToPlex` écrivent enfin dans `user_media_sync_state`
  (SYNCED/ERROR + ack), là où seul un log diagnostique existait avant.
- Callers réels mis à jour avec leur vraie origine (`source`) : lecteur
  (`movviz_playback`), import Netflix (`external_import`), actions IA
  (`ai`) — le toggle manuel et le batch saison/série gardent le défaut
  `movviz_manual`.

## Ce qui a été supprimé (DELETE)

- `syncWatchedMovieState`/`syncWatchedEpisodeState` (les deux upserts SQL
  à CASE répétés) — remplacées par `applyWatchDecision()`, leur unique
  appelant a été migré.

## Ce qui reste volontairement legacy pour l'instant

- `plex-watch-status.json` reste la structure activement lue par
  `getWatchStatus()` (façade), mais n'est plus jamais mutée en dehors d'une
  décision acceptée par le resolver SQL — dans les faits, c'est déjà une
  projection du canonique, pas encore renommée/déplacée (§79 du plan :
  « ne pas renommer massivement au début »).
- `progressStore.ts`'s `plex.pendingAction` reste un champ non lu ailleurs
  (dead code déjà présent avant cette refonte) — non touché, hors du
  scope du bug rapporté.
- Aucune migration one-off écrite : le backfill lazy existant
  (`refreshLegacyUserContext`), maintenant non-destructif, couvre déjà le
  rattrapage progressif des données antérieures à la SQLite bridge.

## Tests

- `scripts/watch-decision.test.ts` — 8 tests unitaires sur
  `applyWatchDecision()` : le scénario exact du bug (§71 du plan), égalité
  stricte de timestamp/priorité, idempotence, isolation multi-utilisateur,
  granularité épisode.
- `scripts/watch-store-plex-merge.test.ts` — 3 tests d'intégration sur
  `mergePlexWatchedState()`, dont la régression trouvée en testant le flux
  réel (le garde-fou `getCurrentWatchState`).
- 443/443 tests existants + nouveaux au vert (stable sur 2 exécutions
  consécutives), typecheck propre, build Next.js OK.
- Reproduction manuelle en direct du scénario complet du plan (Plex T1 →
  unwatch manuel T2 → resync Plex périmé T1 rejeté → vrai revisionnage
  Plex T3 accepté) — confirmée par script, cf. historique de session.

## Risques restants

- Aucune migration de masse exécutée sur des données de production
  existantes — le backfill reste lazy/progressif par design du plan (§47).
- `mergePlexWatchedState`/`applyWatchDecision` n'utilisent pas de
  transaction SQL explicite (BEGIN/COMMIT) — acceptable dans ce modèle
  Node mono-thread synchrone (aucune autre requête ne peut s'intercaler),
  mais une future migration vers un runtime multi-thread devrait
  reconsidérer ce point.
- Le sélecteur de région (session précédente) et cette refonte watched ont
  été livrés dans deux branches séparées ; à fusionner dans l'ordre pour
  éviter un conflit sur `watchStore.ts`/`watchBridge.ts` si les deux
  évoluent encore en parallèle.
