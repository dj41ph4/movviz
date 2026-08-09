# Changelog

All notable changes to Movviz, grouped by development milestone.

---

## v1.13.05 — August 2026

### Correctif accordéon saisons — bordures rouges et compatibilité navigateur ARM

- **Corrigé — bordure rouge autour du chevron** : le navigateur appliquait son focus ring par défaut (outline) sur le `div[role="button"]` de chaque saison, visible comme un carré rouge dans certains environnements (ARM Docker). Supprimé via `outline-none`.
- **Corrigé — accordéon bloqué sous ARM Docker (deuxième passe)** : la transition `gridTemplateRows` CSS n'est pas supportée dans tous les navigateurs ARM. Remplacement par `max-height: 0 → 9999px` avec `overflow: hidden`, technique universelle supportée depuis IE9 — fonctionne sans ResizeObserver, sans JS d'animation, sans Framer Motion.

---

## v1.13.04 — August 2026

### Correctif accordéon saisons ARM Docker (investigation approfondie)

- **Corrigé — accordéon des saisons bloqué sous ARM Docker** : Framer Motion interprète et anime `gridTemplateRows` via JS, ce qui peut échouer sur des runtimes ARM. L'animation est désormais entièrement gérée par le moteur CSS du navigateur : transition inline sur `gridTemplateRows` + `opacity`, sans aucune dépendance JS externe. L'inner div reçoit `min-h-0` pour garantir que la row CSS Grid collapse réellement à 0. Le contenu est toujours présent dans le DOM (masqué par la grid), ce qui élimine aussi le cas où `libSeason` undefined rendait l'expansion silencieusement vide — quand une série n'est pas en bibliothèque, un message localisé est affiché à la place.

## v1.13.03 — August 2026

### Correctif accordéon saisons ARM/QEMU

- **Corrigé — accordéon des saisons bloqué sous ARM Docker** : l'animation d'ouverture des saisons reposait sur `height: "auto"` via Framer Motion, qui mesure la hauteur via `ResizeObserver`. Sous ARM Docker (Mac Apple Silicon / QEMU), `ResizeObserver` retourne 0 au premier rendu, rendant l'animation invisible et la liste d'épisodes inaccessible. L'animation passe désormais sur `gridTemplateRows: "0fr" → "1fr"`, une interpolation CSS pure sans mesure DOM — fonctionne identiquement sur x64 et ARM.

---

## v1.13.02 — August 2026

### Information 2FA C411

- **Ajouté — avertissement 2FA dans le formulaire C411** : les comptes c411.org avec double authentification (2FA) activée ne peuvent pas utiliser les listes Découvrir (chaque nouvelle session demanderait un code). Une note informative est désormais affichée sous les champs identifiant/mot de passe pour signaler cette limitation. 5 locales.

---

## v1.13.01 — August 2026

### Correctifs animations et TVDB

- **Corrigé — mode cinéma désactivé par le toggle animations** : désactiver les animations dans Réglages → Tableau de bord coupait aussi la lecture vidéo du mode cinéma (hero cinematique + en-tête de titre). Les deux paramètres sont désormais indépendants : couper les animations supprime les transitions/effets décoratifs sans jamais bloquer la lecture de la vidéo d'ambiance, qui est contrôlée uniquement par son propre toggle d'autoplay.
- **Corrigé — badge d'état TVDB absent dans l'onglet Animé** : après le déplacement de la clé TVDB vers l'onglet Métadonnées en v1.13.00, le badge « TVDB configuré / non configuré » avait disparu de l'onglet Animé — le toggle semblait inactif sans aucun retour visuel sur l'état de la clé. Le badge est restauré dans l'onglet Animé (lecture seule), avec un renvoi vers l'onglet Métadonnées pour saisir ou modifier la clé.

---

## v1.13.00 — August 2026

### Historique refonte, matching années, TVDB dans Métadonnées, event loop, bottom nav mobile

