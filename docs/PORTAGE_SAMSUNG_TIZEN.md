# Portage Movviz Android TV vers Samsung Tizen

Date : 4 octobre 2026. État : premier jalon implémenté dans `tizen-tv/`, build local et pipeline GitHub ajoutés. Parité complète et validation sur TV physique encore ouvertes. Voir `tizen-tv/README.md` pour distinguer les fonctions livrées et restantes.

## Objectif

Créer un client Samsung TV installable, avec la parité fonctionnelle du client `android-tv-nx`. Conserver le serveur Movviz, les comptes, les droits et les données existants. Le portage concerne l'application cliente ; le moteur de téléchargement continue de fonctionner sur le serveur.

La référence fonctionnelle est le code Android TV actuel, pas une ancienne capture d'écran. Kotlin, Compose, ExoPlayer et les mécanismes d'installation APK ne sont pas exécutables dans une application Web Tizen.

## Architecture proposée

- Module isolé `tizen-tv/`, application Web locale packagée en `.wgt`.
- Premier jalon : TypeScript et DOM compilés en ressources statiques ES2020, QR généré localement, police et ressources embarquées. Génération 2024 supposée d'après l'âge de la TV indiqué par l'utilisateur ; modèle exact encore inconnu. Le serveur Next.js continue de tourner sur le serveur Movviz.
- Un dépôt d'accès aux API, un routeur conservant historique/scroll/focus, un gestionnaire de navigation directionnelle et un adaptateur AVPlay.
- Une seule implémentation de fiche titre dans le client Tizen, utilisée depuis toutes les destinations. Ne pas copier ou modifier `TitleContent.tsx` et ne pas altérer la page détail web ni son panel.
- Reprendre les contrats REST, les identités de médias et les règles du serveur. Ne pas créer un second système d'historique ou de statut vu.
- Réutiliser les dictionnaires existants `en/fr/de/it/nl` au build ; toute nouvelle clé doit être ajoutée dans les cinq langues.
- Aucun SDK Samsung ni fichier de signature dans le paquet navigateur de Movviz. Les certificats et mots de passe restent hors du dépôt.

## Inventaire de parité

| Fonction | Référence Android / API vérifiée | Travail Tizen |
|---|---|---|
| Configuration serveur | `WizardScreen.kt`, `/api/system/changelog` | Saisie à la télécommande, validation, stockage et changement de serveur |
| Connexion compte / Plex | `LoginScreen.kt`, `/api/auth/login`, `/api/auth/plex/tv-pin`, `/api/auth/plex/poll`, `/api/auth/me` | Transport de session compatible Tizen, code Plex, erreurs et compte en attente |
| Profils du foyer | `ProfilePickerScreen.kt`, `/api/tv-profiles`, `/api/users` | Sélection et gestion du foyer selon droits ; vérifier le vrai mécanisme de changement de compte |
| Accueil | `HomeScreen.kt`, `/api/interface/dashboard`, `/api/dashboard/hero`, `/api/dashboard/layout`, `/api/plex/on-deck` | Hero, rangées personnalisées, reprise, disponibilité et restitution du focus |
| Bibliothèque | `LibraryScreen.kt`, `CatalogScreen.kt`, `/api/library/movies`, `/api/library/series` | Films/séries, tri, filtres, manquants et collections ; relever également le contrat réel des collections |
| Découverte | `DiscoverScreen.kt`, `RowDetailScreen.kt`, `/api/metadata/rows`, `/api/metadata/row-page`, `/api/metadata/genres`, `/api/metadata/discover`, `/api/metadata/logos` | Rangées, voir tout, pagination, genres, plateformes et studios |
| Recherche | `SearchScreen.kt`, `/api/metadata/search` | Clavier TV, debounce, annulation des réponses obsolètes, films/séries |
| Fiche titre | `TitleDetailScreen.kt`, `/api/metadata/detail`, `/api/library/series/{id}`, `/api/metadata/season`, `/api/watch-status` | Une fiche unique, saisons, épisodes, actions autorisées, disponibilité et statut vu |
| Acteurs et bandes-annonces | `PersonScreen.kt`, `TrailerOverlay.kt`, `/api/metadata/person`, `/api/tv/preview` | Filmographie et lecture des sources compatibles ; vérifier le repli YouTube sur la TV cible |
| Ajout / recherche de fichiers | POST bibliothèque, routes `.../search` et `.../season/{season}/search` | Actions identiques, erreurs, permissions et suivi serveur |
| Téléchargements | `DownloadsScreen.kt`, `/api/activity/v2?tab=queue` | Affichage et rafraîchissement de la file ; téléchargements exécutés côté serveur |
| Profil et historique | `ProfileScreen.kt`, `/api/profile/media`, `/api/playback/continue-watching` | Compteurs serveur, vus/en cours, ouverture du bon épisode |
| Paramètres | `SettingsScreen.kt`, `/api/settings/preferences`, `/api/auth/logout` | Préférences de lecture, langues, connexion et déconnexion réelle |
| Lecteur | `PlayerActivity.kt`, routes stream / playback | AVPlay, reprise, pause/seek, pistes audio/sous-titres, qualité, marqueurs et épisode suivant |
| Mise à jour / cycle de vie | `UpdateOverlay.kt`, `UpdateReceiver.kt`, `MainActivity.kt` | Remplacer le mécanisme APK par une procédure Samsung ; gérer veille, reprise et sortie |

