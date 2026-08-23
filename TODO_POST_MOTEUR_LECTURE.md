# Suivi des idées Phase 2 du moteur de lecture

Idées validées pendant la Phase 2. L'utilisateur avait d'abord demandé
d'attendre la fin de toutes les phases (`PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md`)
pour les traiter, puis est revenu dessus et a demandé de les intégrer tout
de suite au scope en cours.

---

## 1. Analyse automatique dès qu'un fichier est récupéré — ✅ fait

Branché sur les 3 points d'entrée réels où un film obtient un fichier :
`applyImportedFiles.ts` (grab/auto-grab/RSS/récupération orpheline — un seul
point commun pour tout ça) et `librarySync.ts` (film existant qui devient
disponible, film nouveau importé directement depuis Plex). Appel en
fire-and-forget (`probeMovieInBackground`) — n'ajoute aucune latence à
l'import, une erreur d'analyse ne fait jamais échouer l'import.

## 2. Bouton "Analyse complète" en plus de l'incrémental — ✅ fait

`MediaProbePanel` a désormais deux boutons : "Lancer l'analyse" (incrémental,
comportement par défaut inchangé) et "Analyse complète" (`force=true`,
ignore le cache et ré-analyse tout). Testé : un hit de cache normal prend
~0.06ms, un appel forcé relance bien un vrai ffprobe (~30ms sur le fichier
de test).

## 3. Remplacer/enrichir les pastilles qualité de la fiche avec MediaDescriptor — ✅ fait

`mediaDescriptorEnrich.ts` : après chaque probe réussi, les champs
resolution/videoCodec/audioCodec/hdr de `LibraryFile` (primaire, via
`setPrimaryFile` — jamais un hand-patch direct, `versions[]` reste
synchronisé) sont mis à jour avec la vérité ffprobe, canonicalisée dans le
même vocabulaire que `MediaBadges.tsx` (HEVC/AVC/AV1…, TrueHD/DTS/AAC…,
HDR10/Dolby Vision/HLG). Un film jamais analysé garde ses champs actuels
intacts — aucune régression pour la partie du catalogue pas encore
couverte.

**Bug trouvé et corrigé pendant les tests réels** : le bucket de résolution
était calculé sur la hauteur ffprobe — cassait sur tout titre UHD cropé pour
un ratio cinéma (ex. RoboCop 2014 : 3840×1604 réel, hauteur bien en dessous
de 2160 à cause du crop 2.39:1, classé à tort en 1080p). Recalculé sur la
largeur (le width d'un disque 4K reste ~3840 quel que soit le crop) — vérifié
sur 72 films réellement accessibles depuis cette machine, 35 changements,
zéro régression après correction (tout ce qui était juste avant reste juste,
tout ce qui était faux/absent est maintenant correct).

**Deuxième correction, signalée par l'utilisateur** : le badge audio prenait
la piste flaggée "default" par ffprobe (souvent juste l'ordre des pistes dans
le fichier, ex. anglais en premier), sans lien avec la langue réellement
regardée — un fichier français en TrueHD + anglais en AAC affichait le badge
AAC. Corrigé avec `findTrackForLocale()` (déjà partagé avec la sélection auto
des pistes du lecteur, `detectLanguage.ts`) sur `DEFAULT_LOCALE` ("fr",
French-first) : le badge préfère maintenant la piste française si elle
existe, sinon retombe sur l'ancien comportement (default ffprobe puis
première piste). Vérifié sur 3 cas réels (FR non-default, aucune piste FR,
tag ISO 3 lettres "fra").

## 4. Adapter la qualité/vitesse d'encodage à la puissance réelle du serveur — ✅ fait

Soulevé pendant la Phase 6 (détection des capacités serveur) : `serverCapabilities.detect.ts`
détecte seulement CE QUE ffmpeg sait faire (encodeurs/hwaccel compilés), jamais
la puissance réelle du CPU/GPU. Sur un NAS faible (typiquement aucun
NVENC/QSV — `hardwareAcceleration` tout à `false`), un transcodage logiciel
`libx264` au preset par défaut peut être plus lent que la lecture temps réel
→ lag/buffering.

`decidePlayback()` (Phase 4) choisit maintenant l'encodeur exact (`videoEncoderImpl`,
nouveau champ du `PlaybackPlan`) : un encodeur matériel compilé POUR CE CODEC
PRÉCIS (jamais juste "le serveur a du nvenc quelque part" — un `h264_nvenc`
dispo ne dit rien sur `hevc_nvenc`) est toujours préféré ; sinon repli logiciel
(`libx264`/`libx265`/`libsvtav1` — ce dernier choisi plutôt que `libaom-av1`,
bien trop lent pour rester devant la lecture temps réel) avec un preset rapide
`veryfast` (`encoderPreset`, même choix par défaut que Plex Media Server pour
la même raison). Vérifié par 3 tests dédiés, dont un qui confirme explicitement
qu'un nvenc h264 n'est jamais utilisé à tort pour une cible hevc.

