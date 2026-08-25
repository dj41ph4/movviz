# Audit complet des réglages desktop Movviz

Date de l’audit : 23 août 2026
Périmètre : `src/app/settings/page.tsx`, `src/lib/settingsNav.ts`, les composants `src/components/settings/*`, les routes API appelées par ces composants et les traductions associées.
Ce document est une analyse uniquement : aucun comportement desktop n’a été modifié.

> Mise à jour terrain — 25 août 2026 : chaque onglet a aussi été ouvert dans
> l’instance réelle `movviz.dj41ph4.ovh`, sous un compte administrateur. Les
> valeurs, états de connexion, compteurs et journaux observés sont propres à
> cette instance et ne doivent pas être considérés comme des valeurs par défaut.
> Aucun bouton d’enregistrement, de test, de synchronisation, d’importation ou
> de suppression n’a été activé pendant cet audit.

## 1. Résumé exécutif

Les réglages couvrent presque toute l’application : téléchargement, indexation, Plex, métadonnées, qualité, maintenance, notifications, cache, automatisations, diagnostics, IA et zone destructive. La base technique est saine : une source de vérité des onglets (`settingsNav.ts`), navigation par URL (`?tab=`), recherche par libellé et description, protections `adminOnly`, confirmations destructives et composants spécialisés.

Le problème principal est l’expérience utilisateur, pas l’absence de fonctions :

- 25 onglets forment une longue liste technique, dont plusieurs sont des regroupements de 2 à 5 panneaux.
- La navigation mélange des décisions quotidiennes (client de téléchargement, qualité, lecteur) avec des outils d’exploitation (logs, réparation, cache, doctor).
- Les dépendances entre réglages sont peu visibles : Plex → bibliothèque → indexation → téléchargement → lecture ; TMDb/OMDb/TVDB → métadonnées ; cache → visuels et performances.
- Les libellés sont parfois techniques ou vagues (« Expérience », « Performance », « À propos ») alors que l’utilisateur cherche une action (« changer le lecteur », « réparer un chemin », « accélérer les images »).
- Les actions à fort impact existent dans le même parcours que les réglages courants ; la séparation visuelle ne suffit pas toujours à prévenir une mauvaise manipulation.
- Plusieurs panneaux utilisent leur propre logique de chargement, sauvegarde, test et erreurs, ce qui rend le résultat imprévisible d’un onglet à l’autre.

Objectif de refonte : conserver toutes les capacités et les routes existantes, mais transformer les réglages en parcours guidés par intention, avec un niveau « simple » par défaut et un niveau « avancé » explicite.

## 2. Inventaire actuel

### 2.1 Navigation et contrôle d’accès

`SettingsPage` :

- lit `tab` dans l’URL et conserve le partage direct d’un onglet ;
- filtre les onglets `adminOnly` selon `user.role` ;
- propose une recherche qui porte sur le libellé et le texte d’aide ;
- affiche une sidebar sticky desktop et une bottom-sheet mobile ;
- regroupe les entrées en six groupes : personnel, téléchargement, bibliothèque, disque, notifications, système ;
- rend les panneaux directement selon `tab`, sans registre de métadonnées de contenu.

### 2.2 Onglets exposés

| Groupe actuel | Onglet | Fonction réelle | Niveau utilisateur recommandé |
|---|---|---|---|
| Personnel | Tableau de bord | mode, sections, compteurs, affichage des rangées | courant |
| Personnel | Expérience | bande-annonce de fiche, épisodes spéciaux, lecteur bêta, auto-update selon composants | courant/avancé |
| Personnel | GPU | renderer, animations, préférences graphiques | avancé |
| Personnel | Import Netflix | import d’historique/listes Netflix | courant ponctuel |
| Téléchargement | Clients | moteur, instances, type de client, redémarrage | courant/avancé |
| Téléchargement | Indexeurs | indexeurs, resolver, test, activation | administrateur |
| Téléchargement | Qualité | règles de release et formats personnalisés | avancé |
| Bibliothèque | Métadonnées | TMDb, OMDb, TVDB, langue, layout de découverte | administrateur |
| Bibliothèque | Anime | TVDB anime, épisodes spéciaux, synchronisation TVDB | avancé |
| Bibliothèque | Plex | serveur, bibliothèque, liaison, test, PIN Plex | administrateur |
| Bibliothèque | Nommage | modèles films/séries, aperçu, application en masse | avancé |
| Bibliothèque | Imports | listes externes et Seerr | administrateur |
| Bibliothèque | Blocklist | titres/releases interdits, recherche et suppression | avancé |
| Disque | Indexation | scan disque complet/incrémental et import index | administrateur |
| Disque | Maintenance | récupération téléchargements, chemins, dossiers, media probe, corbeille | administrateur/dangereux |
| Notifications | Notifications | transports, webhook, test | courant/administrateur |
| Système | Diagnostics | Doctor + Health | support |
| Système | Performance | statistiques et profil de performance | support |
| Système | Logs | recherche, moteur, resolver, transcodage | support |
| Système | Automatisation | tâches planifiées, file et priorités | avancé |
| Système | IA | fournisseurs, clés, fallback, recherche web, journal debug | avancé |
| Système | Cache | cache API, cache visuels, remplissage et nettoyage | avancé |
| Système | À propos | version, mise à jour, sauvegarde/restauration | courant/support |
| Système | Zone dangereuse | reset et opérations irréversibles | administrateur uniquement |

