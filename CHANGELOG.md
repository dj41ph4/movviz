# Journal des modifications

Toutes les nouveautés et corrections notables de Movviz.

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
