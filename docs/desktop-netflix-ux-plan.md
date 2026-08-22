# Chantier UX desktop — Movviz × référence Netflix

> **Document de suivi vivant.** Le statut de chaque étape est mis à jour dans
> ce fichier avant et après son implémentation. En cas de reprise de contexte,
> lire ce document en premier, puis vérifier `git status` et les commits.

## Objectif

Faire évoluer l'expérience cinéma du **desktop** vers les comportements
éditoriaux et de navigation appréciés sur Netflix, sans copier son interface et
sans sacrifier les forces de Movviz : Plex, demandes, téléchargements,
bibliothèque technique et lecteur multi-modes.

## Décisions non négociables

- Les fiches restent **des panneaux flottants**. Une carte ne mène jamais à
  une page détail dédiée.
- Chemin obligatoire : `carte → TitlePanel → TitleContent → fermer → retour à
  la même rangée et à sa position de scroll`.
- `TitleContent.tsx` demeure l'unique fiche. Aucune variante ou copie de page
  détail n'est autorisée.
- Accueil, Films et Séries adoptent les tuiles cinéma 16:9 ; la Bibliothèque
  conserve les affiches verticales et ses informations techniques.
- Une tuile éditoriale ne repasse jamais à une affiche verticale seule : en
  absence de backdrop, créer une composition 16:9 à partir de l'affiche ; le
  logo officiel est posé sur l'image. En l'absence de logo, le titre texte
  remplace uniquement le logo.
- Films et Séries gardent des contenus séparés. Leur futur sélecteur **Genre**
  est distinct pour chaque type.
- Aucun changement backend n'est inclus dans ce chantier, sauf correction
  strictement nécessaire à une donnée déjà exposée par l'API.
- Le comportement de barre noire au scroll concerne le **navrail Android TV**,
  pas le desktop. Il est hors de ce chantier desktop.

## Référence observée

### Netflix à retenir

- Hero éditorial, titre/logo, synopsis court, CTA et pagination discrète.
- Rangées ordinaires en 16:9, environ sept tuiles visibles sur grand écran.
- Rangées nommées avec intention : recommandation, durée courte, nouveautés,
  ajout récent, tendance.
- Top 10 : exception en affiche verticale avec numéro XXL.
- Survol différé : fiche flottante, sans reflow des rangées, recadrée pour ne
  jamais sortir de la fenêtre.
- Clic série : détail riche et saison/épisodes ; clic épisode : lecture directe.
- Lecteur série : prochain épisode ; lecteur film : pas de prochain épisode.

### Movviz à préserver

- Accueil : hero vidéo, identité Movviz, compteurs, rangées et CTA existants.
- Découverte : recherche, filtres, états Ajouté/Ajouter, panneau de fiche.
- Fiche : trailer/hero, note, liste, distribution, metadata, saisons, épisodes,
  similaires et actions opérationnelles.
- Bibliothèque : qualité, codecs, HDR, Plex, disponibilité, progression des
  épisodes, filtres et tris.

## État du worktree au démarrage

Des modifications non commitées existent déjà sur Android TV, `DashboardPosterCard.tsx`
et le lecteur desktop. Elles ne constituent **pas** une étape validée tant que
leur flux complet et la compilation de production n'ont pas été contrôlés.

## Étapes majeures

| # | Étape | Statut | Critère de sortie |
|---|---|---|---|
| 1 | Cadrage et inventaire des composants réutilisables | En cours | Architecture et données nécessaires identifiées, aucune duplication de fiche |
| 2 | Accueil : hero éditorial et ordre des rangées | À faire | Hero lisible, logo/texte de secours, CTA, rangées intentionnelles |
| 3 | Accueil : tuiles 16:9 et logos intégrés | À faire | Backdrop/logo/fallback 16:9 sur toutes les rangées concernées |
| 4 | Survol desktop flottant | À faire | Délai, preview, aucun reflow, pas de coupure, clic conservé |
| 5 | Catalogues Films et Séries | À faire | Vues séparées, hero par type, bouton Genre et catégories cohérentes |
| 6 | Fiche flottante commune | À faire | Panneau identique partout, scroll et fermeture restitués |
| 7 | Fiche Série et épisodes | À faire | Saisons justes, téléchargement de saison manquante, épisode direct, prochain épisode |
| 8 | Fiche Film et reprise | À faire | Lire/Continuer/Recommencer cohérents avec la reprise fusionnée Plex/Movviz |
| 9 | Lecteur desktop | À faire | Nouveau dock, progression visible, skips, sous-titres et modes préservés |
| 10 | Bibliothèque technique | À faire | Aucune régression sur verticalité, badges, Plex, filtres ou informations média |
| 11 | Validation et release | À faire | Parcours réels film/série, build, tests ciblés et revue de diff |