### 2.3 Routes API observées

| Domaine | Routes principales utilisées |
|---|---|
| Installation/système | `/api/system`, `/api/system/update`, `/api/system/reset`, `/api/system/browse`, `/api/backup`, `/api/danger-zone` |
| Téléchargement | `/api/engine/instances`, `/api/engine/client-type`, `/api/engine/restart`, `/api/indexers`, `/api/resolver`, `/api/jobs`, `/api/jobs/priorities`, `/api/tasks` |
| Bibliothèque/disque | `/api/library/disk-scan`, `/api/library/index-scan`, `/api/library/index-import`, `/api/library/clean-dirs`, `/api/library/repair-paths`, `/api/library/media-probe`, `/api/maintenance/recover-downloads`, `/api/settings/trash`, `/api/library/rename` |
| Métadonnées | `/api/metadata/key`, `/api/metadata/omdb`, `/api/metadata/tvdb`, `/api/metadata/tvdb/sync-all`, `/api/metadata/discover-layout` |
| Plex/Seerr | `/api/plex/config`, `/api/plex/test`, `/api/auth/plex/pin`, `/api/plex/link/poll`, `/api/seerr/config`, `/api/seerr/test`, `/api/seerr/import` |
| Règles et contenu | `/api/settings/release-rules`, `/api/custom-formats`, `/api/blocklist`, `/api/import-lists` |
| Cache et observabilité | `/api/cache`, `/api/cache/warm`, `/api/cache/artwork-warm`, `/api/cache/artwork/clear`, `/api/health`, `/api/perf`, `/api/stats`, `/api/diagnostic/search-logs`, `/api/diagnostics/transcode-logs`, `/api/engine/logs`, `/api/resolver/logs`, `/api/doctor` |
| Notifications/IA | `/api/notifications/config`, `/api/notifications/test`, `/api/webhook`, `/api/webhook/test`, `/api/ai/config`, `/api/ai/config/test`, `/api/ai/session`, `/api/ai/debug-log` |

Les routes sont nombreuses mais cohérentes par domaine. La refonte doit donc rester frontend : créer une couche d’orchestration UX au-dessus des routes existantes, sans modifier les contrats backend.

## 3. Analyse UX détaillée

### Ce qui fonctionne

1. La recherche globale des réglages répond à un vrai besoin et doit devenir le point d’entrée principal.
2. Le découpage en composants limite la taille de la page et permet une migration progressive.
3. Les tests explicites (« tester Plex », « tester indexeur », « tester webhook », « tester fournisseur IA ») sont une bonne base de confiance.
4. Les confirmations existent pour les suppressions, reset, restauration et opérations disque.
5. Les états admin/non-admin sont déjà séparés, ce qui permet de ne pas exposer les réglages d’exploitation aux utilisateurs ordinaires.

### Frictions prioritaires

#### A. Trouver une action

Un utilisateur ne pense pas « onglet Indexation » ; il pense « mon nouveau film n’apparaît pas ». Il ne sait pas si la solution est Plex, un scan disque, un import, le cache ou le metadata provider. La recherche actuelle ne propose pas de parcours (« problème → diagnostic → action »), uniquement une liste filtrée.

#### B. Comprendre l’impact

Les panneaux indiquent souvent ce que fait une option, mais rarement ce qu’elle affecte, combien de temps elle prend, si elle est réversible, ou si elle consomme quota/disque/API. Les actions de cache, scan, sync TVDB, import Seerr et reset devraient afficher durée estimée, portée, progression et possibilité d’annulation.

#### C. Sauvegarder sans peur

Le comportement de sauvegarde varie : certains panneaux sauvegardent immédiatement, d’autres en lot, d’autres après test. Il faut un modèle commun : état local modifié, bouton « Enregistrer », état enregistré, erreur récupérable et annulation.

#### D. Dépendances invisibles

Exemples :

