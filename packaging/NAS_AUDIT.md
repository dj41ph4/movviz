# Audit préalable NAS (28 octobre 2026)

- Source de version : `package.json` (1.27.79 à l'audit), tags `vX.Y.Z`.
- Node : 22 dans Docker et dans le workflow Linux ; Next.js 16.3.8 dans le
  manifeste. `next.config.ts` active déjà `output: "standalone"`.
- Build : `npm run build` vérifie les changelogs, compile Next, construit le
  worker Plex et nettoie le standalone. Démarrage : `node server.js` ; le hook
  `src/instrumentation.ts` démarre le moteur WebTorrent et le résolveur si
  nécessaire.
- Docker : `packaging/docker/Dockerfile` et `docker-compose.yml`. Ports web
  9810, moteur 9820, résolveur 9830, torrent 55000/55001 TCP+UDP. Image
  Node 22 Alpine, FFmpeg, FFprobe, fontes et `su-exec`.
- Persistance : `MOVVIZ_CONFIG_DIR=/config`, `MOVVIZ_DATA_DIR=/data`. La
  racine média contient `torrents/{movies,tv}` et `media/{movies,tv}` ; la
  configuration contient JSON et `node:sqlite`. Les médias et téléchargements
  doivent être sur le même volume pour les déplacements atomiques.
- Dépendances natives : `sharp` dans le standalone Next, `node-datachannel`
  dans WebTorrent ; `utp-native`, `bufferutil`, `utf-8-validate` et
  `fs-native-extensions` sont optionnels dans le moteur. Aucun module Windows
  ne doit entrer dans un paquet NAS.
- Services externes : FFmpeg/FFprobe sont nécessaires aux fonctions de
  transcodage, remux et analyse ; Playwright/Chromium au résolveur Cloudflare.
  Les autres outils cités dans le plan (yt-dlp, unrar, 7z, aria2, rclone) ne
  constituent pas des dépendances obligatoires directes identifiées dans ce
  parcours du serveur et du moteur.
- GitHub Actions : les workflows Android, Linux, Tizen et extension joignent
  déjà leurs assets à la même release de tag. Le workflow Docker existant se
  déclenche sur `main` et publie sur Docker Hub ; aucun fichier de cette
  plateforme n'est modifié ici.
- UGREEN : l'UPK documenté par UGREEN enveloppe une image Docker exportée et
  supporte AMD64/ARM64. Le test `ugcli check` ne prouve pas l'installation.
- Synology : DSM attend `INFO`, `package.tgz`, `scripts`, `conf/privilege` et
  les deux icônes. La table officielle utilise `x86_64` et `armv8`, pas
  `aarch64` comme valeur `INFO`. Les modules natifs, FFmpeg et Playwright sont
  les principaux risques de compatibilité réelle.
