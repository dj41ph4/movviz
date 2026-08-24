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

## 7. Suite du test réel en prod — le format vidéo cible ne tenait pas compte du coût logiciel, 2026-08-24

Une fois le correctif du point 6 déployé (`av1_qsv` retiré à raison), "Dragons"
échouait toujours, et un deuxième film local ("Soixante 9", HEVC 4K SDR) a
été observé en train de rebufferiser en boucle toutes les ~5 secondes. Mesure
en direct sur le flux réel : les événements `waiting` du `<video>` tombaient
toutes les ~5.3s et ne faisaient avancer la lecture que d'environ 2.0s à
chaque fois (soit une durée de GOP) — un facteur temps réel soutenu
d'environ 0.38x, pas un simple aléa réseau.

**Cause réelle** : `pickTranscodeVideoCodec()` choisissait le format cible
(av1 > hevc > h264, dans cet ordre) uniquement d'après ce que l'appareil de
lecture déclare pouvoir décoder — sans jamais regarder si le serveur allait
devoir encoder ce format en logiciel. Un encodage AV1 logiciel (`libsvtav1`,
même au preset le plus rapide) est nettement plus lent qu'un encodage H.264
logiciel (`libx264`) à résolution égale — l'écart de coût encodeur est bien
plus grand que l'écart de coût décodeur, que cette fonction ignorait
complètement. Exactement le point que Plex Media Server tranche déjà en
choisissant toujours H.264 pour ses transcodages logiciels.

**Corrigé** : `pickTranscodeVideoCodec()` reçoit maintenant aussi les
capacités serveur. Un format n'est préféré pour sa meilleure compression que
si un encodeur matériel RÉELLEMENT vérifié (point 6) existe pour lui ; sinon,
h264 est choisi en priorité pour rester réalisable en temps réel en
logiciel — cohérent avec le choix par défaut de Plex Media Server pour la
même raison. Vérifié par 2 nouveaux tests dédiés (`scripts/decide-playback.test.ts`) :
aucun encodeur matériel vérifié → h264 malgré une préférence client pour av1 ;
un encodeur matériel av1 réellement vérifié → av1 reste préféré, sans
régression. 312 tests passent.

## 8. Suite du test réel en prod — le tonemap HDR→SDR avait besoin de sa propre limite, 2026-08-24

Une fois le correctif du point 7 déployé, "Dragons" retombait TOUJOURS en
mémoire tampon sans jamais avancer (0 progression sur 15+ secondes), cette
fois avec `videoEncoderImpl=libx264` confirmé correct — donc pas un problème
de choix d'encodeur. Isolé par élimination : "Soixante 9" (HEVC 4K SDR,
même plafond 1920px, encodage logiciel) suivait parfaitement la lecture en
temps réel dans le même test de session. La seule vraie différence entre
les deux : "Dragons" est Dolby Vision et nécessite la conversion HDR→SDR
(`toneMap`), "Soixante 9" est SDR et n'en a pas besoin.

**Cause réelle** : la chaîne `zscale`/`tonemap` (conversion en lumière
linéaire 32 bits flottant, tone mapping, reconversion) ajoute un vrai coût
de calcul par image, en plus du décodage + redimensionnement + encodage —
jamais pris en compte par le plafond de résolution existant, qui traitait
tout encodage logiciel de la même façon qu'il y ait tonemap ou non.

**Corrigé** : `pickTargetVideoWidth()` applique maintenant un plafond plus
strict (1280px, contre 1920px) spécifiquement quand un encodage logiciel ET
une conversion HDR→SDR sont tous les deux nécessaires en même temps ; un
encodeur matériel réel n'est jamais concerné (un vrai GPU encaisse le
tonemap sans problème). Le chiffre 1280 est un point de départ raisonné
(zone d'ombre : impossible de profiler ce NAS précis depuis l'extérieur),
explicitement à revalider en conditions réelles après déploiement — pas une
valeur mesurée en laboratoire. 2 nouveaux tests dédiés, 314 tests passent.