- Plex non connecté rend les réglages de bibliothèque et de lecture partiellement inutiles ;
- une clé TMDb absente dégrade les visuels, logos et recherches ;
- un client de téléchargement arrêté bloque les demandes ;
- les règles qualité et formats personnalisés se combinent sans aperçu ;
- le cache visuel et le cache de métadonnées n’ont pas le même cycle de vie ;
- les paramètres IA peuvent exposer des clés ou coûter des appels.

#### E. Densité et jargon

Les groupes « Système » et « Maintenance » sont des boîtes à outils d’administrateur. Ils doivent être repliés par défaut, avec des descriptions simples et un mode « Afficher les détails techniques ».

#### F. Gestion des erreurs

Les erreurs sont souvent des toasts ou du texte local au panneau. Il manque une présentation homogène : cause, conséquence, action de réparation, lien vers les logs et identifiant de diagnostic.

## 4. Modèle cible de navigation

### 4.1 Accueil des réglages

Remplacer la sidebar comme point de départ par une page d’accueil avec :

- recherche « Que veux-tu régler ? » ;
- cartes d’état : Plex, téléchargement, métadonnées, stockage, notifications ;
- alertes actionnables (« Plex non connecté », « moteur arrêté », « cache visuel incomplet ») ;
- raccourcis : « Ajouter un serveur Plex », « Configurer un téléchargement », « Choisir la qualité », « Réparer la bibliothèque » ;
- historique des derniers changements ;
- bouton « Tous les réglages avancés ».

La sidebar existante reste disponible après sélection, pour conserver les URL `?tab=` et les habitudes des utilisateurs avancés.

### 4.2 Nouvelle taxonomie par intention

| Nouvelle section | Contenu |
|---|---|
| Démarrage | Plex, client de téléchargement, métadonnées, notifications |
| Apparence et lecture | tableau de bord, expérience, lecteur bêta, GPU/animations |
| Bibliothèque | indexation, Plex, métadonnées, anime, nommage, imports, blocklist |
| Téléchargements | clients, indexeurs, resolver, qualité, formats, automatisations |
| Données et stockage | cache, chemins, réparation, nettoyage, media probe, corbeille, récupération |
| Notifications | notifications, webhooks, tests |
| Assistance et sécurité | diagnostics, santé, logs, performance, sauvegarde, mises à jour, IA |
| Zone dangereuse | reset, suppressions globales, opérations irréversibles |

Les onglets historiques sont aliasés vers ces sections afin de ne casser aucun lien.

### 4.3 Mode simple / avancé

- Simple : champs essentiels, valeurs recommandées, explication en une phrase, test et résultat.
- Avancé : quotas, timeouts, règles détaillées, logs, profils, commandes et formats.
- Le mode avancé est mémorisé par utilisateur, jamais activé par surprise.

## 5. Plan de refonte proposé

### Phase 0 — Contrat UX et instrumentation

- définir les intentions utilisateur et les dépendances entre panneaux ;
- créer un registre typé `settingsCatalog` avec titre, description, section cible, niveau, routes, risques, mots-clés et liens de dépannage ;
- instrumenter ouverture, recherche, sauvegarde, test, erreur et abandon ;
- vérifier que chaque clé de traduction existe dans les cinq locales.

Critères : 100 % des onglets actuels mappés, aucune route modifiée, URL historiques toujours valides.

### Phase 1 — Nouvelle page d’accueil des réglages

- cartes d’état alimentées par les endpoints existants ;
- alertes avec action directe ;
- recherche par intention et synonymes (« film absent », « logo », « Plex », « sous-titres », « lenteur ») ;
- résultats regroupés par « régler », « diagnostiquer », « comprendre ».

Critères : un utilisateur trouve Plex, scan, cache et lecteur en moins de deux interactions lors d’un test guidé.

### Phase 2 — Composants d’interaction communs

- `SettingSection`, `SettingRow`, `SettingSwitch`, `SettingSelect`, `SettingTextInput` ;
- `SaveBar` unique avec état non enregistré ;
- `TestResult` standardisé : succès, avertissement, erreur, durée, détail ;
- `OperationProgress` avec portée, progression, annulation et reprise ;
- confirmation destructive avec résumé exact de l’impact.

Critères : mêmes états de chargement/sauvegarde/erreur dans tous les panneaux migrés.

### Phase 3 — Parcours de démarrage guidé

Créer un assistant non obligatoire :

1. serveur Plex et test ;
2. bibliothèques et chemins ;
3. métadonnées TMDb/OMDb/TVDB ;
4. client et indexeurs ;
5. qualité/nommage ;
6. notifications ;
7. premier scan et premier cache visuel.

Chaque étape indique « pourquoi », « ce qui sera appelé », « ce qui sera modifié » et permet de reprendre plus tard.

