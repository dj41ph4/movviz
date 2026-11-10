# Audit PROD — serveur Plex coupé (2026-11-10)

Prod : version 1.28.112 au début, redéployée en 1.28.113 pendant l'audit. Compte utilisé : « test » (administrateur). Plex : `10.0.0.49:32400`, éteint (connexion refusée), liaison conservée.

## Verdict

**Tout ce qui est lecture, reprise, tableau de bord, routes et pages fonctionne sans Plex.** Un seul vrai défaut trouvé et corrigé dans le code (film local absent de « Reprendre »). Quatre points à connaître avant de supprimer la liaison.

## Ce qui a été testé

| Test | Résultat |
|---|---|
| Bibliothèque : 2 461 films avec fichier, interrogés un par un (`/api/stream/local/<id>/info`) | **2 461 / 2 461 lisibles en local** (`source: movviz`), 0 lent, max 830 ms |
| 15 films au hasard : infos, octets en début et au milieu (`Range`), préparation du moteur | **15 / 15 OK** (mode DIRECT_STREAM), 13 à 50 ms |
| 15 épisodes au hasard (14 liés à Plex, 1 local seul) | **15 / 15 OK** (13 DIRECT_STREAM, 2 TRANSCODE) |
| 10 films ajoutés le plus récemment (sonde ffprobe à froid) | 14 / 14 OK, 80 à 534 ms : la sonde marche sur les nouveautés |
| Sélection d'un sous-titre (texte) : 13 pistes sur 5 films | toutes OK ; image (PGS) → transcodage avec incrustation, OK |
| Lecture réelle dans l'interface : film (Esther, sans clé Plex) | image qui avance, 98 s de tampon, 0 erreur |
| Saut dans la timeline (40 %) | OK, reprend à 49:25 |
| Lecture réelle : épisode lié à Plex (Grimm S1E12), épisode local seul (Haunted Hotel S1E6) | OK ; menus Audio et Sous-titres présents ; choix d'un sous-titre OK |
| 107 routes `GET` de l'API | 103 en 200, 2 en 400 (paramètre manquant, normal), 1 en 401, 1 blocage (voir plus bas) |
| 28 pages | toutes répondent |
| Tâches planifiées Plex | `plex-library-sync` (1,2 s), `plex-watch-sync`, `plex-watchlist-sync` s'exécutent sans erreur ; échec rapide, pas de blocage |

## Constats

### 1. Film local sans clé Plex absent de « Reprendre » — CORRIGÉ (non commité)
Esther (aucune clé Plex) : lu 60 s, position bien enregistrée (`/api/playback/continue-watching` la renvoie en premier), **mais absente de la rangée « Reprendre »** (`/api/plex/on-deck` : 5 entrées, pas elle).
Cause : `src/lib/plex/onDeckService.ts` cherchait le film par `getMovieByPlexRatingKey(p.ratingKey)`. Un film jamais vu par Plex est suivi sous son id Movviz (`mv_…`) : la recherche échouait, l'entrée était écartée. **Indépendant de la coupure** : concerne aujourd'hui 46 films de la bibliothèque (avec fichier, sans clé Plex), et tout futur ajout hors Plex. Cas typique de la règle « Plex optionnel » : les épisodes passaient, pas les films.
Correctif : repli sur `mediaId` puis sur l'id (3 lignes). Test `scripts/on-deck-local-movie.test.ts` : échoue sans le correctif, passe avec ; les 3 autres tests « on-deck » passent toujours (12 / 12).

### 2. Réglages affichent « Plex : Connecté » alors qu'il est éteint — À CORRIGER
`/api/plex/config` renvoie `connected: !!cfg.adminToken` (`src/app/api/plex/config/route.ts:16`) : c'est « un jeton existe », pas « le serveur répond ». Le bouton « Tester » dit bien `{"ok":false}` en 63 ms. L'administrateur ne voit aucune alerte ; aucune notification n'est émise quand les synchronisations Plex échouent en silence.

### 3. Comptes sans mot de passe — RISQUE si la liaison est supprimée
19 comptes : **15 sans mot de passe local, tous Plex-only** (dont **2 des 4 administrateurs**). Aujourd'hui la connexion Plex passe par plex.tv, donc marche serveur éteint. Si la liaison est supprimée (`plexConfigured()` faux), le bouton Plex disparaît de l'écran de connexion. Décision déjà prise : forcer un mot de passe local à la prochaine connexion (mémoire `project-force-local-password`), **non implémenté**.

### 4. `/api/library/upgrade-candidates` > 30 s — HORS PLEX
Deux essais, deux dépassements de 14 s puis 30 s. Route administrateur de recherche d'indexeurs : sans lien avec Plex, à traiter à part. Autres lourdeurs notées : `/api/library/series` 30 Mo (1,5 s), `/api/calendar` 14 Mo (1,1 s).

### 5. Mineur
- Bouton d'en-tête « Moniteur Plex » : ouvre en fait « Sessions actives » (sessions Movviz, Plex vide).
- `/api/playback/prepare` : un profil client incomplet (sans `protocols`, ou sous-titres en simples chaînes) donne **500** au lieu de **400** (constaté pendant le test ; ce n'était PAS un défaut de lecture). Les vrais clients envoient un profil complet.
- Plage d'octets de fin (`bytes=-65536`) refusée en 416 par `/api/stream/local/<id>` : sans effet sur le navigateur, à surveiller pour les lecteurs Android/Tizen.
- Titres liés à Plex avec chemin `/data/films/...` : tous résolus en local, aucun « Plex seul » en prod (0 film avec clé Plex et sans fichier).

## Fausse piste écartée
Trois erreurs 500 sur `/api/playback/prepare` pendant l'audit venaient de **mon profil de test** (champ `protocols` absent), pas de la prod. Un 502 passager venait du **redéploiement en 1.28.113**.

## Limites
- Serveur Plex éteint mais machine allumée : refus immédiat. Si le NAS entier est éteint, les appels sans délai maximal (voir `AUDIT_COUPURE_PLEX.md`, constat 2) bloqueraient ; non reproduit ici.
- Clients Android mobile, Android TV, Samsung Tizen : non testés.
- Écritures sur la prod limitées au compte « test » : positions de lecture d'Esther, Grimm S1E12, Haunted Hotel S1E6 (à effacer si besoin). Aucun « marqué vu », aucune modification de réglage.
- Balayage complet des 37 582 épisodes : abandonné à la demande ; l'échantillon est de 15.
