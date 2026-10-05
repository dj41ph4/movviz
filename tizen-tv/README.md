# Movviz — Samsung Tizen TV

Premier jalon du portage du client Android TV. Cible provisoire : Samsung génération 2024 (Tizen 8 / Chromium 108), build JavaScript ES2020, manifeste Tizen 6 minimum. La version minimale du manifeste ne constitue pas une validation des modèles plus anciens.

## Fonctions livrées dans ce premier jalon

- Configuration du serveur puis écran de connexion NX : compte Movviz ou Plex par code/QR, expiration et annulation de l’appairage, session persistante et déconnexion serveur.
- Sélection et changement de profils déjà connectés, chacun avec sa propre session vérifiée par le serveur ; aucun changement de compte fondé sur un identifiant seul.
- Accueil avec Reprendre et ajouts récents, bibliothèque films/séries, découverte, recherche et fiche titre unique dans ce client.
- Saisons/épisodes disponibles avec vignettes, distribution et filmographies, statut vu/non vu, ajout/demande de titres et recherche automatique, profil et listes personnelles, file des téléchargements.
- Filtres texte/tri de bibliothèque conservés. Le client Samsung suit l'interface NX TV : aucun assistant IA, bouton flottant ni accès au chat.
- Navigation directionnelle, retour avec restauration du focus et du scroll, touches multimédias.
- Intégration AVPlay : ouverture authentifiée, pause, seek, arrêt, fin, reprise et heartbeats de progression ; choix audio/sous-titres replanifié par le serveur, épisode suivant manuel et automatique. Profil SDR H.264/AAC 1080p conservateur ; seek des flux remux/transcodés via redémarrage serveur et maintien d’une horloge globale.
- Traductions françaises, anglaises, allemandes, italiennes et néerlandaises issues des dictionnaires Movviz.

Le profil vidéo limite volontairement les capacités déclarées. HEVC, HDR, 4K, DTS/passthrough, qualité sélectionnable et marqueurs ne sont pas encore portés. Les sous-titres sont traités côté serveur, avec les mêmes limites de source que son moteur (certaines sources distantes ne permettent pas le burn-in). AVPlay n'a pas encore été testé sur une TV physique. L'intégration de la reprise conserve les règles serveur (notamment les épisodes vus à 80 %) ; elle ne remplace pas ces règles par une règle locale.

Restent à porter/valider : bandes-annonces, collections, filtres/pagination avancés, toutes les préférences de lecture, voix et marqueurs. Le rendu reprend les sources et captures NX (palette, Roboto, rail 63/156 dp, hero 340 dp, cartes 99/203 dp, login 300 dp, overlay Plex 525 dp à 1080p). Une inspection navigateur avec données de démonstration ne prouve ni une connexion Plex réelle ni AVPlay. Ce jalon ne revendique pas la parité complète Android TV.

## Build

Depuis la racine du dépôt, après `npm ci` :

```sh
npm run tizen:build
npm run tizen:preview
```

Le build vérifie les types du client, extrait les cinq dictionnaires, reprend la version de `package.json`, assemble les ressources statiques et crée une archive reproductible :

- `tizen-tv/dist/Movviz-Samsung-Tizen-client-unsigned.wgt`
- son fichier SHA-256.

L'aperçu est disponible sur `http://127.0.0.1:9820`. Il permet de vérifier les écrans et la navigation ; la lecture AVPlay exige une TV Samsung. Il faut un serveur Movviz incluant la route `/api/tv/client`, donc au minimum la release contenant ce portage.

## Authentification et lecture

L'application installée possède sa propre origine. Elle appelle uniquement la passerelle `/api/tv/client`, qui ignore les cookies du navigateur, exige une session d'appareil explicite et délègue à une liste fermée de routes existantes avec leurs gardes d'accès. Aucun proxy vers une URL libre et aucune autorisation fondée sur un identifiant utilisateur fourni par l'application.

La connexion renvoie uniquement la session Movviz et l'utilisateur public ; aucun mot de passe ni jeton Plex n'est persisté dans le client. La session est stockée dans le stockage local de l'application et révoquée lors de la déconnexion. Utiliser HTTPS quand le serveur est exposé hors du réseau local.

AVPlay reçoit le cookie de session via `setStreamingProperty("COOKIE", ...)` avant `prepareAsync`. Le flux reste servi par les routes Movviz authentifiées. Les sessions moteur et progression sont identifiées séparément et arrêtées séparément ; aucun secret n'est inséré dans l'URL du média.

## GitHub et releases

Le workflow `.github/workflows/tizen-tv-build.yml` s'exécute sur les tags `v*`, les PR pertinentes et manuellement. Il vérifie les types et les tests d'authentification, construit le `.wgt`, vérifie l'archive et son digest, puis joint les fichiers à la même release que les autres clients.

Sans certificats, il publie uniquement le paquet **explicitement non signé**, à signer avant installation. Il ne présente pas cet artefact comme installable tel quel.

Pour activer la signature CI, ajouter les quatre secrets GitHub suivants :

| Secret | Contenu |
|---|---|
| `MOVVIZ_TIZEN_AUTHOR_P12_B64` | Certificat auteur Samsung `.p12`, encodé en base64 |
| `MOVVIZ_TIZEN_AUTHOR_PASSWORD` | Mot de passe du certificat auteur |
| `MOVVIZ_TIZEN_DISTRIBUTOR_P12_B64` | Certificat distributeur Samsung TV `.p12`, encodé en base64 |
| `MOVVIZ_TIZEN_DISTRIBUTOR_PASSWORD` | Mot de passe du certificat distributeur |

Le workflow installe la CLI Tizen officielle, utilise les deux certificats et publie également `Movviz-Samsung-Tizen-client.wgt`. Une configuration partielle échoue explicitement. Le certificat distributeur de développement doit autoriser le DUID de la TV cible ; un paquet signé pour une autre TV n'est pas automatiquement installable sur la tienne. La branche de signature n'est pas validée tant qu'un build signé n'a pas réussi.

## Installation sur Samsung

Créer/importer les certificats Samsung TV avec le DUID du téléviseur, activer son mode développeur et autoriser l'ordinateur de développement. Pour signer le paquet non signé avec une CLI locale et un profil déjà configuré :

```sh
tizen package -t wgt -s MON_PROFIL -- tizen-tv/dist/Movviz-Samsung-Tizen-client-unsigned.wgt
```

Installer et lancer le paquet signé via Tizen Studio ou la CLI (remplacer `TV_SERIAL` par le numéro réellement listé par `sdb devices`) :

```sh
tizen install -s TV_SERIAL -n Movviz-Samsung-Tizen-client.wgt -- DOSSIER_DU_PAQUET_SIGNE
tizen run -s TV_SERIAL -p MovvizTvNx.Movviz
```

Le nom du fichier produit lors d'une signature locale peut différer : utiliser le nom réel pour `tizen install`. Ne jamais committer les certificats, leurs mots de passe ou `profiles.xml`.

Références : [AVPlay](https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html), [CLI Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html), [certificats](https://developer.samsung.com/smarttv/develop/tools/additional-tools/vscode/creating-certificates.html).
