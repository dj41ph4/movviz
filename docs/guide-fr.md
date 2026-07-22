# Guide Utilisateur de Movviz

## 1. Vue d'ensemble

Movviz est un centre de commande multimédia unifié. Il réunit la découverte (TMDb), la recherche sur des indexeurs Torznab/Newznab, une bibliothèque de films et séries, la gestion de requêtes multi-utilisateurs, un moteur BitTorrent intégré, l'intégration Plex et bien plus — le tout dans une interface premium au look cinématographique.

**Concepts clés :**

- **Bibliothèque** — Films et séries que vous ajoutez pour le suivi. Chaque titre possède un statut (Disponible, En téléchargement, Manquant, Recherche en cours) et peut être étiqueté, surveillé et recherché automatiquement via les indexeurs.
- **Indexeur** — Services Torznab/Newznab qui indexent les releases. Movviz les interroge pour trouver des téléchargements disponibles pour vos contenus surveillés.
- **Moteur** — Le client BitTorrent intégré. Chaque catégorie (film/série) exécute sa propre instance du moteur avec des chemins de téléchargement, limites de vitesse et ratios de seed indépendants.
- **Requêtes** — Les utilisateurs peuvent demander des titres pas encore en bibliothèque. Les administrateurs approuvent ou refusent les requêtes, ce qui déclenche ensuite la recherche automatique.
- **Plex** — Intégration optionnelle pour la synchronisation de la bibliothèque (import de ce que Plex possède), la synchronisation de la liste de surveillance (demande automatique des ajouts à la watchlist Plex) et le suivi de l'état de visionnage par profil utilisateur.

**Stack technique :** Next.js 15, TypeScript, Tailwind CSS v4, Framer Motion, SWR et un moteur BitTorrent ESM dédié tournant sur un port séparé.

**Ports (par défaut) :** Interface web sur le 9810, Moteur BitTorrent sur le 9820, Résolveur Cloudflare sur le 9830, pair-à-pair sur le 51413/51414.

---

## 2. Premiers pas

### Premier démarrage — Assistant de configuration

La première fois que vous accédez à Movviz (ou s'il n'existe aucun compte administrateur), un assistant de configuration en 6 étapes vous guide sur `/setup` :

