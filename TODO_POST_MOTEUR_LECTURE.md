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

## 3. Remplacer/enrichir les pastilles qualité de la fiche avec MediaDescriptor — en attente

Les pastilles actuelles (résolution/codec/HDR sur la fiche film/série)
viennent de `LibraryFile` (synchro Plex ou parsing du nom de fichier au
moment du grab) — une source moins fiable que ffprobe, qui lit le vrai
fichier. Une fois `MediaDescriptor` disponible pour (quasi) tout le
catalogue, envisager de l'utiliser comme source de vérité pour l'affichage
aussi, pas seulement pour les décisions de lecture.

**Volontairement pas encore fait** : contrairement aux points 1 et 2, c'est
un changement plus risqué (remplace une source de donnée utilisée partout
dans l'app — dashboard, découverte, fiches, bibliothèque) et ça touche à la
couverture réelle du cache (tout le catalogue n'est pas encore analysé). À
discuter avant de s'y lancer : remplacement total, ou juste enrichissement
en complément quand Plex ne sait pas ?
