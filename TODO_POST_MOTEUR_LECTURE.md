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