### Phase 4 — Regroupement bibliothèque/téléchargement

- transformer les panneaux isolés en parcours « Ajouter un titre », « Trouver une release », « Importer », « Réparer » ;
- afficher l’ordre effectif des sources et règles ;
- ajouter un simulateur de release avant sauvegarde des règles qualité/formats ;
- exposer l’état Plex et indexation dans le même écran.

### Phase 5 — Données, cache et maintenance

- distinguer visuels, métadonnées, index de recherche et cache opérationnel ;
- afficher taille, âge, hits/misses, limite, dernier remplissage, erreurs et impact d’un nettoyage ;
- proposer « nettoyer logos », « nettoyer affiches », « nettoyer métadonnées », « tout nettoyer » avec confirmation ciblée ;
- unifier scans disque, réparation chemins, media probe, récupération et corbeille dans une console d’opérations.

### Phase 6 — Support, diagnostics et sécurité

- tableau de santé lisible avant les logs bruts ;
- bouton « Copier le rapport de diagnostic » sans secrets ;
- logs filtrables par corrélation, domaine et date ;
- IA et webhooks dans des espaces sécurisés, clés masquées, test explicite ;
- sauvegarde/restauration avec prévisualisation et vérification d’intégrité.

### Phase 7 — Validation et migration

- tests E2E des chemins critiques ;
- tests de permissions admin/utilisateur ;
- test responsive desktop/tablette ;
- test des anciens liens `?tab=` ;
- migration panneau par panneau derrière un flag ;
- suppression des doublons uniquement après deux versions stables.

## 6. Priorités recommandées

### P0 — À faire en premier

1. Accueil des réglages + recherche par intention.
2. Cartes d’état Plex/téléchargement/métadonnées/stockage.
3. États de sauvegarde, test et erreur uniformes.
4. Assistant de démarrage Plex → téléchargement → métadonnées.
5. Séparation claire des actions destructives.

### P1 — Gain important

1. Cache visuels/métadonnées séparé et explicite.
2. Simulateur de règles qualité/nommage.
3. Console unique des opérations longues.
4. Diagnostic actionnable avant les logs.

### P2 — Raffinement

1. Raccourcis personnalisables.
2. Historique des changements et annulation quand possible.
3. Conseils contextuels selon l’état réel du serveur.
4. Mode avancé mémorisé et partage de liens vers une section précise.

## 7. Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| Modifier un contrat backend | frontend uniquement, tests de snapshots des routes et types |
| Cacher une option avancée | recherche globale, mode avancé explicite, URL conservées |
| Action destructive accidentelle | confirmation contextualisée + rôle admin + résumé d’impact |
| Requêtes répétées et latence | SWR partagé, cache local, polling limité aux opérations actives |
| Secrets exposés | champs masqués, aucun token dans le diagnostic exporté |
| Régression de traduction | ajout simultané dans `en/fr/de/it/nl`, typecheck obligatoire |
| Perte de repères pour les utilisateurs actuels | alias d’onglets, redirections et période de coexistence |

## 8. Définition de fini

La refonte sera considérée terminée quand :

- un nouvel utilisateur configure un serveur fonctionnel sans connaître les noms des routes ou services ;
- un administrateur retrouve chaque réglage existant par recherche ou intention ;
- chaque opération longue affiche état, progression, erreur et reprise ;
- les réglages Plex, téléchargement, métadonnées, cache et lecteur affichent leurs dépendances ;
- les actions destructives sont isolées et confirmées ;
- aucun lien historique `settings?tab=...` ne casse ;
- desktop, API backend et Android TV restent inchangés fonctionnellement ;
- le parcours critique est couvert par des tests et vérifié sur les cinq locales.

## 9. Décision proposée

Commencer par les phases 0 et 1, puis migrer un seul parcours complet — « Plex et bibliothèque » — avant de généraliser les composants communs. Cela permet de valider la nouvelle logique avec un périmètre utile et mesurable, sans risquer une réécriture simultanée des 25 onglets.

## Annexe — panneaux secondaires inclus dans l’audit

Les onglets composites rendent aussi les panneaux suivants accessibles ; ils doivent être représentés dans le futur catalogue, même s’ils ne deviennent pas forcément des pages distinctes :