Chaque ligne doit recevoir une preuve d'intégration avant de déclarer la parité complète. Cet inventaire n'affirme pas que les fonctions sont déjà portées.

## Adaptations serveur à traiter explicitement

### Authentification

`requireUser()` accepte actuellement le cookie de session ou un jeton personnel `Authorization: Bearer`. Les routes de connexion renvoient l'utilisateur public et posent un cookie `HttpOnly; SameSite=Lax`. Le client Android bénéficie d'un cookie jar natif ; une application Web Tizen locale ne bénéficie pas automatiquement du même transport.

Valider sur le modèle cible l'origine de l'application, les cookies et les prérequêtes CORS. Si une authentification dédiée aux appareils est nécessaire, utiliser un appairage avec validation authentifiée côté serveur, secret temporaire, expiration et révocation. Ne pas transformer globalement les cookies en `SameSite=None`, ajouter `Access-Control-Allow-Origin: *` avec credentials, exposer le jeton Plex ou faire confiance à un identifiant utilisateur envoyé par le client.

Les jetons personnels actuels (`/api/profile/tokens`) constituent une possibilité technique, mais leur présence ne résout pas automatiquement le login, les profils ni le transport AVPlay. Ne pas placer un jeton permanent dans une URL de flux. Vérifier l'authentification de chaque requête média et segment, y compris lors d'un seek.

### Capacités de lecture

`src/lib/playback/engine/clientProfile.ts` déclare maintenant aussi `samsung-tizen`. Le client envoie ce type à `/api/playback/prepare` ; les sessions restent propres à leur utilisateur et appareil.

Ne pas annoncer HEVC, HDR, DTS, passthrough, 4K ou sous-titres natifs par simple déduction « TV Samsung ». Déterminer les capacités à partir du modèle, des API disponibles, des spécifications Samsung et de tests matériels. Prévoir le remux ou transcodage serveur lorsque nécessaire ; ne pas reprendre le profil ExoPlayer Android.

### Deux sessions distinctes

Le code actuel expose une session moteur créée par `/api/playback/prepare`, et une session de progression créée par `/api/playback/sessions`. Les identifier séparément : leurs identifiants ne sont pas interchangeables.

Le flux remux/transcodage `/api/playback/session/{sessionId}/stream` vérifie l'utilisateur propriétaire. Un identifiant de session seul ne donne pas accès aux octets. La réponse prepare contient actuellement des objets `markers` et `resume` vides : le client doit charger les informations de progression/marqueurs par le contrat approprié, et ne pas considérer ces objets comme suffisants.