**Complication du test lui-même, notée pour la prochaine fois** : ce
correctif a été mesuré alors qu'un téléchargement de ~52 Go tournait en
parallèle sur le même NAS — le débit du téléchargement s'est effondré de
34,5 Mo/s à 4,3 Mo/s pendant le test de lecture, la preuve que les deux
activités se disputaient les mêmes ressources limitées. Le téléchargement a
dû être mis en pause pour obtenir une mesure fiable, isolée de ce bruit.

**Complété dans la foulée, même principe poussé plus loin** : en plus du
plafond de résolution plus strict, le préset d'encodeur logiciel passe à
`ultrafast` (au lieu de `veryfast`) spécifiquement pour la combinaison
encodage logiciel + tonemap — moins de compression demandée à l'encodeur =
moins de calcul par image, fichier plus gros en échange (acceptable pour un
cas qui sinon ne joue pas du tout). N'importe qui d'autre (encodage logiciel
seul, encodage matériel avec tonemap) garde son réglage précédent — testé
et confirmé qu'aucune régression n'est introduite ailleurs. 314 tests
passent.

## 11. Mode autonome complet — reste du backlog traité en une session, 2026-08-24

Une fois la règle absolue HDR/DV validée en direct sur "Dragons" (facteur
temps réel confirmé à 0.9999995, quasi-parfait, sur 45.76 secondes de
lecture continue), l'utilisateur a autorisé une session en mode autonome
pour traiter le reste du backlog. Livré :

