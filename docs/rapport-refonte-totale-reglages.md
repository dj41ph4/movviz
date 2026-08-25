# Rapport de refonte totale des réglages Movviz

Date : 25 août 2026
Document source : [`docs/settings-desktop-audit.md`](./settings-desktop-audit.md)
Périmètre : interface desktop des réglages, navigation, compréhension,
opérations longues, sécurité et performances perçues.
Principe : conserver les fonctions et contrats API existants ; réorganiser et
unifier l’expérience sans réécrire la logique métier.

## 1. Décision générale

Movviz n’a pas un problème de manque de réglages. Il a le problème inverse :
les fonctions sont extrêmement complètes, mais présentées comme un panneau
d’administration technique. Un utilisateur doit déjà connaître l’architecture
de Movviz pour savoir où agir.

La refonte doit donc faire évoluer la page depuis une **liste d’outils classés
par technologie** vers un **centre de contrôle classé par objectif** :

1. regarder sans problème ;
2. ajouter et télécharger un titre ;
3. organiser et synchroniser la bibliothèque ;
4. personnaliser l’expérience ;
5. réparer ou administrer le serveur.

Le système actuel reste accessible en mode expert et les liens `?tab=` sont
conservés. Aucun réglage ne disparaît : il change de niveau, de contexte ou de
présentation.

## 2. Diagnostic issu de l’audit

### 2.1 Forces à préserver

- Couverture fonctionnelle très supérieure à un simple gestionnaire de médias.
- Composants déjà séparés par domaine.
- Tests de connexion disponibles pour les services externes.
- Protection par rôle administrateur déjà présente.
- Routes API relativement cohérentes.
- Recherche des réglages déjà amorcée.
- Confirmations existantes pour plusieurs actions sensibles.
- URLs partageables et restaurables par onglet.

### 2.2 Causes principales de difficulté

#### La navigation expose l’architecture interne

Les termes « Indexation », « Métadonnées », « Cache », « Maintenance » ou
« Performance » sont corrects pour un développeur, mais pas pour quelqu’un qui
cherche à résoudre « mon film n’apparaît pas » ou « la lecture coupe ».

#### Les réglages et les outils sont mélangés

Un interrupteur personnel, un benchmark, un import CSV, une synchronisation
Plex et une suppression globale sont tous présentés comme des réglages alors
qu’ils représentent cinq natures différentes :

- préférence ;
- configuration ;
- test ;
- opération ponctuelle ;
- action destructive.

#### Les dépendances ne sont pas visibles

L’utilisateur ne voit pas clairement que :

- TMDb alimente images, logos, recherche et Découverte ;
- Plex confirme la présence réelle des médias ;
- les indexeurs et règles qualité précèdent le client de téléchargement ;
- FFmpeg, le navigateur, Plex et le cache segment influencent la lecture ;
- une mise à niveau automatique dépend de plusieurs règles combinées.

#### Chaque panneau a sa propre grammaire

Les boutons Enregistrer, Tester, Actualiser, Lancer, Scanner, Synchroniser,
Compléter et Remplir n’ont pas toujours les mêmes états, délais, confirmations
ou résultats. L’utilisateur doit réapprendre le fonctionnement à chaque écran.

#### La page peut charger trop de données techniques

Les journaux contiennent plusieurs milliers de lignes et les tableaux de
performance peuvent contenir de nombreuses routes. Sans chargement différé,
pagination ou virtualisation, l’écran de réglages devient lui-même une source
de lenteur. Les états serveur ne doivent être interrogés que lorsque leur
surface est affichée ou réellement utile.

## 3. Vision cible

### 3.1 Une page d’accueil qui répond à trois questions

L’accueil des réglages doit immédiatement répondre à :

1. **Est-ce que Movviz fonctionne correctement ?**
2. **Que veux-tu changer ?**
3. **Y a-t-il quelque chose à corriger ?**

Il comporte :

- une recherche centrale en langage courant ;
- un résumé de santé en cinq cartes ;
- les problèmes actionnables ;
- les réglages récents ;
- les opérations en cours ;
- cinq grands parcours ;
- un accès discret au mode expert.

### 3.2 Résumé de santé

Les cinq cartes sont :

