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
- Une tuile éditoriale utilise une vraie image de fond TMDb 16:9. Le logo
  officiel est posé sur l'image ; en l'absence de logo, le titre texte le
  remplace. Sans backdrop réellement disponible, afficher une carte Movviz
  neutre plutôt qu'un faux recadrage d'affiche verticale.
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
| 1 | Cadrage et inventaire des composants réutilisables | Terminé | Architecture et données nécessaires identifiées, aucune duplication de fiche |
| 2 | Accueil : hero éditorial et ordre des rangées | Terminé | Hero lisible, logo/texte de secours, CTA, rangées intentionnelles |
| 3 | Accueil : tuiles 16:9 et logos intégrés | Terminé | Backdrop/logo/fallback 16:9 sur toutes les rangées concernées |
| 4 | Survol desktop flottant | Terminé | Délai, preview, aucun reflow, pas de coupure, clic conservé |
| 5 | Catalogues Films et Séries | Terminé | Vues séparées, hero par type, bouton Genre et catégories cohérentes |
| 6 | Fiche flottante commune | Terminé | Panneau identique partout, scroll et fermeture restitués |
| 7 | Fiche Série et épisodes | En cours | Saisons justes, téléchargement de saison manquante, épisode direct, prochain épisode |
| 8 | Fiche Film et reprise | À faire | Lire/Continuer/Recommencer cohérents avec la reprise fusionnée Plex/Movviz |
| 9 | Lecteur desktop | À faire | Nouveau dock, progression visible, skips, sous-titres et modes préservés |
| 10 | Bibliothèque technique | À faire | Aucune régression sur verticalité, badges, Plex, filtres ou informations média |
| 11 | Validation et release | À faire | Parcours réels film/série, build, tests ciblés et revue de diff |

## Détail opérationnel

### Étape 1 — Cadrage et inventaire

- [x] Cartographier les composants : hero, rangées, cartes, `TitlePanel`,
  `TitleContent`, lecteur, vue Bibliothèque.
- [x] Confirmer les champs image déjà disponibles (`poster`, `backdrop`,
  `logo`) et identifier seulement les modèles qui doivent exposer ces données.
- [x] Définir une seule variante de carte 16:9 éditoriale, réutilisable par
  Accueil, Films et Séries.
- [x] Écrire les règles de fallback image/logo sans lookup HTTP par carte.
- [x] Vérifier que les changements déjà présents ne contredisent pas ce plan.

#### Cartographie confirmée — 2026-08-22

- `DashboardHero.tsx` : hero Movviz ; utilise déjà le backdrop et un logo
  TMDb de la fiche active. Son délai de secours du titre est à corriger à
  l'étape 2.
- `DashboardRows.tsx` : orchestration des rangées de l'accueil ; les données
  TMDb et bibliothèque contiennent déjà `posterPath` et `backdropPath`.
- `DashboardPosterCard.tsx` : carte actuelle de l'accueil et de ses rangées ;
  elle devient la base de la **seule** carte éditoriale paysage. Le Top 10
  reste son unique variante portrait avec numéro XXL.
- `PosterRow.tsx` : seul conteneur de rangée à conserver ; il ne porte pas de
  logique métier ni de destination détail.
- `useTitlePanel.tsx` intercepte déjà les liens `/title/...` à la capture et
  conserve la position de la page. Les cartes n'ont donc pas à réimplémenter
  l'ouverture ni le retour.
- `TitlePanel.tsx` contient le cadre flottant et `TitleContent.tsx` demeure
  l'unique fiche ; cette architecture est intacte.
- `DashboardHero`, `TitleContent` et les modèles `LibraryMovie`/
  `LibrarySeries` confirment aussi la prise en charge de
  `customLogoPath`/`customBackdropPath` quand l'utilisateur a choisi un visuel.

#### Contrat unique de la carte éditoriale

- Une seule carte paysage sera réutilisée par Accueil, Films et Séries. Elle
  reçoit l'identité (`tmdbId`, type, titre), backdrop, poster, métadonnées,
  badges et un éventuel logo déjà résolu ; elle ne connaît ni téléchargement
  ni logique de fiche.
