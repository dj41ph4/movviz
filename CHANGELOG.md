# Journal des modifications

Toutes les nouveautés et corrections notables de Movviz, expliquées simplement.

## [1.7.7] — 2026-07-24

### Corrigé

- **WebCodecs Player** : la lecture ne démarrait pas — la boucle de rendu s'activait avant l'arrivée des premières frames, provoquant un écran noir. Démarre maintenant à la première frame décodée, horloge sync resettée au bon moment

## [1.7.6] — 2026-07-24

### Corrigé

- **Beta player** : le mode beta ne forçait plus la transcode — utilise maintenant WebCodecs/direct en premier, fallback HLS seulement si nécessaire

## [1.7.5] — 2026-07-24

### Ajouté

- **WebCodecs Player beta** : décodeur HEVC/H.264/AV1 natif via WebCodecs API, évite la transcode Plex
- **mp4box.js** : demuxage MP4 progressif (range requests) pour alimenter VideoDecoder/AudioDecoder
- **Sync A/V** : horloge audio avec compensation pause, frame dropping intelligent
- **Fallback automatique** : si WebCodecs échoue → transcode HLS Plex

## [1.7.4] — 2026-07-24

### Ajouté

- **WOW animations** : framer-motion cascade, hover lift, spring tap sur toute l'interface
- **Smart transcode** : AV1/VP9/H.264 → direct stream, HEVC → full transcode Plex
- **Skeleton loading** : shimmer placeholders partout pendant le chargement
- **PageLoader NProgress** : barre de progression en haut pendant les navigations

### Optimisé

- **Settings** : tabs plus rouges, navigation mobile bottom-sheet
- **Delete animation** : 300ms avant suppression pour confirmer visuellement

## [1.7.3] — 2026-07-24

### Ajouté

- **Protection dernier admin** : PATCH users/[id] refuse de révoquer le dernier admin
- **Concurrency CI Docker** : file d'attente, max 1 build, annule les builds parallèles

## [1.7.2] — 2026-07-24

### Ajouté

- **URL state sync** : back button fonctionne sur toutes les pages (discover, search, library, activity, settings, requests)
- **ScrollRestoration** : skip sur popstate pour éviter les sauts

## [1.7.1] — 2026-07-24

### Corrigé

- **safePlexUrl** : autorise les IP privées pour Plex LAN, bloque localhost/loopback/link-local

## [1.7.0] — 2026-07-24

### Ajouté

- **Scan disque local** : `file.diskPath` séparé de `file.path`, tâche planifiée incrémentale
- **Rename priorise diskPath** : utilise `file.diskPath` pour les renommages

## [1.6.0] — 2026-07-25

### Ajouté

- **Moniteur Plex en direct** : icône dans la TopBar (admin only) avec animation EEG, affiche qui regarde quoi, débit, progression, état (▶/⏸), résolution et codecs
- **Détection GPU** : tier automatique (high/medium/low), animations réduites sur GPU faible, toggle manuel
- **Badges dynamiques animés** : pop/pulse sur changement, mise à jour en temps réel via SSE
- **Barre de progression fluide** : transition CSS GPU-accelerated, plus de JS polling par frame
- **Trailers multilingues** : YouTube adapté à la langue (fr→VF, en→VO, es→ES), fallback officiel
- **X-Api-Key auth** : nouveau mode d'authentification indexeur (header HTTP)
- **Indexeur tr4ker** : ajouté au catalogue
- **Auto-update Windows** : installation automatique des mises à jour, activé par défaut
- **Player beta pro** : contrôles overlay custom, PiP, reprise, shortcuts, vitesse 0.5x-2x, menu audio/ST, bitrate adaptatif

### Optimisé

- **Store Maps O(1)** : `getMovie`/`getSeries` 500x plus rapide avec 2000+ films
- **SSE temps réel** : 7 composants passent du polling au push (wanted, timeline, notifications, queue...)
- **UX** : toggle animé, skeleton loading, 28 settings polis, `loading="lazy"` partout
- **Player** : cache ETag + 304, LRU 300 entrées, WebCodecs detection

## [1.5.4] — 2026-07-24

### Corrigé

- trashPurge : refuse suppression si trashRoots non configuré
- Sidebar auto-update : globalThis anchor + délai 2s (flush JSON avant kill)

## [1.5.3] — 2026-07-24

### Ajouté

- Auto-update Windows automatique (activé par défaut, désactivable dans À propos)

## [1.5.2] — 2026-07-24

### Ajouté

- Support auth X-Api-Key + indexeur tr4ker

## [1.5.1] — 2026-07-24

### Corrigé

- clearMovies/clearSeries : paramètre isExplicitClear pour bypass le guard NAS-down
- stateFile : path.resolve pour Windows (.. dans les chemins)

## [1.5.0] — 2026-07-24

### Corrigé

- **Bug racine perte 20 TB trouvé** : `linkOrCopy` supprimait le fichier existant avant de vérifier la source → temp file + rename atomique
- Routes DELETE : `path.dirname()` + depth check + déduplication dossiers
- Engine `finishTorrent` : path traversal par nom torrent bloqué
- Engine `remove(deleteData)` : vérification `startsWith(completedPath)`

## [1.4.8] — 2026-07-24

### Corrigé

- **linkOrCopy atomique** : temp file + rename au lieu de delete-then-copy (bug racine 20TB)

## [1.4.7] — 2026-07-24

### Corrigé

- 6 gardes de sécurité supplémentaires (store, renameExec, depth checks)

## [1.4.6] — 2026-07-23

### Corrigé

- **Protection perte de données — 6 gardes de sécurité** :
  - **Engine `finishTorrent`** : sanitization du nom de torrent (path traversal `../../` bloqué), validation que le chemin de cleanup reste dans downloadPath
  - **Engine `remove(deleteData=true)`** : vérification que `movedTo` est bien sous `completedPath` avant suppression récursive
  - **Store `saveMovies` / `saveSeries`** : refuse d'écraser un fichier de 10+ entrées par `[]` (protection anti-fallback NAS down)
  - **RenameExec `safeMove`** : refuse de déplacer un dossier racine (depth ≤ 1)
  - **RenameExec `rmShellFallback`** : vérifie depth ≥ 2 avant `rd /s /q`
  - **RenameExec `seriesRoot`** : calculé via common ancestor de TOUS les épisodes, garde si root == base

## [1.4.5] — 2026-07-23

### Ajouté

- **Player beta — optimisation complète** (19 recommandations) :
  - Config hls.js ABR + recovery automatique (réseau/média)
  - Détection codec client via WebCodecs API (`pickStrategy` : direct/webcodecs/transcode)
  - SessionId transcode stable (par user+ratingKey), quota 3 sessions/user
  - Menu sélection piste audio + sous-titres
  - Reprise de lecture (localStorage + forward à Plex)
  - Cache LRU segments (TTL 300s, 200 entrées) pour seeks arrière
  - Cap bitrate adaptatif par résolution (4K→15Mbps, 1080p→8Mbps, 720p→4Mbps)
  - Smart directPlay (Plex décide au lieu de forcer transcodage)
  - CORS strict (origin referer, plus de `*`)
  - Buffering/loading UI, indicateur qualité
  - Nouveaux endpoints : `/api/stream/[ratingKey]/progress`, `/stop`, `/info`
- **WebCodecs HEVC/AV1/AC3** : détection du support codec natif du navigateur, même quand `<video>` ne supporte pas le conteneur

### Corrigé

- **TVDB titres japonais persistants** : la resync échouait quand l'épisode existant ET le titre TVDB étaient tous les deux en japonais → fallback "Épisode N" maintenant activé. Nouvel endpoint debug `/api/library/series/[id]/tvdb-debug`.
- **Build installer Windows** : ne se déclenche plus en doublon (push main + push tag), uniquement sur tags

## [1.4.4] — 2026-07-23

### Corrigé