| Carte | État principal | Action rapide |
|---|---|---|
| Lecture | Direct/FFmpeg/Plex disponible, benchmark et erreurs récentes | Tester la lecture |
| Plex et bibliothèque | Connecté, dernière sync, films/séries disponibles | Synchroniser |
| Téléchargements | Moteur, instances, actifs, indexeurs joignables | Voir la file |
| Métadonnées et visuels | TMDb/OMDb/TVDB, cache visuel | Compléter les éléments manquants |
| Stockage et système | Espace libre, tâches en échec, version | Ouvrir le diagnostic |

Une carte ne doit pas seulement dire « erreur ». Elle indique :

- la cause probable ;
- la conséquence utilisateur ;
- l’action recommandée ;
- le détail technique replié.

### 3.3 Les cinq parcours principaux

#### Regarder

Contient : moteur de lecture, langue audio, cache segment, lecteur intégré,
aperçus vidéo, intros/génériques, test de lecture et benchmark.

#### Télécharger

Contient : instances Films/Séries, indexeurs, règles qualité, limites, formats
personnalisés, mises à niveau et état des recherches automatiques.

#### Bibliothèque

Contient : Plex, métadonnées, scan/indexation, anime, nommage, imports,
blocages, récupération et chemins.

#### Apparence

Contient : mode du tableau de bord, hero, carrousels, images Internet/locales,
GPU, animations, année minimale et sections visibles.

#### Système

Contient : notifications, automatisations, cache, IA, diagnostics, journaux,
maintenance, sauvegarde, mise à jour et zone dangereuse.

### 3.4 Correction importante : emplacement final par usage

Le premier classement en cinq parcours est une bonne entrée, mais il ne faut
pas déplacer un onglet entier quand ses options répondent à plusieurs usages.
L’unité de rangement doit être **l’option**, pas le composant historique.

La structure finale recommandée est donc :

```text
Accueil
├── État général
├── Problèmes à corriger
├── Opérations en cours
└── Recherche « Que veux-tu faire ? »

Mon expérience
├── Accueil et carrousels
├── Hero et bandes-annonces
├── Images et réseau
└── Effets et GPU

Lecture
├── Préférences audio et sous-titres
├── Moteur Auto et cache de lecture
├── Intros et génériques
├── Compatibilité / test de lecture
└── Options expertes de transcodage

Bibliothèque et Plex
├── Connexion Plex
├── Synchronisation et disponibilité
├── Métadonnées et visuels
├── Séries, spéciaux et anime
├── Nommage et organisation
├── Imports et titres bloqués
└── Réparer la bibliothèque

Téléchargements
├── Instances Films et Séries
├── Indexeurs
├── Profil qualité
├── Règles et formats personnalisés
├── Mises à niveau
└── Recherche et récupération

Serveur et données
├── Stockage et chemins
├── Cache technique
├── Tâches et automatisations
├── Notifications et intégrations
├── IA
├── Diagnostic et journaux
├── Mise à jour et sauvegarde
└── Zone dangereuse
```

#### Options qui doivent quitter leur onglet historique

| Option actuelle | Emplacement principal recommandé | Raison |
|---|---|---|
| Images depuis Internet / priorité réseau local | Mon expérience → Images et réseau | L’utilisateur cherche à accélérer les images, pas « Expérience ». |
| Aperçus vidéo | Mon expérience → Hero et bandes-annonces | C’est un comportement visuel, pas un réglage du lecteur de film. |
| Compter les épisodes spéciaux comme vus | Lecture → Progression et statuts | Cela change le calcul « vu », pas les métadonnées de la saison 0. |
| GPU et animations | Mon expérience → Effets et GPU | Pas besoin d’un onglet principal séparé. |
| Import Netflix | Bibliothèque → Imports | Il modifie l’historique de visionnage, pas l’apparence personnelle. |
| Langue audio / moteur / cache segment | Lecture | Ces options ne doivent plus être noyées au bas de Plex. |
| Marqueurs intro/générique | Lecture → Intros et génériques | L’utilisateur les associe au lecteur, même si Plex fournit les données. |
| Sync Plex / connexion Plex | Bibliothèque et Plex | Source de vérité de présence et comptes. |
| Cache visuel | Bibliothèque → Métadonnées et visuels | Il explique les logos et fonds manquants. |
| Cache API et statistiques hits/misses | Serveur et données → Cache technique | Information d’administration, à masquer en mode essentiel. |
| Analyse ffprobe | Lecture → Compatibilité, avec raccourci Maintenance | Son but principal est la connaissance des codecs. |
| Scan disque / réparation chemins | Bibliothèque → Réparer | Répond au problème « média absent ». |
| Nettoyage dossiers / corbeille | Serveur et données → Stockage | Ce sont des opérations de fichiers. |
| Sauvegarde/restauration | Serveur et données → Sauvegarde | Ne doit plus être caché dans À propos. |
| Réinitialisation complète | Zone dangereuse uniquement | Trop risqué pour rester dans À propos. |
| Suggestions de mise à niveau | Téléchargements → Mises à niveau | La rangée du dashboard n’est que sa représentation visuelle. |
| Tâches automatiques individuelles | Raccourci dans leur domaine + vue complète Automatisations | Une tâche Plex doit être visible depuis Plex, une tâche cache depuis Cache. |

