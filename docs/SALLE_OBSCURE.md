# Movviz — direction « Salle obscure »

## Expérimentation visuelle réversible

Réglages → Mon expérience → Apparence et aperçus propose **Stable** (par défaut)
et **Bêta**. Stable conserve l'interface actuelle Salle obscure ; Bêta ajoute
la typographie affinée, les cartes sobres, les badges harmonisés et le retour
d'appui de 120 ms. Le choix est personnel, enregistré dans
`user-preferences.json` (`designMode`), et s'applique sans rechargement. Un
échec de sauvegarde rétablit le choix précédent avec un toast.

Les nouvelles règles de `design-beta.css` exigent **à la fois**
`data-movviz-design="beta"` et un viewport ≥ 1024 px. Le serveur lit la
préférence pour le premier rendu ; le provider la synchronise ensuite avec
l'API existante. Aucun stockage parallèle. Le marqueur historique
`data-movviz-appearance="beta"` reste celui de Salle obscure, qui constitue
désormais le rendu Stable de cette expérimentation ; le contenu du dashboard
et les préférences du lecteur sont indépendants de ce nouveau choix.

Les effets pointeur d'origine restent en Stable ; Bêta garde les cartes fixes.
Le retour d'appui est retiré avec la réduction des animations du compte ou
du système. La fiche reste l'unique `TitleContent`, en page comme en panneau.

Le splashscreen Bêta constitue l'exception responsive : sa composition cinéma
est disponible sur tout le web, y compris à 375 et 768 px. Stable conserve
le splash précédent. La révélation du logo et des faisceaux se joue une seule
fois au démarrage, sans minuterie supplémentaire ni animation permanente ;
la progression et la fermeture restent pilotées par le chargement existant.
Les préférences de réduction des mouvements suppriment les révélations.
Le premier HTML contient déjà le mode du compte ; un chargement lent de
l'API des préférences ne déclenche jamais un passage intermédiaire par Stable.

## Historique de la direction Salle obscure

Refonte premium du desktop, livrée par lots dans l'apparence **Bêta**
(`data-movviz-appearance="beta"`, viewport ≥ 1024px). Stable, le mobile et les
applications natives ne changent pas. Proposition complète (analyse écran par
écran, maquettes, inventaire « rien perdre ») : artifact « Movviz Salle obscure »
du projet.

## Principes

- L'image d'abord : l'interface recule dans un noir neutre, les affiches et les
  backdrops portent la couleur.
- Un seul accent : violet `#A77BFF` pour la sélection et la progression. Le
  dégradé de marque est réservé au logo. Bouton principal clair.
- Couleurs unifiées (v1.25.193) : en Bêta desktop, les jetons du thème
  (`--color-cyan`, `--color-magenta`, `--color-brand*`, surfaces, encres) sont
  redéfinis sur la palette Salle obscure, donc tout utilitaire Tailwind suit.
  Vert, orange et rouge gardent leur sens (terminé, attention, échec).
- Une échelle : display (Bricolage Grotesque), interface (Geist), technique
  (Geist Mono). Polices OFL embarquées dans `src/app/fonts/`, sans réseau,
  `preload: false` pour ne rien coûter à Stable.
- Trois arrondis : 8px contrôles, 12px cartes, 18px panneaux.
- Mouvement calme : 120ms survol, 220ms panneau, aucune boucle décorative. Le
  morphing affiche → fiche reste l'unique grand mouvement.
- Un seul anneau de focus, blanc, 2px, décalé de 3px.

## Lots

| Lot | Contenu | État |
| --- | --- | --- |
| 0 | Tokens `--so-*`, polices embarquées, fond neutre | v1.25.190 (partiel : hex en dur et tailles < 11px restent à migrer) |
| 1 | Barre du haut allégée, palette Ctrl K, focus unifié, en-têtes de page | v1.25.190 |
| 2 | Accueil : bouton Lire clair, cartes plateformes intactes | v1.25.193, héros plein cadre en v1.25.195 |
| 3 | Fiche titre : action principale claire, actions secondaires en icônes avec infobulle | v1.25.193, onglets du corps en v1.25.197 |
| 4 | Bibliothèque, Découvrir, Calendrier : couleurs unifiées, doublon type/tri retiré de la bibliothèque | v1.25.193 |
| 5 | Téléchargements (onglets, puces d'état, file, colonne live), accueil des réglages | v1.25.193, file alignée sur la maquette en v1.25.197 ; lecteur, profil et login suivent les couleurs unifiées |

La sidebar rétractable garde sa structure (entrées, ordre, Gestion, profil en pied) : seules sa couleur et la forme de l'entrée active suivent Salle obscure (choix de Seb, 6 octobre 2026, pas de sections Regarder / Bibliothèque / Activité).

## Garde-fous

- Choix de Seb (6 octobre 2026) : sidebar rétractable à structure inchangée ;
  cartes des plateformes de l'accueil : taille ajustable, mais logos et effets
  au survol intouchables ; cartes d'affiche avec image sans logo et logo du
  titre ajouté par-dessus (useTitleArtworkBatch / AdaptiveTitleLogo) ; aucun
  petit libellé sous les boutons icônes (infobulle à la place).
- Chaque règle de `src/components/appearance/salle-obscure.css` exige Bêta ET
  desktop. Les composants qui changent de structure lisent
  `usePremiumAppearance()` et gardent leur rendu Stable/mobile intact.
- Pas de palette de commandes Ctrl K : Seb l'a refusée (2026-10-06, retirée
  en v1.25.198). La barre de recherche reste celle de Stable, à l'identique.