| Panneau | Parent proposé | Rôle |
|---|---|---|
| `ReleaseRulesPanel`, `CustomFormatsPanel` | Téléchargements / Qualité | filtrage et scoring des releases |
| `TvdbSyncAllPanel` | Bibliothèque / Anime | synchronisation globale TVDB |
| `JobQueuePanel`, `TasksPanel` | Téléchargements / Automatisation | file, priorités et tâches planifiées |
| `WebhookSettings` | Notifications | transport webhook et test |
| `AiDebugLogPanel` | Assistance / IA | journal des appels IA |
| `AboutPanel`, `BackupSettings` | Assistance / Sécurité | version, mise à jour, sauvegarde/restauration |
| `DoctorPanel`, `HealthPanel`, `PerfPanel`, `StatsPanel` | Assistance / Diagnostic | santé, performances et statistiques |
| `SearchLogsPanel`, `EngineLogsPanel`, `ResolverLogsPanel`, `TranscodeLogsPanel` | Assistance / Logs | observabilité par sous-système |
| `RecoverDownloadsPanel`, `RepairPathsPanel`, `CleanDirsPanel`, `MediaProbePanel`, `TrashPanel`, `RenamePanel` | Données / Maintenance | réparation et opérations disque |
| `FolderPicker`, `RepairFileBrowserModal`, `CategoryPicker` | composant commun | sélection guidée et réduction des erreurs de saisie |

Cette annexe évite de perdre une fonction lors du regroupement : une fonction peut changer de place et de présentation, mais elle doit rester traçable vers son composant et sa route API actuels.

## 10. Catalogue fonctionnel exhaustif — constat dans l’interface réelle

Cette section est la référence opérationnelle : elle distingue les **réglages
persistants**, les **tests** (sans modification durable), les **opérations**
(qui travaillent sur des données/fichiers) et les **écrans d’observation**.
Les clés, jetons et chemins complets ne sont volontairement pas recopiés.

### 10.1 Accueil et navigation des réglages

- **Accueil** n’est pas un onglet de configuration : c’est le point d’entrée.
  Il affiche l’état de Plex, des clients de téléchargement, de TMDb et du
  stockage, puis des raccourcis vers Plex, Clients, Qualité et Expérience.
- La recherche **« Rechercher un réglage… »** cherche les intitulés, les aides
  et des synonymes d’intention (`film absent`, `lenteur`, `lecteur`, `logo`,
  `renommage`, etc.). Elle ne modifie rien.
- La recherche **« Que veux-tu régler ? »** de l’accueil a le même rôle de
  point d’entrée par intention. Les résultats restent des raccourcis ; l’option
  n’est pas changée lors de la recherche.
- Les onglets administrateur sont masqués à un utilisateur ordinaire. Les liens
  directs `?tab=<id>` restent la référence de navigation partageable.

### 10.2 Personnel

#### Tableau de bord

| Option/action | Effet réel | Portée / précaution |
|---|---|---|
| Mode **Cinéma**, **Classique**, **Compact** | Choisit respectivement : hero + carrousels ; carrousels sans grand hero ; même vue sans file de téléchargement. | Préférence personnelle, sans impact sur les autres comptes. |
| Sections affichées | Active/masque statistiques, file de téléchargement et tâches planifiées. | Visuel uniquement. |
| Chercher sur YouTube si besoin | Cherche une bande-annonce quand TMDb n’en propose pas dans la langue attendue. | Source non officielle, dépendante de YouTube ; désactivée par défaut. |
| Activer le Hero | Affiche ou masque le hero cinématique. | Visuel uniquement. |
| Vitesse du diaporama | 5 s, 10 s, 15 s, 30 s ou 1 min entre les slides. | Visuel uniquement. |
| Aperçu vidéo | Désactivé ou automatique pour les bandes-annonces du hero. | Une vidéo peut consommer réseau/GPU. |
| Année minimale | Retire des rangées Découverte/Recommandé les titres plus anciens que l’année choisie. | Ne supprime aucun titre. |
| Contenu suggéré | Inclut/exclut les titres déjà possédés et ceux à découvrir. | Agit sur le choix du hero. |
| Carrousels | Active individuellement Reprendre, Suggestions, Moins de 40 min, Ajouts récents, Sorties, Optimisations et Tendances. | Ne modifie ni bibliothèque ni historique. |

#### Expérience

| Option | Effet réel | Précaution |
|---|---|---|
| Images depuis Internet | Sert les affiches/fonds directement depuis TMDb, avec repli vers Movviz. | Peut être plus rapide si l’upload du serveur est limité. |
| Priorité au réseau local | Préfère le serveur local sur le réseau domestique. | Évite un détour Internet inutile. |
| Aperçus vidéo | Active/désactive les bandes-annonces de fond sur fiches et survols de cartes. | Désactiver réduit réseau et GPU. |
| Compter les épisodes spéciaux | Inclut la saison 0 dans la condition « série entièrement vue ». | Ne change pas les épisodes ; change le calcul du statut vu. |

#### GPU