#### Règle pour les fonctions transversales

Une option n’existe qu’une fois dans l’état et le code. Elle peut avoir plusieurs
raccourcis, mais tous ouvrent la même ancre :

- Plex apparaît dans Accueil, Lecture et Bibliothèque, mais sa configuration
  principale reste dans Bibliothèque et Plex ;
- ffprobe apparaît dans Lecture et Réparer, mais lance la même opération ;
- cache visuel apparaît dans l’alerte « logos manquants » et dans Métadonnées,
  mais pas sous deux formulaires distincts ;
- une tâche planifiée apparaît dans son domaine et dans Automatisations, sans
  dupliquer sa configuration ;
- les journaux restent centralisés, mais chaque erreur ouvre automatiquement le
  bon journal avec le bon filtre et la bonne corrélation.

Cette règle évite le principal piège d’une refonte par facilité : rendre une
fonction facile à trouver au prix de plusieurs écrans qui pourraient diverger.

## 4. Deux niveaux de complexité

### Mode essentiel — par défaut

Affiche uniquement les décisions compréhensibles et recommandées :

- choix du mode d’affichage ;
- connexion Plex ;
- dossiers Films/Séries ;
- qualité souhaitée ;
- langue ;
- moteur de lecture Auto ;
- notifications ;
- état général.

Chaque réglage affiche une valeur recommandée et une explication courte.

### Mode expert

Affiche notamment :

- points de codec ;
- catégories indexeur ;
- pairs, slots et ratio ;
- modèles de nommage ;
- moteurs manuels de lecture ;
- clés et fournisseurs ;
- tâches, files, métriques et logs ;
- actions disque et destructives.

Le mode est mémorisé par utilisateur. Une recherche peut néanmoins retrouver
une option experte et proposer « Afficher ce réglage avancé ».

## 5. Recherche par intention

La recherche ne doit plus uniquement filtrer des onglets. Elle retourne des
résultats de quatre types :

| Type | Exemple |
|---|---|
| Réglage | « Changer la langue audio préférée » |
| Action | « Synchroniser Plex maintenant » |
| Diagnostic | « Pourquoi un film n’apparaît pas ? » |
| Explication | « Différence entre direct, FFmpeg et HLS Plex » |

Exemples de parcours :

- **film absent** → vérifier Plex → scanner le disque → réparer le chemin ;
- **aucune release** → tester indexeurs → afficher exclusions qualité → logs ;
- **pas de son** → mode Auto → piste audio → test FFmpeg → logs lecture ;
- **images lentes** → état TMDb → cache visuel → réseau local/CDN ;
- **mauvais nom** → modèle de nommage → aperçu → application contrôlée ;
- **serveur lent** → tâches actives → event loop → endpoints lents → benchmark.

Chaque résultat doit mener à une ancre précise, pas seulement à l’onglet
contenant l’option.

## 6. Grammaire commune de tous les réglages

### 6.1 Anatomie d’un réglage

Chaque ligne contient toujours :

1. nom simple ;
2. état ou valeur actuelle ;
3. conséquence en une phrase ;
4. contrôle ;
5. lien « En savoir plus » si nécessaire ;
6. dépendance ou avertissement éventuel.

### 6.2 Sauvegarde

Trois comportements seulement :

- **préférence sans risque** : sauvegarde immédiate + toast « Annuler » ;
- **configuration composée** : modifications locales + barre fixe
  « Annuler / Enregistrer » ;
- **opération** : écran de préparation + résumé + lancement explicite.

