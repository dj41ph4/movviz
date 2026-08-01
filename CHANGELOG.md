# Journal des modifications

Toutes les nouveautés et corrections notables de Movviz.

---

## v1.12.23 — 1 août 2026

### Recherche des manquants — fiabilité

- **Correctif de la régression « 0/413 »** : la recherche des manquants pouvait rester figée et laisser des épisodes bloqués à « Recherche… » à jamais.
- **Statut "searching" plus jamais orphelin** : chaque recherche (film, épisode, saison) est désormais protégée par un `try/finally` qui restaure le statut à "manquant" si une erreur survient en cours de route (timeout indexeur, crash worker, moteur injoignable) — avant, seul un redémarrage (reconcile au boot) nettoyait ces épisodes, d'où 13 épisodes confirmés bloqués en production.
- **Sérialisation par série/film** : la recherche en masse, les tâches planifiées, les boutons manuels et le scan RSS ne recherchent plus la même série en même temps (jusqu'à 3 recherches d'intégrale identiques observées, 12+ requêtes par indexeur chacune). Le second appelant attend le premier puis relit l'état réel : il ne re-cherche que ce qui reste réellement manquant.
- **Progression par saison** : le compteur de la recherche en masse avance désormais saison par saison au lieu de rester à 0/N pendant la première grosse série (29-37 saisons). La barre atteint toujours 100 % même si une série est intégralement couverte par un pack ou échoue en cours de route.

### Beta Player — lecture

- **Direct stream réel pour MP4 AC-3/E-AC-3** : sur Chrome/Edge, `canPlayType()` ment pour l'audio AC-3/E-AC-3 (répond « non » alors que le décodage marche) — le lecteur basculait donc sur HLS/MSE avec le badge « Direct stream ». Le probe passe maintenant par `MediaSource.isTypeSupported()`, qui dit la vérité : les MP4 H.264/HEVC + AC-3/E-AC-3 passent en vrai `el.src` (aucun remux), avec repli automatique sur HLS en cas d'échec du navigateur.
- **Fin de la lenteur au démarrage des films** : le pré-buffer avant `play()` était branché sur `streamCacheTtl` (300 s par défaut) — jusqu'à 5 minutes d'écran « mise en cache… » sur un long métrage. Plafonné à 30 s (aligné sur la marge de buffer native de hls.js), avec un cap dur dans le composant pour que plus aucun appelant ne puisse réintroduire un mur de chargement.

---

## v1.12.22 — 1 août 2026

### Correctif de build

- **package.json corrompu en v1.12.21** : un BOM UTF-8 et un reformatage intempestif (ajoutés lors du bump de version) rendaient le fichier illisible par Node → `next build` échouait sur la CI (installer Windows et image Docker). Fichier restauré dans son format original, sans BOM.
- Re-bump propre à la v1.12.22 pour relancer les pipelines de release.

---

## v1.12.21 — 1 août 2026

### Moteur — stabilité

- **Crash corrigé** : `reconcileQueue` pouvait appeler `.catch()` sur un booléen (les `pause`/`resume` de WebTorrent sont synchrones) → plantage de l'engine sur certains flux de téléchargement.
- **Règle anti-stall** : un torrent sans aucune activité pendant 2 minutes passe en état « Bloqué » — il ne consomme plus de slot, ne bloque plus la file, et dès qu'il reprend du mouvement il est replacé **en dernier** dans la file. Détection centralisée dans le tick (couvre WebTorrent, aria2, libtorrent), état persisté au redémarrage, et « priorité haute » = déblocage manuel immédiat.
- **Suppression aria2 corrigée** : un torrent supprimé ne réapparaît plus dans la file au cycle de polling (nettoyage retenté, handle jamais recréé).

### Recherche séries — règle absolue intégrale → saison → épisodes

- L'**intégrale est systématiquement cherchée en premier** (plus aucun seuil de complétion) ; si trouvée, on s'arrête. Sinon pack de saison, puis épisodes un par un.
- Appliqué partout : recherche manuelle, « rechercher toute la série », « rechercher les manquants », tâches planifiées (sortie du jour, retry des manquants) et scan RSS — l'intégrale n'est tentée qu'une seule fois par série et par passage.
- Pauses de cadencement entre chaque étape pour laisser l'engine démarrer un pack avant de continuer.
- Correction : les épisodes déjà en cours de recherche (`searching`) comptent désormais dans les cibles d'un pack.

### Indexeurs

- **C411 : quota 15 requêtes/minute** respecté avant l'envoi (fenêtre glissante 60 s) — nos propres recherches ne déclenchent plus le 429. Le téléchargement des fichiers `.torrent` est compté dans le quota.

### Lecteur — moteur MSE