## Détail opérationnel

### Étape 1 — Cadrage et inventaire

- [ ] Cartographier les composants : hero, rangées, cartes, `TitlePanel`,
  `TitleContent`, lecteur, vue Bibliothèque.
- [ ] Confirmer les champs image déjà disponibles (`poster`, `backdrop`,
  `logo`) et identifier seulement les modèles qui doivent exposer ces données.
- [ ] Définir une seule variante de carte 16:9 éditoriale, réutilisable par
  Accueil, Films et Séries.
- [ ] Écrire les règles de fallback image/logo sans lookup HTTP par carte.
- [ ] Vérifier que les changements déjà présents ne contredisent pas ce plan.

### Étape 2 — Accueil

- [ ] Conserver le hero Movviz, mais normaliser son cadrage, son contraste et
  sa zone de CTA.
- [ ] Priorité au logo officiel ; après trois secondes sans logo, afficher le
  titre texte sans transition qui ferait disparaître un élément déjà lisible.
- [ ] Ajouter/ordonner les rangées éditoriales : recommandations, formats courts,
  tendance, nouveautés, reprise et sorties à venir.
- [ ] Garder le mélange film/série seulement ici.

### Étape 3 — Cartes 16:9

- [ ] Utiliser `backdrop` quand présent, logo intégré et dégradé de contraste.
- [ ] Construire le fallback 16:9 dérivé du poster sans affiche verticale seule.
- [ ] Garder les badges contextuels, mais sobres.
- [ ] Réserver les affiches verticales et le rang XXL au seul Top 10.

### Étape 4 — Survol

- [ ] Déclencher après environ 700 ms uniquement sur desktop.
- [ ] Rendre une fiche flottante au-dessus des rangées, sans changement de
  largeur/hauteur de la carte source.
- [ ] Montrer image, logo/titre, métadonnées et actions visuelles.
- [ ] Garantir la lisibilité en bord d'écran et conserver le clic vers le
  panneau Movviz.
- [ ] Préserver un parcours tactile/mobile sans dépendre du survol.

### Étape 5 — Films et Séries

- [ ] Créer les vues de catalogue avec hero propre à leur type.
- [ ] Ajouter le bouton **Genre** près du titre de page.
- [ ] Alimenter Films avec des rangées exclusivement film et Séries avec des
  rangées exclusivement série.

### Étapes 6 à 9 — Fiches et lecteur

- [ ] Conserver le panel comme unique destination de chaque carte.
- [ ] Séries : masquer la saison 0 absente, rendre les saisons manquantes
  téléchargeables, ne jamais demander confirmation avant un épisode disponible.
- [ ] Films : afficher Continuer avec timestamp ; afficher Recommencer
  uniquement dans cet état.
- [ ] Lecteur : garder le contrôle Direct qui teste l'audio et bascule en
  transcodage audio si nécessaire ; conserver Auto, Direct, audio, vidéo et
  HLS Plex.
- [ ] Skips intro/générique : visibles et cliquables ; épisode suivant : conservé.

### Étapes 10 et 11 — Protection et validation

- [ ] Vérifier visuellement que la Bibliothèque reste une grille verticale
  technique et qu'elle n'hérite pas des cartes éditoriales 16:9.
- [ ] Tracer un film : carte → panneau → Lire/Continuer → lecteur → fermeture.
- [ ] Tracer une série : carte → panneau → saison → épisode → lecture directe
  → épisode suivant.
- [ ] Vérifier la reprise la plus récente Plex/Movviz et le secours Movviz.
- [ ] Lancer `git diff --check`, tests ciblés et `next build --webpack` avant
  tout commit.

## Journal de suivi

| Date | Étape | Note |
|---|---|---|
| 2026-08-22 | 1 | Audit Netflix et Movviz effectué dans Edge ; décisions ci-dessus consolidées. |