Il ne doit plus être possible de quitter silencieusement une configuration
composée avec des changements non enregistrés.

### 6.3 Tests

Tous les tests utilisent le même bloc de résultat :

- en cours ;
- réussi avec durée ;
- avertissement ;
- échec avec cause ;
- action suivante ;
- détail technique copiable.

Tester une configuration non enregistrée doit tester les valeurs actuellement
saisies, puis proposer de les enregistrer si le test réussit.

### 6.4 Opérations longues

Un centre d’opérations unique suit :

- synchronisations Plex/TVDB ;
- scans disque ;
- remplissages de cache ;
- analyses ffprobe ;
- imports ;
- renommages ;
- récupérations et réparations.

Chaque opération expose : portée, progression, durée estimée, erreurs, reprise,
annulation si sûre et lien vers le résultat. L’utilisateur peut changer de page
sans perdre le suivi.

## 7. Parcours recommandés

### 7.1 Première configuration

1. Détecter l’environnement et le stockage.
2. Connecter Plex et sélectionner les bibliothèques.
3. Configurer les dossiers Films/Séries.
4. Tester le moteur de téléchargement.
5. Ajouter/tester les indexeurs.
6. Choisir un profil qualité simple.
7. Vérifier TMDb et les métadonnées facultatives.
8. Choisir lecture et langue.
9. Lancer une première synchronisation et le cache visuel.
10. Présenter le résumé final et les points facultatifs.

L’assistant est reprenable et ne réécrit jamais un choix manuel sans montrer
le changement proposé.

### 7.2 « Mon film n’apparaît pas »

1. Rechercher le titre dans Movviz et Plex.
2. Vérifier la présence du fichier.
3. Comparer chemin attendu et chemin réel.
4. Proposer sync Plex, scan incrémental ou réparation de chemin.
5. Montrer le résultat exact et l’origine du problème.

### 7.3 « Rien ne se télécharge »

1. Vérifier moteur et instance de catégorie.
2. Vérifier les indexeurs.
3. Exécuter une recherche test.
4. Montrer combien de releases sont exclues à chaque règle.
5. Proposer un ajustement sans le sauvegarder automatiquement.

### 7.4 « La lecture ne fonctionne pas »

1. Afficher le média et ses codecs connus.
2. Tester le mode Auto.
3. Montrer direct, FFmpeg audio, FFmpeg vidéo et Plex/HLS avec leur résultat.
4. Recommander le mode le plus léger réellement compatible.
5. Conserver un accès direct aux logs de cette session uniquement.

## 8. Refonte écran par écran

### Accueil

- Remplacer les raccourcis statiques par états et alertes actionnables.
- Ajouter opérations en cours et derniers changements.
- Ne charger les détails techniques qu’à l’ouverture.

### Apparence

- Montrer un aperçu miniature en direct des modes Cinéma/Classique/Compact.
- Regrouper hero, vidéo, durée et contenu suggéré dans « Hero ».
- Transformer les carrousels en liste réordonnable avec interrupteurs.
- Déplacer GPU dans « Effets et performances graphiques » avancé.

### Lecture et Plex

- Séparer clairement Connexion Plex, Synchronisation et Lecture.
- Montrer Auto comme choix recommandé et les moteurs manuels dans Expert.
- Afficher le cache segment avec estimation mémoire/réseau.
- Afficher les marqueurs intro/générique comme état, pas comme réglage vague.

### Téléchargements et qualité

- Afficher une chaîne visuelle : Indexeur → Règles → Client → Dossier → Plex.
- Fournir trois profils simples : Économe, Équilibré, Qualité maximale.
- Conserver tous les réglages fins en mode expert.
- Ajouter un simulateur qui explique pourquoi une release gagne ou est rejetée.

### Bibliothèque

- Regrouper synchronisation, scan et réparation autour de la présence réelle.
- Montrer séparément « connu de Movviz », « présent dans Plex » et « trouvé sur
  disque ».
- Garder Anime et Imports comme extensions repliées.
- Prévisualiser les changements de nommage avant toute application en masse.

### Maintenance

- Remplacer la liste de boutons par des cartes d’outil avec risque : lecture
  seule, modification de base, déplacement, suppression.
- Toujours faire une phase d’analyse avant une modification.
- Présenter la corbeille comme mécanisme de récupération, avec date de purge.

### Cache

