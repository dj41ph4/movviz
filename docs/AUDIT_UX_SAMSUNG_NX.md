# Audit UX Samsung — référence Movviz NX TV

État local après v1.25.178, 4 octobre 2026. Aucun commit, tag ou push de ces corrections. Le client doit reproduire NX TV, sans ajouter d'assistant IA ni de bouton flottant.

## Méthode et limites

Inspection du navigateur sur `http://127.0.0.1:9820` en 1920 × 1080, avec les données du serveur déjà connecté. Parcours par flèches et Entrée ; lecture des composants Android actuels et des contrats serveur. Le navigateur avait initialement gardé un ancien bundle : les constats retenus ci-dessous ont été confrontés au bundle rechargé ou au code courant. Les anciens intitulés techniques anglais de Découverte ne sont donc pas présentés comme un défaut du bundle final.

Exemples réellement parcourus : accueil Avengers: Infinity War, reprise Gangs of London, affiche Benjamin Tranié, bibliothèque (2 513 films / 814 séries), 56 jours → Saison 1, Découverte, Recherche, Réglages et Profil. Aucun lancement de lecture, ajout de titre, changement de statut vu, message IA, déconnexion ni modification des préférences du compte pendant cet audit.

Le rendu et les parcours navigateur ne prouvent pas AVPlay, le clavier Samsung, la veille, l'installation ni la connexion Plex sur le téléviseur physique. Les observations issues uniquement du code sont distinguées des défauts reproduits à l'écran.

## Corrections locales vérifiées

| Défaut | Correction | Preuve |
|---|---|---|
| Assistant IA ajouté hors du périmètre NX demandé | Suppression du bouton, du dialogue, du contexte chat, des styles et des accès IA de la passerelle Samsung | Accueil rechargé : zéro bouton IA, zéro dialogue ; trois accès GET/POST refusés par le test dédié |
| Aperçu paysage superposé aux affiches voisines, titre doublé et image illisible | Suppression de l'aperçu et du zoom au focus ; géométrie fixe comme le `expanded = false` et `focusedScale = 1f` du HomeScreen Android actuel | Benjamin Tranié focalisé : largeur 198 px, aucun aperçu superposé |
| Films/Séries sans indication persistante du choix | État violet sélectionné et `aria-pressed` sur Bibliothèque et Découverte | Après retour de la fiche : Séries sélectionné, filtre `56` conservé, focus sur 56 jours |
| Rangées personnalisées toutes intitulées Suggestions | Exploitation de `meta.anchorTitle`, `meta.verb` et `meta.providerName`, avec les traductions existantes | Puisque 300 vous a plu ; Suggestion/Nouveautés Netflix, Disney Plus et Amazon Prime Video |
| Deux titres principaux dans la saison, boutons collés et vignettes désalignées par les synopsis longs | Hiérarchie série → saison, un titre visible, groupe d'actions espacé, grille compacte titre/durée et alignement supérieur | Saison 1 : quatre images au même Y=520 px ; durées 51/53/47/49 min ; retour fonctionnel |
| Profil vide avec erreur HTMLProgressElement « non-finite » | DTO Profil distinct : conversion `{progress:{ratio}}` en pourcentage, reprise du still épisode ; borne finie 0–100 sur la barre | Profil connecté : trois rangées Reprendre/Historique/Ma liste, 26 cartes, aucune erreur affichée |
| Rangées vides en Découverte | Ne pas afficher un en-tête sans résultat | Lecture finale du chemin de rendu et build |

Captures locales : `../.scratch/tizen-ux-season-before.jpg`, `../.scratch/tizen-ux-season-after.jpg`, `../.scratch/tizen-ux-home-without-ai.jpg`. La capture de saison après correction a été prise avant le retrait du bouton IA ; la capture d'accueil montre son retrait final.

## Écarts prioritaires restant à traiter

### Navigation, retour et temps d'attente

1. **P1 — Chargement presque invisible.** Bibliothèque, fiche, saison et Profil peuvent laisser un simple titre sur une page vide pendant les requêtes. Reproduit pendant la navigation. Ajouter les états d'attente prévus par NX et un repli de réseau explicite.
2. **P1 — Focus non limité à une rangée.** `moveFocus()` compare tous les boutons par distance : en fin de rangée, Droite peut rechercher une autre zone. Vérifier les règles de bord, les rangées horizontales et le retour vers l'onglet actif sur télécommande réelle.
3. **P1 — Défilement horizontal à restaurer explicitement.** Le snapshot conserve le DOM et le scroll vertical, mais ne décrit pas un état propre à chaque rangée. Le retour de 56 jours fonctionne ; le retour après une longue rangée et changement de destination reste à couvrir.
4. **P1 — Retour à la racine incomplet.** Sans historique, Retour place le focus dans le rail ; aucun chemin de sortie de l'application n'appelle l'API Tizen. Définir le comportement identique à NX avec l'adaptation Samsung nécessaire.
5. **P2 — Dialogues insuffisamment déclarés.** Le code du dialogue Plex utilise une section sans rôle dialog ni aria-modal ; le focus directionnel est restreint au modal mais Tab n'est pas piégé. Vérifier les erreurs, l'expiration et la fermeture par Retour.
6. **P2 — Rail animé et changement de largeur.** Le contenu se redimensionne à l'entrée du rail. Un clic souris pendant l'animation n'a pas déclenché la destination lors d'un essai ; Entrée a fonctionné. Vérifier séparément les clics et la télécommande, sans conclure à un blocage D-pad.