- Nouveau moteur de lecture **MSE** (Media Source Extensions) pour les MP4 : segmentation progressive à la volée, lecture fluide des transcodes compatibles, bascule automatique vers les moteurs existants en cas d'incompatibilité.
- Réglage « Moteur de lecture » (auto / natif / MSE) et panneau debug playback (mode, codecs, buffer, réseau) dans les réglages bêta du lecteur.

---

## v1.12.20 — 31 juillet 2026

### Lecteur — codecs audio : fiabilité maximale, plus aucun son muet

- **E-AC3 ne peut plus jamais être copié en HLS** : hls.js ne sait pas transmuxer l'E-AC3 depuis du TS (erreur de parsing → piste ignorée → vidéo muette). Nouvelle porte dédiée `isAudioMseTransmuxable()` : seuls AAC, MP3 et AC-3 peuvent être copiés (`ta=0`) ; E-AC3/DTS/TrueHD/FLAC/Opus sont transcodés en AAC côté Plex. Whitelist serveur alignée (E-AC3/MP2 retirés, formes RFC 6381 `mp4a.*` acceptées).
- **Bascule de piste fiable** : après une bascule auto (DTS → AC3/AAC), le lecteur force le chemin HLS — le seul capable de sélectionner la piste via `audioStreamID`. Avant, direct play/WebCodecs ignoraient la bascule et rejouaient la piste DTS par défaut (muet silencieux).
- **Meilleur choix de piste** : même langue que la piste d'origine → 5.1 → 2.0 → AAC, au lieu de la première piste compatible trouvée.
- **WebCodecsPlayer : un décodeur par piste réelle** : le décodeur audio n'est configuré que sur une piste AAC/Opus avec son codec réel (`mp4a.40.2`), et n'accepte plus les échantillons des autres pistes (un remux AAC+DTS faisait mourir le décodeur → muet). Erreur de décodeur → bascule automatique vers le HLS.
- **Refs synchronisées** : changement de piste manuel → badge « Direct stream / Transcodé » toujours véridique, et retour HLS après Direct Play conserve la piste choisie.
- **Direct Play protégé** : si une piste non-par défaut est active, le bouton reste sur HLS (le direct play ne sait pas sélectionner une piste).

---

## v1.12.19 — 31 juillet 2026

### Lecteur — bypass des codecs audio incompatibles

- **Bascule automatique de piste audio** : quand la piste par défaut est en DTS/TrueHD/PCM (indécodables par les navigateurs), le lecteur sélectionne automatiquement une piste compatible (AC3/EAC3/AAC) quand elle existe — l'audio est copié (`ta=0`) au lieu d'être transcodé, sans perte audible.
- **Détection MSE réelle** (`MediaSource.isTypeSupported`) pour AC-3/E-AC-3/MP3 : les films en AC3/EAC3 passent en direct stream sur les machines compatibles au lieu d'être transcodés.
- **Détection étendue** : FLAC et MP3 désormais vérifiés (avant : MP3 supposé supporté sans test, FLAC jamais testé).
- **Mappings RFC 6381 corrigés** : E-AC3 → `ec-3` (avant `ac-3`) ; DTS/TrueHD/PCM ne sont plus jamais masqués en AAC.
- **Whitelist copy côté serveur** : Plex ne reçoit plus de hint `copy` pour un codec qu'il transcoderait silencieusement (opus, flac, vorbis, truehd, dts...).
- **Badge corrigé** : le mode remux (`tv=0`/`ta=0`) affiche « Direct stream » au lieu de « Transcodé (audio) ».

---

## v1.12.18 — 30 juillet 2026

### GPU — Ultra Low : seul le décor statique est désactivé

- Le mode Ultra Low coupe uniquement les effets visuels statiques (aurora, grille, backdrop-filter glass) et **conserve toutes les animations** (transitions, shimmer, pulses, spinners).

---

## v1.12.17 — 30 juillet 2026

### GPU — Ultra Low : aurora désactivé

- Le mode Ultra Low supprime désormais entièrement l'aurora (blobs + grille) — seuls le fond sombre et le voile radial restent.

---

## v1.12.16 — 30 juillet 2026

### GPU — 4 profils + traduction corrigée

- **4 profils disponibles** : Ultra Low (effets minimalistes, aurora figé à 24px, sans backdrop-filter), Low (aurora 40px, glass désactivé), Medium (aurora 80px, glass 8px), High (qualité maximale).
- **Traduction corrigée** : les clés `settings.gpu.*` sont maintenant correctement imbriquées dans la section `settings` — le panneau affiche les libellés traduits (fr/en/de/it/nl) au lieu des clés brutes.

---

## v1.12.15 — 30 juillet 2026

### GPU — Sélecteur de profil dans les Réglages