- Séparer visuels, métadonnées et recherche.
- Afficher fichiers présents/manquants, taille, dernier remplissage et prochain
  passage.
- Expliquer la différence entre « compléter », « incrémental » et « vider ».
- Éviter le jargon hits/misses en mode essentiel ; le garder en expert.

### Diagnostics et journaux

- Afficher Doctor et santé avant les métriques.
- Charger les journaux à la demande, par pages, et virtualiser leur rendu.
- Corréler chaque erreur à une recherche, un téléchargement ou une lecture.
- Fournir « Copier un rapport » avec secrets automatiquement masqués.

### Automatisation

- Vue simple : tâches en échec, en cours, prochaine opération importante.
- Vue expert : planning complet, file et priorités.
- Traduire toutes les clés techniques restantes avant affichage.

### À propos et sécurité

- Séparer Version/Mise à jour, Sauvegarde/Restauration et Réinitialisation.
- Déplacer la réinitialisation complète dans la Zone dangereuse.
- Afficher exactement les données incluses dans une sauvegarde.
- Exiger une confirmation contextualisée pour toute restauration.

### 8.1 Conclusion de l’audit visuel

Les captures de l’instance réelle montrent une interface déjà cohérente et
élégante, mais quatre défauts de hiérarchie :

1. la colonne de navigation occupe beaucoup d’attention et devient très longue ;
2. le contenu est une succession verticale de cartes presque équivalentes ;
3. les paragraphes explicatifs sont souvent longs avant que l’utilisateur voie
   la décision importante ;
4. les valeurs simples, les opérations longues et les actions dangereuses ont
   une présence visuelle trop proche.

Le résultat est « complet et sérieux », mais pas encore « évident ». Pour
obtenir l’effet **« wow, tout est là et pourtant je m’en sors »**, la refonte
doit appliquer les règles suivantes.

#### Révéler la puissance progressivement

- Niveau 1 : état, recommandation et action principale.
- Niveau 2 : options courantes du domaine.
- Niveau 3 : détails experts repliés.
- Niveau 4 : données brutes, journaux et diagnostic.

Une page ne doit jamais commencer par les réglages experts. Elle commence par
une réponse claire : « Tout fonctionne », « Deux éléments demandent ton
attention » ou « Cette fonction n’est pas encore configurée ».

#### Un aperçu avant une explication

- Apparence : aperçu réel du hero et des carrousels.
- Qualité : trois profils visuels, puis détails des règles.
- Lecture : schéma Auto → direct → FFmpeg → repli Plex.
- Nommage : exemple de chemin avant/après.
- Cache : barre « visuels prêts / manquants » avant les compteurs API.
- Plex : dernière synchronisation et résultat avant les champs réseau.

#### Une action principale par carte

Chaque carte possède un seul bouton dominant. Les actions secondaires sont
discrètes ou dans un menu. Par exemple, la carte Plex affiche
« Synchroniser maintenant » ; « Rescan complet » est une action avancée avec
explication. La carte Cache affiche « Télécharger les visuels manquants » ; les
purges restent dans un menu de maintenance.

#### Une densité variable selon la nature

| Nature | Présentation |
|---|---|
| État | Carte courte, couleur, date et conséquence |
| Préférence | Ligne compacte avec contrôle à droite |
| Configuration | Carte structurée avec aperçu et barre Enregistrer |
| Opération | Carte avec portée, durée, progression et résultat |
| Danger | Carte isolée, couleur dédiée et confirmation détaillée |
| Logs | Surface pleine largeur, filtrée, paginée et virtualisée |

#### Navigation plus calme

- La navigation principale ne montre que les cinq parcours et Système.
- Une sous-navigation sticky affiche les sections du parcours courant.
- L’onglet sélectionné affiche un fil simple :
  `Réglages › Bibliothèque et Plex › Synchronisation`.
- Sur petits écrans, la sous-navigation devient une sheet et non une longue
  liste poussant le contenu vers le bas.
- Le mode expert est un bouton global clairement visible mais non dominant.