| Option | Effet réel |
|---|---|
| Profil Ultra Low / Low / Medium / High | Réduit ou augmente les effets graphiques et la charge GPU. Medium est le compromis par défaut ; High active la qualité maximale. |
| Activer les animations | Active logo, transitions, aurora et effets ; désactivation = interface statique. |
| GPU détecté | Information technique du renderer courant, non modifiable. |

#### Netflix

| Action | Effet réel | Précaution |
|---|---|---|
| Choisir un CSV / Importer | Importe l’historique de visionnage exporté depuis Netflix afin de marquer les titres vus dans Movviz, et Plex si lié. | Le CSV provient du compte Netflix de l’utilisateur ; le contrôler avant import. |
| Lien activité Netflix | Ouvre l’export d’activité Netflix. | Aucune API Netflix n’est utilisée. |

### 10.3 Téléchargement

#### Clients de téléchargement

| Option/action | Effet réel |
|---|---|
| Moteur torrent Stable / Bêta / libtorrent | Choisit l’implémentation utilisée par les instances. Le changement concerne le moteur, pas les fichiers déjà présents. |
| Instance Films / Séries | Chaque catégorie a son client indépendant et ses propres réglages. |
| Dossiers téléchargement et complétés | Définit l’entrée temporaire et la destination de l’instance. Toute modification doit correspondre à des chemins réellement accessibles au moteur. |
| Téléchargements simultanés | Limite de torrents actifs simultanément. |
| Limites montante/descendante | Plafonds de bande passante par instance ; vide/illimité laisse le moteur gérer. |
| Ratio de seed | Objectif de partage avant arrêt/retirer selon le moteur. |
| Pairs max / slots upload | Limites de connexions et d’envois. Des valeurs excessives peuvent dégrader le réseau. |
| Démarrage auto au boot | Lance l’instance au redémarrage. |
| Configurer | Ouvre l’édition détaillée de l’instance. |

#### Indexeurs

| Option/action | Effet réel |
|---|---|
| URL, clé API, type Torrent/Usenet | Déclare un indexeur Torznab/Newznab interrogé directement par Movviz. |
| Catégories | Restreint les catégories émises dans les recherches. |
| Filtres | Applique les restrictions propres à l’indexeur avant interrogation. |
| CF / résolveur | Utilise le résolveur pour les sites protégés quand nécessaire. |
| Tester | Vérifie la connexion et la réponse de l’indexeur, sans téléchargement. |
| Ajouter un indexeur | Crée une nouvelle configuration d’indexeur. |

#### Qualité

| Option | Effet réel | Interactions importantes |
|---|---|---|
| Mots interdits | Rejette automatiquement toute release contenant un terme. Elle demeure visible en recherche manuelle. | Prévaut sur le score. |
| Mots autorisés | Annule un interdit correspondant dans un cas voulu, ex. une vraie piste MULTI. | À régler avec les interdits. |
| Taille maximale Film / Épisode / Saison / Intégrale | Ignore une release au-delà du seuil. Vide = pas de limite. | Chaque type a son seuil. |
| Points x264 / x265 / AV1 | Bonus/malus de score de codec à résolution égale. | N’est pas la politique de taille. |
| Politique Plus petit / Équilibré / Meilleure qualité | Départage les candidats déjà admissibles en tenant compte de l’efficacité de codec. | Équilibré conserve le comportement standard. |
| Langue cible de remplacement | Rend éligibles au remplacement les fichiers dans une autre langue. | Désactivé évite toute recherche de remplacement linguistique. |
| Codec vidéo/audio cible | Rend éligibles les fichiers qui ne sont pas dans le codec souhaité. | Sert à « Rechercher et remplacer ». |
| Résolution cible | Rend éligibles les fichiers sous la résolution demandée. | Ne baisse pas la qualité. |
| Mise à niveau automatique | Lance les vérifications/remplacements planifiés selon les règles. | À n’activer qu’après revue des règles. |
| Suggestions de mise à niveau | Alimente la rangée de recommandations du dashboard. | N’entraîne pas elle-même de remplacement. |
| Formats personnalisés | Ajoutent/retirent des points lorsqu’un terme est présent dans une release. | Se cumulent avec les règles ci-dessus. |

### 10.4 Bibliothèque

#### Métadonnées

| Option/action | Effet réel |
|---|---|
| Clé TMDb personnelle | Remplace la clé intégrée de Movviz. Sert aux titres, images, logos et découverte. Tester vérifie la clé ; restaurer revient à la clé intégrée. |
| Clé OMDb | Active les notes IMDb, Rotten Tomatoes et Metacritic. Sans clé, ces badges sont simplement absents. |
| Clé TVDB | Nécessaire à la synchronisation anime et aux spéciaux précis. |
| Découverte Movviz / AlloCiné | Change l’ordre et la sélection des rangées Découverte ; les données continuent de provenir de TMDb. |