- Nouvel onglet « GPU » dans les réglages personnels permettant de choisir entre **Medium** (équilibré, par défaut) et **High** (qualité maximale).
- Le profil est persistant (localStorage) et s'applique immédiatement sans rechargement.
- Suppression de la détection automatique GPU : le profil Medium est utilisé par défaut pour tous.

---

## v1.12.14 — 30 juillet 2026

### GPU — Mode Medium forcé pour tous

- La détection GPU automatique est désactivée : tous les utilisateurs utilisent désormais le profil `medium`, avec Aurora à 80px et `backdrop-filter` glass réduit à 8px (vs 20–28px). Charge GPU réduite pour tout le monde, sans perte visuelle significative.

---

## v1.12.13 — 30 juillet 2026

### GPU — Correctif : les optimisations s'appliquent à tous les niveaux

- **Correction majeure** : les classes GPU (`gpu-low/medium/high`) sont maintenant appliquées sur `<html>` pour **tous les utilisateurs** (pas seulement les machines très bas de gamme). Le provider détecte désormais 3 niveaux avec des règles CSS adaptées à chacun.
- **Aurora blur réduit globalement** : les valeurs par défaut passent de 120–140px à 90–110px pour réduire la charge GPU sans perte visuelle notable.
- **Règles étendues** : `gpu-medium` réduit Aurora à 80px et le `backdrop-filter` des glass à 8px ; `gpu-low` pousse la réduction plus loin (Aurora 40px, glass désactivé, badges statiques).
- **Shimmer** reste en `transform: translateX` (compositeur GPU uniquement) — déjà actif pour tous.

---

## v1.12.12 — 30 juillet 2026

### GPU — Optimisation des animations CSS

- **AuroraBackground** : le flou s'adapte au niveau de performance GPU détecté (`gpu-low` → `blur(40px)` au lieu de 120–140px). Réduction majeure de la charge pixel-pipeline.
- **Glass** : les classes `.glass` / `.glass-strong` désactivent leur `backdrop-filter` coûteux sur les machines bas de gamme (`gpu-low` → fond uni). Économise jusqu'à 30 layers de compositeur.
- **Shimmer** : remplace `background-position` animé (paint coûteux) par `transform: translateX` (compositeur GPU uniquement). Appliqué à `Toast.tsx` via la nouvelle classe `.shimmer-gpu`.
- **Badge / Logo** : les animations `box-shadow` (`badgePulse`, `logoPulse`) sont désactivées sur GPU bas de gamme et remplacées par un glow statique.

---

## v1.12.11 — 30 juillet 2026

### Beta Player — Correctif badge + mode transcodage manuel

- **Badge corrigé** : le badge affiche désormais correctement « Transcodé (vidéo) », « Transcodé (audio) » ou « Transcodé » selon les codecs réellement supportés par le navigateur. Le bug venait du bloc `nonMp4` qui forçait `tv=1&ta=1` pour tous les contenus non-MP4 (MKV/AVI/...), ignorant les capacités du navigateur.
- **Mode transcodage manuel** : nouveau menu (icône ⚙️) dans la barre de contrôle avec 4 options : Auto, Audio seulement, Vidéo seulement, Complet. Permet de forcer manuellement ce que Plex doit transcoder, indépendamment de la détection automatique.
- **`maxVideoBitrate` omis en copy** : quand la vidéo est en direct-stream (`videoCodec=copy`), le paramètre `maxVideoBitrate` n'est plus envoyé à Plex pour éviter les conflits.

---

## v1.12.10 — 30 juillet 2026

### Beta Player — Test direct + sélecteur qualité

- **Bouton « Test direct »** : force la lecture directe (sans transcodage HLS) pour tester si le navigateur gère le fichier brut. Bascule vers HLS via « Retour HLS ». Badge vert « Test direct » visible dans l'en-tête.
- **Sélecteur qualité (résolution + débit)** : permet de choisir entre Original, 4K, 1440p, 1080p, 720p. La sélection définit `maxWidth` et `maxVideoBitrate` passés à la route de transcodage Plex. Changement en cours de lecture pris en compte immédiatement.
- **Paramètre `maxWidth`/`maxVideoBitrate`** : la route de transcodage accepte désormais `maxWidth` et `maxVideoBitrate` en query params pour outrepasser l'auto-détection.

---

## v1.12.9 — 30 juillet 2026

### Beta Player — Transcodage audio/vidéo séparé + correctif spinner

