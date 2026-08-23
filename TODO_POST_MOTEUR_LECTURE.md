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

## 4. Adapter la qualité/vitesse d'encodage à la puissance réelle du serveur — ✅ fait (partie décision)

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

**Reste à faire, hors scope de ce point (décision pure, pas exécution)** :
mesurer le facteur de vitesse ffmpeg en direct pendant un vrai transcodage et
dégrader encore (résolution/bitrate) ou basculer en `PLEX_FALLBACK` si même
le preset rapide logiciel ne suit pas — nécessite un vrai process ffmpeg qui
tourne, donc seulement possible une fois le Playback Executor (phase plus
loin dans le plan) écrit.