### 8.2 Proposition de premier écran

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Réglages                                      Essentiel  [ Expert ] │
│ [ Que veux-tu faire ou réparer ? _________________________________ ] │
├──────────────────────────────────────────────────────────────────────┤
│  Tout fonctionne correctement                           4/5 prêts   │
│  Plex ✓   Lecture ✓   Téléchargements ✓   Visuels !   Stockage ✓   │
├──────────────────────────────────────────────────────────────────────┤
│  À corriger                                                        │
│  59 visuels manquants          [ Télécharger les éléments absents ] │
├──────────────────────────────────────────────────────────────────────┤
│  Regarder        Télécharger       Bibliothèque       Apparence      │
│  Lecture Auto    2 instances       Plex synchronisé   Mode Cinéma   │
│  [Configurer]    [Configurer]      [Ouvrir]           [Personnaliser]│
├──────────────────────────────────────────────────────────────────────┤
│  Opérations en cours / réglages récemment modifiés                  │
└──────────────────────────────────────────────────────────────────────┘
```

Ce premier écran montre immédiatement la richesse, mais l’utilisateur n’a pas
à parcourir 25 onglets pour commencer.

### 8.3 Renommage recommandé des onglets

Les nouveaux noms décrivent le résultat attendu plutôt que le composant
technique.

| Nom actuel | Nouveau libellé recommandé |
|---|---|
| Tableau de bord | Accueil et carrousels |
| Expérience | Images et aperçus |
| GPU | Effets graphiques |
| Netflix | Importer l’historique Netflix |
| Clients de téléchargement | Moteur et dossiers de téléchargement |
| Indexeurs | Sources de recherche |
| Qualité | Qualité et remplacements |
| Métadonnées | Informations, images et logos |
| Anime | Anime et épisodes spéciaux |
| Plex | Connexion et synchronisation Plex |
| Nommage | Noms et organisation des fichiers |
| Importations | Importer des listes et demandes |
| Blocages | Titres interdits |
| Indexation | Retrouver les fichiers de la bibliothèque |
| Maintenance | Réparer et nettoyer la bibliothèque |
| Notifications | Services de notification |
| Diagnostics | État et diagnostic du serveur |
| Performance | Vitesse et capacité du serveur |
| Journaux | Journaux techniques |
| Automatisation | Tâches automatiques |
| IA | Outils conversationnels |
| Cache | Cache et accélération |
| À propos | Version, mises à jour et sauvegarde |
| Zone dangereuse | Réinitialisation et suppressions |

Ces libellés peuvent servir aux anciens liens et au mode expert. Dans le mode
essentiel, ils sont regroupés sous les parcours principaux plutôt qu’affichés
comme 25 entrées.

### 8.4 Renommage recommandé des options ambiguës

| Libellé actuel | Nouveau libellé | Pourquoi |
|---|---|---|
| Images depuis Internet | Charger les images directement depuis TMDb | Indique la source et l’action. |
| Priorité au réseau local | Utiliser le serveur local à la maison | Explique le contexte d’activation. |
| Aperçus vidéo | Lire automatiquement les bandes-annonces | Décrit le résultat visible. |
| Compter les épisodes spéciaux | Inclure la saison 0 dans « série entièrement vue » | Supprime l’ambiguïté entre suivi et statut vu. |
| Sections affichées | Éléments visibles sur l’accueil | Plus concret. |
| Contenu suggéré | Titres proposés dans le hero | Précise la zone affectée. |
| Mots interdits | Rejeter les releases contenant | Formulation action/résultat. |
| Mots autorisés | Exceptions aux mots rejetés | Montre la relation entre les deux listes. |
| Points de codec | Préférence de codec dans le classement | Évite de laisser croire à une limite technique. |
| Politique de taille | Priorité entre espace et qualité | Compréhensible sans connaître le scoring. |
| Mise à niveau automatique | Remplacer automatiquement les fichiers moins adaptés | Rend l’impact explicite. |
| Suggestions de mise à niveau | Afficher les améliorations possibles sur l’accueil | Distingue suggestion et remplacement. |
| Utiliser TVDB pour les animes | Organiser les saisons d’anime avec TVDB | Explique l’effet concret. |
| Synchroniser maintenant | Vérifier les changements Plex | Distingue l’incrémental du complet. |
| Rescan complet | Revérifier toute la bibliothèque Plex | Rend la portée évidente. |
| Intros et génériques | Importer les boutons « Passer l’intro/générique » depuis Plex | Décrit l’usage final. |
| Lecteur bêta | Autoriser le lecteur intégré Movviz | L’option rend le lecteur disponible ; elle ne le sélectionne pas pour chacun. |
| Cache segment | Précharger avant la lecture | Terme compréhensible, avec secondes en aide. |
| Moteur de lecture | Mode de lecture | « Auto » reste recommandé. |
| Renommage automatique | Ranger et renommer les nouveaux téléchargements | Mentionne aussi le déplacement/rangement. |
| Récupérer téléchargements | Importer les vidéos restées dans le dossier temporaire | Explique ce qui est récupéré. |
| Réparer les chemins | Retrouver les fichiers déplacés | Formulation orientée problème. |
| Analyse technique | Analyser codecs, audio et sous-titres | Rend ffprobe compréhensible. |
| Compléter le cache | Télécharger tous les visuels manquants | Ne se confond plus avec le cache API. |
| Rafraîchir incrémentalement | Vérifier et réparer les visuels existants | Explique que les fichiers présents sont conservés. |
| Remplir le cache | Précharger les informations de la bibliothèque | Distingue métadonnées et visuels. |
| Configuration complète | Relancer l’assistant de configuration | N’évoque plus une configuration déjà terminée. |
| Optimisation intelligente | Vérifier et optimiser mes réglages | Action plus claire. |

### 8.5 Micro-interactions qui donnent l’effet premium

- Transition courte entre parcours, sans animation lourde permanente.
- Survol d’une carte : halo discret, état et action apparaissent sans déplacer
  la mise en page.
- Après sauvegarde : confirmation locale dans la ligne et possibilité
  d’annuler quelques secondes.
- Les états « recommandé », « personnalisé » et « avancé » utilisent des badges
  cohérents.
- Une option dépendante désactivée explique pourquoi et propose le raccourci
  exact pour satisfaire la dépendance.
- Les opérations longues rejoignent un tiroir global ; une petite pastille
  persiste dans la barre haute.
- Les descriptions longues sont derrière « Pourquoi ? » ou « Détails » ; la
  phrase essentielle reste visible.
- Les champs de secrets affichent « configuré », jamais leur valeur, et offrent
  remplacer/tester séparément.
- Les erreurs importantes restent visibles jusqu’à résolution ; les succès
  ordinaires utilisent des confirmations discrètes.

## 9. Optimisations techniques

### 9.1 Chargement

- Monter uniquement le panneau actif.
- Charger les composants lourds par import dynamique.
- Ne démarrer le polling que quand la carte ou l’onglet est visible.
- Mutualiser les états Plex, moteur, TMDb et stockage via un cache SWR partagé.
- Suspendre/ralentir le polling quand l’onglet navigateur est masqué.
- Éviter les appels admin pour les utilisateurs non-admin.

### 9.2 Grandes listes

- Virtualiser journaux, routes de performance et longues tâches.
- Paginer côté API quand c’est possible sans modifier les contrats critiques.
- Limiter le DOM rendu, pas les données accessibles.
- Conserver les filtres dans l’URL.

### 9.3 Cohérence d’état

- Un registre `settingsCatalog` devient la source de vérité : section, niveau,
  mots-clés, dépendances, risque, ancre et composant.
- Un `SettingsStatusProvider` mutualise les états globaux.
- Un `OperationsProvider` suit les tâches longues entre les écrans.
- Une barre `SaveBar` et un composant `TestResult` remplacent les variantes.

### 9.4 Résilience

- Un échec d’état secondaire ne doit jamais bloquer toute la page.
- Chaque carte possède skeleton, délai maximal, repli et bouton de relance.
- Les secrets ne sont jamais renvoyés dans les rapports ou logs copiés.
- Les actions destructive continuent d’être contrôlées côté serveur, pas
  uniquement masquées dans l’interface.

## 10. Architecture de composants proposée

```text
SettingsShell
├── SettingsHome
│   ├── SettingsIntentSearch
│   ├── SystemHealthSummary
│   ├── ActiveOperations
│   └── RecommendedActions
├── SettingsJourney
│   ├── JourneyHeader
│   ├── DependencyMap
│   └── SettingSections
├── ExpertSettingsNavigation
├── GlobalSaveBar
└── OperationDrawer