**Complété plus tard (Phase 16, audit fondamentaux)** : la partie exécution
manquait encore — `decidePlayback()` savait choisir le bon encodeur, mais rien
n'appliquait de plafond de résolution ni de contrôle qualité correct par
famille d'encodeur. Corrigé : `-crf` était un no-op silencieux sur TOUT
encodeur matériel (nvenc/qsv/vaapi/amf n'ont pas cette option) — vérifié en
direct sur nvenc réel (RTX 5070 Ti) : un encodage 4K avec `-crf 23` ignoré
sortait à un débit plat ~2 Mbit/s peu importe la résolution ; remplacé par
les vraies options de chaque famille (`-rc vbr -cq` nvenc, `-global_quality`
qsv, `-rc_mode CQP -qp` vaapi, `-rc cqp -qp_i/-qp_p` amf — nvenc re-testé en
direct après correction : débit qui suit enfin la résolution, 320×240 vs 4K
nettement différents). Un encodage logiciel (aucun encodeur matériel
disponible) plafonne maintenant une source au-delà de 1920px de large —
plafond honoré même sans limite déclarée par le client, spécifiquement pour
le cas "NAS faible" que ce point visait dès le départ.

## 5. Audit complet des fondamentaux de transcodage — deux agents dédiés, 2026-08-23

Après le bug du downmix audio manquant (voir CHANGELOG v1.19.06), l'utilisateur
a demandé un audit systématique plutôt que de continuer à corriger un bug à la
fois. Deux passes : la première a lu le code réel (`localExecutor.ts`,
`decidePlayback.ts`, `mediaProbe.ts`, etc.) et vérifié chaque hypothèse contre
un vrai `ffmpeg`/`ffprobe` plutôt que de deviner ; la seconde a relu le plan
complet (`PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md`, 76 sections) pour comparer le
code à ce qu'il promet explicitement. 19 constats au total.

**Corrigés dans la foulée** :
- Polices manquantes dans l'image Docker de prod (`fontconfig`/`ttf-dejavu`
  ajoutés) — sans ça, l'incrustation de sous-titres (tous les sous-titres
  image PGS/VobSub, donc quasi tout le BluRay) rendait du texte invisible ou
  plantait le process ffmpeg entier en prod.
- Contrôle qualité par encodeur + plafond de résolution logiciel (point 4
  ci-dessus).
- Aucun intervalle de keyframe fixé sur les transcodages — un scrub dans une
  session déjà tamponnée retombait ~10s en arrière au lieu de suivre le
  point cliqué (vérifié en direct : keyframes à 1/251/501 sans le correctif,
  exactement 0/2/4/6/8/10s avec).
- Débit audio plat 192k quel que soit le nombre de canaux réellement
  encodés — maintenant proportionnel (96k/canal), pertinent seulement si un
  futur client déclare plus de 2 canaux (aujourd'hui tout est downmixé en
  stéréo, voir point audio du CHANGELOG v1.19.06).
- Les capacités vidéo du client desktop (`clientProfile.detect.ts`) ne
  déclaraient JAMAIS `profiles`/`levels`/`bitDepths`/`maxWidth`/`maxHeight` —
  chaque vérification correspondante dans `decidePlayback()` était donc
  silencieusement ignorée. Ajout de vraies sondes WebCodecs (bit depth HEVC/AV1
  10-bit distinctes du flag 8-bit existant, support 4K par codec) — vérifiées
  en direct dans un vrai navigateur.
- AC-3/E-AC-3 déclarés compatibles sur la seule foi du signal MSE
  (`mseAc3`/`mseEac3`) alors que ce moteur livre en `<video>` natif, pas MSE —
  reproduisait exactement le bug historique documenté dans `remuxSession.ts`
  (flux muet). Corrigé pour ne se fier qu'au signal natif.

**Reste à faire — pas corrigé, noté ici pour ne pas être oublié** :
- **Encodage des sous-titres non-UTF-8** (SRT en Windows-1252/ISO-8859-1,
  courant sur les anciennes releases françaises) : confirmé en direct que
  l'incrustation plante purement et simplement sur du texte non-UTF-8, et que
  l'extraction produit un fichier vide sans erreur visible. Tentative de
  correction abandonnée cette session (la détection d'encodage + le bon
  placement de `-sub_charenc` demandait plus de mise au point qu'anticipé) —
  à reprendre avec un banc de test plus fiable.
- **Aucune cascade de repli interne Movviz** à l'échec d'exécution (§43/§46
  du plan) : `sessionManager.ts` a bien `recordFallbackAttempt()` mais rien ne
  l'appelle — un échec ffmpeg en cours de session saute direct à une erreur
  fatale (contenu purement local) ou à Plex après une seule tentative (contenu
  lié à Plex), jamais une dégradation Movviz→Movviz d'abord. Le plus gros
  chantier restant, architecturalement.
- **`MAX_CONCURRENT` non partagé** entre le nouveau moteur local et l'ancien
  moteur Plex (`remuxSession.ts`) — chacun a son propre plafond de 3, donc
  6 process ffmpeg simultanés possibles sans que ni l'un ni l'autre le sache.
  Pas de tiers de coût différenciés non plus (§58-59 du plan) — transcodage
  vidéo et tone-mapping HDR consomment le même "slot" qu'un simple remux.
- **Panneau debug (§52), logs structurés (§54), métriques (§55)** : rien de
  tout ça n'existe encore pour le nouveau moteur — `console.log` texte libre
  au lieu du format `clé=valeur` prévu, aucune métrique agrégée
  (`plexFallbackRate` etc.). Cohérent avec l'avancement du plan (ces sections
  sont prévues plus tard), mais noté pour ne pas l'oublier une fois qu'on y
  arrive.