### Accueil et cartes

7. **P1 — Données volumineuses montées intégralement.** Bibliothèque : 2 513 cartes films, puis 814 cartes séries. Découverte : plus de 500 cartes. La recherche directionnelle parcourt aussi le DOM complet. Fenêtrage/pagination nécessaires avant de conclure à la fluidité Samsung ; aucune mesure matérielle de performance disponible.
8. **P1 — Premier rendu de l'accueil dépend de trois requêtes.** `Promise.all()` attend dashboard, On Deck et hero riche. Un échec On Deck empêche tout le rendu, malgré les autres données disponibles.
9. **P2 — Ordre des recommandations dépend du réseau.** Les réponses films et séries ajoutent leurs rangées indépendamment ; l'ordre peut changer. Appliquer l'ordre stable du HomeScreen et du layout serveur.
10. **P2 — Rangées homonymes films/séries.** Sélection pour vous et Tendances apparaissent plusieurs fois sans contexte de type. Reprendre les intitulés et badges réellement utilisés par NX.
11. **P1 — Reprise épisode trop pauvre.** La carte montre le titre de série et la barre, mais pas l'identité complète saison/épisode, la durée restante et les badges NX. Les champs serveur existent ; ne pas transformer une reprise précise en simple fiche générique.
12. **P2 — Visuels de remplacement.** Sans affiche, l'icône de l'application est utilisée comme image de média. Le repli doit conserver un titre lisible et une mise en page cohérente, notamment pour les personnes et saisons.
13. **P2 — Qualité des grandes images.** `imageUrl()` utilise w500 pour tous les chemins TMDb, y compris le backdrop du hero. Prévoir une taille adaptée au bandeau 1080p sans multiplier inutilement les téléchargements.
14. **P2 — Bandeau incomplet.** Pas de rotation automatique ni de comportement de bande-annonce ; état du carrousel seulement local. Comparer au HomeScreen actuel avant d'ajouter un effet.

### Bibliothèque, Découverte et Recherche

15. **P1 — Catalogue incomplet par rapport à NX.** Seulement filtre texte et trois tris ; pas de parcours genres/plateformes/studios ni d'état de disponibilité détaillé. Reprendre `CatalogScreen.kt`, pas inventer des options.
16. **P2 — Collections absent.** Vérifier le comportement réel de l'onglet Android, qui contient encore un emplacement réservé ; ne pas inventer une implémentation de collections complète sous prétexte de parité.
17. **P1 — Pas de Tout voir/pagination en Découverte.** Les rangées rendent uniquement les résultats initiaux alors que `/api/metadata/row-page` existe.
18. **P2 — Onglet Découverte non conservé au changement de destination.** `discover()` revient toujours aux films. Bibliothèque conserve déjà son type, sa recherche et son tri.
19. **P1 — Recherche uniquement après validation.** Pas de debounce, de recherche locale prioritaire ni de filtres de type. L'état vide/attente/erreur doit être distingué et aligné sur `SearchScreen.kt`.
20. **P2 — Focus du bouton Recherche sans identifiant.** Le bouton submit est construit avec `el()` et n'a pas `data-focus-id` ; une restauration depuis cette action est moins fiable.

### Fiches, saisons, épisodes et personnes

21. **P1 — Clic épisode = lecture immédiate.** Android propose une fiche d'épisode avec synopsis et actions. Le client Samsung saute cette étape. La grille doit rester compacte, mais le synopsis retiré de la grille doit être accessible dans le parcours d'épisode NX.
22. **P1 — Épisodes indisponibles entièrement désactivés.** Ils ne sont plus focalisables ; impossible de consulter leur détail ou leur état depuis la grille. Séparer consultation et disponibilité de lecture.
23. **P1 — Statuts saison/épisode manquants.** Pas de compteur vus, badge manquants, coche vu, progression sur les épisodes, qualité du fichier ou date de diffusion. Champs et présentation à reprendre du TitleDetailScreen actuel.
24. **P2 — Actions de saison incomplètes.** Recherche de saison présente, mais marquage de la saison vue/non vue absent. Les droits et le périmètre des épisodes doivent rester ceux du serveur.
25. **P1 — Watchlist uniquement en ajout.** L'action ne reflète pas l'état déjà ajouté et n'offre pas de retrait. Pas de libellé de succès distinguant un ajout d'une entrée déjà présente.
26. **P1 — Ajout sans restitution d'état.** Après un ajout/demande, la fiche garde ses boutons initiaux ; risque de clics répétés et d'état affiché obsolète.
27. **P2 — Filmographie trop rudimentaire.** Photo récupérée mais non affichée dans `personScreen()` ; biographie non hiérarchisée et titre principal doublé possible. Vérifier avec une personne réelle avant de considérer le parcours terminé.
28. **P1 — Bandes-annonces absentes.** Leur accès fait partie de la fiche de référence ; compatibilité des sources à vérifier sur Samsung.