- **Transcodage séparé audio/vidéo** : le player détecte désormais *exactement* ce que le navigateur ne supporte pas. Si seul l'audio (AC3/DTS) nécessite un transcodage, la vidéo est passée en direct-stream (`copy`). Si seule la vidéo (HEVC/AV1) nécessite un transcodage, l'audio est passé en direct-stream. Économise jusqu'à 2× la charge CPU du serveur Plex.
- **Badge informatif** : le badge « Transcodé » devient « Transcodé (vidéo) », « Transcodé (audio) » ou « Transcodé » selon ce que Plex ré-encode réellement.
- **Paramètres `tv`/`ta`** : la route de transcodage accepte `tv=0`/`ta=0` pour désactiver le transcodage de chaque flux individuellement (bitstream-copy via `directStream=1` de Plex).
- **Correctif spinner fantôme** : les events `FRAG_LOADING`/`FRAG_BUFFERED` de HLS.js mettaient `buffering=true` à chaque chargement de segment, ce qui affichait le spinner au milieu de la vidéo *après* la fin du pré-remplissage du cache. Supprimés — les events natifs `waiting`/`playing` du `<video>` gèrent désormais seuls l'état de buffering.

---

## v1.12.8 — 30 juillet 2026

### Beta Player — Pré-remplissage du cache

- **Pré-buffering avant lecture** : désormais le player ne démarre pas la lecture tant que le cache n'a pas accumulé `streamCacheTtl` secondes de contenu (Réglages → Plex → Cache segment). Barre de progression visible : « Pré-remplissage du cache… Xs / Ys ».
- `prebufferSeconds={streamCacheTtl}` passé à `VideoPlayer` depuis les 3 points d'entrée (détail titre, carte film, page épisode).

---

## v1.12.7 — 30 juillet 2026

### Beta Player — Correctifs

- **Fallback HLS après échec WebCodecs** (critique) : quand le demux mp4box échouait (MKV, erreur réseau), le player restait bloqué sur un écran d'erreur — aucun basculement vers Plex HLS. Corrigé dans `WebCodecsPlayer.tsx` en appelant `onFallback()` sur l'événement `"error"` du demuxer.
- **Session transcode enregistrée après validation URL** : `registerSession()` était appelé avant `safePlexUrl()` — fuite de session si URL invalide.
- **Nettoyage session toujours exécuté** : le guard `el.currentTime > 0` empêchait l'envoi de `stop` à la fermeture immédiate (fuite session jusqu'au TTL). Supprimé.

---

## v1.12.6 — 30 juillet 2026

### Interface
- **Toggle Animations** (Réglages → Tableau de bord) : active/désactive toutes les animations — logo, transitions CSS, framer-motion, fond aurora. Préférence locale (`localStorage`).
- **GpuProvider** monté globalement + `MotionConfig` + script `beforeInteractive` pour éviter le flash du logo.

---

## v1.12.5 — 30 juillet 2026

### Correctifs critiques
- **Panel « Rechercher et remplacer » bloqué ouvert** : le garde `if (!open) return null` avait été retiré par erreur — le portal s'affichait dès l'ouverture de `/library`. Restauré.

---

## v1.12.1 — 30 juillet 2026

### Correctifs critiques
- **Search & Replace vide** : le fast pre-check dans `findUpgradeCandidates()` skipait tous les films quand la langue cible était déjà satisfaite — les upgrades format/codec score n'étaient jamais vérifiés.
- **Affichage progressif** : les candidats apparaissent un par un (stagger 60ms) au lieu d'un bloc après chargement complet.
- **Cache instantané** : les résultats du panel sont conservés en mémoire (`_cachedRows`) — réouverture immédiate sans re-recherche.
- **i18n complet** : `searchAndReplaceIgnore`, `searchAndReplaceGrabbed`, `searchAndReplaceIgnored` dans les 5 langues.

---

## v1.12.0 — 30 juillet 2026

### Rechercher et remplacer — Moteur unifié
- **4 critères cumulatifs** : langue, codec audio, codec vidéo, résolution. Même moteur pour le panel manuel et la tâche automatique.
- **Résolution cible** : 720p (HD), 1080p (FULL HD), 2160p (4K), 4320p (8K) ou Aucun. Configurable dans Qualité.
- **Codec vidéo cible** : x264, x265, AV1 ou Aucun.
- **Codec audio cible** : DTS, TrueHD, Atmos, AAC, AC3, E-AC3, FLAC, OPUS ou Aucun.
- **Multilingue** : support VF, VFQ, VOSTFR, VO, ITA, GER, NL, EN. Adapté à chaque langue.
- **Auto-upgrade** : toggle dans Qualité. Tâche planifiée toutes les 6h qui applique les critères sans confirmation.
- **Mise à niveau automatique unifiée** : remplace l'ancien système résolution-only par le moteur complet.