Composants communs
├── SettingRow / SettingSwitch / SettingSelect / SettingSecret
├── ConnectionCard / TestResult
├── OperationPreview / OperationProgress / OperationResult
├── RiskBadge / DependencyNotice
└── ConfirmImpactDialog
```

Les composants métier existants sont progressivement enveloppés ou découpés.
Ils ne sont pas réécrits tous en une fois.

## 11. Plan d’implémentation

### Lot 1 — Fondations

- créer le catalogue typé de toutes les options ;
- ajouter ancres, niveaux, risques et dépendances ;
- conserver toutes les anciennes URLs ;
- construire les composants communs de ligne, sauvegarde et test.

### Lot 2 — Accueil et recherche

- nouveau centre de contrôle ;
- recherche par intention ;
- états mutualisés ;
- problèmes et actions recommandées.

### Lot 3 — Apparence et lecture

- migrer les préférences personnelles ;
- créer le parcours Lecture/Plex ;
- valider le modèle essentiel/expert.

### Lot 4 — Téléchargement et qualité

- chaîne visuelle de dépendances ;
- profils simples ;
- simulateur de release ;
- unification des tests indexeurs/clients.

### Lot 5 — Bibliothèque et opérations

- présence Movviz/Plex/disque ;
- centre d’opérations ;
- scan, réparation, TVDB, cache et ffprobe avec progression commune.

### Lot 6 — Support, sécurité et performance

- Doctor central ;
- logs virtualisés et corrélés ;
- sauvegarde/restauration ;
- zone dangereuse isolée ;
- audit responsive et accessibilité.

### Lot 7 — Stabilisation

- tests de permissions ;
- tests des anciennes URLs ;
- scénarios E2E ;
- cinq langues ;
- mesure du nombre de clics et du temps de résolution ;
- suppression des anciennes présentations seulement après stabilité confirmée.

## 12. Critères d’acceptation

La refonte est réussie si :

- une personne trouve un réglage courant en moins de deux interactions ;
- « film absent », « téléchargement bloqué » et « lecture impossible » ont un
  parcours guidé complet ;
- aucune option existante n’est perdue ;
- le mode essentiel ne montre aucune clé, log ou terme technique inutile ;
- le mode expert conserve toute la puissance actuelle ;
- toutes les opérations longues restent suivies après navigation ;
- toutes les actions risquées indiquent portée et réversibilité ;
- les onglets lourds ne ralentissent plus l’ouverture des réglages ;
- les utilisateurs non-admin ne déclenchent aucun appel admin inutile ;
- desktop 375 px, tablette 768 px et grand écran restent pleinement utilisables ;
- les cinq langues et les anciens liens sont couverts par les tests.

## 13. Recommandation finale

Le meilleur premier chantier n’est pas de redessiner les 25 onglets. Il faut
d’abord construire le **centre de contrôle**, la **recherche par intention** et
les **composants communs**, puis migrer un parcours complet :
**Lecture et Plex**.

Ce parcours concentre les dépendances les plus importantes et permet de valider
la nouvelle méthode sur un cas immédiatement utile. Une fois stable, la même
grammaire peut être appliquée au téléchargement, à la bibliothèque puis au
système, sans perdre la richesse actuelle de Movviz.

## 14. Mise en œuvre — v1.19.39

La première fondation de la refonte est maintenant intégrée sans modifier les
formulaires métier ni leurs routes :

- l’accueil devient un **centre de contrôle** branché sur les états réels de
  Plex, du moteur de téléchargement, de TMDb et du stockage ;
- les quatre vérifications s’allument successivement et aboutissent à un
  verdict lisible, avec accès direct au réglage concerné ;
- le mode **Essentiel** remplace la liste de 25 onglets par cinq parcours :
  expérience, lecture, bibliothèque/Plex, téléchargements, serveur/données ;
- le mode **Expert**, mémorisé dans le navigateur, conserve la liste complète ;
- la recherche retrouve toujours les options avancées, même depuis le mode
  Essentiel ;
- chaque parcours possède une page d’orientation avec cartes essentielles et
  avancées, puis un en-tête contextuel permet de revenir au parcours ;
- les libellés français vagues ou trop techniques ont été renommés selon leur
  fonction réelle ;
- les cinq langues contiennent les nouvelles clés ;
- les appels administrateur du centre de contrôle ne partent plus pour un
  utilisateur standard ;
- les liens historiques `?tab=` restent compatibles, tandis que les parcours
  utilisent `?section=`.

Cette version établit la grammaire visuelle et la navigation. Les lots suivants
peuvent désormais simplifier progressivement les formulaires internes sans
dupliquer ni déplacer leur logique métier.
