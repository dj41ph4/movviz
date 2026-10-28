# UGREEN UPK

Le tag GitHub `vX.Y.Z` déclenche le workflow `Build UGREEN UPK`. Il construit
les images AMD64 et ARM64 à partir du Dockerfile Movviz existant, les exporte
dans des UPK officiels avec `ugcli`, puis joint les deux fichiers à la même
GitHub Release que les APK Android et les autres assets.

À l'installation, choisir deux dossiers persistants : `CONFIG_PATH` pour l'état
et la base, `DATA_PATH` pour téléchargements et bibliothèque. Les films, séries
et torrents restent sous une **unique racine média** afin de permettre les
déplacements instantanés de fichiers. Renseigner le PUID/PGID d'un compte ayant
accès en écriture à ces dossiers. Ne pas pointer sur un dossier temporaire de
l'application UGOS.

L'application utilise la suite Docker UGOS Pro (`com.ugreen.docker`, version
minimale déclarée `1.7.0.0000`). Ports : web 9810, moteur 9820, résolveur 9830,
pairs BitTorrent TCP/UDP 55000 et 55001. Une installation peut échouer si ces
ports sont déjà utilisés. Une mise à jour conserve les dossiers sélectionnés.

Le build officiel se fait sur GitHub Actions. Pour déboguer, il faut Docker,
Buildx, Node 22 et l'outil officiel `ugcli` 1.1.0.25 :

```sh
bash packaging/ugreen/build.sh amd64
bash packaging/ugreen/build.sh arm64
```

Le contrôle `ugcli check` est obligatoire avant `ugcli pack`. Les tests
d'installation, de redémarrage, de mise à jour et de persistance doivent encore
être effectués sur un appareil UGOS Pro réel avant de garantir un modèle précis.

Documentation : https://developer.ugnas.com/doc/backend/quick-start/develop-docker-app.html