### Profil, réglages, connexion et téléchargements

29. **P1 — Réglages hors présentation NX.** Une rangée de boutons sur page vide remplace les sections Compte/Lecture/À propos. La langue audio par défaut existe dans `SettingsScreen.kt` mais n'est pas proposée par le client Samsung.
30. **P1 — Déconnexion focalisée dès l'entrée.** L'action de déconnexion est le premier focus. La référence NX place cette action après les informations et préférences.
31. **P1 — Changement de langue incomplet.** Le code enregistre la langue et PATCH la préférence, mais les libellés de l'écran et du rail ne sont pas reconstruits ; si la requête échoue, le stockage local a déjà changé.
32. **P2 — Profil incomplet.** Compteurs et notes renvoyés par `/api/profile/media` non affichés ; reprise d'épisode manque encore ses métadonnées visibles malgré la correction du crash.
33. **P2 — Profils seulement déjà connectés.** Initiales locales et ajout par connexion ; ce n'est pas encore l'expérience de foyer/avatar NX. Préserver l'identité authentifiée, ne pas changer d'utilisateur avec un simple ID.
34. **P2 — Connexion sur hauteur réduite.** Les dimensions fixes du formulaire peuvent produire un débordement lorsque le clavier ou une zone système réduit la hauteur disponible. À vérifier sur Samsung ; ne pas présenter le navigateur de bureau comme son clavier TV.
35. **P2 — Plex : QR et action d'ouverture.** QR à marge d'un module dans le code ; qualité de scan à vérifier sur téléphone. Le dialogue Samsung n'a que Annuler, alors que LoginScreen Android propose aussi l'ouverture de Plex.
36. **P1 — Erreurs de connexion brutes.** Plusieurs erreurs réseau/validation sont affichées directement depuis l'exception. Prévoir les messages traduits et les états d'erreur de la référence, sans données sensibles.
37. **P2 — Téléchargements en texte brut.** Nom, pourcentage et statut interne sont concaténés ; manque la présentation de file NX, les états lisibles et les informations de vitesse/temps restant. Ne pas ajouter d'actions destructives sans le parcours prévu.

### Lecteur et cycle de vie — inspection de code, pas preuve matérielle

38. **P1 — Contrôles toujours affichés.** Pas de masquage automatique ni de retour du focus au panneau de contrôle comme NX.
39. **P1 — Seek réduit à ±30 s.** Pas de barre focalisable/scrubbing ni de prévisualisation ; UX à reprendre du lecteur de référence avec l'adaptateur AVPlay.
40. **P1 — Chargement de lecture insuffisamment visible.** Préparation et buffering n'ont pas de présentation complète permettant de distinguer attente, pause et erreur.
41. **P1 — Épisode suivant immédiat.** Pas de compte à rebours/annulation ; vérifier le comportement NX plutôt qu'ajouter une préférence arbitraire.
42. **P1 — Choix de qualité et marqueurs absents.** Profil conservateur fixe ; les pistes sont replanifiées côté serveur mais la parité du panneau lecteur n'est pas prouvée.
43. **P1 — Veille/reprise incomplète.** Page cachée : pause et heartbeat ; pas de parcours de retour visible/reconnexion. Tester veille, réseau perdu, sortie et retour depuis l'accueil Samsung.
44. **P1 — AVPlay et session média non vérifiés sur TV.** Authentification des segments, reprise, seeks, sous-titres, sélection audio et nettoyage doivent recevoir chacun une preuve physique avant toute annonce de parité.

## Validation effectuée et suite

- `npm run tizen:build` : typecheck client, cinq dictionnaires et paquet non signé réussis.
- `npm run typecheck` : réussi après retrait de l'IA et corrections locales.
- Tests de passerelle : 9/9 réussis, dont le refus explicite des accès IA.
- Retour saison → fiche → bibliothèque : filtre `56`, onglet Séries et focus 56 jours conservés.
- Découverte : titres personnalisés réels et état Films/Séries vérifiés après compilation.
- Profil : carte de reprise et les trois rangées réapparaissent avec le contrat serveur réel.
- `git diff --check` : réussi ; version conservée à 1.25.178 ; aucun push.

La CI de la release précédente a deux échecs dans `scripts/watch-provider-navigation.test.ts` : attente textuelle `setSort("popularity.desc")` et expression `kind === "all" ? "Pour vous"` dans la page Découverte web. Les logs ont été identifiés ; ces fichiers ne font pas partie des corrections Samsung de cet audit. Ce constat ne suffit pas à qualifier les deux tests de faux positifs : diagnostic dédié restant, sans modification silencieuse de la page web.

Prochain ordre recommandé : compléter le parcours d'épisode et les états de disponibilité ; reprendre les réglages NX ; rendre le catalogue progressif et le focus explicite ; compléter le lecteur, puis vérifier matériellement les scénarios Samsung. Aucun nouvel écran ou assistant qui n'appartient pas à la référence NX demandée.