### Moteur — Corrections série
- **Import séries corrigé** : `movedFiles` vide → skip notification plutôt que boucle HTTP 400 infinie.
- **`aria2.forceRemove`** prioritaire dans `_clientRemove` — plus fiable que `aria2.remove`.
- **`_selectEpisodeFiles`** ré-exécuté après résolution des métadonnées (magnets).

### Performance — Index média mémoïsé
- **`getMediaIndex()`** : parse une fois les métadonnées de tous les films/épisodes, invalidé automatiquement quand `library.json` change.
- `findUpgradeCandidates()` passe de 60s à ~5s — plus de parseRelease en boucle.

### Calendrier — Scroll infini
- Weeks/mois s'empilent dynamiquement au scroll (IntersectionObserver). Jusqu'à 52 semaines ou 12 mois.

### Recherche des manquants — Aléatoire
- Fisher-Yates shuffle sur films et saisons manquants. Chaque passe cible un sous-ensemble différent.

### Interface
- **Logo 4K** : badge affiné, texte centré, moins large.
- **Bouton Optimiser** (✨) sur les cartes séries comme pour les films.
- **Bouton éditer widgets** : icône crayon discrète, masqué quand les statistiques sont désactivées.
- **Traductions** : "Remplacer", "Ignorer", "Optimiser" dans les 5 langues.

### Quoi de neuf — Correction
- Parsing CHANGELOG.md : supporte `v1.12.0`, `[1.12.0]` et `1.12.0`.

### Optimisations GPU
- `layout:true` retiré avec reduceMotion, `popLayout→sync`, `will-change` retiré, hover glow CSS, Logo4K simplifié, `.glass` sans saturate, images lazy.

### Données
- Cache upgrade-candidates invalidé quand les règles changent.
- `saveMovies/saveSeries` anti-corruption : distingue ENOENT des autres erreurs.

---

## v1.11.1 — 30 juillet 2026

### Rechercher et remplacer — Moteur unifié codec audio/vidéo + langue
- **Codec vidéo cible** : choisissez x264, x265, AV1 ou Aucun dans Paramètres → Qualité. Tout fichier possédé dans un autre codec devient éligible au remplacement.
- **Codec audio cible** : choisissez DTS, TrueHD, Atmos, AAC, AC3, E-AC3, FLAC, OPUS ou Aucun. Même logique de remplacement.
- **Priorité unifiée** : langue → codec audio → codec vidéo → custom format → score codec. Un seul moteur pour le panel manuel ET la tâche planifiée.
- **Badges colorés** dans le panel : vert (audio) et bleu (vidéo) pour distinguer les types d'upgrade.
- **Épisodes TV** : supportent désormais aussi les upgrades codec audio/vidéo en plus de la langue.

### Quoi de neuf — Correction parsing CHANGELOG.md
- Le regex de parsing accepte désormais les formats `v1.11.1`, `[1.11.1]` et `1.11.1`. Le modal post-mise à jour fonctionne à nouveau.

### Optimisations GPU — Zéro perte visuelle
- **`layout: true`** retiré quand `reduceMotion` est actif (bug qui forçait le recalcul layout sur toutes les cartes).
- **`AnimatePresence popLayout → sync`** sur les 4 grilles (biblio, corbeille, requêtes, problèmes) — économise la double mesure layout.
- **`will-change: transform`** retiré du style permanent des cartes — le calque GPU n'est plus alloué 24/7.
- **`whileHover boxShadow`** remplacé par `hover:shadow-[...] transition-shadow` CSS natif — plus de `requestAnimationFrame` par carte au survol.
- **Logo 4K** : seule l'animation SMIL du texte persiste — fond et bordure fixes via `BaseBadge` (comme les autres logos).
- **`.glass`** : `saturate()` retiré du backdrop-filter (coût shader ÷ 2).
- **Images** : `loading="lazy"` et `decoding="async"` ajoutés sur 12 images hors viewport.

---

## v1.11.0 — 30 juillet 2026

### Moteur — Téléchargements séries (aria2) entièrement corrigés
- **`_isDone` NativeBackend** : suppression de la surcharge qui ignorait `selectedFileIndices` — la détection de complétion utilise désormais la version parente (`AbstractBackend`), capable de vérifier chaque fichier individuellement.
- **`_selectEpisodeFiles` ré-exécuté** après résolution des métadonnées (magnets) dans `_clientPoll` — `aria2.changeOption(select-file=…)` est envoyé dès que les fichiers sont connus, économisant la bande passante.
- **Filtre `_import` unifié** : utilise `_matchesEpisode()` (même logique que `_selectEpisodeFiles`) au lieu d'une vérification inline stricte. Les fichiers avec fallback de saison (dossier `Season 1`) ou épisode extrait par regex ne sont plus ignorés.
- **`episodeTarget` transmis** pour les grabs d'épisodes individuels (`autoGrabSeries.ts`) — le moteur sait quel fichier cibler, même pour un torrent mono-fichier.
- **`aria2.forceRemove`** utilisé en priorité dans `_clientRemove` — plus fiable que `aria2.remove` pour les téléchargements actifs.

