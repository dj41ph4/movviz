# Movviz — direction visuelle Bêta

## Garde-fous

- Stable reste l'apparence déployée avant le pilote premium et le choix par défaut.
- Toute nouvelle finition est activée uniquement par le choix Bêta. Ne jamais appliquer un style premium globalement aux composants partagés.
- Le premier pilote est desktop ; ne pas modifier implicitement les applications Android natives.
- Conserver les sources de données, les actions, les tailles de cartes validées, les préchargements et la lecture. Ne pas remplacer le moteur de carrousel pour changer sa décoration.
- Respecter les animations désactivées et le mouvement réduit. Aucun délai d'apparition qui retarde les clics, aucune boucle décorative sur toutes les cartes.

## Sélection étudiée dans les documentations officielles

Les composants publics ci-dessous servent de références ; les templates Pro payants ne sont pas nécessaires. Cette liste ne signifie pas que ces composants sont déjà intégrés.

- [Magic Card](https://magicui.design/docs/components/magic-card) : lumière suivant le pointeur pour les surfaces interactives. Candidat pour les plateformes ou une carte mise en avant, pas pour chaque vignette à la fois. Un éventuel suivi du pointeur doit rester local, sans recomposer le tableau de bord.
- [Shine Border](https://magicui.design/docs/components/shine-border) : accent lumineux pour un seul élément sélectionné. Préférer une finition au survol plutôt qu'une animation permanente.
- [Blur Fade](https://magicui.design/docs/components/blur-fade) : transitions d'entrée courtes pour les sections déjà disponibles. Le contenu doit rester immédiatement visible et cliquable ; ne pas flouter les vidéos ni retarder les images préchargées.
- [Progressive Blur](https://magicui.design/docs/components/progressive-blur) : piste pour la lisibilité du hero. Évaluer le coût GPU avec une vidéo avant toute adoption ; garder un dégradé simple si le flou coûte trop cher.
- [shadcn Skeleton](https://ui.shadcn.com/docs/components/skeleton) : placeholders à la taille réelle des cartes pour éviter les sauts de mise en page.
- [shadcn Command](https://ui.shadcn.com/docs/components/command) : référence de présentation pour les résultats de recherche et les raccourcis, en conservant la recherche Movviz existante.
- [shadcn Carousel](https://ui.shadcn.com/docs/components/carousel) : référence de finition des contrôles et du focus, sans remplacer le défilement et les préchargements Movviz.

## Ordre recommandé

1. Dashboard : hero cinéma, contrôles cohérents, surfaces de plateformes et cartes mieux hiérarchisées.
2. Fiches : actions, informations techniques, suggestions et lecture visuellement harmonisées.
3. Découverte : recherche, filtres et sélection des plateformes, sans changer le classement.
4. Réglages : composants homogènes et retours de sauvegarde lisibles.

Valider le rendu et la réactivité à chaque étape. Ne pas recopier un template de site marketing sur une médiathèque.

## Comparaison élargie — sélection pour Movviz

Cette sélection est une appréciation de pertinence pour Movviz, pas un classement universel. Les bibliothèques ne sont pas installées en bloc : les motifs retenus sont adaptés par du code original Movviz, avec les dépendances déjà présentes.

| Source | Ce que je retiens | Usage Movviz | Décision |
| --- | --- | --- | --- |
| [React Bits](https://github.com/DavidHDev/react-bits) | Spotlight Card, Tilted Card, Gradual Blur | Affiches mises en avant et surfaces lumineuses | Premier choix pour une signature visuelle ; limiter l'inclinaison aux cartes survolées. La licence inclut Commons Clause, ne pas la présenter comme du MIT sans restriction. |
| [Aceternity UI](https://ui.aceternity.com/ai-recommendations) | Apple Cards Carousel, Expandable Cards, Spotlight | Composition éditoriale et transition affiche → fiche | Premier choix comme référence de mise en scène. Conserver les carrousels, l'accessibilité, les previews vidéo et le player existants. Le catalogue sépare composants gratuits et produits Pro. |
| [Motion Primitives](https://motion-primitives.com/docs) | Primitives de transitions et interactions | Changements d'état et ouverture des fiches | Premier choix pour la cohérence du mouvement ; adapter à Framer Motion déjà présent plutôt que dupliquer les moteurs. |
| [Animate UI](https://github.com/imskyleen/animate-ui) | Contrôles et composants animés | Menus, boutons, filtres et réglages | Complément pour les actions, pas une refonte globale des formulaires en une fois. |
| [Origin UI](https://github.com/shadcn/originui) | Contrôles React/Tailwind copiables | Recherche, filtres, sélecteurs et paramètres | Bon socle fonctionnel, moins différenciant visuellement que les trois premiers. |
| [Kokonut UI](https://kokonutui.com/docs) | Inputs, boutons et petites interactions | Recherche et panneau Movviz AI | Réserve de composants, sans importer les effets de particules par défaut. |
| [Cult UI](https://www.cult-ui.com/docs) | Contrôles Halo, entrées de prompts, composants de niche | Movviz AI | Réserve pour l'espace AI. Les shader heroes ne sont pas prioritaires sur un dashboard qui lit déjà de la vidéo. |

### Direction recommandée

Une identité « cinéma premium » : images en premier, panneaux sombres nets, typographie éditoriale, lumière localisée magenta/violet, transition continue entre vignette et fiche. React Bits et Aceternity fournissent les références distinctives ; Motion Primitives assure la cohérence des transitions ; shadcn/Origin assurent les contrôles.

Ne pas empiler sept bibliothèques : sélectionner les composants gratuits nécessaires, vérifier leurs licences et leurs dépendances, puis les intégrer ponctuellement côté Bêta. Écarter les murs 3D, curseurs personnalisés, WebGL et particules permanentes qui peuvent gêner la navigation et concurrencer le décodage vidéo. Mesurer avant toute promesse de performance.

## Intégration v1.25.171

Les motifs retenus sont implémentés par du code original (pas un copier-coller des composants fournisseurs) : spotlight local et inclinaison bornée à ±1,5°, surfaces et bordures au survol, contrôles éditoriaux de carrousel, thème de recherche/filtres/réglages/AI, prévisualisations et finition des fiches. Le morphing affiche → fiche existant est conservé, avec un timing Bêta harmonisé ; pas de second moteur de transition.

`AppearanceProvider` vérifie que la réponse du cache porte l'identité du profil actif, puis active l'attribut `data-movviz-appearance="beta"`. Chaque règle de `premium.css` est conditionnée à cet attribut et au viewport desktop. Le provider partage la requête SWR des réglages et ne bloque pas le rendu en attendant leur chargement.

Le contrôleur de pointeur possède au maximum une frame en attente et une géométrie mémorisée pour la carte active. Il nettoie les propriétés à la sortie, au scroll, au redimensionnement, à la déconnexion ou au retour à Stable. Il n'est pas actif pendant la lecture ou lorsque les animations sont réduites. Aucun coût de particules, WebGL, scène 3D ou animation permanente n'est ajouté.

Les patterns de Command/Skeleton sont adaptés à la recherche et aux chargements existants ; aucun moteur de recherche ni contrat de lecture n'est remplacé. Les variantes marketing comme Progressive Blur sur la vidéo, les shaders et les carrousels 3D ne sont pas intégrées : la sélection est adaptée au contexte réel de Movviz.
