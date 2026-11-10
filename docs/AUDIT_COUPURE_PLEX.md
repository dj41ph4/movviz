# Audit « coupure de Plex » — 2026-11-10

## Méthode

Deux outils, tous deux rejouables :

| Outil | Rôle |
|---|---|
| `node scripts/plex-cut-audit.mjs [unconfigured\|refused\|hung\|all]` | Banc dynamique. Copie isolée de `.movviz-data`, session admin, bibliothèque de test, puis tous les `GET` de l'API (206), toutes les pages (35) et 58 parcours ciblés (lecture, vu, reprise, accueil, réglages Plex, connexion, santé). Rien ne touche aux vraies données. |
| `node scripts/plex-cut-static.audit.mjs` | Audit statique : appels Plex sans délai maximal, interface conditionnée à `plexUrl`/`plexRatingKey`, tâches planifiées, routes sans garde. |

Trois états de Plex testés :

- **unconfigured** : aucune liaison (pas de `plex.json`).
- **refused** : liaison conservée, serveur éteint (connexion refusée tout de suite).
- **hung** : liaison conservée, serveur qui accepte la connexion mais ne répond jamais (NAS gelé, pare-feu qui jette).

Bibliothèque de test : film et épisode **local + Plex**, **local seul**, **Plex seul** (chemin tel que Plex le voit, pas de fichier lisible).

## Verdict en une phrase

La lecture de fichiers locaux, le suivi « vu » et les tâches planifiées **survivent à la coupure**. Ce qui casse : **la connexion des comptes sans mot de passe**, **trois écrans qui se figent si Plex est gelé**, **les titres connus seulement de Plex**, et **« Reprendre » si la liaison est supprimée**.

## Résultats mesurés

| Scénario | Appels | 5xx / blocages | Lecture locale | Lecture « Plex seul » |
|---|---|---|---|---|
| unconfigured | 269 | 0 (1 blocage `perf/profile`, profileur volontairement long, sans rapport) | OK, 206 en 35-45 ms | impossible |
| refused | 269 | 0 réel (voir « erreurs 500 » plus bas) | OK, identique | impossible |
| hung | 269 | **3 blocages > 20 s** | OK, identique | impossible |

Lecture locale (info, octets avec `Range`, préparation moteur, ouverture de session), film **et** épisode : **identique dans les 3 scénarios**, aucune lenteur. Les pages (35) répondent toutes sans erreur. Aucune erreur non gérée dans les journaux serveur.

## Constats, du plus grave au moins grave

### 1. Comptes sans mot de passe verrouillés si la liaison disparaît — CRITIQUE
- `GET /api/auth/me` renvoie `plexLoginAvailable = hasAnyUser() && plexConfigured()` ; l'écran de connexion cache le bouton Plex sinon (`src/app/login/page.tsx:233`).
- `plexConfigured()` = hôte **et** jeton admin présents. Supprimer la liaison (ou perdre le jeton) cache le bouton.
- Copie locale de `.movviz-data` : **129 comptes sur 130 n'ont aucun mot de passe**. À recompter sur la prod.
- Repli existant mais facultatif : `POST /api/profile/local-login`.
- **Décision de l'utilisateur** : forcer pseudo + mot de passe local à la prochaine connexion (mémoire `project-force-local-password`). **Non implémenté.**
- Même sans supprimer la liaison : la connexion Plex passe par plex.tv (pas par le serveur), mais un compte **nouveau** exige d'être dans la liste de partage du serveur (`getPlexServerAccounts`), donc **plus aucune inscription par Plex** serveur éteint (échec fermé, voulu).

### 2. Trois routes qui se figent si Plex est gelé — ÉLEVÉ
| Route | Cause | Effet |
|---|---|---|
| `POST /api/plex/test` | `testPlexServer` : `fetch` sans délai (`client.ts:358`) | bouton « Tester » bloqué > 25 s |
| `GET /api/plex/accounts` | `fetch` sans délai (`client.ts:260`, plex.tv `shared_servers`) + serveur | écran de comptes bloqué |
| `GET /api/metadata/collection` | `getPlexCollections` appelé tant que `plexConfigured()` est vrai | **page Collections bloquée** |