### File d'attente — Supprimer tout
- **Correction `importedHistory` survivait au DELETE** : `AbstractBackend.remove()` nettoie désormais l'historique d'import quand le méta n'est plus actif. Les éléments supprimés ne réapparaissent plus.
- **Polling SWR gelé** pendant l'opération (clé `null`) — plus de flash disparition/réapparition.

### Logo 4K Ultra Premium
- Animation 3 couches superposées : CSS shimmer (6s) + Framer Motion border/glow (5.5s) + SVG gradient texte (4.5s). Palette brand Movviz (violet → cyan → magenta → blanc) en boucle infinie.

### Calendrier
- **Anti-boucle infinie** : SWR configuré (`errorRetryCount: 3`, `revalidateOnFocus: false`, `dedupingInterval: 10s`).
- **Optimisation API** : un seul appel `allAnimeVfLaunches()` au lieu de N appels dans la boucle series — matching en mémoire.
- **`searchingKey` corrigé** — le feedback de recherche manuelle sur les chips fonctionne à nouveau.

### Interface
- **Bouton « Lire sur Plex »** : route détail film enrichie avec `plexUrl` (cohérent avec la route série).
- **Badge libtorrent** : « Alpha » → « Expérimental » en rouge.

### Logs transcode
- Buffer ancré dans `globalThis.__movvizTranscodeLogs` — visible dans Diagnostics (corrige l'isolation des bundles Next.js).

### Sécurité données — Anti-corruption critique
- **`saveMovies` / `saveSeries`** : le `catch {}` distingue `ENOENT` des erreurs de lecture. Plus de risque d'écrasement de la bibliothèque entière si le NAS est temporairement indisponible.
- **Import intégrale** : les saisons sans fichiers ne sont plus ignorées — les épisodes orphelins sont correctement libérés.

---

## v1.10.103 — 30 juillet 2026

### Moteur — Correction téléchargements séries (aria2)
- **`_isDone` NativeBackend corrigé** : utilisation de la détection parente (`AbstractBackend`) qui gère les `selectedFileIndices` pour les packs saison/intégrale. Le téléchargement sélectif n'empêche plus la détection de complétion.
- **`_selectEpisodeFiles` ré-exécuté** après résolution des métadonnées (magnets) dans `_clientPoll` — `select-file` est maintenant envoyé à aria2 dès que les fichiers sont connus.
- **Filtre `_import` unifié** : utilise `_matchesEpisode` (même logique que `_selectEpisodeFiles`), corrige les fichiers ignorés à l'import alors qu'ils avaient été correctement sélectionnés pour le téléchargement.
- **`episodeTarget` transmis** pour les grabs d'épisodes individuels (`autoGrabSeries.ts`) — le moteur sait désormais quel fichier cibler, économisant la bande passante.

### Calendrier — Correction boucle infinie
- **Optimisation API** : `allAnimeVfLaunches()` appelé une seule fois au lieu de N appels `findAnimeVfLaunch()` dans la boucle series — matching en mémoire, temps de réponse divisé.
- **SWR configuré** : `revalidateOnFocus: false`, `errorRetryCount: 3`, `dedupingInterval: 10s` — plus de retry infini ni revalidation au focus.
- **Correction `searchingKey`** : le feedback de recherche manuelle sur les chips fonctionne à nouveau.

### Interface
- **Bouton « Lire sur Plex »** : corrigé sur la route détail film (`plexUrl` ajouté, cohérent avec la route série).
- **« Supprimer tout »** (file d'attente) : correction du flash disparition/réapparition — la mise à jour optimiste est faite après l'opération, pas avant.

### Logs transcode
- Buffer ancré dans `globalThis.__movvizTranscodeLogs` — les logs sont visibles dans Diagnostics même avec l'isolation des bundles Next.js.

### Données — Sécurité critique
- **Anti-corruption `saveMovies` / `saveSeries`** : le `catch {}` distingue désormais `ENOENT` des autres erreurs. Plus de risque d'écrasement de la bibliothèque si le NAS est temporairement indisponible.
- **Import intégrale** : les saisons sans fichiers libèrent désormais leurs épisodes orphelins (`activeInfoHash` remis à `null`, statut corrigé).

---

## v1.10.56 — v1.10.83 — Juillet 2026

### Moteur — Robustesse du cycle d'import
- Notification bibliothèque retentée automatiquement toutes les 15 secondes en cas d'échec, via `this.meta` (pas `_clientList`, qui peut être vidé par le nettoyage).
- Protection anti-double-appel `onComplete` (guard `m.processing`).
- Nettoyage conditionnel : le dossier download n'est supprimé qu'après notification réussie.
- Correction du bug `movedTo` écrasé par le chemin download au lieu du chemin bibliothèque.
- `Promise.resolve()` sur les appels à `_clientPause` pour compatibilité WebTorrent (retour synchrone).
- Correction du chemin source aria2 : `path.isAbsolute()` empêche le doublage du répertoire (`/data/downloads/film/data/downloads/film/...`).
- Nettoyage post-import : suppression individuelle des fichiers (pas seulement du dossier torrent), gestion des chemins relatifs aria2, suppression récursive des sous-dossiers sans fichiers vidéo.
- Logs du workflow complet : ajout → complétion → import → notification → nettoyage.

### Interface — Toasts premium et confirmations
- **Système de toast repensé** : animations spring Apple-like, carte glass/gradient avec shimmer sur desktop, ligne fine centrée sur mobile.
- Toast "Ajouté aux téléchargements" avec icône download et dégradé brand.
- Tous les `confirm()` navigateur remplacés par `confirmDialog()` (modal glass animée).
- **Bouton « Récupérer téléchargements »** dans Paramètres → Maintenance : scan récursif des dossiers download, matching accent-insensitive (é→e), renommage avec templates, déplacement vers la bibliothèque. Jamais d'écrasement.
- **Bouton « Effacer doublons »** : supprime les fichiers du dossier download déjà présents dans la bibliothèque.
- **ErrorBoundary** sur le player YouTube : crash isolé, image de fond affichée, erreur loguée en diagnostic.

### Recherche — Matching moins strict
- `sanitizeQuery` : suppression des apostrophes et de tous les caractères spéciaux avant envoi à l'indexeur. « L'Arme Fatale » → `L.Arme.Fatale`.
- Accents normalisés (NFD + strip diacritics) déjà présents.
- `fuzzyMatch` dans recover-downloads : 70% de recouvrement par mots, insensible aux accents.

### Player Bêta — Corrections direct play et transcode
- **Normalisation des codecs Plex vers RFC 6381** : `h264` → `avc1.640028`, `aac` → `mp4a.40.2`. Sans ça, `canPlayType()` retournait toujours `""` et le direct play n'était jamais tenté.
- **Détection du conteneur MKV** : le `<video>` natif ne lit pas le MKV. Skip direct play, routage vers WebCodecs ou transcode HLS.
- **Sessions de transcode** : limite passée de 3 à 5, expiration automatique après 5 minutes d'inactivité. Correction du bug qui bloquait définitivement après 3 vidéos.

### Badges — Codecs lisibles
- Audio : logos SVG pour Dolby Atmos, Dolby Digital (AC3), Dolby Digital+ (EAC3), DTS, TrueHD. TextPills pour FLAC, PCM, AAC, Opus, MP3, Vorbis, WMA.
- Vidéo : x265/H.265/HEVC → HEVC, x264/H.264/AVC → AVC.
- Badge SDR supprimé (absence de HDR = implicite).
- Barre de progression téléchargement : interpolation 60 fps.

### Images TMDb — Proxy global
- Règle `rewrites` Next.js : toutes les URLs `https://image.tmdb.org/t/p/` remplacées par `/tmdb/` dans le codebase. Le navigateur voit du same-origin → zéro warning CORS.

### Correctifs divers
- Page historique : `entry.media?.title` avec optional chaining.
- Resolver Playwright : auto-install Chromium, chemin fixe (indépendant de l'utilisateur).
- Build.ps1 : `$_.PSIsContainer` → `-Directory`, tiret cadratin Unicode échappé.

---

## v1.10 — Juillet 2026

### Moteur — Backend natif aria2 (Bêta)
Le backend basé sur aria2 remplace le backend WebTorrent JavaScript par un processus natif C++, offrant des performances nettement supérieures (5 MB RAM contre 50-100 MB) et la gestion de centaines de téléchargements simultanés.
- Communication JSON-RPC sur port loopback, secret de session auto-généré.
- Détection de complétion fonctionnelle même avec `--bt-stop-timeout=0` (vérification `completedLength >= totalLength`).
- Finalisation avec seed ratio : l'import vers la bibliothèque s'effectue immédiatement après la fin du téléchargement ; le dossier download est nettoyé uniquement après la fin du seed.
- Ajout immédiat des torrents dans la file dès l'appel RPC, sans attente du cycle de polling.
- UPnP automatique sur les ports TCP 51413-51414 au démarrage, libération à l'arrêt.
- Gestion bidirectionnelle des identifiants infoHash ↔ GID aria2 : pause, reprise et suppression fonctionnent sur toutes les clés.

### Moteur — Backend WebTorrent (Stable)
- Correction client zombie : `_tryBind` attend désormais l'événement `listening` au lieu d'un timeout aveugle de 1,5 s.

### Moteur — Cycle d'import et robustesse
- L'annonce bibliothèque (`/api/library/import`) est retentée automatiquement toutes les 15 secondes en cas d'échec. Le statut de complétion n'est validé qu'après succès.
- Protection anti-double-appel : `onComplete` ne peut plus être appelé deux fois simultanément.
- Nettoyage conditionnel : le dossier download n'est supprimé qu'après notification réussie de la bibliothèque.
- Correction du chemin de source aria2 : `path.isAbsolute()` garantit que les chemins relatifs ne doublent pas le répertoire de téléchargement.
- `Promise.resolve()` sur les appels à `_clientPause()` pour supporter les backends synchrones (WebTorrent) et asynchrones (aria2).

### Moteur — Libtorrent Alpha (rtorrent/libtorrent-rasterbar)
- Nouveau backend communiquant avec rtorrent via SCGI/XMLRPC (zéro dépendance externe).
- Sélecteur dans les paramètres avec badge « Alpha » visible.
- Parser XMLRPC depth-aware : tableaux imbriqués, types i4/i8/string/boolean/nil/array.
- Opérations : ajout (magnet, .torrent, URL, infoHash brut), pause, reprise, suppression, polling 2,5 s.
- Sécurité : échappement des valeurs RC, validation d'ID, timeout SCGI 15 s, arrêt gracieux + kill forcé.
- Compatibilité Windows, Linux, Docker. Retombe en mode dégradé si le binaire est absent.

### Persistance et configuration
- Réglages persistants entre mises à jour : résolution multi-plateforme unifiée entre l'application web et le moteur.
- Changement de backend transparent (WebTorrent ↔ aria2 ↔ libtorrent) sans perte de configuration ni de téléchargement.

### Téléchargements — File d'attente
- Barre de progression fluide : interpolation 60 fps côté client entre les relevés de polling.
- Affichage corrigé de la progression et de la taille (le champ `size` est désormais transmis dans `summary()` — fini le « 0 B / 0 B »).
- ETA calculé depuis les données aria2.
- Déduplication des torrents présents à la fois dans le cache client et l'historique d'import.
- Purge des identifiants complétés à chaque cycle de polling (correction de fuite mémoire).

### Indexeurs et téléchargements
- Authentification lors du téléchargement de fichiers `.torrent` : `apikey` en paramètre d'URL, `X-Api-Key` en header.
- Extraction de l'infoHash depuis les liens magnet et transmission au moteur, évitant les désynchronisations avec le backend natif.

### Interface
- Logs d'instance avec indicateur de backend : `[stable]`, `[beta]`, `[alpha]`.
- Logs du workflow complet : ajout → complétion → import → notification bibliothèque → nettoyage download.
- Badges audio unifiés : logos SVG pour Dolby Atmos, Dolby Digital (AC3), Dolby Digital+ (EAC3), DTS, TrueHD. TextPills lisibles pour FLAC, PCM, AAC, Opus, MP3, Vorbis, WMA.
- Badges vidéo unifiés : HEVC, AVC, AV1.
- Badge SDR supprimé (l'absence de HDR est implicite).
- Crash page historique corrigé (optional chaining sur `entry.media`).
- ErrorBoundary bande-annonce : si le player YouTube plante, l'image de fond s'affiche sans crash.
- Rapport automatique d'erreurs non-critiques dans l'onglet Diagnostics admin.

### Build et infrastructure
- Correction du script Windows (`build.ps1`) : `$_.PSIsContainer` → `-Directory`, tiret cadratin Unicode échappé.
- Ajout de `rtorrent` et `aria2` à l'image Docker.

---

## v1.0 — v1.9 — Fondations

- Interface web complète : découverte, recherche, bibliothèque, calendrier, file d'attente, historique.
- Intégration Plex : streaming, sync de bibliothèque, watch status.
- Indexeurs Torznab : recherche manuelle et auto-grab, scoring, cache RSS.
- Gestion des demandes utilisateur : approbation, suivi.
- Collections, tags, versions multiples, profils de qualité.
- Renommage automatique avec templates configurables.
- Séparation des profils utilisateurs (isolation des vues par compte).
- Panel latéral de détail titre réutilisable (pas de duplication de composants).
- Responsive design (375 px minimum, 768 px tablette).
- Internationalisation : français, anglais, allemand, italien, néerlandais.
- Compatibilité Docker, Windows, Linux, NAS.

---

_Les détails complets sont disponibles dans l'historique Git._