1. **Langue** — Choisissez la langue de l'interface parmi 5 options disponibles : français (fr), English (en), Italiano (it), Nederlands (nl), Deutsch (de).
2. **Clé API TMDb** — The Movie Database (TMDb) alimente toute la découverte, les métadonnées, les affiches et la recherche. Vous pouvez utiliser la clé par défaut intégrée ou saisir la vôtre depuis [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. **Clé API TVDB** — TheTVDB fournit des métadonnées supplémentaires, en particulier pour les animes. Obtenez une clé sur [thetvdb.com/api-information](https://thetvdb.com/api-information).
4. **Indexeur** — Ajoutez un ou plusieurs indexeurs Torznab ou Newznab. Ce sont les sources que Movviz interroge lors de la recherche de releases. Vous pouvez les ajouter depuis un catalogue ou configurer un endpoint générique manuellement.
5. **Client de téléchargement** — Configurez les instances du moteur BitTorrent intégré (une pour les films, une pour les séries). Définissez les dossiers de bibliothèque, les chemins de téléchargement, les limites de vitesse, les ratios de seed et le comportement de démarrage automatique.
6. **Plex** — Connectez optionnellement un Plex Media Server pour la synchronisation de la bibliothèque, la synchronisation de la liste de surveillance et l'authentification Plex.

Chaque étape peut être ignorée et configurée ultérieurement dans les Réglages.

### Création de compte / Connexion

Après la configuration, vous arrivez sur la page de connexion `/login`. Movviz prend en charge deux méthodes d'authentification :

- **Compte local** — Inscrivez-vous avec un nom d'utilisateur et un mot de passe. Le premier compte (créé lors de la configuration) est un administrateur. Les inscriptions suivantes créent des utilisateurs en attente qui doivent être approuvés par un admin.
- **Authentification Plex** — Cliquez sur « Se connecter avec Plex » pour vous authentifier via votre compte Plex. Une pop-up d'autorisation Plex s'ouvre ; une fois terminée, la connexion est automatique.

Si vous avez déjà un compte, utilisez directement le formulaire de connexion. Utilisez le lien « Pas encore de compte ? » pour passer en mode inscription.

---

## 3. Tableau de bord (/)

Le tableau de bord est votre page principale — statistiques en un coup d'œil et activité récente.

### Widgets personnalisables

La section supérieure affiche des tuiles avec les comptages de :
- **Films** — Films totaux en bibliothèque
- **Séries** — Séries totales en bibliothèque
- **Épisodes** — Épisodes surveillés totaux
- **Épisodes manquants** — Épisodes surveillés pas encore disponibles
- **Disponibles** — Films + épisodes disponibles
- **En téléchargement** — Films + épisodes actuellement en téléchargement ou en recherche
- **Manquants** — Films en statut manquant
- **Épisodes disponibles** — Épisodes surveillés disponibles

**Mode édition :** Cliquez sur l'icône du crayon pour entrer en mode édition. En mode édition vous pouvez :
- **Réorganiser** les tuiles par glisser-déposer (réorganisation Framer Motion)
- **Supprimer** les tuiles avec le bouton X sur chaque tuile
- **Ajouter** des tuiles masquées depuis le menu déroulant « Ajouter un widget »

Cliquez sur la coche pour quitter le mode édition et sauvegarder la disposition.

### File d'attente de téléchargement

Sous les tuiles de statistiques, la **file d'attente de téléchargement** montre les torrents actifs et en attente du moteur, avec des mises à jour de progression en temps réel.

### Ajoutés récemment

La section inférieure montre les 12 films les plus récemment ajoutés dans une grille progressive. Chaque carte affiche l'affiche, le titre et la progression du téléchargement si le film est en cours de téléchargement.

---

## 4. Découverte (/discover)

La page Découverte est votre point de départ pour trouver de nouveaux contenus à ajouter à la bibliothèque.

### Sélecteur de type de contenu

En haut, choisissez entre **Film** et **Série** pour parcourir les contenus spécifiques à chaque type. Les genres, les lignes et les résultats de recherche se mettent à jour en conséquence.

### Lignes dynamiques (vue accueil)

Lorsqu'aucun filtre n'est actif, la page Découverte affiche des lignes horizontales organisées de contenus :
- **Tendances actuelles** — Ce qui est populaire en ce moment
- **Populaires** — Titres les plus populaires
- **Les mieux notés** — Titres avec les meilleures évaluations
- **À venir** — Sorties futures
- **Actuellement au cinéma / Diffusion en cours** — Actuellement au cinéma ou à la télévision
- **Box-office** — Films avec le plus gros chiffre d'affaires
- **Enfants** — Contenus familiaux
- **Nouvelles sorties** — Ajouts récents en streaming
- **Nouvelles séries / Renouvelées** — Séries TV nouvelles ou récemment renouvelées

Chaque ligne est un carrousel défilant horizontalement. Cliquer sur une carte navigue vers la page des détails du titre. Cliquer sur « Voir tout » passe à une vue en grille avec pagination filtrée pour cette catégorie.

**Classements :** Certaines lignes (ex. Les mieux notés, Box-office) s'affichent sous forme de classements numérotés plutôt que de carrousels.

### Boutons studios et réseaux

Sous les lignes de contenu, vous trouverez des boutons pour les **studios** (sociétés de production) et les **réseaux** (chaînes de télévision). Cliquer sur un studio filtre les films de cette société ; cliquer sur un réseau filtre les séries de cette chaîne.

### Tuiles de genres

Des tuiles avec dégradés colorés sont affichées pour chaque genre. En cliquer une filtre les résultats pour ce genre.

### Filtres

Lorsque vous activez un filtre ou effectuez une recherche, la page passe de la vue accueil à une grille de navigation avec pagination et ces contrôles :

- **Champ de recherche** — Tapez pour rechercher par titre (debounced à 350ms)
- **Menu déroulant Genre** — Filtrer par genre
- **Champ Année** — Filtrer par année de sortie
- **Menu déroulant Trier** — Trier par Tendance (popularité), Mieux notés (moyenne des votes) ou Plus récents (date de sortie)
- **Puces de filtres actifs** — Affichent les filtres actifs (genre, année, studio, réseau, catégorie de ligne) avec un X pour les supprimer
- **Bouton Réinitialiser** — Efface tous les filtres d'un coup

### Résultats infinis

La grille de navigation charge les résultats par pages. En défilant vers le bas, plus de résultats sont chargés automatiquement via un IntersectionObserver. Un bouton « Charger plus » apparaît également en bas comme alternative.

### Ajouter à la bibliothèque

Chaque carte dans la vue navigation a un bouton superposé pour **Ajouter à la Bibliothèque**. Une fois cliqué, Movviz ajoute le titre à votre bibliothèque et commence automatiquement à chercher une release. La carte montre le statut actuel (Disponible, En téléchargement, Manquant) si le titre est déjà dans votre bibliothèque.

---

## 5. Bibliothèque (/library)

La page Bibliothèque comporte trois onglets : Bibliothèque, Calendrier et Recherchés.

### 5.1. Onglet Bibliothèque

La vue principale de la bibliothèque affiche tous vos films et séries dans une grille progressive responsive.

**Filtres :**
- **Type** — Tous, Films uniquement ou Séries uniquement
- **Statut** — Tous, Disponible, En téléchargement ou Manquant
- **Étiquette** — Si des étiquettes sont attribuées aux titres, des boutons d'étiquette apparaissent pour filtrer
- **Trier** — Par Titre (alphabétique) ou Récents (ajoutés le plus récemment)

**Rendu progressif :** Les 100 premières cartes sont rendues immédiatement ; le reste est chargé par lots via `requestIdleCallback` pour que la page reste réactive même avec des milliers de titres.

**Cartes :** Les cartes de films affichent l'affiche (avec une barre de progression pendant le téléchargement), le titre, l'année et le badge de statut. Les cartes de séries affichent des informations similaires pour le statut global de la série.

**Réconciliation :** L'admin peut déclencher une réconciliation de la bibliothèque pour détecter les fichiers manquants ou les fichiers non suivis sur le disque. Les problèmes sont signalés en ligne.

### 5.2. Calendrier

Affiche les prochaines sorties de films et les dates de diffusion des épisodes regroupées par date. Les entrées d'aujourd'hui sont surlignées. Chaque entrée montre la miniature de l'affiche, le titre, le badge de langue (VF/VO) et les liens vers la page des détails du titre.

### 5.3. Recherchés

Liste tous les éléments surveillés manquants — films en statut manquant et épisodes surveillés mais pas encore disponibles.

Fonctionnalités :
- **Bouton « Tout télécharger »** — Recherche tous les éléments manquants par lots (limite de 5 recherches simultanées), avec un compteur de progression
- **Recherche par élément** — Chaque film ou épisode manquant a un bouton de recherche pour déclencher une recherche immédiate sur l'indexeur pour cet élément spécifique

Les éléments sont affichés avec leur titre, leur date de sortie/diffusion et depuis combien de temps ils ont été ajoutés.

---

## 6. Collections (/collections)

### 6.1. Sagas (Franchises TMDb)

Les collections de franchises TMDb détectées automatiquement (ex. « Star Wars », « Harry Potter ») sont affichées dans cette section.

- **Progression** — Chaque saga montre un compte possédés/totaux (ex. 4/11) et une barre de progression
- **Analyser la bibliothèque** — L'admin peut déclencher un scan des sagas pour détecter de nouvelles collections depuis la bibliothèque
- **Mode d'affichage** — Grande grille, petite grille ou liste (sauvegardé dans localStorage)

Cliquer sur une saga mène à sa page de détails qui montre toutes les entrées de la collection.

### 6.2. Collections personnalisées

Collections créées par l'utilisateur pour organiser votre bibliothèque comme vous le souhaitez.

- **Création** — Cliquez sur le bouton « Nouvelle collection » pour créer une collection personnalisée
- **Mode d'affichage** — Comme pour les sagas : grande grille, petite grille ou liste

---

## 7. Activité (/activity)

La page Activité suit les opérations de téléchargement, les événements et les échecs.

### 7.1. Téléchargements (File d'attente)

Affiche la file d'attente de téléchargement en temps réel depuis le moteur BitTorrent.

**Statuts visibles :**
- **Métadonnées** — Téléchargement des métadonnées/informations du torrent
- **En téléchargement** — Téléchargement en cours
- **En seed** — Terminé, maintenant en partage
- **En pause** — Mis en pause par l'utilisateur ou le système
- **Bloqué** — Aucun pair/activité
- **Terminé** — Téléchargement fini

**Actions par élément :**
- Mettre en pause / Reprendre
- Redémarrer
- Retirer de la file
- Retirer + supprimer les fichiers téléchargés

**Ajout manuel :** Vous pouvez ajouter des torrents manuellement via un lien magnet ou en chargeant un fichier `.torrent`.

**Filtres de statut** — Filtrez la file par statut pour vous concentrer sur des statuts spécifiques.

### 7.2. Historique

Un journal chronologique des événements liés à vos contenus :
- **Récupéré** — Une release a été récupérée depuis un indexeur
- **Importé** — Un téléchargement a été importé dans la bibliothèque
- **Mis à jour** — Un fichier existant a été remplacé par une meilleure qualité
- **Échoué** — Un téléchargement ou une importation a échoué
- **Bloqué** — Une release a été bloquée par la blocklist

### 7.3. Recherchés

Identique à l'onglet Recherchés de la Bibliothèque — éléments surveillés manquants qui peuvent être recherchés individuellement.

### 7.4. Erreurs

Une vue filtrée de l'historique qui montre uniquement les événements échoués pour un débogage rapide.

---

## 8. Recherche indexeur (/search)

La page de recherche vous permet d'interroger directement vos indexeurs configurés.

**Barre de recherche** — Saisissez une requête et appuyez sur Entrée ou cliquez sur le bouton de lancement.

**Alternance Film/Série** — Limite la recherche aux catégories films ou séries sur vos indexeurs.

**Tableau de résultats triable** — Les résultats sont affichés dans un tableau responsive avec colonnes triables :
- **Titre** — Nom de la release (monospace)
- **Score** — Score de qualité (coloré : vert ≥ 90, ambre ≥ 75)
- **Indexeur** — Quel indexeur a retourné la release
- **Âge** — Depuis combien de temps elle a été publiée
- **Taille** — Taille du fichier
- **Pairs** — Comptage des seeders (coloré)
- **Action** — Bouton de récupération pour télécharger manuellement

**Score de qualité :** Chaque release est évaluée selon votre configuration dans Réglages > Téléchargement > Qualité (profils de release + formats personnalisés). Des scores plus élevés indiquent de meilleures correspondances avec vos préférences.

**Bouton Récupérer** — Télécharge manuellement une release spécifique. Le bouton se transforme en coche une fois récupérée.

**Releases récentes** — Lorsqu'aucune requête de recherche n'est saisie, la page affiche les releases récentes de vos indexeurs pour la catégorie sélectionnée.

**Erreurs par indexeur** — Si un indexeur retourne une erreur (mauvaise clé, limite de débit, etc.), elle est affichée dans une bannière d'avertissement pour que vous sachiez pourquoi certains indexeurs n'ont pas retourné de résultats.

---

## 9. Requêtes (/requests)

Les utilisateurs peuvent demander des films ou séries qui ne sont pas encore en bibliothèque.

**Effectuer une requête :** Depuis la page des détails d'un titre, cliquez sur « Ajouter à la bibliothèque ». Si l'élément n'est pas en bibliothèque, une requête est créée (selon les permissions de l'utilisateur).

**Liste des requêtes :** Affiche toutes les requêtes avec l'affiche, le titre, l'évaluation, l'année, la description, qui l'a demandée et quand.

**Requêtes en attente :** Les nouvelles requêtes apparaissent avec un badge « En attente ».

**Actions admin :**
- **Approuver** — Approuve la requête et déclenche une recherche automatique
- **Refuser** — Rejette la requête

**Statut de requête approuvée :** Après approbation, le badge de statut se met à jour pour refléter le statut réel de la bibliothèque (Recherche en cours, En téléchargement, Manquant, Disponible).

**Onglets :** En attente (par défaut) montre uniquement les requêtes non traitées ; Toutes montre chaque requête. Le badge dans la barre latérale affiche le comptage des requêtes en attente.

---

## 10. Historique (/history)

Un journal complet des événements distinct de la page Activité.

**Filtres :**
- **Type** — Tous, Film ou Série
- **Type d'événement** — Tous, Récupéré, Importé, Mis à jour ou Échoué

**Tableau des événements :** Chaque entrée montre le titre du contenu, le type d'événement (avec icône), la taille, l'horodatage, l'indexeur/acteur et le score de qualité. Cliquer sur un titre navigue vers sa page de détails.

---

## 11. Problèmes (/issues)

Les utilisateurs peuvent signaler des problèmes avec les éléments multimédia.

**Signaler un problème :** Dans la page des détails d'un titre présent en bibliothèque, cliquez sur « Signaler un problème ». Choisissez le type de problème :
- **Vidéo** — Problèmes de qualité vidéo ou de lecture
- **Audio** — Problèmes de pistes audio
- **Sous-titres** — Sous-titres manquants ou incorrects
- **Autre** — Tout autre problème

**Liste des problèmes :** Affiche tous les problèmes signalés avec affiche, titre, badge du type de problème, statut, description, signalateur et horaire.

**Commentaires :** Chaque problème dispose d'un système de commentaires en fil de discussion. Cliquez sur le bouton de comptage des commentaires pour développer la conversation. Ajoutez des commentaires via le champ de saisie en bas.

**Actions admin :**
- **Résoudre** — Marque un problème comme résolu
- **Rouvrir** — Rouvre un problème précédemment résolu

**Onglets :** Ouverts (par défaut) montre les problèmes non résolus ; Tous montre chaque problème.

---

## 12. Utilisateurs (/users)

Gestion des utilisateurs pour les administrateurs. Affiche une liste de tous les utilisateurs.

**Utilisateurs en attente :**
- Les utilisateurs qui se sont inscrits mais n'ont pas encore été approuvés apparaissent dans une section surlignée
- **Approuver** — Active le compte utilisateur
- **Refuser** — Supprime l'utilisateur en attente

**Utilisateurs actifs :**
Chaque ligne utilisateur affiche :
- Nom d'utilisateur avec badge d'authentification (Local ou Plex)
- Rôle (Utilisateur ou Admin) avec activation/désactivation en ligne
- Activation **Approbation automatique** — Lorsqu'activée, les requêtes de cet utilisateur sont approuvées automatiquement
- Lien vers la page des détails de l'utilisateur

**Créer un utilisateur local :** Ouvre un modal pour créer directement un nouvel utilisateur local (nom d'utilisateur + mot de passe).

**Importer des utilisateurs Plex :** Si Plex est connecté, importe les utilisateurs du serveur Plex en tant qu'utilisateurs Movviz.

### Détail Utilisateur (/users/:id)

Cliquer sur un utilisateur affiche sa page de détails avec trois onglets :

**Général :**
- **Découverte par continent** — Définit quels continents apparaissent dans la page Découverte de l'utilisateur
- **Limites de requête** — Limites par utilisateur pour les requêtes de films et séries (avec case Illimité)
- **Approbation automatique** — Activation pour l'approbation automatique des requêtes
- **Synchronisation watchlist Plex** — Si l'utilisateur a un token Plex, il peut demander automatiquement les ajouts de sa watchlist Plex

**Permissions :**
- **Rôle** — Utilisateur ou Admin (un admin ne peut pas se rétrograder lui-même)
- **Peut gérer les requêtes** — Délègue la gestion des requêtes à des utilisateurs non-admin

**Mot de passe :** Pour les utilisateurs non-Plex, les administrateurs peuvent réinitialiser le mot de passe.

---

## 13. Profil (/profile)

La page de profil de chaque utilisateur pour les réglages personnels.

### Mot de passe

Changez votre mot de passe en saisissant le mot de passe actuel et un nouveau (minimum 8 caractères).

### Token API

Créez et gérez des tokens d'accès API personnels pour un accès programmatique.

- **Créer un token** — Donnez-lui un nom, puis copiez le token généré (affiché une seule fois)
- **Liste des tokens** — Affiche tous les tokens avec date de création et dernière utilisation
- **Révoquer** — Supprime un token pour l'invalider

### Découverte par Continent

Sélectionnez les continents que vous souhaitez prioriser dans la découverte. Cela filtre les films et séries affichés sur votre page Découverte en fonction des pays de production.

### Watchlist

Votre liste de surveillance personnelle — titres que vous avez marqués pour plus tard.

Chaque élément de la watchlist affiche l'affiche, l'évaluation et les actions au survol :
- **Ajouter à la bibliothèque** — Ajoute le titre à la bibliothèque et le retire de la watchlist
- **Retirer** — Retire de la watchlist sans ajouter

Vous pouvez ajouter des titres à votre watchlist depuis n'importe quelle page de détails de titre en utilisant le bouton signet.

---

## 14. Réglages (/settings)

Les Réglages sont organisés en 5 groupes avec une barre latérale escamotable sur desktop et une navigation en bas de page sur mobile. Tous les onglets des Réglages (sauf À propos) sont accessibles uniquement aux administrateurs.

### 14.1. Téléchargement

**Clients :** Deux instances intégrées du moteur BitTorrent — une pour les films, une pour les séries. Chaque instance affiche :
- Indicateur de statut (en ligne/hors ligne)
- Protocole (Torrent)
- Association de catégorie (Film/Série)
- Résumé de la configuration actuelle

Lors de la modification, vous pouvez configurer :
- **Dossier bibliothèque** — Où sont stockés les fichiers multimédia pour Plex
- **Dossier de téléchargement** — Où vont les téléchargements incomplets
- **Dossier des terminés** — Où sont déplacés les téléchargements terminés
- **Téléchargements actifs max** — Limite de téléchargements concurrents
- **Ratio de seed** — Ratio cible avant d'arrêter le seed
- **Pairs max** — Nombre maximum de connexions pairs par torrent
- **Slots d'upload** — Slots d'upload par torrent
- **Limite de vitesse téléchargement** — Limite globale de téléchargement (Ko/s ; « Illimité » si vide)
- **Limite de vitesse upload** — Limite globale d'upload
- **Démarrage automatique** — Si l'instance démarre avec le moteur

**Éditeur de dossiers :** Si le moteur tourne sur la même machine, un navigateur de dossiers intégré vous permet de naviguer et sélectionner les chemins visuellement. Pour les configurations distantes/Docker, saisissez le chemin manuellement.

**Bouton Redémarrer le moteur** — Si le moteur est hors ligne, un bouton de redémarrage apparaît.

**Indexeurs :** Configurez les indexeurs Torznab/Newznab pour la recherche de releases.

Chaque indexeur affiche :
- Protocole (Torrent/Usenet) avec icône
- Nom et URL de base
- Statut de connexion (OK/Échec/Non testé) avec détail du dernier test
- Indicateurs d'authentification (clé API ou identifiants)
- Activation/désactivation
- Réglage de priorité

**Paramètres par indexeur :**
- **Catégories** — Quelles catégories de contenu rechercher (panneau extensible)
- **Filtres** — Taille min/max (Mo) et âge maximum (jours)
- **Résolveur Cloudflare** — Active le résolveur Cloudflare pour les indexeurs protégés par Cloudflare
- **Bouton Test** — Teste la connexion en temps réel
- **Supprimer** — Retire l'indexeur

**Ajouter un indexeur :** Flux en deux étapes :
1. Choisissez dans un catalogue d'indexeurs prédéfinis (Torznab/Newznab)
2. Saisissez l'URL, l'authentification (clé API ou nom d'utilisateur/mot de passe) et les catégories

**URL du résolveur :** Configurez l'URL de FlareSolverr (par défaut : `http://localhost:9830`) utilisé par le résolveur Cloudflare.

**Qualité :** Règles de score et de filtrage pour les releases, combinant les profils de release et les formats personnalisés en un seul onglet.

- **Mots bloqués** — Une liste de mots qui, s'ils sont présents dans le titre d'une release, la font rejeter. Ajoutez des mots individuellement ; supprimez avec le bouton X.
- **Tailles maximales** — Tailles maximales autorisées pour les films (Go), les épisodes (Go) et les saisons (Go). Les releases qui les dépassent sont rejetées.
- **Scores de codec** — Scores pour les codecs vidéo : x264, x265 et AV1. Des scores plus élevés rendent les releases avec ce codec plus susceptibles d'être choisies.
- **Formats personnalisés** — Règles de score basées sur des regex appliquées aux titres des releases. Chaque format possède un nom, un score (positif ou négatif) et des termes regex. Créez-en pour prioritiser ou déprioritiser des motifs spécifiques (ex. « HDR », « Dolby Vision », « Remux », etc.).

### 14.2. Bibliothèque

**Métadonnées :** Configuration des sources de données externes.

- **TMDb** — La clé API de The Movie Database. Vous pouvez utiliser la clé par défaut intégrée ou fournir la vôtre. Testez la clé pour vérifier qu'elle fonctionne. Option de restauration de la clé par défaut disponible.
- **TVDB** — La clé API de TheTVDB pour les métadonnées supplémentaires. Inclut un interrupteur pour utiliser TVDB spécifiquement pour les titres **anime**.
- **OMDb** — La clé API de The Open Movie Database pour les scores Rotten Tomatoes et les évaluations Metacritic. Testez pour vérifier.
- **Disposition Découverte** — Choisissez entre la disposition standard **Movviz** (carrousels d'affiches + classements) ou la disposition **Allociné**, qui modifie le style de la page Découverte.

**Plex :** Intégration avec Plex Media Server.

- **Connexion :**
  - **Nom d'hôte** — Nom d'hôte ou IP du serveur Plex
  - **Port** — Par défaut 32400
  - **SSL** — Activez pour utiliser HTTPS
  - **Connecter/Reconnecter** — Authentifiez-vous avec votre compte Plex via popup navigateur
  - **Test** — Vérifie la connectivité
- **Synchronisation de bibliothèque :**
  - Activez pour permettre la synchronisation automatique des bibliothèques Plex dans Movviz
  - **Synchroniser maintenant** — Déclenche une synchronisation immédiate
  - **Nouveau scan complet** — Force un re-scan complet plutôt qu'incrémental
  - Les résultats montrent combien de films/séries ont été ajoutés et comparés
- **Synchronisation de watchlist :**
  - Activez pour permettre la synchronisation globale de la watchlist Plex
  - Lorsqu'activée, les utilisateurs qui se connectent avec Plex peuvent voir leur watchlist Plex transformée automatiquement en requêtes
- **Profils Plex (Mappage utilisateurs) :**
  - Mappez chaque utilisateur Movviz à un Plex Managed User (profil) spécifique pour que l'état de visionnage reflète l'historique de ce profil

**Nommage :** Modèles de nommage pour fichiers et dossiers avec insertion interactive de tokens.

Modèles pour :
- **Dossier film** — ex. `{title} ({year})`
- **Fichier film** — ex. `{title} ({year}) [{quality}]`
- **Dossier série** — ex. `{title} ({year})`
- **Dossier saison** — ex. `Season {season:00}`
- **Fichier épisode** — ex. `{series} - S{season:00}E{episode:00} - {title}`

**Tokens interactifs :** Cliquez sur un champ, puis cliquez sur un bouton token pour l'insérer à la position du curseur. Les tokens disponibles incluent : `{title}`, `{year}`, `{quality}`, `{season}`, `{episode}`, `{series}` et d'autres.

**Points ou espaces :** Choisissez si les séparateurs utilisent des points ou des espaces.

**Aperçu en temps réel :** Pendant que vous modifiez les modèles, un aperçu montre à quoi ressembleront les chemins de fichiers résultants pour un film et un épisode d'exemple.

**Importations :** Watchlists externes qui peuvent être synchronisées et ajoutées automatiquement à la bibliothèque (accessible via l'onglet « Importations »).

Sources prises en charge :
- **Trakt** — Listes utilisateur Trakt
- **IMDb** — Listes IMDb
- **Letterboxd** — Watchlist Letterboxd

Pour chaque liste, configurez :
- **Nom** — Une étiquette descriptive
- **Type** — Trakt, IMDb ou Letterboxd
- **URL** — L'URL de la liste
- **Approbation automatique** — Lorsqu'activée, les éléments de cette liste sont approuvés automatiquement (aucune approbation manuelle nécessaire)
- **Bouton Synchroniser** — Déclenche manuellement une synchronisation

Chaque liste affiche sa dernière synchronisation.

**Importation Seerr :** Importe les requêtes depuis une instance Overseerr existante.

- **URL** — L'URL de votre serveur Seerr
- **Clé API** — Clé API pour l'authentification
- **Test** — Vérifie la connexion
- **Importer maintenant** — Lance le processus d'importation

Après l'importation, un résumé montre :
- Utilisateurs et requêtes scannés
- Importés (comptages approuvés et en attente)
- Sautés (déjà en bibliothèque, déjà demandés, refusés, bloqués)
- Importations échouées
- Utilisateurs non correspondants (utilisateurs Seerr non trouvés dans Movviz)

**Blocages :** Titres qui ne devraient jamais être ajoutés à la bibliothèque.

- **Ajouter un titre bloqué** — Cherchez un titre sur TMDb, sélectionnez-le, ajoutez optionnellement un motif et confirmez
- **Liste des bloqués** — Affiche tous les titres bloqués avec type, titre, année, motif, qui l'a bloqué et quand
- **Débloquer** — Retire un titre de la blocklist

Lorsqu'un titre bloqué est rencontré (via requête ou importation), il est silencieusement refusé avec un message « Bloqué ».

### 14.3. Disque

**Indexation :** Scanne les dossiers racine de la bibliothèque pour les fichiers orphelins — fichiers multimédia sur le disque qui ne sont pas suivis dans la bibliothèque Movviz. Un seul onglet avec un sélecteur Film/Série.

- Sélectionnez le dossier racine à scanner
- Les correspondances sont présentées avec une recherche TMDb intégrée pour l'appariement manuel si nécessaire
- Importation en un clic pour ajouter les fichiers appariés à votre bibliothèque

**Renommage :** Renomme les dossiers et fichiers selon vos modèles de nomenclature.

Flux :
1. **Analyser** — Scanne votre bibliothèque et génère une liste de candidats au renommage avec les chemins actuels vs. prévus
2. **Sélectionner** — Choisissez quels éléments renommer (Tous, Films uniquement, Séries uniquement ou sélection individuelle)
3. **Aperçu** — Révisez les modifications
4. **Exécuter** — Applique les renommages avec progression en temps réel et journal

Paramètres :
- **Langue** — Choisissez la langue TMDb pour les titres traduits (affecte les noms de dossiers/fichiers)
- **« Supprimer les dossiers vides »** — Après le renommage, supprime automatiquement les répertoires désormais vides
- **Progression + journal en temps réel** — Suivez l'opération en temps réel

**Maintenance :** Regroupe les opérations de maintenance du disque en un seul onglet.

**Réparer les chemins :** Détecte les entrées de bibliothèque dont les fichiers ont été déplacés ou sont manquants.

1. **Analyser** — Compare les registres de la bibliothèque avec le système de fichiers réel
2. Les résultats sont catégorisés :
   - **Certaines** — Une correspondance unique (auto-sélectionnée)
   - **Ambiguës** — Correspondances multiples possibles (nécessite un choix humain)
   - **Conflit** — Un fichier qui correspond à plusieurs entrées de la bibliothèque
3. **Navigateur de fichiers** — Pour la correction manuelle, ouvrez un navigateur de fichiers pour parcourir et sélectionner le chemin correct
4. **Appliquer** — Reconnecte les entrées sélectionnées

Options :
- **Auto-reconnexion silencieuse** — Pour les bind mounts Docker, Movviz détecte et corrige automatiquement les changements de chemin silencieusement
- **« Supprimer les dossiers vides après la reconnexion »** — Nettoie les répertoires orphelins après la réparation

**Dossiers vides :** Scanne les dossiers racine configurés pour les répertoires vides.

- Scanne récursivement tous les dossiers racine de la bibliothèque configurés
- Ignore les fichiers système courants (`.DS_Store`, `Thumbs.db`, `Desktop.ini`, etc.)
- **Supprimer** — Supprime les répertoires vides sélectionnés
- **Nettoyage récursif des parents** — Après la suppression, les dossiers parents désormais vides sont également supprimés récursivement

**Corbeille :** Filet de sécurité pour les contenus supprimés.

Lorsqu'un film ou une série est retiré de Movviz avec ses fichiers, les fichiers peuvent être déplacés vers un dossier corbeille au lieu d'être définitivement supprimés.

- **Dossier films** — Chemin où vont les fichiers de films supprimés
- **Dossier séries** — Chemin où vont les fichiers de séries supprimées
- **Conservation** — Jours avant que les fichiers dans la corbeille soient définitivement supprimés (configurable)
- **Comptage d'éléments** — Montre combien d'éléments sont actuellement dans la corbeille

### 14.4. Notifications

Configurez les notifications push pour les événements multimédia (récupéré, importé, échoué, etc.). Cet onglet unique regroupe les transports, le webhook et les options d'activité.

**Transports :**
- **Discord** — URL Webhook
- **Telegram** — Token du bot + Chat ID
- **Gotify** — URL du serveur + Token d'application
- **Slack** — URL Webhook
- **Pushbullet** — Token API

Chaque transport :
- Activation/désactivation
- Champs de configuration (les mots de passe sont masqués)
- **Bouton Test** — Envoie une notification de test pour vérifier la configuration

**Webhook :** Envoie des notifications HTTP POST à une URL personnalisée.

- **Activer** interrupteur
- **URL** — L'endpoint du webhook
- **Bouton Test** — Envoie un payload de test

**Mises à jour qualité :** Active ou désactive la recherche et le téléchargement automatiques de versions de qualité supérieure des contenus déjà disponibles.

### 14.5. Système

**Diagnostic :** Aperçu de l'état du système en temps réel.

- **Moteur** — Moteur BitTorrent en ligne/hors ligne
- **TMDb** — Connectivité API TMDb
- **Indexeur** — Statut de connexion par indexeur
- **Processus :**
  - **Web** — Processus de l'interface web : % CPU, RAM, uptime
  - **Moteur** — Processus du moteur : % CPU, RAM, uptime
- **Espace disque** — Espace total, libre et utilisé sur les chemins configurés
- **Statistiques bibliothèque** — Comptage total films, séries, épisodes
- **Performances** — Comptages et latences des appels API
- **Journal du moteur** — Live tail de la sortie du moteur
- **Journal du résolveur** — Live tail de la sortie du résolveur Cloudflare

**Tâches planifiées :** Liste de toutes les tâches récurrentes en arrière-plan.

Chaque tâche affiche :
- **Nom** — Ce que fait la tâche
- **Intervalle** — À quelle fréquence elle s'exécute
- **Dernière exécution** — Quand elle a été exécutée la dernière fois
- **Prochaine exécution** — Quand elle sera exécutée la prochaine fois
- **Bouton « Exécuter maintenant »** — Déclenche manuellement la tâche

**File d'attente des tâches :** Tâches en arrière-plan actives et récentes.

- Affiche les travaux actuellement en cours avec statut et progression
- Historique des travaux récemment terminés
- **Priorité** — Curseur (0–100) par type de travail pour contrôler la priorité d'exécution
- Les travaux avec une priorité plus élevée sont exécutés en premier lorsque plusieurs travaux sont en file

**Cache :** Statistiques et gestion pour les caches.

Chaque entrée de cache affiche :
- **Nom** — Identifiant du cache
- **Hits** — Recherches cache réussies
- **Miss** — Recherches cache échouées
- **Clés** — Nombre d'entrées en cache
- **Taille** — Utilisation mémoire estimée

Actions :
- **Remplir** — Pré-charge un cache
- **Vider** — Invalide toutes les entrées d'un cache

**Sauvegarde :** Exportez et importez la configuration JSON.

- **Exporter** — Télécharge tous les réglages, métadonnées de la bibliothèque et configuration sous forme de fichier JSON
- **Importer** — Charge un fichier JSON précédemment exporté pour restaurer la configuration

**À propos :** Informations sur l'application.

- **Version** — Numéro de version actuel de Movviz
- **Licence** — GNU General Public License v3.0
- **Soutenir le projet** — Lien pour soutenir le développement
- **Mises à jour :**
  - **Bouton Vérifier les mises à jour**
  - Sur **Windows** : Bouton d'installation en un clic qui télécharge et applique la mise à jour automatiquement
  - Sur **Docker/autres plateformes** : Affiche un lien vers la page de release GitHub avec les instructions

**Zone dangereuse :** Actions irréversibles séparées visuellement en bas du groupe.

Chaque action nécessite de taper un mot de confirmation avant d'être exécutée :
- **Effacer tous les films** — Supprime tous les films de la bibliothèque
- **Effacer toutes les séries** — Supprime toutes les séries de la bibliothèque
- **Effacer l'historique d'activité** — Supprime tout l'historique d'activité
- **Effacer les notifications** — Efface toutes les configurations de notification
- **Effacer les requêtes** — Supprime toutes les requêtes utilisateurs
- **Effacer les problèmes signalés** — Supprime tous les problèmes signalés
- **Réinitialiser l'état de synchronisation Plex** — Réinitialise le suivi de synchronisation Plex

---

## 15. Fiche détaillée (/title/:type/:id)

Une page de détail complète pour les films et séries, montrant tout sur un titre.

### Sections de contenu

- **Fond** — Image hero pleine largeur en haut
- **Affiche** — Affiche verticale avec dégradé superposé
- **Titre** — Nom du film ou de la série
- **Évaluations** — Scores TMDb, IMDb, Rotten Tomatoes (depuis OMDb) et Metacritic
- **Année, Durée, Saisons** (pour les séries), **Genres**
- **Slogan** — Le slogan du film ou de la série (si disponible)
- **Synopsis** — Résumé complet / résumé de l'intrigue
- **Budget / Recettes** — Pour les films, données financières de TMDb

### Boutons d'action

- **Ajouter à la bibliothèque** — Si pas déjà en bibliothèque, ajoute le titre et déclenche la recherche
- **Regarder sur Plex** — Si disponible en bibliothèque et Plex est connecté, ouvre directement le lecteur web Plex
- **Rechercher** — Si l'élément existe en bibliothèque, déclenche une nouvelle recherche sur l'indexeur (utilisé aussi pour les mises à jour qualité)
- **Choix manuel** — Ouvre la page de recherche indexeur pré-remplie pour la sélection manuelle de la release
- **Signet / Retirer le signet** — Ajoute ou retire de votre watchlist personnelle
- **Bande-annonce** — Ouvre un modal avec la bande-annonce YouTube
- **Saga** — Pour les films, lien vers la page de collection/saga TMDb

### Badge de statut bibliothèque

Affiche le statut actuel du titre dans votre bibliothèque : Disponible, En téléchargement, Recherche en cours ou Manquant.

### Casting et Équipe

- **Casting** — Ligne horizontale défilante de portraits d'acteurs avec noms des personnages ; cliquez pour voir les détails de la personne
- **Équipe** — Grille des membres de l'équipe par fonction (Réalisateur, Scénariste, etc.) avec expansion « Voir plus »

### Saisons (Séries)

Pour les séries, un panneau des saisons montre chaque saison avec ses épisodes. Chaque épisode affiche :
- Numéro d'épisode et titre
- Date de diffusion
- Activation du suivi
- Badge de statut
- Bouton de recherche par saison

### Mots-clés

Tags/mots-clés de TMDb affichés sous forme de pilules.

### Recommandations

Titres similaires de TMDb affichés sous forme de grille d'affiches.

### Informations barre latérale

- Titre original
- Statut (Sorti, Terminée, Série en cours, etc.)
- Date de sortie / Première diffusion
- Budget et recettes (films)
- Langue originale
- Pays d'origine
- Studios / Sociétés de production
- **Plateformes de streaming** — Logos des fournisseurs de streaming disponibles (ex. Netflix, Disney+, etc.)
- **Liens externes** — Icônes Plex, TMDb, IMDb, Rotten Tomatoes, Letterboxd

### Modaux de requête

Si le titre n'est pas encore en bibliothèque, cliquer sur « Ajouter à la bibliothèque » ouvre un modal de requête spécifique au type (film ou série) avec des options pour l'utilisateur.

### Modal Choix manuel

Ouvre la page de recherche indexeur (`/search`) dans un contexte modal/dialogue, pré-remplie avec les métadonnées du titre et la bonne référence de bibliothèque pour l'importation automatique après récupération.

---

## 16. Raccourcis clavier

- **Cmd+K / Ctrl+K** — Ouvre la palette de commandes universelle pour la navigation et la recherche rapide
- **Navigation barre latérale** — Toutes les sections principales sont accessibles depuis la barre latérale : Tableau de bord, Découverte, Bibliothèque, Collections, Recherche, Requêtes, Activité, Historique, Problèmes, Utilisateurs (admin), Réglages (admin)

---

## 17. Dépannage

### Moteur hors ligne

**Symptômes :** Les téléchargements ne démarrent pas, l'activité n'affiche pas de files, indicateur rouge « hors ligne » dans Réglages > Téléchargement > Clients.

**Solutions :**
- Vérifiez que le processus du moteur est en cours d'exécution (`npm run engine` ou le service Windows)
- Vérifiez que le port 9820 n'est pas bloqué par un pare-feu
- Dans Réglages > Téléchargement > Clients, cliquez sur « Redémarrer le moteur »
- Consultez les journaux du moteur dans Réglages > Système > Diagnostic
- Vérifiez que le fichier d'état du moteur n'est pas corrompu

### Erreurs d'indexeur

**Symptômes :** Les résultats de recherche sont vides, ou des indexeurs spécifiques affichent un statut « échec ».

**Solutions :**
- Vérifiez le résultat du test de chaque indexeur dans Réglages > Téléchargement > Indexeurs
- Vérifiez que vos clés API sont toujours valides
- Pour les indexeurs protégés par Cloudflare, activez le « Résolveur Cloudflare » et assurez-vous que FlareSolverr est en cours d'exécution
- Vérifiez les filtres de taille min/max et d'âge maximum dans Réglages > Téléchargement > Qualité — ils pourraient être trop restrictifs
- Cherchez les messages d'erreur par indexeur dans la bannière d'avertissement de la page de recherche

### Chemins brisés (bind mount Docker)

**Symptômes :** Les fichiers existent sur le disque mais la bibliothèque affiche un statut « manquant ». Le scan Réparer les chemins montre des candidats avec des chemins incorrects.

**Solutions :**
- Lancez un scan dans Réglages > Disque > Maintenance > Réparer les chemins
- Pour les bind mounts Docker, Movviz tente l'auto-reconnexion silencieuse — vérifiez que cela a fonctionné
- Si l'auto-reconnexion n'a pas fonctionné, utilisez le navigateur de fichiers manuel pour corriger les chemins
- Assurez-vous que vos montages de volume Docker sont cohérents entre les redémarrages

### Sessions expirées

**Symptômes :** Erreurs 401 sur les appels API, redirection vers la page de connexion inattendue.

**Solutions :**
- Déconnectez-vous et reconnectez-vous
- Si vous utilisez l'authentification Plex, reconnectez votre compte Plex
- Les cookies de session sont gérés par le serveur — si le serveur redémarre, les sessions peuvent être invalidées
- Vérifiez que l'horloge système est exacte (la validation du token de session est sensible au temps)
