# Movviz — direction « Salle obscure »

Refonte premium du desktop, livrée par lots dans l'apparence **Bêta**
(`data-movviz-appearance="beta"`, viewport ≥ 1024px). Stable, le mobile et les
applications natives ne changent pas. Proposition complète (analyse écran par
écran, maquettes, inventaire « rien perdre ») : artifact « Movviz Salle obscure »
du projet.

## Principes

- L'image d'abord : l'interface recule dans un noir neutre, les affiches et les
  backdrops portent la couleur.
- Un seul accent : violet `#A77BFF` pour la sélection et la progression. Le
  dégradé de marque est réservé au logo. Bouton principal clair (lot 2).
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
| 2 | Accueil : hero plein cadre, Reprendre flottant, cartes | à faire |
| 3 | Fiche titre : actions à 3 niveaux, onglets, panneau Fichier | à faire |
| 4 | Bibliothèque, Découvrir, Calendrier : barre d'outils unifiée | à faire |
| 5 | Lecteur, téléchargements, gestion, profil, login | à faire |

La sidebar rétractable garde sa structure (entrées, ordre, Gestion, profil en pied) : seules sa couleur et la forme de l'entrée active suivent Salle obscure (choix de Seb, 6 octobre 2026, pas de sections Regarder / Bibliothèque / Activité).

## Garde-fous

- Chaque règle de `src/components/appearance/salle-obscure.css` exige Bêta ET
  desktop. Les composants qui changent de structure lisent
  `usePremiumAppearance()` et gardent leur rendu Stable/mobile intact.
- La palette de commandes ne remplace aucun moteur : titres via
  `/api/metadata/search`, « Rechercher dans Découverte » pousse `/discover?q=`
  comme l'ancienne barre, la recherche torrent ouvre `/search?q=`.
