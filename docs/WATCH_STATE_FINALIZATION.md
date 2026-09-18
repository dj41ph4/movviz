# Finalisation du statut « vu / non vu » — bilan

> Suite directe de [WATCH_STATE_CANONICAL_REFACTOR.md](./WATCH_STATE_CANONICAL_REFACTOR.md).
> Ce document couvre le plan de finalisation (branche
> `claude/watch-state-finalization`) : transactions atomiques, lecture
> canonique côté API, outbox Plex durable, réparation de la contamination
> inter-comptes trouvée en production, et badge « vu » Android.

## Bilan par phase

| Phase | Sujet | Statut |
|---|---|---|
| 1-2 | Tie-break par `watched_event_id` (pas `watched_source`) | ✅ FAIT |
| 3 | Transaction explicite `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` dans `applyWatchDecision` | ✅ FAIT |
| 4 | Lecture canonique SQLite pour `/api/watch-status` (`getCanonicalWatchStatus`) | ✅ FAIT |
| 5 | Normalisation des sources dans `recordWatched`/callers (`movviz_manual`, `movviz_playback`, `external_import`, `ai`) | ✅ FAIT (session précédente) |
| 6-9 | Outbox Plex durable (réutilise `user_media_sync_state`), retry via scheduler | ✅ FAIT |
| 10-11 | Détection Plex entrant d'un « Marquer non vu » (spike) | 🚫 BLOQUÉ — voir ci-dessous |
| 12-13 | Badge « vu » sur les affiches Android (mobile-nx + tv-nx) | ✅ FAIT — scope V1 films uniquement |
| 14-15 | Outil de diagnostic + réparation de la contamination inter-comptes | ✅ FAIT |
| 16 | Démotion complète du JSON legacy (`plex-watch-status.json`) | ⏸️ PARTIEL — voir ci-dessous |
| 17 | Nettoyage de code mort supplémentaire | ✅ FAIT — rien trouvé au-delà de ce qui était déjà supprimé |
| 18-19 | Matrice de tests / tests de chaos | ✅ FAIT — 462 tests verts, atomicité + fail-open couverts |
| 20 | Test live multi-utilisateur sur serveur Plex réel | 🚫 BLOQUÉ — nécessite accès Plex de production |
| 21-23 | Docs, version/changelog, audit final | ✅ CE DOCUMENT |

## Phase 10-11 — détection Plex entrante « non vu » (BLOQUÉ)

Impossible à finaliser depuis cet environnement de développement : Plex ne
notifie jamais Movviz d'un événement « Marquer comme non vu » côté client
(pas de webhook pour cette action précise, contrairement à `media.scrobble`).
La seule voie possible est un polling périodique de l'historique de visionnage
et une comparaison avec l'état canonique — mais vérifier que Plex *cesse*
de renvoyer un item dans l'historique après un « non vu » manuel nécessite
un vrai serveur Plex de production et un clic humain réel dans l'interface
Plex, qu'aucun script ne peut simuler de façon fiable (l'historique de
visionnage Plex n'est pas un journal d'événements — un item disparu peut
aussi bien signifier « non vu » que « purge de rétention d'historique »).

**Procédure de test manuel à faire (une seule fois, en production) :**
1. Marquer un film comme vu dans Movviz (source `movviz_manual`).
2. Vérifier qu'il apparaît bien comme vu dans Plex (`Réglages → Journaux`,
   tag `plex.watchWrite`, capability `SYNCED`).
3. Dans Plex, cliquer « Marquer comme non vu » sur ce même film.
4. Attendre le prochain passage de `plex-watch-sync` (toutes les 2h, ou
   forcer la tâche planifiée) et vérifier dans Movviz si le statut change.
5. Signaler le résultat — s'il ne change pas (cas attendu avec le code
   actuel, qui ne fait qu'ingérer l'historique de *visionnage*, jamais les
   « non-vu »), la phase 10-11 nécessitera un futur chantier dédié
   (webhook Plex plus riche, ou scan différentiel de bibliothèque).

## Phase 16 — démotion du JSON legacy (PARTIEL, décision assumée)

Le chemin de lecture côté client (`/api/watch-status`) est déjà canonique
(SQLite d'abord, JSON en repli uniquement si le moteur est indisponible —
phase 4). En revanche, `plex-watch-status.json` reste lu directement par
**23 fichiers** côté serveur, en particulier tout le moteur de
recommandation (`seedBuilder.ts`, `becauseYouWatched.ts`,
`providerPersonalized.ts`, `engine.ts`, `taste.ts`), l'IA (`contextBuilder.ts`,
`profile.ts`, `recommendationScore.ts`) et le dashboard
(`suggestionEngine.ts`).

**Décision assumée dans cette session** : ne pas réécrire ces 23 call sites
pour lire directement `user_media_state`/`context_events`. Risque de
régression bien supérieur au bénéfice immédiat — ce JSON est déjà, dans les
faits, une projection fidèle du canonique (il n'est plus jamais muté en
dehors d'une décision acceptée par `applyWatchDecision`, cf. refonte
précédente), donc aucun de ces 23 appelants ne peut aujourd'hui lire une
donnée incohérente avec le canonique. La bascule complète reste possible
plus tard, fichier par fichier, sans urgence.

## Contamination inter-comptes — outils livrés

- `scripts/audit-watch-user-contamination.ts` — diagnostic lecture seule,
  détecte un contenu vu strictement identique entre deux comptes distincts
  (le symptôme exact observé en production : 138 films / 4753 épisodes
  partagés entre deux comptes).
- `scripts/repair-watch-user-contamination.ts` — réparation par compte,
  dry-run par défaut (`--apply` requis), sauvegarde les 3 fichiers concernés
  avant toute écriture, ne touche jamais le ledger SQLite (ambiguïté
  signalée, jamais résolue arbitrairement), relance une synchro Plex neuve
  après nettoyage.
- Cause racine déjà corrigée (session précédente) : génération d'id
  utilisateur faible (`Date.now()+Math.random()`) remplacée par
  `randomUUID()` partout, plus un garde-fou `addUser()` qui lève une
  exception sur collision d'id.

**Action encore nécessaire côté exploitation** : lancer l'audit en
production (mêmes variables d'environnement que le serveur), puis si
issah7130/gmpm78 (ou tout autre compte) sont confirmés contaminés, lancer
la réparation avec `--apply` pour CHACUN séparément.

## Badge « vu » Android (phase 12-13)

Ajouté dans `android-mobile-nx` et `android-tv-nx` : pastille cercle-dégradé
(même langage visuel que le badge existant sur `EpisodeCard` en fiche
titre) sur les cartes films de l'accueil, Découvrir, Catalogue, « Voir
tout », filmographie et recherche. **Scope V1 volontairement limité aux
films** : aucune donnée client ou serveur n'existe aujourd'hui pour savoir
si une série entière est vue sans charger tous ses épisodes (coût réseau
prohibitif) — badger les séries en grille nécessiterait un agrégat serveur
dédié, hors scope de ce chantier.

## Tests

462/462 tests verts (`npm test`), typecheck propre, build Next.js OK,
compilation Kotlin réelle (`./gradlew :app:compileDebugKotlin`) réussie sur
les deux apps Android.