- **Refonte — page Historique** : timeline groupée par date (Aujourd'hui / Hier / Cette semaine / Ce mois / Plus ancien), cartes avec bordure colorée selon le statut, entrées d'échec en rouge avec message d'erreur affiché directement (sans clic), animations décalées à l'entrée, état vide illustré, compteur d'événements, rafraîchissement automatique toutes les 10 secondes. Traduit intégralement en 5 langues (labels de statut, groupes de dates, système, score, détails).
- **Corrigé — matching : tolérance d'année étendue à ±2** : les releases physiques (Blu-ray/DVD) publiées jusqu'à deux ans après la sortie cinéma originale étaient rejetées par le filtre d'année (ex. Tafiti, film allemand 2024 avec release française Blu-ray 2026). La tolérance passe de ±1 à ±2 dans `releaseMatchWorker.mjs` et `matching.ts`, ce qui active aussi le bonus de containment déjà présent pour les titres tronqués par les releases scène.
- **Déplacé — clé API TVDB de l'onglet Animé vers l'onglet Métadonnées** : regroupement logique avec TMDb et OMDb. L'onglet Animé conserve les deux bascules (utiliser TVDB / épisodes spéciaux) et le panneau de synchronisation. Les hints de navigation des deux onglets sont mis à jour. 5 locales.
- **Simplifié — texte event loop dans Performance** : remplacé par une phrase claire en une ligne (latence du thread principal, vert = OK, rouge = surchargé). 5 locales.

---

## v1.12.98 — August 2026

### Correction mobile — hitbox barre de navigation inférieure

- **Corrigé — boutons non cliquables en bas de la barre de navigation mobile** : sur iPhone avec indicateur d'accueil (zone safe-area ≈ 34 px), le `paddingBottom` safe-area était appliqué sur le conteneur `nav` plutôt que sur chaque bouton. Avec `items-stretch`, les enfants ne remplissent que la zone de contenu du nav (hors padding) — la zone safe-area en bas était visuellement couverte par le fond de la barre mais n'appartenait à aucun élément cliquable. Le padding est désormais porté par chaque bouton avec `max(0.5rem, env(safe-area-inset-bottom))`, ce qui étend la hitbox jusqu'en bas de l'écran tout en conservant l'icône et le libellé centrés dans la partie visible.

---

## v1.12.97 — August 2026

### Correction C411 collision d'ID TMDb + amélioration matching releases scène

- **Corrigé — collision d'espace d'ID TMDb dans les listes C411** : TMDb utilise deux espaces d'identifiants distincts (films et séries) qui se chevauchent — le même numéro peut désigner à la fois un film et une série différente. Jusqu'ici, le premier résultat trouvé (côté film) était retenu sans vérification, ce qui pouvait afficher la fiche d'un film sans rapport à la place d'une série. La résolution passe maintenant par un **hint titre + année** fourni par C411 : quand un ID existe des deux côtés, le titre et l'année stockés dans la liste permettent de choisir le bon espace. Le cache est versionné (v2) ; les anciennes entrées sans version sont ignorées et recalculées pour éviter qu'un verdict erroné survive les 30 jours de TTL.
- **Amélioré — matching releases scène avec sous-titre tronqué** : les releases de scène omettent souvent le sous-titre officiel (ex. « Tafiti » au lieu de « Tafiti - Ab durch die Wüste »), ce qui les pénalisait à 0,50 sous le seuil de matching. Un bonus de containment ramène le score à 0,85 quand le titre de la release est entièrement contenu dans le titre officiel **et** que l'année est compatible — les films différents homonymes publiés une autre année restent rejetés.

---

## v1.12.96 — August 2026

### Découvrir — libellé de la section recommandations affiné

- **Affiné — section recommandations** : le libellé de la première ligne de la page Découvrir passe de « Pour vous & meilleurs » à **« Sélection pour vous »** — plus lisible, plus propre, sans conjonction maladroite. Traduit en 5 langues.

---

## v1.12.95 — August 2026

### Désinstalleur Windows réparé, conteneur Docker réparé, wizard complété, login C411 clarifié

- **Corrigé — conteneur Docker en boucle de redémarrage** : au démarrage avec PUID/PGID différents des valeurs par défaut de l'image (le cas standard d'un NAS), le `docker-entrypoint.sh` supprimait le groupe `movviz` **avant** son utilisateur — busybox refuse de supprimer un groupe qui est le groupe principal d'un utilisateur existant (« group in use »), l'`addgroup` qui suivait échouait donc aussi et le conteneur mourait en boucle avec « addgroup: group 'movviz' in use » répété à chaque tentative. L'ordre est corrigé (utilisateur avant groupe, à chaque étape) et le script libère désormais proprement l'UID et le GID demandés, même quand le groupe cible est verrouillé par son utilisateur propriétaire. L'image amd64+arm64 publiée est régénérée avec ce correctif.
- **Corrigé — désinstalleur Windows en panne** : l'installation se terminait par une erreur d'exécution « Cannot call CreateInputOptionPage » au lancement de la désinstallation (cette fonction n'existe pas dans le runtime du désinstalleur d'Inno Setup, uniquement dans celui de l'installeur — elle avait été introduite avec la question « supprimer les données personnelles ? » en v1.12.91). La question est désormais posée via une boîte de confirmation native à la fin de la désinstallation, **par défaut NON** : rien n'est jamais effacé sans confirmation explicite, toujours en 5 langues, et les données (ProgramData) restent conservées par défaut pour permettre une réinstallation complète.
- **Nouveau — wizard** : l'étape finale affiche une carte « Activation des comptes » qui explique que le compte administrateur est déjà actif et que les prochains comptes (inscription ou Plex) devront être approuvés dans Réglages → Utilisateurs.
- **Clarifié — indexeurs C411** : le libellé « Identifiants du site » précise désormais entre parenthèses que le login est optionnel (il ne sert qu'aux listes Découvrir, la recherche fonctionne sans).

---

## v1.12.94 — August 2026

### Découvrir refondu — listes fusionnées, séries et films strictement séparés

- **Corrigé — mélange séries/films** : les listes c411.org (Populaires / Uploads récents / Sorties du jour) affichaient un mélange de films et de séries dans les deux onglets. Elles sont désormais filtrées par l'onglet actif (Films ou Séries), à l'affichage comme dans « Tout voir ».
- **Nouveau — listes fusionnées** : les sections de la page Découvrir sont regroupées avec dédoublonnage (un titre n'apparaît plus deux fois) :
  - « Pour vous & meilleurs » (suggestions + mieux notés)
  - « Tendances & populaires » (layout Movviz)
  - « En salles » (à l'affiche + box office) et « Prochainement & VOD » (layout Allociné, films)
  - « Nouvelles & renouvelées » (layout Allociné, séries)
  - De 11 à 7 sections en layout Movviz, de 14 à 9 en layout Allociné (films) et de 11 à 7 (séries). Chaque section fusionnée a son « Tout voir » paginé (cache 10 min).
- **Supprimé — tuiles Genres** : la rangée de tuiles genres (doublon du filtre genre de la barre) a été retirée.
- **Nouveau — builds Docker multi-arch** : les images publiées sur Docker Hub sont de nouveau construites pour `linux/amd64` **et** `linux/arm64` (QEMU + buildx réactivés).

---

## v1.12.93 — August 2026

### Indexeurs — statut réel, clé en mémoire et diagnostic de connexion

- **Nouveau — diagnostic C411** : la section « Identifiants du site » du crayon C411 affiche désormais le vrai statut serveur (listes actives ou inactives, avec le login concerné) et un bouton « Tester la connexion C411 » qui exécute un vrai login avec les identifiants enregistrés. En cas de config incomplète, un diagnostic détaillé indique exactement ce qui manque (listes / identifiant / mot de passe). L'échec silencieux « j'ai saisi mes identifiants mais rien ne s'affiche » devient donc visible et identifiable.
- **Nouveau — clé en mémoire** : le bouton « Afficher les catégories » d'un indexeur déjà configuré ne demande plus de resaisir la clé API — elle est reprise automatiquement depuis le serveur (le navigateur ne la voit jamais), et une mention « Clé enregistrée — utilisée automatiquement » l'indique. Fonctionne aussi pour le mode identifiants.
- **Nouveau — bouton « Tester la connexion »** sur chaque indexeur : vérifie l'URL et les identifiants en une seconde et affiche le résultat (OK ou l'erreur de l'indexeur).
- **Corrigé — sauvegarde silencieuse** : le formulaire n'accepte plus d'échouer en silence — si l'enregistrement échoue côté serveur, l'erreur est affichée et le formulaire reste ouvert.
- **Corrigé** : la clé du catalogue (ex. `c411`) est désormais aussi enregistrée lors d'une modification, pas seulement à l'ajout.

---

## v1.12.92 — August 2026

### Crayon C411 : identifiants du site modifiables

- **Corrigé** : au crayon, la section « Identifiants du site (listes Découvrir) » (login, mot de passe, toggle des listes) ne s'affichait jamais sur un indexeur C411 déjà configuré — l'identité « C411 » se perdait à l'enregistrement : seuls `kind: "torznab"` et l'URL étaient conservés, et le formulaire ne reconnaissait l'indexeur que par son `kind`.
- **Nouveau** : la clé du catalogue (ex. `c411`) est désormais persistée sur l'indexeur à l'ajout, et les indexeurs existants sont reconnus par leur URL de catalogue (repli). La section identifiants apparaît donc aussi en édition, et le toggle « listes Découvrir » n'est plus perdu à l'ajout (il est maintenant enregistré dès le POST initial).

---

## v1.12.91 — August 2026

### Intégration c411.org à la page Découvrir

- **Nouveau** : trois listes issues du site c411.org s'affichent dans l'onglet Découvrir — « Populaires sur C411 », « Uploads récents sur C411 » et « Sorties du jour sur C411 » (catégorie films/vidéos uniquement). Les identifiants du compte s'enregistrent dans Réglages → Indexeurs → C411 (section « Identifiants du site »), et chaque liste peut être activée ou désactivée indépendamment.
- Session gérée automatiquement (connexion avec CSRF, TTL 25 min, repli sur un second essai), requêtes espacées pour ne pas se faire bloquer, et résolution TMDb des releases avec cache 30 jours : un titre n'est proposé qu'à partir d'un score minimum (titre exact ou année + type), zéro faux positif.
- **Corrigé — parsing des noms de releases** : les underscores devenaient des points avant l'analyse des tags, « AD » n'est reconnu qu'en majuscules (les films comme « Ad Astra » ne sont plus mutilés), les canaux « 5.1 » et les groupes de release sont ignorés, « 10.bits » devient 10BIT.

### Crayon de modification sur tous les indexeurs

- **Nouveau** : chaque indexeur configuré (Torznab, Prowlarr, C411…) dispose d'un crayon pour éditer ses réglages sans le recréer — le formulaire affiche les secrets existants masqués et ne les écrase pas si le champ est laissé vide.

### Désinstallateur Windows — choix de suppression des données personnelles

- **Nouveau** : la désinstallation demande explicitement, via une case à cocher, si toutes les données personnelles (bibliothèques, historique, téléchargements, réglages — stockées dans ProgramData) doivent être effacées. Décochée par défaut : une réinstallation conserve tout, comme avant. Si cochée, une confirmation supplémentaire protège contre toute suppression accidentelle. Écran en 5 langues.

### Mode cinéma — option « au survol » retirée

- **Nettoyage** : le déclenchement de la bande-annonce « au survol » du Hero cinématique ne fonctionnait pas de manière fiable ; l'option a été retirée des réglages (il ne reste que « Désactivé » et « Automatique ») et la logique de survol du hero a été supprimée.

---

## v1.12.90 — August 2026

### Séries à saison unique découpées en « parties » (ordre DVD) — assemblé automatiquement

- **Corrigé** : les releases d'une série à UNE seule saison découpée dans l'ordre DVD en plusieurs parties (ex. Disjointed : 1 saison de 20 épisodes, sortie en « S01.PART.01 » + « S02.S01.PART.02 », ou simplement « S01 » + « S02 ») n'étaient jamais matchées — le numéro de saison annoncé (S02) ne correspondait à aucune saison de la bibliothèque, donc les épisodes 11-20 restaient introuvables sur les indexeurs.
- **Nouveau** : détection du marqueur « PART.N » dans le nom de la release (`S01.PART.02`, `Partie 2`…) et repli pour les séries à saison unique : une release S02 (ou part 2) couvre les épisodes de la seconde moitié de la saison (11-20 pour 20 épisodes). La sélection des fichiers du moteur et l'import sont traduits dans la même numérotation, pour que les fichiers `S02E01…E10` atterrissent bien sur S1E11-20.
- **Garde-fous** : uniquement les séries à une seule saison ; toute série multi-saisons garde son matching exact inchangé (une vraie saison 2 n'est jamais réinterprétée comme une partie). Les films ne sont pas concernés.

---

## v1.12.89 — August 2026

### Épisodes TBA traités comme « à venir » — les séries avec une saison annoncée mais non datée sont complètes

- **Corrigé** : un épisode sans date de sortie mais au titre placeholder « TBA » (TVDB/TMDb pré-créent ces épisodes pour les saisons annoncées, ex. Gachiakuta S2) était traité comme sorti → `missing` → recherché sans fin sur les indexeurs. Règle désormais en deux conditions distinctes : date future → « à venir » ; pas de date **et** titre TBA → « à venir » aussi. Un épisode sans date au titre réel garde le comportement historique (recherchable).
- **Corrigé — calculs de statut série/saison** : une série dont tout ce qui reste est « à venir » (TBA ou dates futures) est désormais **complete** (« disponible ») partout — page bibliothèque, détail, découverte, demandes, calendrier — et disparaît naturellement des recherches des manquants (search all, retries 6h, RSS). Une série entièrement « à venir » reste affichée « à venir ».
- Appliqué partout : création de série (TMDb + TVDB anime), backfill saison 0, réparation des saisons TMDb, sync Plex (création + mise à jour), tâche quotidienne de transition des dates.

---

## v1.12.88 — August 2026

### Diagnostic Plex enrichi + GUIDs externes demandés explicitement à Plex

- **Ajouté** — `GET /api/plex/diagnostic?title=...` affiche maintenant le GUID brut et le tableau `Guid[]` tels que rapportés par la liste ET par le détail (`/library/metadata/{ratingKey}`), plus le tmdbId résolu par la logique du sync — permet d'expliquer pourquoi un média n'est pas lié.
- **Amélioré — sync Plex** : les requêtes de liste incluent désormais `includeExternalMedia=1`, le paramètre Plex qui peuple le tableau `Guid[]` (tvdb://, imdb://, tmdb://) directement dans les réponses `/all`.

---

## v1.12.87 — August 2026

### Liaison Plex étendue aux GUIDs legacy + diagnostic Plex

- **Corrigé — sync Plex** : les GUIDs au format legacy (`com.plexapp.agents.thetvdb://80741?lang=fr`, agents d'avant 2021) n'étaient pas lus — seul le tableau `Guid[]` moderne l'était. Ces séries ne pouvaient jamais être liées, même avec la résolution `/find` de la v1.12.86. Le champ `guid` legacy est désormais parsé lui aussi (`thetvdb`/`imdb`/`tmdb`).
- **Ajouté — route diagnostic** `GET /api/plex/diagnostic?title=...` (admin) : affiche pour chaque titre Plex correspondant le type, le ratingKey, le GUID brut, le tableau `Guid[]` et le tmdbId résolu par la même logique que le sync — permet d'expliquer pourquoi un média n'est pas lié.

---

## v1.12.86 — August 2026

### Liaison Plex corrigée pour les médias sans GUID TMDb + outil de liaison enrichi

- **Corrigé — sync Plex** : la résolution des identifiants ne lisait que les GUID `tmdb://` rapportés par Plex. Les médias matchés par l'agent Plex uniquement en `tvdb://`/`imdb://` (séries canadiennes, anciens agents, etc.) étaient **silencieusement ignorés** — fichiers présents sur le disque et visibles dans Plex, jamais liés dans Movviz, et l'outil de liaison ne trouvait rien à réparer (aucun chemin n'était enregistré). **Corrigé** : les GUID `imdb://`/`tvdb://` sont désormais résolus vers TMDb via `/find` (mis en cache comme les autres appels TMDb), et en cas de doublons TMDb pour un même titre, l'entrée déjà présente dans la bibliothèque Movviz est prioritaire. Confirmé en production sur « Le cœur a ses raisons » : le GUID `tvdb://80741` se résout vers tmdb 2903 (2005), présent dans la bibliothèque.
- **Amélioré — liaison de fichiers** (`repair-paths`) : quand le nom de fichier enregistré n'existe plus nulle part sur le disque, l'outil propose désormais aussi les fichiers dont le nom contient le même `SxxEyy` (candidats à confirmation manuelle — jamais de reliaison automatique sur ce critère).
- **Docs** : plan d'architecture « Movviz Federation » archivé dans `docs/federation-plan.md`.

---

## v1.12.85 — August 2026

### Bug de renommage moteur corrigé + isolation de la recherche des manquants (quotas + annulation)

- **Corrigé — moteur** (`AbstractBackend.mjs`) : bug de renommage des packs — l'objet d'informations partagé (`releaseInfo`) était muté par la résolution du fichier cible, et pour tout fichier sans numéro d'épisode dans le nom, ce même objet était réutilisé pour les suivants : le PREMIER fichier apparié imposait alors son épisode à tous les autres. Confirmé en production sur un pack Trigun intégrale : 25 fichiers renommés `S01E03` (puis `S01E04` au 3ᵉ import), E1 toujours écrasé. **Corrigé** : l'objet est désormais cloné par fichier (`{ ...info }`) — reproduit localement avec les 28 vrais noms de fichiers du pack, chaque fichier obtient son propre épisode (E01-E26, uniques). Le moteur redéployé ne re-renommera plus jamais un pack entier vers le même épisode.
- **Quotas indexeurs (anti-429)** : quotas par indexeur réactivés (`c411.org` = 15 req/min documentées, 20 req/min par défaut pour tout hôte) + nouveau plafond global de 40 req/min (fenêtre glissante 60 s). Appliqués AVANT l'envoi de chaque requête (`fetchXml`), les quotas documentés ne sont donc jamais dépassés. La recherche groupée « rechercher les manquants » ne peut plus s'auto-infliger des 429 (mesuré en production : ~35 requêtes en ~35 s déclenchait déjà un 429).
- **Annulation des jobs** : nouvelle route `POST /api/jobs/[id]/cancel` (admin) + `requestCancelJob()`/`isJobCancelled()` dans la file + nouveau statut `"cancelled"` (settle propre via `JobCancelledError`, drapeau purgé à la fin). Points de contrôle coopératifs à tous les niveaux de la recherche groupée : entre items du lot, entre saisons, entre épisodes — les épisodes non encore cherchés restent simplement « manquants » et seront retentés au prochain passage. Un job en file est retiré immédiatement ; un job en cours s'arrête à son prochain point de contrôle (quelques secondes).
- **UI** : le panneau File d'attente affiche les jobs annulés (icône dédiée + libellés `jobs.statusCancelled` dans les 5 langues).

---

## v1.12.84 — August 2026

### Import fiabilisé des packs de saison/intégrale — plus jamais de "S01E" vide ni de fichiers écrasés

- **Contexte (confirmé en production)** : un pack de saison Noblesse (20,3 Go) téléchargé à 100 % n'a importé que 2 épisodes sur 13. Le grab n'avait pas de `episodeTargets` — le moteur importait alors TOUS les fichiers à l'aveugle, et chaque fichier dont le numéro d'épisode n'était pas identifiable était renommé avec un épisode VIDE (`Noblesse - S01E.mkv`). Plusieurs fichiers d'un même pack arrivaient alors sur le même chemin de destination et s'**écrasaient mutuellement** (le dernier remplaçait les précédents), les épisodes jamais importés restant "manquants".
- **Corrigé — moteur** (`AbstractBackend.mjs`) : quand le numéro d'épisode reste inconnu après tous les fallbacks (nom de fichier, release, dossier), le fichier garde désormais son nom d'origine au lieu du template `S{season:00}E{episode:00}` vide — nom unique par fichier, plus de collision ni d'écrasement, et fichier toujours découvrable par l'outil de renommage. `avoidCollision()` s'applique maintenant aussi aux séries (comme aux films).
- **Corrigé — grab manuel** (`/api/indexers/grab`) : un grab depuis une fiche série/saison passe maintenant `episodeTargets` au moteur (épisodes monitorés "manquant"/"recherche"), exactement comme un grab automatique — le moteur ne télécharge/importe alors que les épisodes ciblés.
- **Précision** : l'import côté bibliothèque n'a pas changé — un fichier sans numéro d'épisode n'est jamais attribué à tort à un épisode ("missing" tant que le lien n'est pas résolu).

---

## v1.12.83 — August 2026

### Mots autorisés — un terme présent dans le titre annule le mot interdit

- **Nouveau** : dans Réglages → Qualité, une section "Mots autorisés" vient s'ajouter à "Mots interdits". Si un mot autorisé est présent dans le titre d'une release, le mot interdit correspondant est annulé. Cas typique résolu : un debile a uploadé un épisode marqué "VOSTFR" alors que c'est en réalité un multi — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` avec "VOSTFR" interdit + "FRENCH" autorisé est désormais accepté, tandis qu'un simple VOSTFR reste rejeté.
- **Application** : la logique vit dans `matchesBlockedWord()` (`releaseRules.ts`), donc toutes les entrées la respectent — recherche auto (torznab), garde de décision, import de fichiers, récupération de téléchargements.
- **Match** : en sous-chaîne insensible à la casse, comme les mots interdits (note : "TRUEFRENCH" contient "FRENCH").
- Tests : 6 nouveaux cas dans `scripts/allowed-words.test.ts` (23/23 verts).

---

## v1.12.82 — August 2026

### Release 1.12.82 — encodage vérifié, pipeline CI relancé sur un commit sain

- **Contexte** : le premier push de la v1.12.81 a été réalisé avec un `package.json` corrompu par un BOM UTF-8 (`U+FEFF`) introduit par un écriture PowerShell — le build CI (`next build` via `build.ps1`) a échoué avec `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Corrigé** : l'encodage de tous les fichiers concernés (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) a été vérifié octet par octet — aucun BOM, UTF-8 propre. Le commit corrigé de la v1.12.81 contenait déjà le code exact sans BOM ; la v1.12.82 repart d'une base saine et relance le pipeline complet (installateur Windows + image Docker) sur le bon commit.
- **Rappel** : les fichiers source ne doivent JAMAIS être écrits via PowerShell 5.1 (`Set-Content`, redirections) — ses encodages par défaut corrompent l'UTF-8 ou ajoutent un BOM.

---

## v1.12.81 — August 2026

### Search/matching audit (TR4KER vs C411), link-before-download, Seerr notification flood, and a discovered engine-token mismatch

- **Fixed, confirmed live**: a series like "Ma vie avec les Walter Boys" (tmdbId 199001) could never be grabbed: the French localized title was used for both the indexer query and local release matching, while scene releases are always named after the ORIGINAL title ("My.Life.With.The.Walter.Boys.S03...") — every indexer returned 0 hits. Search and matching now prefer `originalTitle` (the localized title stays as an alias), and the daily metadata refresh backfills `originalTitle`/`tvdbId`/`imdbId` on pre-existing entries. TR4KER also only declares tvdb search (`tvSearchTvdb`, no tmdb) — the tvdbid was never sent to it because the field didn't exist; `searchTv` now sends `tvdbid` (TR4KER) / `tmdbid` (C411) as the indexer supports.
- **Fixed**: a failing ID-mode search (indexer-side error or HTTP 5xx) silently swallowed the whole search — the text fallback never ran. Both `searchMovie`/`searchTv` now always fall back to the text query.
- **Fixed**: the hourly RSS refresh silently showed "C411:0" — indexer errors were caught and discarded. Errors are now logged per indexer (`rss_refresh.indexer_error`) and a cycle with 0 releases while others return plenty warns with the indexer's caps (`rss_refresh.indexer_empty`).
- **Fixed**: linking a release before downloading failed with "Impossible d'ajouter ce titre à la bibliothèque" when the title was already in the library — the server's `alreadyInLibrary` response now carries the existing item so the picker can link straight to it. A duplicate-library guard (`libraryEntriesMatch`, title/originalTitle/aliases + compatible year) also stops TMDb duplicate entries from creating a second library record.
- **Fixed**: the `[seerr] mediaId not found` log flood — unknown tmdbIds are now cached as misses for 1 hour (warn at most once/hour each) with bounded pagination, and "processing" notifications are deduped to one per title per pass (`notifySeerrProcessingOnce`).
- **Fixed, environment**: the diagnostic log showed every grab rejected with `{"error":"unauthorized"}` — the web app and the download engine were using different `engine-token.json` files (dev vs Windows service install). Token files aligned; an explicit "TOKEN MOTEUR INVALIDE" hint now appears in the diagnostic log when the engine rejects a grab with unauthorized.

---

## v1.12.80 — August 2026

### "Récupérer téléchargements" crashed on large download folders — now batched, and the queue/history tabs no longer freeze with thousands of rows

- **Fixed, confirmed live**: the maintenance action processed every file in one synchronous request. With hundreds of files (big packs, long-running backlog) the request could time out or take minutes, and the response rendered every recovered/failed/duplicate entry at once — the page froze or crashed outright. The scan now runs in batches of 20 files per request: the panel re-invokes automatically with the paths already attempted (the server is idempotent per path, so a permanently-failed file is reported once and never retried within the same run), shows progress as batches complete, and caps the rendered list at 30 entries per section with a "+N more" note — the full data stays available for the delete-duplicates/unmatched actions.
- **Fixed**: the Queue tab rendered every torrent row (downloading, seeding, completed...) on every 500 ms poll — hundreds of completed items painted thousands of DOM nodes, freezing the tab. It now paints the first 50 rows immediately (active items sort first, so the live queue stays visible), grows the rest in idle time, and offers a "Show more" button. Same progressive rendering applied to the Activity history tab, which holds up to 2000 entries.
- Both changes are rendering/perf-only: filters, bulk actions, counters and cleanup buttons behave exactly as before.

---

## v1.12.79 — August 2026

### Hardened the previous fix after independent review

- An independent review of v1.12.78's recovery fix caught two real gaps before they could bite: the new "trust the original download's own record" resolution could have let it override a file's own explicit, disagreeing season number — meaning a mislabeled release could have been silently misfiled into the wrong season folder. It now only fills in a season/episode the file's own name didn't already provide, never overrides one it did. Also, one remaining spot (a movie bundled inside a series-category pack) was still on the old guess-only path while every other case had already been upgraded — now consistent across all of them.

## v1.12.78 — August 2026

### Root cause of downloads recovery couldn't relink either — recovery was discarding information it already had

- **Fixed, confirmed live**: investigated a specific case (Wakfu) where the download-recovery tool couldn't find a match for completed files even though the show was already correctly in the library. Root cause: recovery was re-guessing each file's show purely from its file name and folder path, even for files whose original download already knew — with certainty, from the moment it was grabbed — exactly which series and season it belonged to. That authoritative information was being discarded before the per-file matching ran, forcing every file through a fuzzy filename guess instead. For a show organized as `ShowName/Saison 01/episode.avi` with an episode file whose own name carries no recognizable season marker, that guess fell back to reading the season folder itself ("Saison 01") as the show's title — sharing no words at all with the real name, so it never matched.
- Recovery now resolves a file's show/season directly from its original download's own record when available, instead of guessing — and when it does have to fall back to reading folder names, it now checks one level higher whenever the closer folder turns out to be a bare season marker with no real title in it, rather than stopping at the first folder regardless of what it actually contains. Both fixes are generic — they apply to any show organized this way, not the one that surfaced the bug.

## v1.12.77 — August 2026

### Theater Mode was letting the page underneath bleed through visibly

- **Fixed, confirmed live**: the previous fix made the player's own background transparent so the color ambience could show through — but nothing behind it was actually fully opaque (the page-dim layer is only ~80% black through a blur, and the color layers themselves stack several partial-opacity effects with no solid base). The real library page ended up visibly readable through the letterbox bars — worse than the flat black it replaced. Added a permanent, fully opaque base layer underneath everything else, so the page can never show through again, with or without a title's artwork available for the color extraction.

## v1.12.76 — August 2026

### Theater Mode's content-adaptive backdrop was invisible — fixed, and rebalanced for real visual impact

- **Fixed, confirmed live**: the color ambience extracted from each title's own artwork was structurally hidden — the actual video player's own background was fully opaque, painted on top of the ambience layer, so the color only ever flashed for an instant during the opening animation before disappearing completely for the entire time spent watching. On top of that, the ambience layer itself carried a second near-opaque black scrim stacked directly on the color gradient, crushing what little showed through during that instant to almost nothing. Net effect: flat black regardless of the title's artwork.
- The player's background is now transparent where it's meant to show the backdrop through, and the scrim/gradient balance was reworked so the extracted color is actually visible in the letterboxed areas around the video — a bright, colorful poster now visibly tints the theater, a dark one stays moody, instead of everything looking identical.

## v1.12.75 — August 2026

### Root cause of a completed season-pack download that never showed up in the library

- **Fixed, confirmed live**: investigated a specific case (an anime whose season packs had fully downloaded — the queue showed them "completed" — but none of the episodes ever became available). The root cause: some season-pack releases name their episode files after the show in a heavily abbreviated or non-standard form the title parser can't recognize (in the confirmed case, an acronym sharing no words with the real title) — so when the completed download's files failed to match any tracked episode, they were correctly *not* deleted, but the recovery pass that's supposed to catch exactly this case only recorded the miss in a value nothing ever read, so the files sat there indefinitely with zero visibility.
- The recovery pass now records these the same way a truly-unlinked manual download already does: they show up in Activité → Non liés, where they can be manually pointed at the right title — generically, for any release whose name the parser can't confidently map, not specific to the one show that surfaced it.

## v1.12.74 — August 2026

### Matching bug that could grab the wrong show, and a job-queue stall that could silently freeze all background searches

- **Fixed, confirmed live**: the title-matching score treated two titles as near-identical based on raw character distance alone, even when they differed by one completely different word — confirmed live with "How I Met Your Father" (an unrelated spin-off) scoring ~91% similar to a search for "How I Met Your Mother" and getting grabbed in its place. The scorer now also checks word-by-word: a wholesale different word (not a spelling variant) is disqualifying regardless of how close the overall character count looks.
- **Fixed, confirmed live**: a single stuck background task (in this case a slow Plex sync) could occupy a job-queue slot indefinitely, silently blocking every other queued job behind it — including scheduled and manual searches — for as long as it stayed stuck, with no error or indication anything was wrong. This is what could leave a monitored, correctly-added title never actually searched. The queue now frees a job's slot after 10 minutes if it hasn't finished, so a single hung task can no longer starve everything behind it.

## v1.12.73 — August 2026

### Beta player — direct play now starts the way the manual "lightning bolt" retry always worked

- **Fixed**: the player used to decide whether to attempt direct play by pre-checking codec support with browser APIs that are known to lie for common cases (AC-3/E-AC-3 always reporting "unsupported" on Chrome/Edge, some containers reporting decodable video as unsupported) — routing many files to a transcode or WebCodecs fallback that direct play would actually have handled fine. Confirmed live: the manual retry button, which always attempted direct unconditionally with no such pre-check, worked noticeably better.
- Direct play is now the unconditional first attempt on every video, exactly matching what the manual retry already did — the two are now literally the same code path, sharing the same automatic recovery (falls back to the other playback mode on a real playback error or on genuinely silent audio, unchanged from before).
- The manual retry button now benefits from that same automatic recovery too, and resumes from the current position instead of restarting from zero.
- Removed the now-fully-unused WebCodecs playback path this pre-check used to route into — it was strictly a worse, redundant version of what direct play + the existing fallback chain already cover.

## v1.12.72 — August 2026

### Theater Mode — a real immersive player, not a video in a modal

- **New**: the Beta player now opens in a full "Theater Mode" — the current page stays exactly where it was behind it (scroll position, state, everything), the player expands from the button you clicked with a genuine geometric transition (not a fade), and the page behind dims and blurs progressively rather than just disappearing.
- Any ambient trailer or preview playing anywhere on screen stops the instant the real player opens — never two videos playing at once.
- The player's backdrop now takes on a subtle color ambience extracted from the title's own artwork (dominant tones, brightness-aware) instead of being flat black — analyzed once per title and cached, never during playback.
- "Lire dans Plex" now reads "Lire" wherever the Beta player will actually handle playback, and stays "Lire sur Plex" wherever it's a genuine hand-off to Plex — consistent across every title card, the title page, the episode page, and the dashboard hero (which previously had no Beta player integration at all).
- The three separate copies of this trigger logic across the app are now one shared implementation, closing the gap where a future fix could land in one place and be missed in the others.

### In-app "what's new" now follows your interface language

- Release notes are now localized per UI language (falling back to English for anything not yet translated), instead of a single fixed-language file.
- **Fixed**: the release notes were silently missing on both the Docker and Windows builds — the file they're read from was never actually included in either packaged build, so the "what's new" popup had nothing to show.

## v1.12.70 — August 2026

### Download engine — root cause of permanently unlinked downloads

- **Fixed, confirmed live**: removing a torrent from the download engine reported success and wiped its own tracking (including which library title it belonged to) even when the underlying download client silently failed to actually remove it — the torrent kept running and seeding untouched, but the engine had no record of it anymore. This is what produced downloads that could never be linked back to a title no matter how many times a recovery scan ran. The engine now only clears its own bookkeeping once removal is independently confirmed; otherwise the torrent stays tracked and can be retried instead of turning into a permanent orphan.

## v1.12.51 – v1.12.69 — August 2026

Matching accuracy and engine reliability pass: complete-series pack detection (season-range terms, false-positive guards), stuck-download recovery hardened to atomic no-overwrite moves with a reliable import callback, per-series/movie write locking to close a race that could drop a completed episode's status, and duplicate-download reconciliation so a re-grabbed file no longer leaves the library stuck on the wrong status. User guide refreshed to cover recently shipped features (title editing, movie versions, unlinked-download linking, anime settings).

## v1.12.24 – v1.12.50 — August 2026

Complete-series pack search (single-query, season-range aware), download recovery reliability (folder scan, orphaned-file matching, duplicate cleanup), secured duplicate deletion, and a small automated test suite for the release-matching core.

## v1.10.90 – v1.12.23 — July–August 2026

Quality-upgrade workflow (Optimize / Ignore, meaningful-upgrade detection), a redesigned resolution/codec badge system, GPU/animation performance profiles, and engine stabilization across the interchangeable download backends (crash fixes, anti-stall rule, per-series search locking).

## v1.10.39 – v1.10.89 — July 2026

Download engine rewrite with interchangeable backends (native/aria2, WebTorrent, libtorrent), a maintenance "recover downloads" tool for orphaned files, a premium toast notification system, audio-codec badges, and beta in-app playback improvements (direct play, transcode logging).

## v1.10.12 – v1.10.17 — July 2026

Language-detection accuracy pass: audio-track language read from Plex, French-variant tags (VF/VFQ/VFF/TRUEFRENCH) correctly satisfying quality profiles, duplicate-episode cleanup, and a fix for premature torrent abandonment.

## v1.10.1 – v1.10.6 — July 2026

Decision Guard (pre-grab blocklist enforcement), franchise/collection detection, a redesigned download queue and diagnostics dashboard, and trailer/calendar refinements.

## v1.8.0 – v1.9.9 — July 2026

Unified title panel (single component for the slide-in and full-page views), a trash/recycle-bin safety net for removed titles, mobile responsiveness pass, and a fix for a memory leak in the metadata cache.

## v1.4.5 – v1.7.9 — July 2026

Security hardening (path traversal, database protections, CodeQL alerts), the trash system's final protections, a live in-app player, real-time updates across the UI, Plex activity monitoring, and collections support.

## v1.1.67 – v1.4.4 — July 2026

In-app player with automatic Plex transcode fallback, Overseerr (Seerr) request import, multi-architecture Docker builds, and a reduction of the settings navigation from 26 tabs down to 18.

## v1.1.50 – v1.1.66 — July 2026

Initial public release: TMDb discovery, Torznab/Newznab indexer search, unified movie/series library, multi-user requests, the built-in BitTorrent engine, and Plex sync — plus early stability and security fixes (session handling, library deduplication, dependency upgrades).
