# À faire une fois le moteur de lecture terminé

Idées validées pendant la Phase 2, volontairement mises de côté pour ne pas
dévier du plan de refonte (`PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md`). À
reprendre une fois la dernière phase (Phase 20 — Device Learning) livrée.

---

## 1. Analyse automatique dès qu'un fichier est récupéré

Aujourd'hui `getOrProbeMediaDescriptor()` n'est appelée que manuellement
(bouton Réglages > Maintenance) ou par le futur moteur de décision à la
demande. Brancher un appel juste après qu'un fichier atterrisse dans la
bibliothèque (grab terminé, import, réconciliation disque) — probablement
dans `autoGrab.ts` / `autoGrabSeries.ts` — pour que le film soit déjà
analysé avant même la première lecture.

## 2. Bouton "Analyse complète" en plus de l'incrémental actuel

Le cache (path+size+mtime) rend déjà `MediaProbePanel` incrémental par
défaut — relancer le bouton ignore tout fichier inchangé. Ajouter un second
bouton/option "Forcer une analyse complète" qui ignore le cache et
ré-analyse tout, utile après une mise à jour de la logique de mapping
(`PROBE_VERSION`) ou en cas de doute.

## 3. Remplacer/enrichir les pastilles qualité de la fiche avec MediaDescriptor

Les pastilles actuelles (résolution/codec/HDR sur la fiche film/série)
viennent de `LibraryFile` (synchro Plex ou parsing du nom de fichier au
moment du grab) — une source moins fiable que ffprobe, qui lit le vrai
fichier. Une fois `MediaDescriptor` disponible pour (quasi) tout le
catalogue, envisager de l'utiliser comme source de vérité pour l'affichage
aussi, pas seulement pour les décisions de lecture — décision de scope
séparée (bibliothèque/affichage), pas partie du moteur de lecture lui-même.

---

*Rappel : ne pas commencer ces trois points avant que toutes les phases du
plan de refonte soient terminées — l'utilisateur a explicitement demandé
d'attendre la fin.*