- **Benchmark du serveur** (`serverBenchmark.ts`, explicitement demandé plus
  tôt dans la session) : mesure un vrai encodage ffmpeg court pour chaque
  profil réel que `decidePlayback()` produit (logiciel simple, logiciel +
  tonemap, matériel si un encodeur est vraiment vérifié) et calcule le
  facteur temps réel obtenu — exactement la métrique qui a servi, à la
  main, à trouver et calibrer chaque correctif de cette investigation. Trois
  déclencheurs pour une seule fonction : bouton manuel (Réglages →
  Performance → nouveau `BenchmarkPanel`), démarrage juste après une mise à
  jour (`instrumentation.ts`, compare la version enregistrée du dernier
  résultat à la version courante — fonctionne pareil pour l'installeur
  Windows et un re-pull d'image Docker/NAS, les deux se terminant par un
  redémarrage du process), et une tâche planifiée mensuelle
  (`scheduler/tasks.ts`, apparaît aussi gratuitement dans le panneau
  Automatisation générique). Piège trouvé et corrigé en vérifiant en
  direct : la source synthétique `lavfi color=` n'a AUCUNE métadonnée de
  couleur — `zscale` refuse toute conversion ("no path between
  colorspaces") tant que primaries/transfer/matrix ne sont pas explicites
  des DEUX côtés (entrée ET sortie), y compris pour un simple bt709→bt709 ;
  la chaîne réelle de `localExecutor.ts` n'a jamais ce problème puisque les
  vrais fichiers HDR portent toujours ces tags.
- **Détection HDR réelle** (`clientProfile.detect.ts`) : `hdr` n'était
  jamais renseigné sur les capacités vidéo du client desktop — même un
  écran HDR réel ne pouvait jamais bénéficier du repli Dolby Vision
  rétrocompatible (§29). Corrigé avec `matchMedia("(video-dynamic-range:
  high)")` — vérifié en direct que c'est le bon signal : sur cette machine,
  `(dynamic-range: high)` vaut `true` (écran HDR) mais `(video-dynamic-
  range: high)` vaut `false` au même instant (mode vidéo HDR pas actif) ;
  utiliser le premier aurait produit un faux positif.
- **Sélecteur manuel "Mode transcodage" nettoyé** : signalé par
  l'utilisateur comme confus et cassé pour du contenu local ("Audio
  seulement" échoue, "Auto" fonctionne). Cause réelle : ce menu ne pilote
  que `handlePlexPlayback()` → l'ancien circuit HLS/Plex, jamais le nouveau
  moteur local. Le menu entier est maintenant masqué quand
  `hasRealPlexLink` est faux (calculé une fois au niveau du composant,
  réutilisé là où il l'était déjà en interne) — la combinaison cassée n'est
  plus jamais atteignable, plutôt que de laisser chaque option échouer
  individuellement.
- **Cover art jamais confondue avec la vidéo principale** (`mediaProbe.ts`) :
  `disposition.attached_pic` (confirmé en direct via un MP3 avec pochette
  embarquée, ET qu'une pièce jointe Matroska n'apparaît elle jamais comme un
  flux — deux mécanismes distincts) exclut maintenant une image de
  couverture du choix du flux vidéo principal, avec repli si c'est
  vraiment le seul flux vidéo présent.
- **Limite de sessions partagée** (`sharedTranscodeLimit.ts`) : le moteur
  local et l'ancien circuit Plex avaient chacun leur propre plafond de 3,
  soit jusqu'à 6 process ffmpeg simultanés possibles sans qu'aucun des deux
  ne le sache — sur un DS923+ à 2 cœurs sans GPU, potentiellement
  catastrophique. Un seul plafond partagé maintenant, lu directement depuis
  les deux registres `globalThis` (pas d'import circulaire entre les deux
  moteurs).
- **Nettoyage à l'arrêt du serveur** (`instrumentation.ts`) : aucun des deux
  moteurs ffmpeg n'avait de hook de nettoyage sur SIGTERM/SIGINT — un
  redémarrage/redéploiement laissait tout process en cours orphelin. Best-
  effort SIGTERM à chaque session active à l'arrêt, sans jamais appeler
  `process.exit()` soi-même (reste la responsabilité de Next.js).

**Reste explicitement hors scope** (annoncé comme tel dès le départ, pas
oublié) : clients natifs Android TV/Mobile/Cast (phases 17-19 du plan —
codebases séparées, pas réalisable dans une continuation de cette session) ;
encodage des sous-titres non-UTF-8 (tentative déjà abandonnée une fois cette
session, nécessite un banc de test plus fiable) ; cascade de repli interne
Movviz→Movviz en cas d'échec d'exécution (`recordFallbackAttempt()` toujours
non appelé — le plus gros chantier architectural restant) ; panneau debug,
logs structurés et métriques dédiés au nouveau moteur ; feature flags
granulaires par couche (§67) ; séparation `TranscodeBackendSelector` (§30,
refactor pur sans gain fonctionnel).

## 9. Suite du test réel en prod — le plafond 1280px ne suffisait toujours pas, 2026-08-24

Une fois la 1.19.11 déployée, "Dragons" a été retesté avec zéro autre charge
sur le serveur ("300" venait de finir son téléchargement) : plus aucun
plantage, mais mesure directe sur deux fenêtres consécutives de ~22
secondes confirme un facteur temps réel stable d'environ 0.29-0.31x — la
lecture s'éloigne continuellement de ce qui est réellement disponible,
pas un simple retard au démarrage qui se rattrape.

**Raisonnement** : le filtre de redimensionnement s'exécute APRÈS le
décodage — réduire la résolution de sortie ne réduit jamais le coût du
décodage lui-même. La comparaison avec "Soixante 9" (point 7-8, source 4K de
classe de décodage comparable, sans tonemap, plafond 1920px, facteur temps
réel proche de 1x) suggère que décodage + redimensionnement + encodage
tiennent déjà seuls dans le budget — c'est bien la conversion HDR→SDR
elle-même qui domine le surcoût, et son coût suit le nombre de pixels
traités. Fermer un écart de ~3.3x seulement en réduisant sa part
(tonemap+encodage) demande environ racine(3.3)≈1.8x de réduction de
largeur ; 1280/1.8≈720 — qui correspond aussi au plancher "sécurisé" que
d'autres solutions de transcodage (Plex, Jellyfin) utilisent déjà pour ce
même cas.

**Corrigé** : plafond resserré à 720px pour la combinaison encodage
logiciel + tonemap (était 1280px). Toujours un point de départ raisonné à
revalider en conditions réelles, pas une valeur mesurée en laboratoire —
impossible de profiler ce NAS précis depuis l'extérieur. 314 tests passent
(valeur attendue mise à jour dans le test existant).

## 10. Changement de fond — le HDR/Dolby Vision ne force plus de transcodage vidéo, 2026-08-24

Après la 1.19.12, l'utilisateur a confirmé son modèle réel : **Synology
DS923+**. Recherche faite, confirmée par plusieurs sources indépendantes —
le DS923+ tourne sur un AMD Ryzen R1600, **2 cœurs**, **sans aucun GPU
intégré**. Ce n'est pas un problème de pilote ou de configuration Docker à
corriger : il n'y a littéralement aucune puce à exposer au conteneur. Ça
confirme définitivement que le plafond logiciel mesuré aux points 6-9 est
réel et non contournable par du réglage fin supplémentaire — décision prise
d'arrêter cette piste-là.

L'utilisateur a alors posé la vraie question qui débloque tout :
**pourquoi transcoder la vidéo du tout pour un problème purement HDR ?**
Un décodeur qui ne comprend pas le Dolby Vision affiche quand même l'image
en utilisant la couche de base — juste avec un rendu des couleurs un peu
moins précis, jamais une image cassée ou absente. Forcer un transcodage
(cher, et sur ce NAS, voué à ne jamais suivre le temps réel) uniquement
pour corriger la précision des couleurs est le mauvais compromis sur du
matériel modeste. Règle absolue posée par l'utilisateur : *"le HDR ou DoVi,
tu n'y touches pas ; seules les vidéos où l'image n'apparaît pas déclenchent
un transcodage automatique de l'image ; sinon c'est audio seulement."*

**Bug annexe découvert en creusant la question** : `clientProfile.detect.ts`
ne renseignait JAMAIS le champ `hdr` des capacités vidéo du client desktop —
ce qui signifie que même un vrai écran HDR n'aurait jamais pu bénéficier du
repli déjà existant pour Dolby Vision rétrocompatible (§29). Vérifié en
direct dans un vrai navigateur : `matchMedia('(dynamic-range: high)')` vaut
`true` sur cette machine (l'écran est HDR) mais
`matchMedia('(video-dynamic-range: high)')` vaut `false` (le mode vidéo HDR
n'est pas actif) — la bonne détection existe et fonctionne, mais un
correctif basé uniquement dessus n'aurait pas résolu le cas réel de
l'utilisateur aujourd'hui. Non traité pour l'instant (noté ici, pas encore
implémenté) — la règle absolue ci-dessous rend la question largement
secondaire de toute façon.

**Corrigé** : `checkVideoCompatibility()` distingue maintenant les raisons
"dures" (codec/profil/palier/profondeur de couleur/résolution/fps — l'image
ne s'afficherait vraiment pas) des raisons HDR/DV (toujours enregistrées
pour diagnostic, mais qui ne comptent plus dans le calcul de compatibilité).
Un décalage HDR/DV seul → vidéo toujours COPY, seuls l'audio et le
conteneur changent si besoin. `toneMapNeeded` reste honoré si un
transcodage vidéo est de toute façon déclenché pour une vraie raison dure
(ou pour l'incrustation de sous-titres) — pas de raison de se priver d'une
correction de couleur gratuite dans ce cas. 315 tests passent (3 tests
réécrits pour refléter le nouveau comportement, 1 nouveau test qui vérifie
que le tonemap reste appliqué quand un transcodage est déjà forcé pour une
vraie raison).

**Reste signalé par l'utilisateur, pas encore traité** : le sélecteur
manuel "Mode transcodage" (Auto / Lecture directe / Audio seulement / Vidéo
seulement / HLS manuel) dans les contrôles du lecteur ne pilote QUE
l'ancien chemin Plex/HLS (`reloadHls()`) — pour du contenu purement local
(sans lien Plex réel, comme "Dragons"), choisir "Audio seulement" tente de
recharger une session Plex qui n'existe pas et échoue, alors que "Auto"
fonctionne car il route correctement vers le nouveau moteur local. Signalé
par l'utilisateur comme confus/à refaire entièrement. Pas encore corrigé —
la priorité immédiate était la règle absolue HDR/DV ci-dessus, qui rend déjà
"Auto" fiable pour ce cas. Le ménage de ce sélecteur (le désactiver pour du
contenu sans lien Plex réel, ou le reconnecter au nouveau moteur) reste à
faire séparément.