- **Sécurité — 5 alertes CodeQL corrigées dans `seerr/mediaMap.ts`** :
  - **SSRF (#44, #46, #47)** : validation de l'URL Seerr via `safeBase()` — schéma http/https seulement, blocage localhost/loopback/private/link-local, construction des URLs via `new URL()`
  - **Format string (#48)** : `console.warn` utilise concaténation de chaînes au lieu d'argument format injecté
  - **Regex polynomial (#45)** : `replace(/[/]+$/,"")` au lieu de `replace(/\/+$/,"")`

## [1.4.3] — 2026-07-23

### Corrigé

- **Cartes film/série — vues desktop et mobile totalement不同es** : l'overlay hover (boutons sur le poster) s'affiche UNIQUEMENT sur desktop (`hidden lg:flex`), la barre d'actions en dessous s'affiche UNIQUEMENT sur mobile (`lg:hidden`). Fini les doublons.
- **Boutons mobiles opaques** : remplacement de `glass-strong` (semi-transparent, invisible) par `bg-white/10 border border-white/10` (opaque, clairement cliquable). Taille tactile 44px (`h-10`).
- **CollectionCard** : même traitement — hover desktop uniquement, barre mobile opaque en dessous.

## [1.4.2] — 2026-07-23

### Corrigé

- **Workflow CI doublon** : suppression de `windows-installer.yml` qui doublonnait `build-installer.yml` et créait deux releases concurrentes sur chaque tag.

## [1.4.1] — 2026-07-23

### Corrigé

- **Actions hover visibles sur mobile** : les boutons d'action qui apparaissaient uniquement au survol (`group-hover:opacity-100`) sur desktop étaient invisibles/inaccessibles sur smartphone. Ajout d'une barre d'actions permanente entre l'affiche et le titre sur `LibraryMovieCard` (recherche, tags, suppression...) et `CollectionCard` (édition, suppression).
- **CI installer** : le workflow `build-installer.yml` ne force plus une version spécifique d'InnoSetup, évitant l'échec quand une version plus récente est déjà installée sur le runner GitHub.

## [1.4.0] — 2026-07-23

### Ajouté

- **Séparation des profils utilisateurs** : isolation complète entre comptes.
  - Collections privées par défaut (créateur + admin uniquement), filtrage `createdBy` dans l'API
  - Activity v2 filtrée par les requêtes de l'utilisateur pour les non-admins (queue, history, failures, wanted)
  - Paramètres accessibles aux non-admins avec onglets limités à leur périmètre
  - 14+ endpoints API sécurisés avec `requireUser` ou `requireAdmin` (fuite de données colmatée)
- **Agents de contrôle qualité** : 5 agents créés (.opencode/agents/) — profile-separation-expert, responsive-expert, code-expert, test-agent, orchestrateur anti-régression
- **Diagnostic erreurs cliquable** : dans "Temps de réponse", le nombre d'erreurs ouvre une modale détaillée (code HTTP, durée, horodatage)
- **API `/api/perf?errors=1`** : renvoie les entrées d'erreur brutes

### Corrigé

- **Responsive smartphone (~15 fichiers)** : boutons en wrap sur mobile, `overflow-x-hidden` remplacé par de vrais correctifs, touch targets ≥44px, dropdowns limités à `100vw-2rem`
- **Settings page** : les non-admins n'étaient pas bloqués mais l'onglet "About" était visible et vide — corrigé
- **Imports inutilisés** : nettoyage des icônes non utilisées dans settings/page.tsx
- **Notification Seerr films déjà en bibliothèque** (v1.3.5)
- **Pack intégrale Trigun introuvable** : `seasonEpisodeMatches` accepte `season === null` pour les packs (v1.3.4)
- **Perf TMDb** : recommandations limitées à 5 appels concurrents (v1.3.4)
- **Logs de scoring** : détail par étape de filtrage dans grab_release (v1.3.3)

## [1.3.5] — 2026-07-23

### Corrigé

- **Notification Seerr absente pour les films déjà en bibliothèque** : quand un film était importé du disque AVANT la demande Seerr, l'import Seerr le voyait déjà présent (`alreadyInLibrary`) et ne notifiait jamais Seerr — le statut restait bloqué sur "requested". Désormais, si le film est "available" dans Movviz, `notifySeerrStatus("available")` est appelé.
- **Diagnostic — clic sur le nombre d'erreurs** : dans le tableau "Temps de réponse", le nombre d'erreurs est maintenant cliquable et ouvre une modale listant chaque erreur (code HTTP, temps, horodatage).

### Ajouté

- **API `/api/perf?errors=1`** : renvoie les entrées d'erreur brutes (status ≥ 400) pour une vue détaillée.

## [1.3.4] — 2026-07-23

### Corrigé

- **Pack intégrale toujours pas trouvé (Trigun)** : `seasonEpisodeMatches` rejetait les releases sans numéro de saison (ex. "Trigun Complete Series") — `parsed.season === null` n'est plus bloquant quand on cherche un pack. Le pack intégrale passe désormais le filtre et peut être grabbé.
- **Performance recommandations TMDb** : les 25 appels parallèles à l'API TMDb pour les recommandations sont maintenant limités à 5 concurrents, évitant la saturation du rate-limit du plan gratuit qui ralentissait `/api/metadata/rows` (~4s).

## [1.3.3] — 2026-07-23

### Corrigé

- **Notification Seerr absente pour films importés du disque** : l'ajout direct d'un film depuis le scan disque (import) ne déclenchait jamais `notifySeerrStatus("available")` — le statut restait bloqué sur "requested" dans Overseerr.
- **Per-filter logging pour le débogage de recherche** : `grab_release.scoring` et `grab_release.no_match` détaillent désormais le nombre de releases passant chaque étape de filtrage (titre, saison, pack, résolution, score, taille, liste d'échec).

## [1.3.2] — 2026-07-23

### Ajouté

- **Build automatisé de l'installateur Windows via GitHub Actions** : le workflow `.github/workflows/build-installer.yml` compile l'installateur Inno Setup sur chaque push vers `main` et crée une Release avec l'artefact `.exe` attaché quand un tag `v*` est poussé.

## [1.3.1] — 2026-07-23

### Corrigé

- **Pack intégrale introuvable pour les séries à 1 mot (Trigun)** : le parseur ne reconnaissait pas "Complete Series", "Intégrale" etc. comme délimiteurs de titre → le titre parsé incluait ces mots, et `titleSimilarity` rejetait le résultat pour les séries à 1 mot. Ajout de `PACK_DESC_RE` dans `parseRelease` pour tronquer ces descripteurs.
- **Sync TVDB anime — titres en japonais persistants** : même avec `Accept-Language: fr`, TVDB n'a pas de traduction française pour certains épisodes d'anime et retombe en japonais. `resyncAnimeSeasonsFromTvdb`, `buildAnimeSeasonsFromTvdb` et `applyTvdbTitleOverrides` préservent désormais les titres français existants quand TVDB retourne du texte CJK (japonais/chinois).
- **Agents vérificateurs** : 3 agents de review + 1 agent expert TVDB/manga/animé créés dans `.opencode/agents/`.

## [1.3.0] — 2026-07-23

### Ajouté

- **Migration du format des tâches planifiées** : détection et migration automatique de l'ancien format plat vers `{runs, configs}`.
- **Nettoyage des dossiers vides** : scan récursif sécurisé (boucle anti-root Windows).
- **Requêtes triées** : les demandes Seerr sont triées par `createdAt` descendant.
- **Saisons spécifiques Seerr** : une demande peut cibler des saisons précises (pas seulement l'intégrale).

### Corrigé

- **Import Seerr — crash silencieux** : `SeerrImportResult` retourne les champs attendus par l'UI (`seerrUsers`, `seerrRequests`, `unmatchedUsers`).
- **Notification API Overseerr** : utilisation des codes numériques (`5` = disponible) au lieu de strings, `findSeerrMediaId` avec recherche ciblée par TMDb.
- **Recherche intégrale complète** : `addSeriesToLibrary` utilise `searchAndGrabCompleteSeries` au lieu de ne chercher que la première saison.

## [1.2.7] — 2026-07-23

### Ajouté

- **Import automatique depuis Overseerr/Seerr** : nouvelle tâche planifiée toutes les 1 min qui importe les demandes sans doublon
- **Intervalles des tâches configurables** : chaque tâche peut être réglée en jours/heures/minutes depuis l'UI
- **Cache vidéo configurable** : durée de cache des segments vidéo réglable dans les réglages Plex (0 = pas de cache, défaut 300s)

### Corrigé

- **Son absent en lecture directe** : quand le codec audio n'est pas supporté par le navigateur, le lecteur bascule automatiquement sur le flux transcodé (h264+aac) qui fonctionne partout
- **Sync-all bloqué** : le endpoint sync-all n'avait pas de timeout → bloquait le frontend indéfiniment
- **Stream sans range requests** : les proxys vidéo ne transmettaient pas l'en-tête `Range` → impossible de seek, téléchargement complet avant lecture
- **TVDB anime — titres en japonais** : le client TVDB ne passait pas de langue à l'API → les titres revenaient en japonais pour les anime. Ajout du header `Accept-Language` avec la langue configurée (fr par défaut).

## [1.2.6] — 2026-07-23

### Corrigé

- **TVDB anime — titres en japonais** : le client TVDB ne passait pas de langue à l'API → les titres revenaient en japonais pour les anime. Ajout du header `Accept-Language` avec la langue configurée (fr par défaut).
- **Sync-all bloqué** : le endpoint sync-all n'avait pas de timeout → bloquait le frontend indéfiniment.
- **Stream sans range requests** : les proxys vidéo ne transmettaient pas l'en-tête `Range` → impossible de seek, téléchargement complet avant lecture.

## [1.2.2] — 2026-07-23

### Ajouté

- **Lecteur vidéo — fallback transcodage** : tentative de lecture directe en priorité ; si le codec/container n'est pas supporté par le navigateur (x265, MKV...), fallback automatique vers le transcodage HLS de Plex (h264+aac). Badge « transcodé » visible dans l'interface.

### Modifié

- **Mode clair** : blobs aurora désactivés, fond uni propre sans dégradé.

## [1.2.1] — 2026-07-23

### Modifié

- **Mode clair — contraste sidebar** : `--color-abyss` rapproché de `--color-void` pour éliminer la coupure nette entre la sidebar et le contenu principal.
- **Thème par défaut** : le mode sombre est désormais le thème par défaut (au lieu de suivre les préférences OS). Les changements utilisateur restent persistés.

### Corrigé

- **Build Docker arm64** : pin Alpine 3.20 (`node:22-alpine3.20`) pour éviter le crash QEMU (SIGILL) pendant la génération des pages statiques Next.js — le tag roulant `22-alpine` est passé à Alpine 3.21 dont les binaires ne sont pas entièrement émulables par QEMU.

## [1.2.0] — 2026-07-23

### Ajouté

- **Lecteur bêta (Paramètres → Plex)** : remplace l'ouverture de Plex Web par un lecteur vidéo intégré. Active le proxy de streaming direct depuis Plex. Désactivé par défaut — certains codecs peuvent ne pas fonctionner dans le navigateur. (Bêta)
- **Indexeurs — priorité** : boutons `−`/`+` dans chaque ligne d'indexeur pour monter/descendre la priorité de traitement, avec `savePriority()` PATCH vers l'API.
- **Queue — fluidité** : polling SWR réduit à 2000ms. Barres de progression animées (`transition-all duration-1000 ease-linear`) et interpolation locale `displayProgress` via `setInterval(120ms)` basée sur la vitesse de download — l'affichage bouge en continu entre les mises à jour serveur.

## [1.1.68] — 2026-07-23

### Ajouté

- **Avertissements zone à risque pour les onglets Disque** : Indexation, Renommage et Maintenance ont désormais le même style rouge (`dangerous`) que la Zone dangereuse dans la barre latérale, plus un bandeau d'avertissement en haut de chaque panneau.

### Modifié

- **Activity V1 supprimée** : la V2 devient l'interface d'activité permanente (route `/activity`). L'ancienne route `/activity/v2` redirige vers `/activity`.
- **Queue — actualisation 500ms** : le rafraîchissement passe de 3s à 500ms pour plus de réactivité.
- **Queue — tri amélioré** : les téléchargements en cours sont toujours au-dessus des terminés, avec date décroissante à l'intérieur de chaque groupe.
- **Queue — affichage date** : format compact `"23 Jul 2026"` au lieu de l'horloge + tooltip.
- **Recherche — mise en évidence des saisons** : les références de saison dans les titres de release sont colorées (vert si correspond, ambre si non).

### Corrigé

- **Série — pack intégrale hors cible** : `isCompleteSeriesPackTitle()` vérifie maintenant que le pack couvre au moins une saison manquante. Exemple : une "Intégrale S01-S28" ne sera plus prise pour une recherche Saison 29.
- **Parsing de plage de saisons** : le pattern `SEASON_RANGE_RE` accepte désormais le séparateur français `"à"` (ex. `"S01 à S28"`).

## [1.1.67] — 2026-07-22

### Modifié

- **Réorganisation des réglages** : les 8 groupes de la page Réglages sont fusionnés en 5 — Téléchargement, Bibliothèque (intègre Nommage, Importations, Seerr, Blocages), Disque, Notifications, Système (intègre À propos et Zone dangereuse).
- **Section « Soutenir le projet »** ajoutée dans le README avec lien GitHub Sponsors.

## [1.1.66] — 2026-07-22

### Ajouté

- **Recherche TMDB automatique au clic sur Récupérer** : dans `/search`, cliquer sur « Récupérer » pré-remplit maintenant la recherche TMDb avec le titre parsé du release, au lieu de laisser l'utilisateur taper manuellement.

### Modifié

- **Version** passée à 1.1.66.

## [1.1.65] — 2026-07-22

### Modifié

- **Mise à jour majeure des dépendances** : Next.js 15→16, TypeScript 5→6, framer-motion 11→12, lucide-react 0→1, tailwind-merge 2→3, @types/node 22→26. React, Tailwind, PostCSS montés à leurs dernières versions mineures. Le fichier `middleware.ts` a été renommé en `proxy.ts` (convention Next.js 16) avec `export function proxy`. Le script d'initialisation du thème passe par une balise `<script>` synchrone directe au lieu de `next/script beforeInteractive`, qui ne s'exécutait plus avant le premier rendu dans Next.js 16 — corrige l'affichage « texte sur fond blanc » au chargement.
- **Build Windows : version.json** synchronisé avec le numéro de version du projet.

## [1.1.64] — 2026-07-22

### Corrigé

- **Plantage du wizard de démarrage à la dernière étape** : `router.push("/")` + `router.refresh()` créait un race condition sur certains clients. Remplacé par `window.location.href = "/"` (équivalent à F5, qui fonctionnait déjà).
- **Dédoublonnage des ajouts en bibliothèque** : `addMovie()` et `addSeries()` vérifient maintenant si le `tmdbId` existe déjà avant d'insérer (commité après coup dans la release 1.1.63).

## [1.1.63] — 2026-07-22

### Corrigé — Merci à [TheGeeKing](https://github.com/TheGeeKing) pour le debug

- **Sécurité : n'importe quelle valeur dans le cookie `movviz_session` permettait de contourner la page de connexion et d'accéder à l'application.** Le middleware vérifiait uniquement la présence du cookie (vraie pour n'importe quelle chaîne non vide comme `"foobar"`), sans jamais valider son contenu. Les tokens de session sont maintenant signés avec HMAC-SHA256 via une clé secrète générée automatiquement à l'installation (ou via la variable d'environnement `MOVVIZ_SESSION_SECRET`). Le middleware exige que la valeur du cookie corresponde au format attendu (64 caractères hexadécimaux en format legacy, ou `64.64` en format signé) — toute valeur arbitraire est immédiatement rejetée.
- **Dédoublonnage des imports Plex et des ajouts en bibliothèque** : `addMovie()` et `addSeries()` dans le store ne font désormais plus confiance aux seuls appels pour vérifier l'absence de doublon. Si un `tmdbId` existe déjà, l'appel est un no-op et retourne l'entrée existante, ce qui protège contre les doubles-clics et les appels concurrents.
- **Build Docker multi-architecture** : l'image Docker est maintenant publiée pour `linux/amd64` ET `linux/arm64` (Raspberry Pi, Apple Silicon, NAS Synology/QNAP). Les outils de compilation natifs (`cmake`, `build-base`) ont été ajoutés à l'étape de build pour que les modules natifs optionnels se compilent sans échec sur ARM64.

## [1.1.60] — 2026-07-22

### Corrigé
- **Recherche manuelle (Queue, Choix manuel, Wanted)** : le filtre `includes` sur les résultats directs de l'indexeur était trop strict — il exigeait que le titre complet normalisé (ex. `the.amazing.spider-man.le.destin.dun.heros`) soit un sous-texte du titre de release, ce qui échouait quand l'indexeur retournait un titre tronqué (ex. `Spider-Man.Le.Destin.dun.heros.2014...`). Suppression du filtre `includes` pour les résultats de recherche directe (l'indexeur a déjà filtré par requête) et dédoublonnage par GUID.

## [1.1.59] — 2026-07-22

### Corrigé
- **Filtrage des résultats de recherche** : le post-filtrage comparait le titre normalisé (avec points) au titre brut de l'indexeur (avec espaces/ponctuation) — ne matchait jamais. Les deux côtés sont maintenant normalisés via `sanitizeQuery` avant comparaison.

## [1.1.58] — 2026-07-22

### Corrigé
- **Recherche depuis la file d'attente** : le bouton 🔍 dans la file d'attente naviguait vers `/search?q=...` (texte seul, sans `tmdbId`). Désormais l'ID TMDb est transmis via `ActivityMedia.tmdbId` jusqu'à l'API, qui utilise `searchMovie` (`t=movie&tmdbid=XXX`) comme pour les autres chemins.

## [1.1.57] — 2026-07-22

### Corrigé
- **Sanitize des requêtes de recherche** : meilleur nettoyage des titres (apostrophes, doubles espaces après suppression des deux-points, points consécutifs) pour que les indexeurs reçoivent une requête propre.
- **searchMovie/searchTv : fallback texte si l'ID TMDb ne trouve rien** : la recherche par `t=movie&tmdbid=XXX` peut retourner vide si l'indexeur ne connaît pas ce film. Maintenant, si aucun résultat, on refait une recherche par texte normal.

## [1.1.56] — 2026-07-22

### Corrigé
- **Recherche manuelle (choix manuel) ne trouvait rien sur les titres avec accents** : la recherche texte envoyait "Team.Démolition" aux indexeurs, qui ne retournaient rien car les noms de release n'ont jamais d'accents ("Demolition.Man.1993…"). Désormais les accents sont normalisés en ASCII (é→e, è→e, ç→c…) avant d'être envoyés.
- **Recherche manuelle moins précise que la recherche automatique** : l'auto-grab utilisait `t=movie&tmdbid=XXX` (recherche par ID TMDb), bien plus fiable que le texte seul, mais la recherche manuelle n'avait pas l'ID. Ajout de `tmdbId`/`imdbId` à l'API de recherche manuelle — quand le film est connu (depuis sa fiche), la recherche utilise `searchMovie` avec l'ID TMDb, exactement comme l'auto-grab.

## [1.1.55] — 2026-07-22

### Corrigé
- **Changement d'onglet lent dans l'activité V2** : les 4 onglets (File d'attente, Historique, Manquant, Échecs) restaient montés simultanément avec chacun son poll SWR 3s → charge réseau et CPU constante. Passage au montage conditionnel (seul l'onglet visible est rendu) — l'onglet cliqué hydrate ses données instantanément depuis le cache SWR sans attendre le prochain poll.

## [1.1.54] — 2026-07-22

### Ajouté
- **Filtre "En seed" dans la file d'attente** : les torrents en cours de seed (terminés mais encore actifs) sont maintenant visibles dans l'onglet Activité, avec leur ratio, vitesse de partage et temps écoulé — directement dans la ligne compacte, comme sur un vrai client torrent.
- **Heure d'ajout dans la ligne compacte** : chaque téléchargement affiche maintenant l'heure exacte à laquelle il a été ajouté, sans avoir besoin de déplier la carte.

### Optimisé
- **File d'attente encore plus réactive** : chaque ligne est maintenant un composant `React.memo` avec une comparaison champ par champ (progression, vitesse, ratio, statut…). Les 40+ lignes ne se re-rendent plus à chaque rafraîchissement 3 secondes — seules celles dont les données changent se mettent à jour.

### Corrigé
- **Torrents en seed invisibles** : l'API filtrait les torrents dont le statut était "seeding" ou "completed" — ils n'apparaissaient jamais dans la file. Désormais tous les torrents sont transmis, et le client applique ses propres filtres.
- **Erreur TypeScript bloquante** : le type `QueueItem.status` n'incluait pas `"seeding"`, ce qui empêchait la compilation avec les nouveaux filtres.

## [1.1.53] — 2026-07-22

### Ajouté
- **Historique groupé par jour avec heure exacte** : les entrées d'activité (téléchargements terminés, imports, échecs…) sont maintenant regroupées par jour ("Aujourd'hui", "Hier", ou la date complète), avec l'heure exacte (HH:MM) affichée à droite de chaque ligne et la date/heure complète en infobulle — comme un vrai client torrent.
- **Heure d'ajout dans les détails de la file d'attente** : la section dépliée de chaque téléchargement affiche maintenant la date et l'heure exactes d'ajout dans la file.

### Optimisé
- **File d'attente bien plus réactive** : l'API ne rescannait plus l'intégralité de la bibliothèque (641 séries × ~65 épisodes = ~42 000 itérations) pour chaque torrent à chaque appel. Un index infoHash → média est construit en une passe et mis en cache tant que les fichiers bibliothèque ne changent pas. Résultat : la latence de l'onglet Activité est divisée par 5 à 10 sur les grosses bibliothèques.
- **Filtres de l'historique mémoïsés** : les listes filtrées et les ensembles d'utilisateurs/indexeurs uniques n'étaient pas mémoïsés, donc recalculés à chaque rendu (frappe dans la recherche, changement d'onglet, etc.). Ils sont maintenant encapsulés dans `useMemo`.
- **File d'attente mémoïsée** : les compteurs (actifs, en pause, bloqués) et la liste filtrée sont maintenant en `useMemo` pour éviter un re-calcul à chaque poll de 3 secondes.

### Corrigé
- **Dates des films/séries manquants non localisées** : les dates dans l'onglet "Manquant" utilisaient `toLocaleString()` sans passer par la locale sélectionnée dans l'interface — elles s'affichaient toujours en anglais. Elles utilisent maintenant le même format que le reste de l'application.

## [1.1.52] — 2026-07-22

### Corrigé
- **L'application pouvait se figer complètement (pages qui ne répondent plus, requêtes en timeout) pendant les périodes d'activité** : la sauvegarde du cache de métadonnées (~12 Mo) était écrite de façon bloquante toutes les 2 secondes en pleine navigation — sur le disque du NAS, déjà occupé par les téléchargements, chaque écriture gelait tout le serveur le temps qu'elle passe. Elle est maintenant asynchrone, atomique (plus aucun risque de fichier corrompu en cas de coupure), et espacée de 30 secondes.
- **Les gros fichiers de la bibliothèque étaient ~40 % plus lourds que nécessaire** : le fichier des séries (22 Mo) était écrit avec une mise en forme indentée que personne ne lit, payée en CPU et en disque à chaque changement de statut d'épisode. Les gros fichiers sont désormais écrits en compact (13,8 Mo pour le même contenu) ; les petits fichiers de configuration restent lisibles.
- Le panneau des caches ne re-sérialise plus l'intégralité du cache (~12 Mo de travail) à chaque affichage — la taille des entrées est mémorisée au fil de l'eau.

## [1.1.51] — 2026-07-22

### Corrigé
- **Les badges de qualité (codec, source…) étaient illisibles en mode clair sur la fiche d'un film et dans la liste des épisodes** : ces pastilles blanches translucides sont pensées pour se lire par-dessus une affiche (où elles restent inchangées), mais sur ces deux écrans elles s'affichent directement sur le fond de page — devenues quasi invisibles en clair. Elles utilisent maintenant des couleurs adaptées au thème à ces deux endroits précis.

## [1.1.50] — 2026-07-22

### Corrigé
- **Le mode clair manquait de finition et plusieurs éléments étaient peu lisibles** : les champs de saisie (mot de passe, jetons API, filtres…), les séparateurs et certains fonds atténués gardaient leurs teintes pensées pour le thème sombre, ce qui donnait des zones grises ternes aux bordures presque invisibles. L'onglet actif des réglages et de la barre de navigation mobile affichait aussi un texte blanc illisible sur fond clair. Tout est désormais adapté au mode clair — passé en revue sur l'ensemble des pages.

## [1.1.49] — 2026-07-22

### Corrigé
- **Une série partiellement disponible affichait à tort "Téléchargement"** : dès qu'au moins un épisode était disponible, la fiche de la série affichait "Téléchargement" même quand rien n'était réellement en cours — aucun épisode en téléchargement ni en recherche, juste des épisodes encore manquants. Elle affiche maintenant "Manquant", comme la bibliothèque le fait déjà correctement.

## [1.1.48] — 2026-07-22

### Corrigé
- **Un film ou un épisode pouvait rester bloqué sur "Recherche…" pour toujours** : si le serveur redémarre (mise à jour, plantage) pendant qu'une recherche est en cours, son statut restait figé sur "recherche" indéfiniment — rien ne le relançait ni ne le signalait, alors qu'aucun téléchargement n'était réellement en cours. Movviz remet maintenant automatiquement ces éléments à "manquant" au démarrage, pour qu'ils soient repris normalement à la prochaine recherche.

## [1.1.47] — 2026-07-22

### Corrigé
- **Un 429 pendant le téléchargement du fichier torrent lui-même passait inaperçu** : contrairement aux recherches, cette étape ne prévenait jamais le système anti-429 qu'un indexeur venait de répondre "trop de requêtes" — le prochain titre repartait aussitôt le taper. Elle le signale désormais comme les autres, pour que l'indexeur souffle avant la suite.
- **Un échec de récupération refusé par le moteur ne disait pas pourquoi** : le journal de diagnostic affichait juste "refusé par le moteur" sans détail, aussi bien pour les films que pour les packs de séries. Le message inclut maintenant la raison exacte renvoyée par le moteur.

## [1.1.46] — 2026-07-22

### Corrigé
- **Recherche directe des indexeurs en parallèle → séquentielle** : quand le cache RSS ne contient pas de résultat pour un titre (film plus ancien, sorties hors de la fenêtre RSS), la recherche directe interrogeait tous les indexeurs en parallèle avec `Promise.all` — ce qui déclenchait des erreurs 429 (rate-limit) systématiques. Les recherches sont maintenant séquentielles : un indexeur à la fois, sans bombarder les serveurs.
- **Scroll infini de la bibliothèque qui pouvait se bloquer en cours de chargement** : le `IntersectionObserver` qui déclenche le chargement progressif des cartes pouvait utiliser une valeur périmée du nombre total de titres, empêchant le rendu de continuer au-delà du premier lot. Un `ref` garantit que le déclencheur utilise toujours la valeur à jour.

## [1.1.45] — 2026-07-22

### Ajouté
- **Un cœur pour soutenir le projet, un raccourci d'apparence dans l'en-tête** : un bouton en forme de cœur (vers la page de soutien) et le sélecteur clair/sombre/automatique sont maintenant directement accessibles depuis l'en-tête, à gauche du choix de la langue — plus besoin d'aller dans le profil pour changer l'apparence.

### Corrigé
- **Les icônes de l'en-tête (notifications, compte) disparaissaient sur mobile** : la barre de recherche ne rétrécissait pas correctement sur petit écran et poussait les icônes suivantes hors de l'écran. Elle passe maintenant en icône seule sur mobile, et toutes les icônes restent visibles.

## [1.1.44] — 2026-07-22

### Ajouté
- **Apparence claire, sombre ou automatique** : un nouveau réglage dans le profil permet de choisir l'apparence de Movviz sur cet appareil — clair, sombre, ou automatique (suit le réglage du système). Le choix est mémorisé et s'applique immédiatement, sans rechargement ni effet de clignotement au démarrage.

## [1.1.43] — 2026-07-22

### Corrigé
- **Recherche des manquants qui semblait ne rien faire pendant plusieurs minutes** : une synchronisation Plex déjà en cours empêchait la recherche de démarrer tant qu'elle ne s'était pas terminée (jusqu'à 6 minutes d'attente sans aucun indicateur). La recherche des manquants peut maintenant démarrer aux côtés d'une synchronisation déjà en cours au lieu d'attendre son tour. Le bouton affiche aussi désormais "En attente…" pendant ce court délai, au lieu de sembler figé.
- **Une série avec plusieurs saisons manquantes et sans pack intégral disponible recherchait ce pack intégral une fois par saison** (jusqu'à 6 fois de suite pour une série de 8 saisons), alors que la réponse ne peut pas changer d'une saison à l'autre pendant la même recherche. Il n'est désormais recherché qu'une seule fois par série.

## [1.1.42] — 2026-07-22

### Corrigé
- **Une série avec beaucoup d'épisodes manquants et sans pack disponible pouvait prendre des heures** : chaque épisode individuel re-cherchait un pack de saison ET un pack intégral, alors que les deux venaient déjà d'être écartés une seule fois pour toute la saison juste avant. Avec les pauses ajoutées en 1.1.41 pour éviter les 429, cette redondance coûtait environ 5 secondes de recherches inutiles par épisode — pour une série avec 70+ épisodes manquants (une vieille série sans pack dispo), ça grimpait à plusieurs heures. La saison/l'intégrale ne sont plus recherchées qu'une seule fois par saison, pas une fois par épisode.

## [1.1.41] — 2026-07-22

### Corrigé
- **Le 429 se reproduisait même avec la pause de 1,5s entre titres** : pour une seule série sans rien en cache, le code enchaînait saison-pack → intégrale → épisode → nouvel essai saison-pack, chaque étape interrogeant tous les indexeurs en parallèle, sans la moindre pause entre ces étapes internes (seule la pause entre séries différentes existait). Une seule série suffisait déjà à générer 6 à 8 requêtes en quelques secondes. La même pause s'applique désormais aussi entre chaque étape de cette cascade.

## [1.1.40] — 2026-07-22

### Modifié
- **Pause entre chaque titre allongée (800ms → 1,5s)** : le journal de diagnostic a montré en direct qu'un indexeur se mettait en rate-limit après seulement ~35 requêtes en ~35 secondes pendant "Rechercher les manquants" — la pause de 800ms n'était donc pas assez large pour rester sous son seuil de tolérance. Portée à 1,5s partout (films, séries, épisode par épisode), pour une marge plus confortable.

## [1.1.39] — 2026-07-22

### Corrigé
- **Trouvé la vraie fréquence à laquelle les indexeurs se mettent en rate-limit (429) pendant "Rechercher les manquants"** : une série avec beaucoup d'épisodes manquants et sans pack disponible (une vieille sitcom entière, par exemple) déclenchait une recherche directe par épisode, à la chaîne, sans la moindre pause entre chacune — contrairement à tous les autres cas (film par film, série par série, saison par saison), qui respectaient déjà une pause. Résultat observé en direct : plus de 2000 lignes de journal en à peine 25 secondes, toutes "indexeur rate-limité". La même pause qu'ailleurs s'applique désormais entre chaque épisode cherché individuellement, y compris dans les tâches automatiques programmées.

## [1.1.38] — 2026-07-21

### Ajouté
- **Repli en recherche directe partout** (films, séries, sélection manuelle, intégrale de série) : le cache RSS ne contient que les ~100-150 dernières sorties, donc un titre plus ancien n'y apparaissait jamais. Quand le cache ne donne rien, une recherche directe est maintenant tentée sur les indexeurs disponibles — un indexeur en cooldown 429 n'empêche pas l'autre de répondre.
- **Tri par note dans la Bibliothèque**, en plus du tri par titre et par ajout récent.
- **Le journal de diagnostic (Réglages → Diagnostics)** couvre maintenant aussi la recherche directe et la sélection manuelle, et précise quand un "0 résultat" vient d'un indexeur qui répond 429 (rate-limité) plutôt que d'un vrai échec de recherche.

### Modifié
- **"Rechercher les manquants" traite un titre à la fois**, avec une vraie pause entre chaque recherche : plus lent, mais ça ne sollicite plus le CPU ni un indexeur en continu sur toute la durée du batch (et donc plus de risque de déclencher un 429 qui bloquerait aussi la recherche manuelle pendant la fenêtre de cooldown). Le bouton s'adapte en plus à la catégorie affichée dans la Bibliothèque : "Chercher film manquant" sur le filtre Films, "Chercher épisodes manquants" sur Séries, "Rechercher les manquants" sur Tout.

### Corrigé
- **La recherche (manuelle, automatique, et intégrale de série) ne trouvait quasiment rien en pratique.** La requête envoyée aux indexeurs combinait le titre avec l'année ou le code saison/épisode, contenait des espaces (alors que les noms de release utilisent des points : "100.Millions.2025..."), des guillemets typographiques, ou un ":" — chacun de ces cas renvoyait 0 résultat même quand le titre seul trouvait plusieurs dizaines de résultats. La requête envoyée aux indexeurs est maintenant nettoyée et normalisée (titre seul, points à la place des espaces, caractères spéciaux retirés) ; l'année/saison ne sert plus qu'au tri de pertinence en local.
- **Un film ajouté pouvait rester bloqué sur "Recherche..." indéfiniment**, sans jamais télécharger ni échouer proprement, à cause d'un plantage silencieux juste avant l'envoi au moteur quand le repli en recherche directe était nécessaire (le cas le plus courant).
- **"Rechercher l'intégrale" pouvait télécharger n'importe quelle release de la série, pas forcément un vrai pack complet** — par exemple chercher l'épisode manquant d'une saison et se retrouver à télécharger le fichier d'une saison totalement différente, les deux étant simplement des releases qui matchent le titre. Une release n'est désormais retenue comme "intégrale" que si elle porte une mention explicite (Intégrale/Complete/Complet...) ou une plage de saisons couvrant l'essentiel de la série.
- **La Bibliothèque s'arrêtait de charger en plein milieu de la liste** dès qu'on faisait défiler en continu : l'affichage progressif ne se poursuivait que pendant les moments d'inactivité du navigateur, que le défilement laisse rarement arriver. Un déclencheur au défilement charge maintenant la suite dès qu'on approche du bas.
- **Lier un torrent à un film/série pas encore dans la bibliothèque déclenchait un 2ème téléchargement en double** : l'ajouter à la bibliothèque relançait automatiquement sa propre recherche, en plus du fichier qu'on venait de choisir soi-même à la main. Ce cas précis (ajout uniquement pour pouvoir lier un fichier déjà choisi) ne déclenche plus cette recherche automatique.
- **La synchronisation des vues Plex pouvait bloquer toute la file d'attente de jobs pendant de longues minutes** (recherche des manquants, mises à niveau qualité, synchro bibliothèque...), la rendant complètement immobile en apparence : un appel réseau sans délai limite pouvait attendre indéfiniment si la connexion d'un utilisateur restait muette, et le reste du traitement était strictement séquentiel. Elle a maintenant le même délai limite que tous les autres appels Plex, et traite plusieurs séries/utilisateurs en parallèle.

## [1.1.26] — 2026-07-21

### Ajouté
- **Journal de diagnostic pour le bouton "Rechercher les manquants"** : un nouveau panneau dans Réglages → Diagnostics affiche en direct chaque étape de la recherche (lecture du cache RSS, scoring, filtrage, envoi au moteur) avec chronométrage. Permet de voir exactement pourquoi un titre n'est pas trouvé — cache vide, indexeur rate-limité, filtrage qualité trop strict, moteur injoignable. Filtrable par niveau (TOUT/INFO/WARN/ERROR/DEBUG), avec copie et effacement.

## [1.1.25] — 2026-07-21

### Corrigé
- **Scan RSS des indexeurs ne fonctionnait pas après un redémarrage** : le rafraîchissement du cache au boot (`instrumentation.ts`) obtenait un 429 de l'indexeur, ce qui déclenchait un rate-limit en mémoire de 10 minutes. Pendant cette fenêtre, toute tentative de scan RSS (manuel/automatique) voyait l'indexeur comme limité et ne faisait rien — 399ms et terminé. Les rate-limits sont maintenant réinitialisés après le refresh de boot, et le refresh est fait avant le démarrage du planificateur pour éviter les doubles appels concurrents.

## [1.1.24] — 2026-07-21

### Corrigé
- **Plus aucun résultat de recherche nulle part.** Quand tous les indexeurs se retrouvaient temporairement limités en débit (429) au moment du rafraîchissement horaire du cache, celui-ci était écrasé par une liste vide — et comme toute recherche (auto, manuelle, "Rechercher les manquants") lit uniquement ce cache, plus rien ne remontait jusqu'au prochain rafraîchissement réussi. Un rafraîchissement qui ne ramène rien conserve maintenant le cache précédent au lieu de l'effacer.

## [1.1.23] — 2026-07-21

### Modifié
- **Réduit le vrai coût de calcul derrière "Rechercher les manquants"** (pas juste étalé dans le temps comme le correctif précédent) : l'analyse d'un nom de release (extraction titre/saison/épisode/qualité) est maintenant mise en cache — les ~2000 releases du cache indexeurs ne sont plus ré-analysées à chaque recherche alors que leur contenu n'a pas changé depuis le dernier rafraîchissement horaire.

## [1.1.22] — 2026-07-21

### Corrigé
- **"Rechercher les manquants" rendait toute l'application injoignable pendant son exécution.** Chaque recherche compare le titre demandé à tout le cache des indexeurs (jusqu'à ~2000 releases) — un calcul pur, pas une attente réseau, qui s'exécute sur l'unique thread du serveur. Sans pause entre chaque film/série/saison traité, ce calcul s'enchaînait sans interruption et empêchait le serveur de répondre à quoi que ce soit d'autre pendant toute la durée de la recherche. Une micro-pause entre chaque élément laisse maintenant le serveur respirer et continuer à répondre normalement.

## [1.1.21] — 2026-07-21

### Corrigé
- **Chargement des sagas très lent (jusqu'à 400+ appels simultanés à TMDb)** : la fiche "Collections" interrogeait TMDb pour chaque franchise en parallèle sans aucune limite, ce qui déclenchait un embouteillage auto-infligé (chaque appel finissait par ralentir à ~4s). Limité à 10 appels en parallèle — même résultat, sans le pic de charge.
- **Badges "utilisateurs en attente" / "demandes en attente"** : ils interrogeaient la liste complète toutes les 5 secondes en continu tant que l'app était ouverte. Passé à 30 secondes — largement suffisant pour un badge d'attente, et beaucoup moins de charge sur le serveur.

## [1.1.20] — 2026-07-21

### Corrigé
- **Cause probable du "Health check exceeded timeout" sur le conteneur Docker** : l'écriture du cache RSS (jusqu'à ~2000 releases) se faisait de façon bloquante — pendant sa durée, tout le serveur (y compris la réponse au health check) était gelé. C'est particulièrement sensible quand le disque du NAS est déjà sollicité par des téléchargements en cours. L'écriture reste tout aussi fiable (toujours attendue avant de continuer) mais ne bloque plus le reste du serveur pendant qu'elle a lieu.

## [1.1.19] — 2026-07-21

### Corrigé
- **Une release "morte" (aucun pair ne détient les derniers morceaux) était re-téléchargée en boucle indéfiniment** : dès qu'un téléchargement était abandonné pour cette raison, la prochaine recherche automatique (ou "Rechercher les manquants") retombait sur exactement la même release et repartait pour un cycle d'échec identique, à l'infini. Cette release précise est maintenant écartée pendant 24h après un abandon, le temps qu'une autre source soit tentée.
- **Erreur "state save failed: ENOENT" dans les journaux du moteur** : deux sauvegardes de l'état du moteur qui se chevauchaient pouvaient se marcher dessus (la seconde tentait de renommer un fichier temporaire déjà consommé par la première). Chaque sauvegarde utilise maintenant son propre fichier temporaire, éliminant la collision.

## [1.1.18] — 2026-07-21

### Corrigé
- Dans la fenêtre "Lier avant de télécharger" / "Lier" : quand le titre choisi n'était pas encore dans la bibliothèque et nécessitait une approbation admin (compte non-admin), la liaison échouait silencieusement au lieu d'expliquer pourquoi — message clair maintenant, plutôt qu'une liaison invalide.

## [1.1.17] — 2026-07-21

### Corrigé
- **Cache RSS non écrit sur disque** : `writeJsonCached` utilise un délai de 300ms pour coalescer les écritures, mais pour le cache RSS (écriture unique en bloc), cette latence asynchrone empêchait le fichier d'être persisté. Réécrit avec `writeFileSync` + `renameSync` atomique, le fichier `rss-cache.json` est maintenant écrit immédiatement et disponible après chaque rafraîchissement.

## [1.1.16] — 2026-07-21

### Corrigé
- **Cache RSS vide au redémarrage** : le cache RSS est maintenant rechargé automatiquement au boot du serveur (via `instrumentation.ts`), les recherches fonctionnent immédiatement après un reboot sans attendre le premier cycle planifié.

## [1.1.15] — 2026-07-21

### Modifié
- **Toutes les recherches utilisent le cache RSS** : plus aucun appel direct aux indexeurs sauf le rafraîchissement explicite du cache (tâche `rss-indexer-scan`). Les recherches auto-grab, le bouton « Rechercher les manquants », les recherches manuelles et les tâches de retry lisent toutes depuis `rss-cache.json`. Élimine les risques de 429 sur les indexeurs.
- **Recherche manuelle** : lit aussi depuis le cache RSS, avec filtrage par mot-clé et tri par score ou date selon le mode.

## [1.1.14] — 2026-07-21

### Corrigé
- **Bouton « Rechercher les manquants » bloqué en chargement** : si le job se terminait avant le premier rafraîchissement du statut (2 secondes), le spinner restait indéfini et le bouton semblait inactif. Correction avec un fallback de 8 secondes et une gestion plus robuste du passage « en cours → terminé ».
- **Recherche manquants très lente sur les grandes bibliothèques** : les films et épisodes manquants étaient traités un par un en séquence. Passage à 3 recherches simultanées (concurrency limitée), ce qui réduit considérablement le temps d'attente.

## [1.1.13] — 2026-07-21

### Ajouté
- **Cache RSS + rate-limit automatique** : les indexeurs qui répondent HTTP 429 (trop de requêtes) sont automatiquement mis en pause pendant 10 minutes, sans requête directe pendant cette période. Le cache RSS évite de taper les indexeurs à chaque cycle de matching — le rafraîchissement du cache et le matching sont faits dans la même tâche horaire, garantissant zéro régression.
- **Requêtes nettoyées de la ponctuation** : les caractères `!`, `"`, `(`, `)`, `+`, `|` sont supprimés des requêtes de recherche, ils sont interprétés comme des opérateurs par les indexeurs Torznab et causaient des faux négatifs (ex: "Black Friday !" ne trouvait rien).

### Corrigé
- **Faux positif du title matching** : un titre court comme "Lucky" (1 mot) ne matche plus "Lucky Luke" (2 mots), le score de containment est pénalisé de -0.15 pour les titres mono-mots.

## [1.1.12] — 2026-07-21

### Corrigé
- **Recherche échouait sur les titres avec ponctuation** : un film comme "Black Friday !" ne trouvait aucun résultat car le "!" est interprété comme un opérateur NOT par les indexeurs Torznab. La fonction `sanitizeQuery()` supprime maintenant les caractères spéciaux (`!`, `"`, `(`, `)`, `+`, `|`) des requêtes de recherche avant de les envoyer aux indexeurs.

## [1.1.11] — 2026-07-21

### Corrigé
- **Faux positif du title matching sur les titres courts** : un titre comme "Lucky" (1 mot) matcher "Lucky Luke" (2 mots) et se faisait télécharger à tort. Le score de containment est maintenant pénalisé quand le titre le plus court n'a qu'un seul mot, ce qui évite les confusions entre une série courte et une série plus longue qui partage le même premier mot. Tous les autres cas (titres multi-mots, variantes, franchises) restent inchangés.

## [1.1.10] — 2026-07-21

### Ajouté
- **PerfPanel : Interface et Appels sortants visibles simultanément** : le tableau des temps de réponse dans Diagnostics affiche maintenant les deux vues (Interface : ce que le navigateur ressent, Appels sortants : ce que le serveur attend de TMDb/Plex/indexeurs/moteur) l'une en dessous de l'autre avec un bouton Actualiser — plus besoin d'onglet pour basculer.
- **Backfill des infos techniques Plex après chaque sync** : la synchronisation Plex récupère maintenant les métadonnées audio/vidéo/sous-titres/chapitres pour tous les films de la bibliothèque, même ceux qui n'ont pas été modifiés récemment. Fini les "Infos techniques" vides après un sync incrémental.

### Corrigé
- **sync incrémental ignorait les films existants** : les films déjà dans la bibliothèque avec `plexRatingKey` ne récupéraient pas leurs `plexMediaInfo` tant qu'un sync complet (force) n'était pas lancé — la nouvelle fonction `backfillMissingMediaInfo` les rattrape automatiquement après chaque sync, même incrémental.

## [1.1.8] — 2026-07-21

### Ajouté
- **Infos techniques détaillées sur la fiche film** : quand le film vient de Plex, la fiche détail affiche maintenant une carte "Infos techniques" avec le conteneur, le débit, la liste des pistes audio (codec, canaux, langue), les sous-titres disponibles (langue + indication forced) et le nombre de chapitres.
- **Badge "Disponible" sur les titres similaires** : les cartes de la section "Titres similaires" sur la fiche détail d'un film affichent maintenant un badge vert si le film est déjà dans la bibliothèque — plus besoin de cliquer pour vérifier.
- **Relance automatique des films et épisodes manquants** : une nouvelle tâche planifiée toutes les 6 heures re-cherche les films et épisodes surveillés restés bloqués sur "manquant" (après un échec de la recherche initiale, ou quand le RSS ne les a pas attrapés). Respecte toutes les règles des profils de qualité (mots interdits, taille max, points codec).

## [1.1.7] — 2026-07-21

### Ajouté
- **Vrais logos pour les badges qualité** : 4K, HDR, Dolby Vision, Dolby Atmos, DTS, TrueHD s'affichent maintenant avec leur logo officiel (SVG inline) au lieu d'un simple texte. Le 2160p devient un logo "4K", le 4320p devient "8K".
- **Lier un téléchargement à une œuvre pas encore dans la bibliothèque** : le sélecteur de liaison dans l'onglet "Non liés" permet maintenant de chercher directement sur TMDb et d'ajouter l'œuvre à la bibliothèque avant de la lier — plus besoin de quitter l'écran.
- **Détection des packs intégrale dans la file d'attente** : quand un téléchargement concerne tous les épisodes surveillés d'une série, la file affiche "Intégrale" au lieu d'un simple numéro de saison.
- **Sous-onglets dans l'historique** : l'onglet Historique de l'Activité V2 dispose maintenant de filtres rapides (Tous / Terminé / En cours / Échecs) en haut de page, au-delà des filtres avancés existants.
- **Codecs extraits depuis Plex** : le sync Plex récupère maintenant les codecs vidéo (HEVC, H.264…), audio (DTS, EAC3, TrueHD…) et le HDR (HDR10, Dolby Vision) directement depuis l'analyse des fichiers effectuée par Plex — plus fiable que le nom du fichier. Applicable à tous les éléments déjà synchronisés dès le prochain sync complet.

### Modifié
- **Taille des badges augmentée** : les badges qualité/codec sont plus grands et plus lisibles, aussi bien sur les jaquettes de la bibliothèque que dans les fiches détail et la liste des épisodes.
- **Intervalle de purge de la corbeille** : passe de quotidien à tous les 30 jours (les fichiers restent 30 jours dans la corbeille avant suppression définitive).

### Corrigé
- **Badges "téléchargement" fantômes sur les séries** : quand un pack de saison ou une intégrale était supprimé de la file d'attente, seuls les épisodes des packs saison/série libéraient leur statut "downloading" — les autres restaient bloqués avec un badge de téléchargement inexistant. Désormais, tous les épisodes liés au torrent supprimé sont libérés en une seule passe.
- **Réconciliation des téléchargements** : la tâche de réconciliation (toutes les 10 minutes) vérifiait uniquement si le torrent *existait* dans le moteur. Un torrent terminé en phase de seed n'était pas libéré, laissant l'épisode bloqué sur "downloading". Désormais, seul un torrent réellement en cours de téléchargement (ou en attente de métadonnées) maintient le statut "downloading" — un torrent terminé, en seed, en pause ou stalled libère l'épisode.

## [1.1.6] — 2026-07-21

### Ajouté
- **Badges qualité directement sur les jaquettes** : la résolution (1080p, 4K…), le codec vidéo (x265…), le codec audio (DTS, Atmos…) et le HDR (HDR10, Dolby Vision…) s'affichent maintenant en petits badges en bas de chaque affiche dans la bibliothèque, ainsi que dans la fiche détail d'un film et à côté de chaque épisode dans la liste des saisons. Pour les fichiers déjà présents avant cette version, les infos sont extraites automatiquement depuis le nom du fichier.
- **"Lier avant de télécharger" dans la recherche** : quand tu tombes sur un résultat sur la page de recherche sans être passé par la sélection manuelle d'un film ou d'une série, Movviz te propose maintenant de choisir à quelle œuvre (film/série, saison, épisode) le relier avant même de lancer le téléchargement — comme ça, l'import se fait tout seul à l'arrivée.
- **Onglet "Non liés" dans Activité** : un nouvel onglet (admin seulement) qui liste les fichiers déjà téléchargés et rangés sur le disque mais jamais associés à un film ou une série de ta bibliothèque. Tu peux les lier rétroactivement en choisissant l'œuvre correspondante, sans avoir à tout retélécharger.

### Corrigé
- **Traductions manquantes** : les libellés de liaison, l'option "Changer" et "Aucun résultat", ainsi que "Saison" dans les fiches étaient absents des traductions italienne, néerlandaise et allemande — désormais présents partout.
- **Import de saison** : un pack qui se révèle être une saison différente de celle attendue (ex. étiqueté S02 mais téléchargé pour S03) n'écrase plus les épisodes de S03 par erreur — le système vérifie maintenant que chaque fichier correspond bien à la saison visée.

## [1.1.5] — 2026-07-21

### Corrigé
- La recherche d'une intégrale de série ne cherchait qu'en anglais ("Complete Series") et ratait donc les packs étiquetés autrement (ex. "Intégrale" en français) — elle essaie maintenant plusieurs termes équivalents en français, anglais, italien, néerlandais et allemand, et fusionne les résultats.

## [1.1.4] — 2026-07-21

### Corrigé
- Une recherche pouvait récupérer un titre proche mais différent (ex. "Once Upon a Time" attrapait "Once Upon a Time in Wonderland") plutôt que de ne rien trouver — un titre officiel plus long qui contient le titre recherché est maintenant nettement moins bien noté, au lieu d'être traité comme une correspondance quasi parfaite.
- Deux épisodes manquants de la même saison recherchés au même moment pouvaient déclencher deux téléchargements identiques du même pack de saison ; un seul est maintenant lancé, le second réutilise le premier.
- La file d'attente d'Activité affichait un pack de saison comme s'il était figé sur un seul épisode ; elle indique maintenant clairement "Saison N — pack (X épisodes)".

## [1.1.3] — 2026-07-20

### Corrigé
- **Fiche série : les saisons issues d'un resync TVDB pour l'anime restaient invisibles** même après la synchro. Le menu déroulant des saisons utilisait toujours les métadonnées TMDb (1 saison pour les animes) pour décider quelles rangées afficher, ignorant les saisons supplémentaires détectées sur le disque. L'accordéon utilise maintenant les données de la bibliothèque quand elle a plus de saisons que TMDb, ce qui fait apparaître toutes les saisons possédées quelle que soit la couverture TMDb.

## [1.1.0] — 2026-07-20

### Corrigé
- Téléchargement ciblé sur un seul épisode dans un pack de saison ou de série : bien plus fiable de bout en bout — la progression et la détection de fin ne se basent que sur le fichier réellement voulu, un transfert qui stagne juste avant la fin relance automatiquement une reconnexion aux pairs puis se rabat sur le fichier complet si besoin, une source vraiment morte est abandonnée pour repartir sur une autre release au lieu de tourner indéfiniment, et un redémarrage ne recible plus que l'épisode voulu.
- Statuts plus fiables sur la fiche série : plusieurs épisodes manquants regroupés dans le même pack passent tous en "Disponible" une fois terminé (plus seulement le premier), un épisode ou film déjà disponible ne redescend plus à tort en "Manquant", et le badge de saison distingue bien "en cours" de "manquant".
- Pause, reprise, redémarrage et suppression fonctionnent aussi sur un téléchargement déjà terminé et importé.
- Un import qui échoue apparaît maintenant dans l'Historique au lieu de rester invisible, et n'écrase plus jamais un autre épisode déjà disponible.
- Temps restant affiché sur un téléchargement : toujours exact et cohérent avec la vitesse affichée juste à côté.
- Sécurité : les actions de contrôle des téléchargements (pause, suppression, ajout, vidage de la file) sont maintenant vérifiées aussi côté serveur, pas seulement masquées côté interface pour les comptes non-admin.
- Recherche automatique et manuelle : un titre ou un épisode clairement erroné est maintenant pénalisé correctement, il ne peut plus dépasser une vraie correspondance grâce aux seuls bonus de qualité/seeders.
- Le bouton "Rechercher la saison" reste maintenant visible même une fois la saison complète.
- La recherche rapide (Cmd/Ctrl+K) et Bibliothèque > Manquants ouvrent la bonne fiche pour un film, au lieu de retomber sur la bibliothèque générale.
- Réglages > Indexeurs : une erreur d'indexeur (clé API invalide, requête refusée…) affiche maintenant un message clair au lieu d'être confondue avec "aucun résultat" ou un simple "HTTP 401".
- Mobile : la barre de navigation basse ne se décale plus au scroll, et le bouton "Rechercher les manquants" garde son état si tu changes de page pendant qu'il tourne ; la puce de notification sur l'icône Activité reste maintenant synchronisée avec les téléchargements affichés dans la liste.
- Auto-reliaison des fichiers accessibles via plusieurs points de montage (Docker/NAS) : appliquée de façon fiable dans tous les cas, plus seulement un cas particulier rarement atteint.

### Ajouté
- Un seul épisode manquant dans un pack de saison ou de série ne télécharge plus que ce fichier, jamais tout le pack — y compris en repli automatique quand aucune release isolée n'existe pour cet épisode.
- Bouton "Rechercher les manquants" global : recherche tout ce qui manque dans toute la bibliothèque en une fois, en préférant un pack de saison dès que plusieurs épisodes manquent et l'intégrale d'une série quand elle est presque entièrement absente.
- Bandeau "Pack en cours de téléchargement" sur la fiche série quand plusieurs épisodes partagent le même torrent, et fusion des deux anciennes fiches série en une seule, plus complète.
- Bouton "Logs" dans l'Historique sur les entrées en échec, avec le détail de ce qui n'a pas fonctionné.
- Support des épisodes doubles (un seul fichier couvrant deux numéros d'épisode).
- Réglages > Indexeurs : les vraies catégories de chaque indexeur, testables directement depuis le formulaire d'ajout sans avoir à l'enregistrer d'abord.
- Nouvel outil de suppression des dossiers vides après renommage ou déplacement (Réglages > Fichiers), avec option pour le lancer automatiquement depuis Renommage/Réparer les chemins.
- Bibliothèque réorganisée en un panneau de filtres plus clair, et fiches film/série optimisées pour smartphone.

## [1.0.70] — 2026-07-19

### Ajouté
- **"Réparer les chemins" proposait de relier des fichiers alors qu'ils étaient déjà accessibles** via un autre point de montage (ex. Docker : un même fichier NAS visible sous `/data/films/...` dans Movviz et sous `/volume1/docker/plex/films/...` du point de vue Plex — même fichier, deux chemins). Le scan voyait le chemin enregistré introuvable, trouvait un candidat identique ailleurs, et demandait à l'utilisateur de "réparer" quelque chose qui n'était pas cassé. Détection automatique maintenant : si le fichier existe au même sous-chemin (dossier parent + nom de fichier) ailleurs dans la bibliothèque, c'est le même fichier physique vu d'un autre mount — Movviz relie la fiche silencieusement, sans rien demander. Quand plusieurs candidats pointent vers le même fichier physique via des mounts différents (Linux/Mac : comparaison par inode ; Windows : résolution `realpathSync.native()` qui déroule les lettres de lecteur `Z:\` → `\\NAS\share\...`), ils sont dédoublonnés avant analyse pour ne pas créer de fausse ambiguïté.

## [1.0.69] — 2026-07-19

### Modifié
- **Réglages : la barre latérale était illisible**, avec un groupe "Bibliothèque" de 10 onglets où il fallait défiler pour tout voir. Le groupe est maintenant éclaté en trois : "Bibliothèque" (métadonnées, Plex), "Fichiers" (indexation, renommage, nommage, réparation, corbeille) et "Importations" (listes d'import, Seerr, blocages). L'onglet "Nommage" a quitté le groupe "Téléchargement" pour rejoindre "Fichiers" où il a toujours dû être. Le groupe "Avancé" (un seul interrupteur "Mise à niveau qualité") a fondu dans "Système". Aucun changement fonctionnel, juste de l'ordre.
- **Les noms des tâches planifiées (Réglages > Système > Tâches) étaient toujours en français** même quand l'interface était configurée en anglais, néerlandais ou allemand — ils venaient du code serveur qui ne connaît pas ta langue. Ils passent maintenant par le même système de traduction que le reste de l'app.
- **Les libellés des champs de configuration des notifications** (Webhook URL, Bot Token, Chat ID, etc.) étaient aussi en anglais fixe. Ils suivent maintenant ta langue d'interface.
- **La référence des variables de nommage** (la liste des `{title}`, `{year}`, `{season}` dans l'éditeur) était en anglais — les explications et les exemples aussi. Tout est maintenant traduit.
- **Les notifications poussées vers Discord, Telegram, Slack** mélangeaient l'anglais et le français selon l'endroit du code qui les envoyait ("is now available" ici, "supprimé de la bibliothèque" là). Elles sont maintenant toutes en français, quelle que soit la provenance.

## [1.0.67] — 2026-07-18

### Ajouté
- **"Réparer les chemins" : rattachement manuel par navigateur de fichiers.** Pour les fiches qu'aucune correspondance automatique ne peut retrouver — typiquement un fichier déplacé dans un dossier portant le nom d'un tout autre titre suite à un ancien bug de renommage — un bouton "Parcourir…" ouvre un explorateur du disque du serveur pour choisir soi-même le vrai fichier. Fonctionne comme le sélecteur de dossier des Réglages, mais affiche aussi les fichiers vidéo, pas seulement les dossiers.

### Corrigé
- **Les fichiers `.m4v` n'étaient jamais détectés par le scan de la bibliothèque ni par "Réparer les chemins".** L'extension manquait de la liste reconnue comme vidéo, donc ces fichiers (ex. certaines séries importées en `.m4v`) étaient invisibles pour ces outils, même quand ils existaient bel et bien sur le disque.

## [1.0.66] — 2026-07-18

### Corrigé
- **"Réparer les chemins" ne trouvait rien pour les fichiers déjà renommés.** L'outil ne comparait que le nom de fichier de l'ancien chemin enregistré à ce qu'il trouvait sur le disque — si le fichier avait déjà été renommé entre-temps (nouveau titre, nouveau format), son nom avait changé lui aussi, donc la comparaison échouait toujours. L'outil calcule maintenant, à partir du titre et de l'année déjà connus de la fiche et des modèles de nommage actuels, l'emplacement exact où le fichier devrait se trouver, et vérifie directement s'il y est — sans appel réseau, juste une vérification sur le disque. Le repli par nom de fichier reste utilisé en second recours pour les fichiers non renommés.
- **Deux fiches cassées pouvaient être reliées au même fichier, créant des doublons dans la bibliothèque.** Quand deux fiches différentes partageaient la même correspondance unique (typiquement un vrai doublon déjà présent), les deux étaient auto-sélectionnées et reliées au même fichier physique. Ce genre de conflit est maintenant détecté et jamais auto-sélectionné — la case à cocher reste désactivée et une note explique le conflit, en attendant une vérification manuelle.

## [1.0.65] — 2026-07-18

### Ajouté
- **Paramètres > Bibliothèque : nouvel outil "Réparer les chemins"** — pour les fiches dont le fichier enregistré est introuvable (par exemple après un déplacement manuel de fichiers hors de leurs dossiers d'origine), cherche un fichier portant exactement le même nom ailleurs dans la bibliothèque et propose de relier la fiche à son vrai fichier. Ne déplace ni ne supprime jamais rien sur le disque — seules les correspondances certaines (un seul fichier candidat) sont pré-sélectionnées ; les correspondances ambiguës ou introuvables restent affichées pour vérification manuelle avant toute application.
- **Bibliothèque : tri par "Récemment ajouté"** — en plus du tri par titre, permet de voir en un coup d'œil ce qui vient d'apparaître dans la bibliothèque.

## [1.0.63] — 2026-07-18

### Ajouté
- **Bibliothèque > Manquant : bouton "Télécharger tout"** — relance une recherche pour chaque film et épisode manquant en un clic, au lieu de cliquer élément par élément. Affiche la progression pendant l'opération.

### Corrigé
- **Activité (v2) : les 4 onglets (File d'attente, Historique, Manquant, Échecs) continuaient de faire des requêtes en arrière-plan en continu même quand un autre onglet était affiché** — chaque ligne de la liste "Manquant" interroge l'état de sa recherche toutes les 2 secondes, et la liste elle-même se rafraîchit toutes les 3 secondes ; avec les 4 onglets gardés actifs simultanément (pour un retour instantané en changeant d'onglet) et jusqu'à une centaine de lignes affichées, ça produisait un flux constant de requêtes réseau même en étant sur un onglet différent. Chaque onglet met maintenant son propre rafraîchissement en pause tant qu'il n'est pas celui affiché.

## [1.0.62] — 2026-07-18

### Ajouté
- **Application du renommage — barre de progression + journal en temps réel :** comme le scan, l'application des renommages passe maintenant par une tâche en arrière-plan avec progression et journal en direct. Les éléments déjà correctement nommés ou renommés avec succès disparaissent automatiquement de la liste ; seuls ceux qui ont échoué restent affichés, avec l'explication de l'échec.
- **"Quoi de neuf" cumulatif :** si tu n'as pas ouvert Movviz depuis plusieurs versions, la fenêtre affiche maintenant tout ce que tu as manqué (de ta dernière version vue jusqu'à la version actuelle), pas seulement les nouveautés de la toute dernière version.

### Corrigé
- **Renommage de séries dont les épisodes sont répartis sur deux dossiers différents (ex : coquille dans le nom d'origine) :** le renommage ne gérait correctement que les épisodes physiquement présents dans le dossier de référence ; ceux d'un second dossier (nom légèrement différent) étaient silencieusement laissés de côté sur le disque, alors que la fiche bibliothèque était mise à jour comme si tout avait été déplacé. Le renommage part maintenant systématiquement de l'emplacement réel de chaque épisode, regroupe tout dans le dossier unifié, et déplace aussi les fichiers annexes (sous-titres, .nfo, affiches) laissés dans les anciens dossiers avant de les supprimer une fois vides.
- **Même défaut sur les films :** la fiche bibliothèque pouvait être marquée "renommé avec succès" même quand le fichier n'existait plus à l'emplacement enregistré. La mise à jour de la fiche n'a lieu que si le fichier est vérifié présent à sa nouvelle destination.
- **Journal du renommage — explication des échecs :** chaque échec (épisode introuvable, taux TMDb dépassé, etc.) est maintenant explicité ligne par ligne dans le journal, et un résumé récapitulatif est ajouté à la fin. Les éléments en échec sont aussi listés avec leur raison directement dans le résultat, pas seulement le compteur.

## [1.0.61] — 2026-07-18

### Corrigé
- **Le journal du renommage n'affichait jamais les séries.** Le journal était plafonné à 500 lignes, et les films sont toujours analysés avant les séries — sur une bibliothèque de plusieurs centaines de films, le plafond était atteint avant même de commencer les séries, qui n'apparaissaient donc jamais. Plafond retiré.

## [1.0.60] — 2026-07-18

### Corrigé
- **Même bug de chemins que le renommage (v1.0.59), corrigé partout ailleurs.** La corbeille, l'indexation (scan et import) et la réconciliation avec le disque utilisaient toutes le même calcul de chemin sensible au système d'exploitation local — pouvant produire des chemins corrompus quand la bibliothèque est sur un NAS/serveur consulté depuis un poste différent. Chaque fonction reconnaît maintenant le format du chemin réel qu'elle traite plutôt que de se fier au système d'exploitation de la machine qui l'exécute.

## [1.0.59] — 2026-07-18

### Corrigé
- **Le renommage de bibliothèque échouait ("Erreur d'analyse" / "Execute failed") dès que les chemins de fichiers venaient d'un NAS/serveur Linux consulté depuis un poste différent.** Le calcul du nouveau chemin utilisait le séparateur du système d'exploitation local au lieu de celui du chemin réel, produisant des chemins corrompus (mélange de `/` et `\`). Le renommage reconnaît maintenant le format du chemin d'origine et le respecte du début à la fin.
- Durcissement de sécurité : le renommage utilisait un appel shell avec le nom de fichier inséré directement dans la commande (repli si la suppression normale échoue) — remplacé par un appel qui ne passe jamais par l'interpréteur de commandes, donc aucun caractère dans un titre ne peut être interprété comme une commande.

## [1.0.57] — 2026-07-18

### Ajouté
- **Renommage — tâche background persistante :** le scan passe par le système de jobs (file d'attente, progression, historique). Tu peux quitter la page et revenir, la progression continue et les résultats restent disponibles. Visible dans Réglages > File d'attente.

## [1.0.56] — 2026-07-18

### Ajouté
- **Renommage — barre de progression + journal d'analyse :** le scan affiche maintenant une barre de progression avec pourcentage et un journal en direct listant chaque film/série analysé avec son résultat. Permet de diagnostiquer les échecs (TMDb injoignable, taux limité, titre non trouvé, etc.). Accessible via le bouton "Afficher le journal" dans le panneau de renommage.

### Corrigé
- **Scan de renommage — erreur silencieuse :** le scan pouvait échouer sans message clair (timeout, erreur TMDb, etc.). La réponse est maintenant un flux NDJSON avec progression en temps réel, et les erreurs sont affichées dans l'interface. La route API a aussi un `maxDuration` de 5 minutes pour les grandes bibliothèques.

## [1.0.55] — 2026-07-18

### Ajouté
- **Renommage de bibliothèque :** analyse tous les films et séries, calcule les noms attendus avec le titre officiel TMDb dans la langue de ton interface, et renomme les dossiers/fichiers sur le disque. Sélection individuelle ou par lot (tout, films, séries). Déclenche un scan Plex automatique après chaque renommage. Configurable dans Réglages > Bibliothèque > Renommage.

## [1.0.54] — 2026-07-18

### Ajouté
- **Corbeille :** filet de sécurité pour les suppressions — quand un film ou une série est supprimé avec ses fichiers, ils sont déplacés dans un dossier configurable au lieu d'être effacés définitivement. Une purge automatique quotidienne les supprime passé le délai choisi (30 jours par défaut). Configurable dans Réglages > Bibliothèque > Corbeille.
- **Corbeille exclue des scans :** les fichiers dans la corbeille ne sont ni signalés comme "non suivis" par la réconciliation, ni proposés à l'indexation.

### Corrigé
- **Crash "client already destroyed" après "Supprimer tout" :** le clear-all déclenchait une erreur TCP qui tuait le client WebTorrent en boucle au redémarrage. Le handler d'erreur précoce (`onEarlyError`) vérifie maintenant `client.destroyed` avant d'appeler `destroy()`.

## [1.0.53] — 2026-07-18

### Corrigé
- **Le bouton "Mise à niveau par qualité" (Réglages > Activité) se remettait tout seul sur "activé"** après un vidage de cache navigateur ou sur un nouvel appareil, même si un admin l'avait explicitement désactivé. Le réglage vivait pour moitié dans le stockage du navigateur (qui ne connaît pas la vraie valeur choisie côté serveur), pour moitié côté serveur — désormais une seule source de vérité, exclusivement côté serveur. La liste "Manquants" (onglet Bibliothèque) utilisait aussi l'ancienne valeur locale pour décider d'afficher les mises à niveau possibles ; elle suit maintenant le même réglage réel.

## [1.0.52] — 2026-07-18

### Ajouté
- **Indexation Films / Indexation Séries (Réglages > Bibliothèque).** Deux nouveaux écrans qui scannent le(s) dossier(s) de bibliothèque à la recherche de fichiers jamais liés à un film ou une série — placés à la main, migrés d'un autre outil, ou ajoutés avant Movviz. Chaque dossier détecté est proposé avec un titre TMDb deviné automatiquement (corrigible via une recherche manuelle si le résultat ne convient pas), et un clic sur "Importer" relie les fichiers directement, sans repasser par une recherche d'indexeur puisqu'ils existent déjà sur le disque.

## [1.0.51] — 2026-07-18

### Corrigé
- **Le compteur des sagas (Collections) comptait aussi les films pas encore sortis** — une franchise active affichait donc en permanence un ratio incomplet ("1/12" même en possédant tous les films déjà sortis). Seuls les films réellement sortis comptent maintenant dans le total.

### Modifié
- **Sagas : le ratio "possédés/total" passe d'un texte jaune brut à un badge cohérent** avec le reste de l'interface, accompagné d'une barre de progression. La section Sagas a aussi son propre sélecteur de vue (grille large, grille compacte, liste).

## [1.0.50] — 2026-07-18

### Corrigé
- **Les notifications s'affichaient toujours en français ou en anglais, jamais dans ta langue.** Elles étaient enregistrées comme du texte figé côté serveur, qui ne sait pas quelle langue tu as choisie. Chaque notification est maintenant reconstruite dans ta langue au moment de l'affichage — titre du film/série, saison, épisode, quantités, tout est traduit dans les 5 langues.
- **Téléchargement d'une saison complète : un seul épisode (le dernier) affichait "en cours de téléchargement"**, les autres restaient bloqués sur leur ancien statut. Chaque mise à jour de statut écrasait la précédente au lieu de s'additionner ; tous les épisodes de la saison sont maintenant mis à jour en une seule fois.
- **Lien mort dans l'historique** pour une release choisie manuellement depuis Recherche — pointait vers une fiche sans identifiant. Corrigé pour toujours renvoyer vers la bonne fiche.
- **Zone dangereuse : une action pouvait échouer silencieusement** en affichant quand même "Fait" — la case de confirmation était aussi toujours en français quelle que soit la langue choisie. Les deux sont corrigés.
- **Choix manuel de release sur une série terminée** ouvrait toujours la recherche sur la saison 1 au lieu de la première saison réellement incomplète.
- Petites incohérences internes dans le suivi des recherches et des indexeurs, sans impact visible.

## [1.0.49] — 2026-07-18

### Corrigé
- **Erreur d'hydratation React sur la fiche d'une série** : le bouton "rechercher cette saison" était imbriqué dans le bouton qui déplie/replie la saison — HTML invalide. La ligne dépliable est maintenant un élément cliquable ordinaire (accessible au clavier comme avant), le bouton de recherche reste un vrai bouton indépendant à l'intérieur.

## [1.0.48] — 2026-07-18

### Corrigé
- **La file d'attente affichait parfois "Indexeur inconnu" pour un téléchargement pourtant lancé par Movviz lui-même.** La correspondance entre le torrent en cours et son historique de recherche se faisait uniquement par empreinte du torrent — qui peut être représentée différemment par le moteur selon le format du torrent (hybride v1/v2). Un épisode ou une saison grabbé automatiquement enregistrait aussi sa référence de bibliothèque dans un format légèrement différent de celui réellement utilisé ailleurs, empêchant toute correspondance de secours. Les deux formats sont maintenant unifiés, et la file d'attente retrouve l'indexeur via cette référence si l'empreinte seule ne suffit pas.

## [1.0.47] — 2026-07-18

### Corrigé
- **Collections : l'encart des sagas laissait un vide brut** pendant son chargement, au lieu d'une esquisse — la page sautait visuellement dès que les données arrivaient.

### Ajouté
- **"Lancer maintenant" dans Réglages > Tâches ne bloque plus la page.** Comme les recherches manuelles, la tâche part en tâche de fond via la file d'attente ; le bouton se remet à tourner tout seul si tu reviens sur la page pendant qu'elle travaille encore.

## [1.0.46] — 2026-07-18

### Corrigé
- **Le bouton "Rechercher maintenant" sur la fiche d'une série ne faisait rien** (erreur 404 silencieuse) — il visait une route qui n'existait pas. Il lance maintenant une recherche sur toutes les saisons surveillées qui ont des épisodes manquants, avec le même bouton qui se remet à tourner si tu reviens sur la page pendant que ça travaille.

### Ajouté
- **Réactivité des Réglages :** dans Blocages, Indexeurs, Listes d'import et Plex (attribution de profil), retirer/activer/désactiver une entrée s'affiche désormais immédiatement, sans attendre la réponse du serveur.

## [1.0.45] — 2026-07-18

### Ajouté
- **Réactivité globale de l'interface :** de nombreuses actions (pause/reprise/suppression dans la file d'attente, surveiller/ignorer dans les manquants, approuver/refuser une demande, ajouter à la liste de suivi) s'affichent maintenant immédiatement à l'écran au clic, sans attendre la réponse du serveur. En cas d'échec, l'affichage se corrige automatiquement.
- **Les recherches manuelles ("Rechercher maintenant") ne bloquent plus la page.** Elles partent maintenant en tâche de fond via le même système de file d'attente que les tâches planifiées : le bouton se remet à tourner tout seul si tu reviens sur la page pendant que la recherche est encore en cours, même après être passé ailleurs entre-temps.

## [1.0.44] — 2026-07-18

### Modifié
- **Recherche instantanée (barre du haut / Cmd+K) :** supprimé la règle qui redirigeait brutalement vers Découverte dès 3 caractères tapés. La recherche affiche maintenant les résultats en direct dans la fenêtre — bibliothèque et catalogue TMDb mélangés, dédupliqués — sans jamais te faire quitter ce que tu es en train de taper. Un lien "Voir tous les résultats" reste disponible en bas si tu veux ouvrir Découverte. Recherche annulée et relancée proprement à chaque frappe (fini les résultats obsolètes qui s'affichent en retard).

### Corrigé
- **File d'attente : l'indexeur et la qualité affichés étaient inventés**, pas les vraies données ("YGG" ou "Torrent9" selon le type de média, qualité toujours "1080p"/"720p"). Les vraies informations enregistrées au moment du téléchargement (indexeur réel, qualité détectée) sont maintenant utilisées ; à défaut d'enregistrement, la qualité est déduite du nom de la release plutôt qu'inventée.

## [1.0.43] — 2026-07-18

### Corrigé
- **File d'attente (Activité) : le titre des téléchargements ne s'affichait plus du tout sur smartphone.** Le badge de statut ("Téléchargement", "Bloqué"…) partageait la même ligne que le titre et, plus large que l'espace disponible, faisait passer le titre à une largeur de zéro pixel — invisible. Le titre a maintenant sa propre ligne pleine largeur, avec troncature propre ; le badge et les actions (pause, recherche, suppression) sont repositionnés en dessous.
- **File d'attente : bouton "Supprimer tout" et barre de filtres mal alignés sur petit écran.** Le bouton passait sur deux lignes et chevauchait les filtres. Il passe maintenant proprement à la ligne suivante quand la place manque.
- **File d'attente : une carte de statistique affichait la mauvaise étiquette** ("Téléchargement" au lieu de "Bloqué").
- **Fiche film/série sur smartphone : l'affiche et le titre étaient écrasés côte à côte**, ce qui repoussait les boutons ("Rechercher maintenant", etc.) sur deux lignes. L'affiche passe maintenant au-dessus du titre sur petit écran, tout redevient lisible.

## [1.0.42] — 2026-07-17

### Corrigé
- **Plantage mémoire au démarrage (nouvelle cause) :** plusieurs tâches planifiées en retard (rafraîchissement des métadonnées, mise à niveau qualité, etc.) pouvaient se lancer en même temps au démarrage et réécrire chacune tout le fichier de la bibliothèque à chaque titre traité — la mémoire grimpait à plus de 4 Go en moins d'une minute. Les écritures sur un même fichier sont maintenant regroupées automatiquement (fenêtre de 300 ms) au lieu de s'empiler, quel que soit le nombre de tâches qui écrivent en même temps. Ce correctif protège tous les mécanismes d'écriture de l'application, pas seulement celui qui a déclenché ce plantage précis.

## [1.0.41] — 2026-07-17

### Corrigé
- **Le moteur refusait tous les torrents (port déjà utilisé) :** si le port d'écoute des pairs était déjà pris par un autre processus, le moteur de téléchargement restait bloqué dans un état cassé au démarrage — plus aucun torrent, nouveau ou repris, ne pouvait être ajouté. Il bascule maintenant automatiquement sur un port de secours au lieu de rester planté. **Merci à Tony et à ses gros doigts d'avoir déniché ce bug 🐛**
- Les erreurs de reprise au démarrage n'inondent plus les journaux d'une ligne par torrent — un seul résumé regroupé désormais.

### Modifié
- **Activité V2 devient la seule version :** le sélecteur V1/V2 a disparu des réglages, tout le monde utilise désormais la nouvelle interface d'Activité.

## [1.0.40] — 2026-07-17

### Ajouté
- **Mise à niveau qualité persistée :** le bouton d'activation/désactivation dans Réglages > Activité V2 écrit maintenant sur le serveur — le planificateur respecte vraiment l'état choisi.
- **File d'attente V2 :** barre de filtres par état, bouton "Relancer" sur les bloqués, double suppression (fichiers conservés ou effacés), bouton "Supprimer tout" pour les admins.

### Modifié
- **Gestion CPU :** deux nouveaux réglages par instance — "Pairs max" et "Slots d'upload" dans la configuration des clients de téléchargement.

## [1.0.39] — 2026-07-17

### Corrigé
- **Les 13 tâches planifiées (Plex, indexeurs, qualité, métadonnées…) ne se relançaient plus après un redémarrage :** chacune avait sa propre minuterie qui repartait de zéro à chaque redémarrage du conteneur, même si la tâche était déjà en retard selon son horaire affiché. Avec des redéploiements fréquents, certaines tâches quotidiennes pouvaient rester des jours sans jamais vraiment s'exécuter. Elles passent maintenant par la file d'attente commune : toutes les 30 secondes, Movviz vérifie ce qui est en retard et le relance aussitôt, en respectant les points de priorité.

## [1.0.38] — 2026-07-17

### Ajouté
- **File d'attente de tâches en arrière-plan :** les scans lourds (comme le scan des sagas dans Collections) tournent maintenant dans une vraie file d'attente, 3 tâches à la fois maximum, sans bloquer le reste de l'application.
- **Points de priorité (Réglages > Système > File d'attente) :** attribue un score de 0 à 100 à chaque type de tâche pour décider laquelle passe devant les autres quand plusieurs sont en attente en même temps. Les téléchargements sont prioritaires par défaut — pendant un téléchargement actif, les autres tâches ralentissent automatiquement pour lui laisser la place.
- **Collections : sélecteur de vue** (grande grille / petite grille / liste), avec ton choix mémorisé pour tes prochaines visites.

### Corrigé
- Le scan des sagas passe désormais par la file d'attente commune au lieu de son propre mécanisme dédié — plus cohérent avec le reste de l'app et plus simple à surveiller.

## [1.0.37] — 2026-07-17

### Corrigé
- **Encore un plantage mémoire pendant "Scanner ma bibliothèque" :** le cache des réponses TMDb n'avait aucune limite de taille — sur une bibliothèque jamais scannée, chaque film consultait une URL différente et restait en mémoire pour toujours, sans jamais être libéré. Le cache est maintenant plafonné (2000 entrées, les plus anciennes sont libérées automatiquement).
- Ajout de journaux de diagnostic (mémoire utilisée, progression) pendant le scan de bibliothèque, pour identifier immédiatement la cause si un plantage se reproduit malgré tout.

## [1.0.36] — 2026-07-17

### Corrigé
- **Nouveau plantage mémoire pendant "Scanner ma bibliothèque" (Collections) :** le scan réécrivait le fichier complet de la bibliothèque à chaque film analysé au lieu de regrouper les écritures — sur une grosse bibliothèque, ça empilait des dizaines de réécritures complètes par seconde en mémoire jusqu'au plantage. Les mises à jour sont maintenant regroupées par lots de 20.

## [1.0.35] — 2026-07-17

### Corrigé
- **Plantage complet de l'application (mémoire saturée) :** dans certaines conditions, la lecture de la clé TMDb se répétait en rafale (des centaines de fois par seconde) au lieu d'être mise en cache, ce qui saturait la mémoire jusqu'à faire planter tout le conteneur Docker. La clé est maintenant gardée en mémoire quelques secondes au lieu d'être relue à chaque appel.
- **"Le moteur n'est pas démarré" affiché à tort (surtout sur smartphone) :** ce message s'affichait aussi bien quand le moteur était vraiment coupé que quand ta session avait simplement expiré, ce qui empêchait de comprendre le vrai problème. Un message "Ta session a expiré" avec bouton de reconnexion apparaît maintenant dans ce second cas.

## [1.0.34] — 2026-07-17

### Ajouté
- **Gestion CPU :** deux nouveaux réglages par instance de téléchargement — "Pairs max" (limite les connexions simultanées par torrent, défaut 55) et "Slots d'upload" (limite le nombre de seeders simultanés pour économiser le CPU, 0 = illimité).
- **File d'attente V2 :** barre de filtres par état (Tous / En cours / Bloqués / Terminés), bouton "Relancer" sur les torrents bloqués, double suppression (fichiers conservés ou effacés).

## [1.0.33] — 2026-07-17

### Ajouté
- **Gestionnaire de téléchargement repensé :** barre de filtres par état (Tous / En cours / Terminés / Bloqués) au-dessus de la liste des torrents.
- **Relance des téléchargements bloqués :** un bouton "Relancer" sur les torrents bloqués qui les supprime et les ré-ajoute automatiquement (fichiers conservés) pour forcer une reconnexion au essaim.
- **Suppression flexible :** deux boutons distincts — "Retirer" (garde les fichiers sur le disque) et "Supprimer + fichiers".

## [1.0.32] — 2026-07-17

### Ajouté
- Réglages > Métadonnées : nouvelle section OMDb pour renseigner ta propre clé (gratuite) — permet d'afficher les notes Rotten Tomatoes, Metacritic et IMDb sur les fiches films/séries. Sans clé, ces icônes n'apparaissent tout simplement pas, plutôt que de s'afficher cassées.
- Fiches films/séries : bouton "Bande-annonce" qui ouvre la meilleure vidéo YouTube trouvée, quand une existe.
- Collections : nouvelle section "Sagas dans ta bibliothèque", détectée automatiquement dès qu'un film possédé appartient à une franchise TMDb (ex. James Bond, Fast and Furious) — même avec un seul film sur toute la saga. Bouton d'analyse de la bibliothèque pour les films déjà ajoutés avant cette fonctionnalité.
- Fiche d'une saga : bouton "Télécharger les X manquants" qui ajoute d'un coup tous les films de la franchise que tu n'as pas encore.

## [1.0.31] — 2026-07-17

### Ajouté
- Fiche film/série : vrais logos pour Plex, TMDb, IMDb, Rotten Tomatoes et Letterboxd dans les liens rapides (au lieu de simples pastilles texte).

### Modifié
- Fiche film/série : les dates et montants (recettes, budget) s'affichent maintenant dans la langue choisie, pas seulement en français.
- Import Seerr et listes d'import : les titres sont traités par petits lots simultanés au lieu d'un par un — l'import est nettement plus rapide sur de grosses listes.
- Écritures sur disque (bibliothèque, comptes, etc.) : la mise à jour est immédiate en mémoire, l'écriture physique se fait juste après en arrière-plan au lieu de bloquer la réponse — réduit les ralentissements pendant un import massif.

### Corrigé
- **Régression :** Activité > File d'attente n'affichait plus aucun téléchargement en cours (alors qu'ils apparaissaient bien sur le Tableau de bord) depuis le durcissement de sécurité du jeton moteur — cette page appelait le moteur sans jamais lui présenter le jeton.

## [1.0.30] — 2026-07-17

### Ajouté
- Fiche film/série : panneau d'informations enrichi — date de sortie exacte, recettes et budget (films), studios repliables au-delà de 3, et une rangée de liens rapides vers Plex, TMDb, IMDb, Rotten Tomatoes et Letterboxd.
- La rangée "Disponible sur" (plateformes de streaming) a rejoint ce panneau au lieu d'être dans l'en-tête.

## [1.0.29] — 2026-07-17

### Modifié
- Découverte > "Suggestions pour vous" propose maintenant davantage de titres (jusqu'à 40 au lieu de 20, basé sur un historique de visionnage plus large).

## [1.0.28] — 2026-07-17

### Corrigé
- **Sécurité/fiabilité :** le moteur de téléchargement ne pouvait plus prévenir l'application quand un import se terminait (erreur 401) depuis le récent durcissement de l'authentification de l'API — un film ou un épisode fraîchement téléchargé pouvait rester coincé en "En cours" au lieu de passer à "Disponible". Corrigé avec un vrai jeton secret partagé entre le moteur et l'application (généré automatiquement, aucune configuration à faire), au lieu de rouvrir l'accès public à ces deux endpoints.

## [1.0.27] — 2026-07-17

### Ajouté
- Fiche film : nouveau bouton "Saga" qui ouvre la liste de tous les films de la même franchise (ex. tous les Batman), avec leur statut dans ta bibliothèque.
- Fiche film/série : rangée "Disponible sur" avec les logos des plateformes de streaming qui proposent le titre.
- Fiche film/série : lien IMDb à côté de la note, et bouton "Voir l'équipe complète" pour dérouler tous les postes clés au lieu des 6 premiers seulement.
- La rangée "Recommandés" de la fiche titre utilise maintenant les vraies recommandations TMDb plutôt que les titres "similaires" (souvent hors-sujet).

### Modifié
- Tableau de bord : la file de téléchargement reste maintenant toujours pleine largeur juste sous les widgets, même en grand écran — elle ne se réduisait plus dans une colonne étroite sur le côté.

### Corrigé
- Découverte > "Suggestions pour vous" : les films/séries déjà dans la bibliothèque n'apparaissent plus dans les suggestions (seul l'historique "vu" était pris en compte avant).
- Découverte > "Suggestions pour vous" : cliquer sur "Tout voir" faisait planter la page.
- **Fiabilité :** tous les appels au moteur de téléchargement ont maintenant une limite de temps (10s) — un moteur temporairement saturé ne bloque plus une requête indéfiniment jusqu'au timeout du proxy/NAS.
- L'installation en un clic refuse maintenant explicitement de s'exécuter sur autre chose que Windows, même en cas d'appel direct à l'API.

## [1.0.26] — 2026-07-17

### Ajouté
- **Résolveur Cloudflare intégré :** nouveau service indépendant (port 9830, résolveur maison basé sur Playwright) qui débloque les indexeurs protégés par Cloudflare. Chaque indexeur a maintenant un bouton "CF" dans ses réglages pour activer le passage par le résolveur.
- **Interface Réglages > Indexeurs :** champ de configuration de l'URL du résolveur (par défaut http://localhost:9830), sauvegardé automatiquement au focus perdu.
- **Cycle de vie complet du résolveur :** démarrage automatique au lancement de l'app (instrumentation.ts), capture des logs stdout/stderr en mémoire (500 dernières lignes), visible dans Réglages > Santé > Journal du résolveur.
- **API de gestion :** points d'accès `/api/resolver/logs` et `/api/resolver/restart` pour surveiller et redémarrer le résolveur depuis l'interface.

## [1.0.25] — 2026-07-17

### Ajouté
- Activité > File d'attente : la barre de progression, la taille téléchargée et le temps restant sont maintenant visibles directement sur chaque ligne, sans avoir à cliquer pour déplier le détail.

## [1.0.24] — 2026-07-17

### Corrigé
- **NAS/Docker :** le bouton de mise à jour de la barre latérale proposait un "Installer maintenant" qui ne faisait rien de concret hors Windows. Il affiche maintenant une simple info "mise à jour disponible" qui, une fois cliquée, explique clairement qu'il faut re-pull l'image (comme dans Réglages > À propos).
- **Sécurité :** l'installation en un clic refuse maintenant explicitement de s'exécuter sur autre chose que Windows, même si on force l'appel à l'API.

## [1.0.23] — 2026-07-17

### Corrigé
- La fenêtre "Quoi de neuf" ne s'affichait jamais : elle attendait qu'un navigateur ait déjà vu une version précédente, ce qu'aucun navigateur n'avait encore juste après la sortie de cette fonctionnalité.

## [1.0.22] — 2026-07-17

### Ajouté
- Après chaque mise à jour, une fenêtre "Quoi de neuf" résume les changements de la nouvelle version en langage simple, dès la prochaine ouverture de Movviz.
- Collections rejoint le menu principal — accessible directement, sans passer par un réglage caché.

### Corrigé
- Réglages > Fonctionnalités a été retiré : c'était une page d'interrupteurs bêta qui ne faisaient rien (ou presque). Collections est maintenant une fonctionnalité normale et toujours active ; le seul interrupteur qui avait un vrai effet (synchronisation de la watchlist Plex) a été déplacé dans Réglages > Plex, où il fonctionne vraiment.

## [1.0.21] — 2026-07-17

### Ajouté
- Nouveau panneau Réglages > Import Seerr : récupère toutes les demandes déjà faites sur une instance Seerr existante et les réattribue automatiquement aux comptes Movviz correspondants (par compte Plex ou nom d'utilisateur).
- Trois nouvelles langues d'interface : italien, néerlandais et allemand.
- L'assistant de première configuration commence maintenant par le choix de la langue.
- L'installeur Windows propose maintenant son propre choix de langue (français, anglais, italien, néerlandais, allemand).
- Suggestions personnalisées et badge "Vu" dans Découverte.
- Support des profils Plex gérés (comptes enfants/membres du foyer), assignables depuis les Réglages.

### Modifié
- Page d'accueil du dépôt (README) entièrement réécrite pour expliquer clairement ce que fait Movviz.
- Sur la fiche d'un film ou d'une série déjà disponible, "Lire sur Plex" passe en action principale — la recherche et le choix manuel restent accessibles mais en retrait.
- Réglages > À propos installe maintenant vraiment la mise à jour en un clic sur Windows, comme le texte le promettait déjà.
- Numéro de version unifié : une seule source (au lieu de deux fichiers qui pouvaient se désynchroniser).

### Corrigé
- **Sécurité :** la mise à jour en un clic pouvait être déclenchée par n'importe quel utilisateur connecté, pas seulement un administrateur.
- Le drapeau du sélecteur de langue (en haut de l'écran) ne s'affichait pas sur certains ordinateurs Windows — remplacé par une petite icône qui s'affiche identiquement partout.
- Plusieurs boutons affichaient un texte brut illisible (ex. « search.manual ») au lieu d'un vrai texte traduit.
- **Sécurité :** plusieurs endpoints internes (pilotage du moteur de téléchargement, navigateur de fichiers du serveur) étaient accessibles sans être connecté. Toute l'API exige maintenant une session valide, sauf les quelques endpoints qui doivent rester publics (connexion, inscription).
- **Fiabilité :** la bibliothèque et les comptes utilisateurs s'écrivent maintenant de façon atomique sur le disque — un crash pile pendant une sauvegarde ne peut plus corrompre le fichier.
- Le panneau de mise à jour affichait un bouton en double avec un comportement incohérent.

## [1.0.11] — 2026-07-16

### Corrigé
- Le tri « Nouveautés » de Découverte affichait encore quelques fiches sans aucun vote alors qu'elles étaient déjà sorties depuis un moment — nettoyage supplémentaire.

## [1.0.10] — 2026-07-16

### Ajouté
- Le studio **DC** rejoint Marvel et Disney dans les tuiles de Découverte.
- Lien **GitHub Sponsors** dans Réglages > À propos, pour soutenir le projet.

### Corrigé
- Les fiches sans aucune note (0 étoile) ou avec une fausse note de 10/10 basée sur un seul vote n'apparaissent plus dans Découverte — sauf pour les films/séries pas encore sortis, où c'est normal.
- La liste des dernières releases dans Recherche ignorait le choix Films/Séries — elle le respecte maintenant.
- Correction technique de la chaîne de publication qui empêchait l'installeur Windows de sortir correctement.

## [1.0.8] — 2026-07-16

### Ajouté
- Movviz embarque désormais **une clé TMDb par défaut** : l'application fonctionne dès l'installation, sans clé à créer. Toujours possible d'utiliser la sienne depuis Réglages ou lors du premier démarrage.
- Nouvelle rangée « Tendances » côté séries, qui reflète le vrai classement d'allocine.fr.

### Modifié
- Réglages entièrement réorganisés en catégories plus logiques (Téléchargement, Bibliothèque, Notifications, Système, Avancé).
- Le dégradé animé du logo boucle maintenant en douceur, de gauche à droite, sans à-coup visible.
- Les colonnes triables de la Recherche sont plus lisibles (la colonne active se distingue clairement).

### Corrigé
- Le renommage automatique des fichiers laissait parfois des parenthèses vides quand une information manquait (ex. année inconnue).
- Les tris « Top » et « Nouveautés » de Découverte ne remontaient pas de résultats pertinents.

## [1.0.7] — 2026-07-16

### Ajouté
- Nouvelle page **À propos** dans les Réglages : version installée, licence, et vérification de mise à jour en un clic (Windows).
- Recherche : ajout de colonnes triables et de l'âge de la release.

### Corrigé
- Blocage de l'onglet Activité > Manquants sur les grosses bibliothèques.
- Le compteur de téléchargements en cours du tableau de bord restait parfois coincé à 1.
- Les modèles de nommage par défaut sont plus proches des standards du secteur.

## [1.0.6] — 2026-07-16

### Ajouté
- **Filtrage par continent** dans Découverte : chaque utilisateur peut choisir les régions dont il veut voir le contenu.
- **Gestion des utilisateurs repensée** : quotas de demandes, délégation d'approbation, fiche détaillée par utilisateur.
- Navigation regroupée en onglets par thème (Bibliothèque, Activité...) au lieu d'une longue liste de liens.
- Barre de navigation mobile.
- Profileur de performances et statistiques CPU/RAM dans les Diagnostics.
- Import automatique des téléchargements terminés dans la bibliothèque, dès qu'ils sont prêts.

### Modifié
- Bibliothèque et Découverte s'affichent instantanément grâce à un cache, avec actualisation en arrière-plan.
- Les grandes bibliothèques s'affichent progressivement au lieu de bloquer l'interface.
- Le moteur de téléchargement redémarre proprement même si un dossier réseau est temporairement indisponible.

### Corrigé
- Les téléchargements terminés qui disparaissaient après un redémarrage.
- Les téléchargements de séries qui atterrissaient dans le dossier films.
- Plusieurs plantages du moteur de téléchargement (démarrage, arrêt, dossiers manquants).

## [1.0.5] — 2026-07-16

### Ajouté
- Date de sortie complète affichée sur toutes les cartes (films, séries, Découverte).
- Badges visuels sur les cartes : disponible (vert), en téléchargement (mauve), manquant (ambre).

### Modifié
- Les badges de statut restent cohérents entre la Bibliothèque, la Découverte et le calendrier.