Treize appels réseau Plex n'ont pas de délai maximal (liste complète : `node scripts/plex-cut-static.audit.mjs`, section A) : `client.ts` lignes 59, 74, 98, 112, 134, 155, 260, 313, 334, 358, `plexUserContext.ts:497`, `avatarSync.ts` (2), `stream/plex-proxy/.../route.ts:150`. Les appels plex.tv sont sur le chemin de la **connexion** (`checkPin`, `getPlexAccount`).

### 3. Titres connus seulement de Plex — ÉLEVÉ (dépend des données prod)
Un film ou épisode sans fichier lisible depuis le conteneur (chemin enregistré tel que Plex le voit, sans correspondance apprise) :
- `GET /api/stream/local/<id>/info` annonce `"playable": true`, `source: "plex"` ;
- mais les octets répondent 409 et la préparation moteur 404 (`plex_raw_source_unavailable`).
Le bouton Lecture s'affiche donc, puis la lecture échoue. À mesurer sur la prod : nombre de titres avec `plexRatingKey` et **sans** fichier lisible (aucun outil ne le donne aujourd'hui).

### 4. « Reprendre » sans liaison — MOYEN (seulement si la liaison est supprimée)
- `onDeckService.ts` calcule `plexUrl` avec le `machineIdentifier` de la config. Sans liaison : `plexUrl = null`.
- `DashboardRows.tsx:358` et `LibraryRecommendedRows.tsx:110` n'activent la lecture que si `plexRatingKey && plexUrl`. Résultat attendu : cartes sans lecture ni menu « marquer vu ».
- Liaison **conservée** mais serveur éteint : non touché (le `machineIdentifier` reste dans `plex.json`).
- Établi par lecture du code ; non reproduit en direct (une position de reprise exige 60 s de lecture réelle).

### 5. Erreurs 500 là où 502/503 conviendrait — FAIBLE
`/api/stream/<clé>/info`, `/transcode` et `/<clé>` renvoient **500 `invalid_plex_url`** quand Plex est configuré mais éteint (400 propre quand Plex n'est pas lié). À confirmer : sur le banc, Plex est en `127.0.0.1`, que la garde SSRF peut refuser ; peut être un artefact.

### 6. Faux ami d'interface — FAIBLE
Les boutons « Ouvrir dans Plex » (`VideoPlayer.tsx:2917`, `:2969`, fiche titre, héros) restent affichés serveur éteint et mènent à une page morte.

## Fonctions qui disparaissent par nature (sans action possible)

Marqueurs d'intro/générique issus de Plex (repli IntroDB existant, réglage « API uniquement »), import de l'historique Plex, synchro des listes de suivi plex.tv, « Reprendre » alimenté par Plex, avatars Plex, rangées de collections Plex.

## Ce qui a été vérifié sain

- Aucune liaison : 0 erreur 5xx sur l'API et les pages.
- Tâches planifiées : `plex-library-sync`, `plex-marker-sync`, `plex-watch-sync`, `plex-watch-bootstrap`, `plex-full-reconcile` ont une garde `plexConfigured()`. Exception : `plex-watchlist-sync` (parle à plex.tv, pas au serveur ; `retryPendingPlexWatchedState` sans garde).
- Marquer vu / non vu, ouverture de session de lecture, historique, statuts : OK dans les 3 scénarios (la poussée vers Plex est en arrière-plan, sans bloquer).
- Disjoncteur par utilisateur (`plexCircuitBreaker`) présent pour la synchro de vus.

## Limites de cet audit

- Données : copie de la base de **développement**, pas de la prod (bibliothèque réelle absente, un seul compte avec mot de passe).
- Interface : routes et pages interrogées, **aucun clic** dans un navigateur ; constat 4 déduit du code.
- plex.tv ne peut pas être coupé sur ce banc (donc la connexion Plex sans internet n'est pas testée).
- Clients **Android mobile, Android TV NX, Samsung Tizen non audités** : ils consomment les mêmes routes, mais leurs écrans n'ont pas été passés en revue.

## Avant la coupure : liste de contrôle

1. Faire définir un mot de passe local à **tous** les comptes (constat 1).
2. Ne **pas** supprimer `plex.json` / la liaison : éteindre seulement le serveur évite les constats 1 et 4.
3. Corriger les 3 routes qui figent (constat 2) : délai de 8-10 s partout.
4. Mesurer les titres « Plex seul » sur la prod (constat 3) et compléter les correspondances de chemins.
5. Relancer `scripts/plex-cut-audit.mjs all` après correction : attendu 0 blocage.