- Image : backdrop TMDb 16:9 en priorité, puis backdrop récupéré par lot si
  la rangée ne le fournissait pas ; enfin fond neutre Movviz si TMDb n'en a
  réellement aucun. Une affiche verticale n'est jamais recadrée en faux
  paysage.
- Marque : logo personnalisé Movviz s'il existe, sinon meilleur logo TMDb
  localisé, sinon titre texte. Un logo n'est jamais remplacé par un titre au
  cours d'un même affichage.
- Performance : aucune carte ne déclenche son propre `GET
  /api/metadata/images`. Les logos d'une rangée seront résolus dans un lot
  unique, borné et mis en cache côté serveur/client. La route de détail
  actuelle reste inchangée ; une route de lot dédiée ne sera ajoutée qu'à
  l'étape 3 si les données de rangée ne peuvent pas être enrichies sans
  requêtes unitaires.
- Le survol actuel est structurellement compatible (portail, délai 700 ms,
  aucun reflow) mais sa preview utilise encore le poster : elle basculera sur
  le même visuel paysage/logo à l'étape 4.

### Étape 2 — Accueil

- [x] Conserver le hero Movviz, mais normaliser son cadrage, son contraste et
  sa zone de CTA.
- [x] Priorité au logo officiel ; après trois secondes sans logo, afficher le
  titre texte sans transition qui ferait disparaître un élément déjà lisible.
- [x] Ajouter/ordonner les rangées éditoriales : recommandations, formats courts,
  tendance, nouveautés, reprise et sorties à venir.
- [x] Garder le mélange film/série seulement ici.

### Étape 3 — Cartes 16:9

- [x] Utiliser `backdrop` quand présent, logo intégré et dégradé de contraste.
- [x] Prévoir le fallback éditorial sans affiche verticale seule : fond Movviz
  neutre si aucune vraie image 16:9 n'existe.
- [x] Garder les badges contextuels, mais sobres.
- [x] Réserver les affiches verticales et le rang XXL au seul Top 10.

La route authentifiée `/api/metadata/images/batch` est l'unique exception
backend strictement nécessaire : elle expose dans un seul appel les logos déjà
fournis individuellement par TMDb, limite la concurrence à quatre requêtes
amont et s'appuie sur le cache TMDb existant. Elle ne modifie ni les routes de
fiche, ni les données bibliothèque, ni le fonctionnement Plex.

### Étape 4 — Survol

- [x] Déclencher après environ 700 ms uniquement sur desktop.
- [x] Rendre une fiche flottante au-dessus des rangées, sans changement de
  largeur/hauteur de la carte source.
- [x] Montrer image, logo/titre, métadonnées et actions visuelles.
- [x] Garantir la lisibilité en bord d'écran et conserver le clic vers le
  panneau Movviz.
- [x] Préserver un parcours tactile/mobile sans dépendre du survol.

### Étape 5 — Films et Séries

- [x] Créer les vues de catalogue avec hero propre à leur type.
- [x] Ajouter le bouton **Genre** près du titre de page.
- [x] Alimenter Films avec des rangées exclusivement film et Séries avec des
  rangées exclusivement série.

### Étapes 6 à 9 — Fiches et lecteur