- **Feature flags par couche (§67)** : un seul interrupteur ("engine-v2")
  pour tout le moteur au lieu des 7 prévus par le plan
  (`movvizHdrPipeline` etc. — désactiver une seule couche sans couper tout le
  reste n'est pas possible aujourd'hui).
- Points mineurs non traités : `TranscodeBackendSelector` (§30) pas séparé du
  moteur de décision (fonctionne, juste pas la couche nommée que le plan
  prévoit) ; flux d'images "cover art" jamais explicitement exclus de la
  détection du flux vidéo principal (pas de cas réel trouvé, juste aucune
  protection) ; aucun hook de nettoyage sur arrêt serveur (process ffmpeg
  potentiellement orphelins après un restart en cours de session — même
  lacune que l'ancien moteur Plex, pas une régression).

**Reste à faire, hors scope de ce point (décision pure, pas exécution)** :
mesurer le facteur de vitesse ffmpeg en direct pendant un vrai transcodage et
dégrader encore (résolution/bitrate) ou basculer en `PLEX_FALLBACK` si même
le preset rapide logiciel ne suit pas — nécessite un vrai process ffmpeg qui
tourne, donc seulement possible une fois le Playback Executor (phase plus
loin dans le plan) écrit.

## 6. Validation réelle en prod (movviz.dj41ph4.ovh) — bug trouvé et corrigé, 2026-08-23/24

Une fois le mode "Auto" activé en prod (le seul réglage qui expose le nouveau
moteur pour du contenu purement local, sans toucher au chemin Plex existant
pour tout le reste), deux vrais films locaux ont été testés en direct sur le
vrai Synology : "The Raid" (AVC 1080p + AC3, cas de base — copie vidéo, audio
transcodé et downmixé en 2.0) a fonctionné parfaitement, durée correcte,
lecture fluide, buffer confortablement devant la lecture. "Dragons" (HEVC 4K
Dolby Vision, cas dur — transcodage vidéo complet + tone-mapping) a échoué
immédiatement avec un message "Impossible de lire cette vidéo, ouvrez-la dans
Plex à la place" — trompeur, puisque ce film n'a justement aucun lien Plex.

**Cause réelle trouvée** : `serverCapabilities.detect.ts` ne faisait que lire
la liste des encodeurs COMPILÉS dans le binaire ffmpeg (`ffmpeg -encoders`) —
jamais si le matériel derrière existe vraiment. Sur ce Synology, l'encodeur
`av1_qsv` (Intel Quick Sync) est bien compilé dans l'image ffmpeg mais aucun
périphérique QSV n'est exposé au conteneur Docker — `decidePlayback()` le
choisissait quand même (raisonnement correct sur des données fausses),
`pickVideoEncoderImpl()` renvoyait `av1_qsv`, et la tentative d'encodage
plantait immédiatement au runtime, sans repli. C'est exactement la limite que
le fichier documentait déjà lui-même en commentaire ("hardwareAcceleration.*
veut dire que ffmpeg tenterait, pas que le matériel existe") — mais jamais
corrigée jusqu'à ce que ce test en conditions réelles la fasse apparaître.

**Corrigé** : `detectServerCapabilities()` tente maintenant un vrai micro-
encodage (320×240, 1 frame, `-f null -`) pour chaque famille matérielle que
la liste compilée prétend supporter, et retire de `videoEncoders` tout nom
dont la famille échoue réellement ce test — un seul point de filtrage,
puisque `pickVideoEncoderImpl()` ne fait que vérifier `videoEncoders.includes(...)`.
Vérifié en direct sur la machine de dev (vrai GPU NVIDIA présent) : `h264_nvenc`
réussit véritablement et reste disponible, tandis que `h264_qsv`/`h264_amf`
échouent véritablement ("Error creating a MFX session", "DLL amfrt64.dll
failed to open") et sont bien exclus — la distinction que ce correctif existe
pour faire. 310 tests passent (2 nouveaux remplacent l'ancien test qui
n'attendait que la présence dans la liste compilée, pour un solde net de +1).