## Flux à vérifier de bout en bout

1. Connecter un vrai utilisateur et confirmer son identité côté serveur.
2. Ouvrir un vrai film de sa bibliothèque ; récupérer son identité Movviz et sa source disponible.
3. Construire le profil matériel Samsung et préparer la lecture ; ouvrir la session de progression avec la durée réelle.
4. Faire lire le flux authentifié par AVPlay ; appliquer la reprise, envoyer les heartbeats et notifier les seeks.
5. Arrêter, libérer AVPlay et arrêter les ressources serveur appropriées ; rouvrir et vérifier la position réelle.
6. Refaire avec un épisode local puis un épisode Plex dans une même série : la présence locale de la série ne détermine pas la source de chaque épisode (`EpisodePlaybackTarget.kt`).
7. Vérifier le passage vu à 80 % pour les épisodes avec le minimum de lecture réelle imposé par `progressPolicy.ts`, puis la reprise de l'épisode en cours ou du premier épisode disponible non vu dans l'ordre saison/épisode.
8. Changer de profil et confirmer que progression, historique et recommandations ne fuient pas entre comptes.

Les noms de films et épisodes de validation doivent être choisis dans la bibliothèque réellement accessible ; aucun test matériel n'a été exécuté pendant cet audit.

## Ordre d'implémentation

1. Identifier modèle/année/firmware, version Tizen, accès développeur et serveur de test. Arrêter la cible de compilation et la matrice codecs.
2. Créer le module isolé, manifeste, build et aperçu navigateur ; connexion réelle, profils et télécommande.
3. Porter accueil/bibliothèque/découverte/recherche, fiche unique, saisons, personnes et collections avec conservation de navigation.
4. Intégrer AVPlay et le transport média authentifié ; sessions, reprise, pistes, qualité, marqueurs et lecture suivante.
5. Porter profil, téléchargements, préférences et actions de bibliothèque. Aucun assistant IA dans le client Samsung, conformément à l'interface NX TV demandée.
6. Vérifier les cinq langues, échecs réseau, permissions, veille/reprise et changements de profil.
7. Générer un `.wgt` signé, installer sur Samsung, effectuer les scénarios réels et compléter la matrice de parité ; ajouter le pipeline de release une fois la signature maîtrisée.

## Critères de livraison

- Build et typecheck du client, validation du manifeste et contrôles serveur pertinents.
- Navigation entièrement utilisable à la télécommande, sans souris : focus visible, retour cohérent, clavier TV, restauration du scroll et dialogues accessibles.
- Lecture locale et Plex réelle, début/reprise/seek/fin, audio et sous-titres, compatibilité et repli serveur vérifiés sur la TV cible.
- Aucun changement involontaire aux données, droits, sync Plex, client web ou Android TV.
- Certificat Samsung et package `.wgt` installables ; preuves séparées pour compilation, signature, installation et exécution.
- Aucune annonce « portage complet » si une ligne de parité ou un test matériel requis reste ouvert.

## Informations manquantes lors de l'audit

Modèle exact et année de la Samsung, firmware/version Tizen, possibilité d'activer le mode développeur, serveur de test accessible et certificat de signature associé à la TV. Les commandes `tizen` et `sdb` n'ont pas été trouvées dans le PATH ; cela ne prouve pas l'absence d'une installation ailleurs.

## Sources Samsung

- [Versions des moteurs Web par année de TV](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html)
- [Lecture avec AVPlay](https://developer.samsung.com/smarttv/develop/guides/multimedia/media-playback/using-avplay.html)
- [Référence AVPlay](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html)
- [Configuration des applications Web](https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html)
- [Test des applications sur TV](https://developer.samsung.com/smarttv/develop/faq/application-testing.html)
- [Création des certificats Samsung](https://developer.samsung.com/smarttv/develop/tools/additional-tools/vscode/creating-certificates.html)