#### Anime

| Option/action | Effet réel |
|---|---|
| Utiliser TVDB pour les animes | Ne concerne que les titres détectés anime (origine japonaise + Animation) ; affiche/résumé restent TMDb. |
| Suivre les épisodes spéciaux | Inclut ou exclut les futurs saison 0/OVA lors des nouvelles syncs. Les suivis existants ne sont pas modifiés. |
| Resynchroniser tous les animes | Lance une opération bibliothèque : restructure les saisons selon TVDB et rafraîchit les titres d’épisode. Les non-animes peuvent recevoir des spéciaux TMDb manquants. |

#### Plex

| Option/action | Effet réel | Précaution |
|---|---|---|
| Hôte, port, SSL, tester | Définit et vérifie la connexion serveur Plex. | Ne pas exposer le jeton ; le test n’importe rien. |
| Reconnecter | Relance la liaison de compte/serveur. | Peut nécessiter validation Plex. |
| Synchroniser maintenant | Réconciliation incrémentale Plex ↔ Movviz : disponibilité, imports, épisodes changés. | Plex reste la source de vérité de présence fichier. |
| Rescan complet | Réconciliation exhaustive, notamment médias entièrement disparus de Plex. | Long sur grosse bibliothèque ; ne doit jamais supprimer une série Movviz automatiquement. |
| Sync automatique watchlist | Interrupteur global qui autorise ou coupe la tâche périodique pour tous les utilisateurs. | Les préférences individuelles ne peuvent pas la contourner. |
| Intros et génériques | Synchronise les marqueurs Plex pour les boutons passer intro/générique. | Affiche dernier passage et compteurs. |
| Langue audio préférée | Choisit la piste initiale ; Automatique suit la langue d’interface. | Réglage de lecture. |
| Lecteur bêta | Rend le lecteur intégré disponible sur l’instance. | Chaque utilisateur l’active ensuite dans son profil. |
| Cache segment | Nombre de secondes de vidéo préchargées ; 0 désactive. | Plus haut = mémoire/réseau supplémentaires. |
| Moteur de lecture | Auto (direct puis FFmpeg local), stable, natif/HLS, MSE, FFmpeg remux, HLS Plex manuel ou bêta manuel. | Auto est la voie recommandée ; HLS Plex est un repli manuel. |

#### Nommage

| Option/action | Effet réel |
|---|---|
| Renommage automatique | Active l’application des modèles aux téléchargements terminés. Désactivé conserve le nom de release. |
| Modèle dossier/fichier film | Construit destination et nom à partir des variables. |
| Modèle série/saison/épisode | Construit arborescence et nom d’épisode. |
| Variables | `{title}`, `{year}`, `{season:00}`, `{episode:00}`, `{episodeTitle}`, `{quality}`, `{resolution}`, `{source}`, `{videoCodec}`, `{audioCodec}`, `{hdr}`, `{group}`. |
| Points au lieu des espaces | Transforme le séparateur des modèles. |
| Réinitialiser / Enregistrer / Appliquer en masse | Restaure les modèles, persiste les changements ou applique le renommage aux éléments concernés. Appliquer en masse est une opération disque à confirmer. |

#### Importations et blocages

| Option/action | Effet réel |
|---|---|
| Listes Trakt / IMDb / Letterboxd | Ajoute une liste dont les titres sont synchronisés dans la bibliothèque. |
| Seerr : URL, clé, tester | Configure et vérifie une instance Seerr. |
| Importer les demandes Seerr | Recrée dans Movviz les demandes non refusées et les réattribue selon Plex/nom d’utilisateur. |
| Bloquer un titre | Empêche définitivement une demande/ajout jusqu’au déblocage. |
| Débloquer | Retire uniquement le blocage ; ne recrée pas de demande. |

### 10.5 Disque et maintenance

| Panneau/action | Effet réel | Danger / portée |
|---|---|---|
| Indexation Films/Séries — scan complet | Parcourt les dossiers et relie les fichiers réels aux entrées suivies ; actualise `diskPath`. | Lecture/analyse disque, pas de suppression. |
| Indexation incrémentale | Même objectif, limitée aux changements récents. | À préférer au quotidien. |
| Importer/indexer les orphelins | Propose les fichiers non liés, placés à la main ou migrés. | Vérifier les correspondances. |
| Récupérer téléchargements | Cherche les vidéos non importées dans le dossier temporaire et les déplace vers la bibliothèque. | Modifie des fichiers. |
| Réparer les chemins | Trouve un fichier portant le même nom ailleurs et met à jour le chemin stocké après confirmation. | Ne déplace/supprime rien par lui-même. |
| Supprimer dossiers vides | Analyse puis supprime les dossiers qui ne contiennent aucun fichier réel. | Destructif sur l’arborescence, confirmation requise. |
| Analyse technique Films/Séries | Lance `ffprobe` par fichier/épisode et met codec, HDR, audio et sous-titres en cache. | Long, mais pas de modification du média. |
| Corbeilles Films/Séries | Envoie les suppressions de média vers la corbeille avant purge définitive. | Configurer les chemins et la conservation ; la purge est planifiée. |