- [x] Conserver le panel comme unique destination de chaque carte.
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
| 2026-08-22 | 1 | Cartographie achevée : backdrops, logos TMDb et overrides Movviz existent déjà ; contrat unique des cartes et stratégie de logo groupé consignés. |
| 2026-08-22 | 2 | Démarrée : ajustement du hero (secours titre à 3 secondes) et préparation des rangées éditoriales mixtes. |
| 2026-08-22 | 2 | Terminée : logo attendu trois secondes puis titre stable, rangées Accueil réordonnées et mixtes ; ajout de « Vous avez peu de temps ? » fondé uniquement sur les durées réellement connues. |
| 2026-08-22 | 3 | Démarrée : migration de la carte unique vers backdrop, logo groupé et fallback paysage. |
| 2026-08-22 | 3 | Terminée : `DashboardPosterCard` est paysage partout sauf Top 10 ; logos résolus en lot avec priorité aux overrides Movviz ; sans backdrop TMDb, une carte Movviz neutre évite tout faux recadrage vertical. |
| 2026-08-22 | 4 | Démarrée : la preview de survol existante passe au même langage backdrop/logo et son placement est consolidé. |
| 2026-08-22 | 4 | Terminée : survol différé desktop dans un portail, preview paysage plus large, placement borné à la fenêtre et aucune action dupliquée ; mobile/tactile conserve le clic direct. |
| 2026-08-22 | 5 | Démarrée : audit des catalogues Découverte existants pour obtenir Films et Séries séparés avec hero et Genre sans recréer les fiches. |
| 2026-08-22 | 5 | Terminée : la Découverte devient un catalogue explicite Films/Séries, hero éditorial par type et menu Genre au même niveau ; grilles/rangées migrées vers la carte paysage unique, ajout bibliothèque préservé hors du lien. |
| 2026-08-22 | 6 | Démarrée : vérification de l'unicité `TitlePanel`/`TitleContent`, de l'interception de lien et de la conservation de scroll. |
| 2026-08-22 | 6 | Terminée : toutes les nouvelles cartes restent des liens interceptés ; un seul `TitlePanel` rend l'unique `TitleContent`, verrouille le fond sans navigation et possède le bouton sticky « Fermer ». |
| 2026-08-22 | 7 | Démarrée : audit du flux fiche Série, saisons, épisodes et lecture directe. |
| 2026-08-22 | 2–5 | Revue visuelle de la release publiée : les barres de défilement permanentes et une rangée technique à une seule tuile créaient un rendu vide. Elles sont retirées/masquées dans le candidat. Les cartes du candidat exigent désormais un vrai backdrop TMDb 16:9 (résolu par lot) puis superposent logo ou titre, sans recadrage d'affiche verticale. |
| 2026-08-22 | 7 | Corrigé pendant l'audit : une reprise refusait le remux FFmpeg malgré son support `seekTo`, puis tombait sur HLS bloqué. FFmpeg accepte à nouveau la reprise ; HLS reste le dernier secours automatique uniquement après l'échec réel des legs locales. |
| 2026-08-22 | 7 | Corrigé pendant l'audit : le flux local d'un épisode passait son identifiant composite à une route qui exige l'identifiant brut de série. Le lecteur transporte désormais les deux identités sans ambiguïté. |
| 2026-08-22 | 9 | Corrigé pendant l'audit : les routes `local/*/info` n'exposaient aucun codec, aucune piste et aucun état FFmpeg. Un fichier local ne pouvait donc pas basculer en remux audio après une détection de silence. Elles enrichissent désormais la réponse avec les métadonnées Plex associées, sans modifier la source locale prioritaire. |
| 2026-08-22 | 3–4 | Ajustement après revue visuelle : les cartes éditoriales de rangée passent à 252–304 px selon la largeur disponible. Le survol devient une preview interactive portallée, 28 % plus large, qui naît sur la tuile et reste ouverte sous le pointeur ; elle ouvre la même fiche Movviz sans reflow de rangée. |
| 2026-08-22 | 3 | Consolidation artwork : chaque carte éditoriale privilégie le couple TMDb backdrop 16:9 + logo officiel, avec priorité aux overrides Movviz. Les chemins sont mémorisés durablement par langue (`title-artwork-cache.json`), les octets immuables sont enregistrés dans `tmdb-artwork/` et le navigateur les garde un an ; aucune requête TMDb par carte ni préchargement massif bloquant. |
| 2026-08-22 | 3 | Affinage demandé : fonds éditoriaux limités aux backdrops TMDb neutres (sans titre localisé) avant superposition du logo, sinon repli texte sans doublon. Les cartes passent à 300–360 px. Affichage, hero et recherche remplissent le cache immédiatement ; une tâche quotidienne de 30 titres ne fait que rattraper les absents/échecs, tandis que Réglages → Cache expose les actions complète et incrémentale. L'action complète télécharge réellement les fonds 16:9 et logos dans le cache disque. |