### 10.6 Notifications, diagnostics, observabilité et IA

| Zone | Options/actions | Utilité |
|---|---|---|
| Notifications | Discord, Telegram, Gotify, Slack, Pushbullet, Webhook ; champs de transport, Tester, Enregistrer. | Envoie les événements Movviz vers le canal configuré. Tester peut transmettre une notification test. |
| Diagnostics | Doctor Movviz / Analyser mon installation. | Diagnostic déclenché à la demande, jamais automatiquement ; propose des corrections. |
| Santé | État moteur, TMDb, indexeurs, processus et disque. | Observation, pas un réglage. |
| Performance | Benchmark de transcodage, latence UI/API sortantes, event loop, statistiques et actualisation. | Sert à diagnostiquer lenteurs et capacité de lecture. |
| Journaux | Logs de recherche, moteur, résolveur et transcodage ; filtres de niveau, actualiser, copier, vider. | « Vider » concerne le journal/cache concerné, pas les médias. |
| Automatisation | Planning, file, priorités, dernières/durées/prochaines exécutions des tâches. | Vue d’exploitation : qualité, indexeurs, Plex, metadata, RSS, disque, corbeille, benchmark, etc. |
| IA | Activer, fournisseur principal Mistral/OpenRouter/Gemini, fallback, web Mistral, modèle et clés multiples par fournisseur, tests, journal. | Les clés sont des secrets ; la recherche web élargit les données envoyées au fournisseur principal. |

### 10.7 Cache, version, sauvegarde et zone dangereuse

| Zone | Option/action | Effet réel / précaution |
|---|---|---|
| Visuels des cartes | Compléter le cache | Télécharge les fonds 16:9 et logos manquants de la bibliothèque. |
| Visuels des cartes | Rafraîchir incrémentalement | Vérifie une tranche quotidienne et restaure les fichiers absents, sans dupliquer les visuels présents. |
| Visuels des cartes | Vider tout / logos / affiches | Purge ciblée du cache persistant ; les cartes devront recharger/télécharger les fichiers manquants. |
| Cache API | Remplir le cache | Précharge les métadonnées de bibliothèque afin d’accélérer les écrans après redémarrage. |
| Cache API | Vider le cache d’un fournisseur | Efface uniquement les réponses de ce fournisseur (TMDb, OMDb, AlloCiné, YouTube Search...). N’efface pas les fichiers média ni Plex. |
| À propos | Configuration complète / optimisation intelligente | Relance le wizard ; le mode intelligent préserve les choix modifiés manuellement. |
| À propos | Réinitialisation complète | Efface tout le dossier de configuration et relance le wizard. Action majeure. |
| À propos | Mise à jour automatique / chercher une mise à jour | Gestion de mise à jour Windows ; Docker/NAS nécessitent le processus d’image. |
| À propos | Exporter/restaurer | Sauvegarde ou remplace la configuration entière. Restaurer exige une validation explicite et un fichier fiable. |
| Zone dangereuse | Effacer films/séries/historique/notifications/demandes/problèmes | Supprime les données Movviz ciblées, jamais Plex, fichiers ou moteur. |
| Zone dangereuse | Réinitialiser la synchro Plex | Oublie l’horodatage de synchronisation ; le prochain passage réconcilie complètement. |

## 11. Dépendances à rendre visibles dans la future UX

1. **Images, logos, recherche et Découverte** dépendent de TMDb ; OMDb et
   TVDB enrichissent seulement des cas précis.
2. **Ajout automatique** dépend successivement de la demande, des règles de
   qualité, d’un indexeur répondant, d’une instance de téléchargement et des
   chemins/noms configurés.
3. **Disponibilité d’un média** dépend de Plex ; Movviz conserve en revanche
   le suivi, les préférences et l’historique même si Plex ne voit plus le
   fichier.
4. **Lecture intégrée** dépend de Plex, du moteur choisi, des codecs du média,
   de FFmpeg et du cache segment ; le HLS est le repli manuel, pas la voie
   normale.
5. **Opérations de disque** (récupération, nettoyage, renommage, corbeille)
   doivent toujours indiquer le dossier concerné, le nombre de fichiers et le
   caractère réversible avant confirmation.
