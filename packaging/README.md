# Déploiement de Movviz

Movviz se déploie sur trois cibles depuis le **même code**. Le serveur écoute
sur le port **9810** (interface + API) ; le moteur de téléchargement réserve le
port **9820**.

| Cible | Dossier | Service / démarrage auto | Redémarrage auto |
| --- | --- | --- | --- |
| Windows x64 | `windows/` | Service Windows (boot) | Oui (10 essais) |
| Linux x64 | `linux/` | Unité systemd (boot) | Oui (`on-failure`) |
| NAS / Docker | `docker/` | `restart: unless-stopped` | Oui |

Dans tous les cas, au démarrage de la machine le service lance le serveur Movviz,
dont le hook d'amorçage (`src/instrumentation.ts`) démarre automatiquement les
**instances de téléchargement marquées « démarrage auto »** — une par catégorie
(Films / Séries), chacune indépendante. Aucun lancement manuel n'est nécessaire.

---

## Windows

Dans une PowerShell **en administrateur**, à la racine du projet :

```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\install-service.ps1
```

Le script installe les dépendances, compile, assemble la sortie standalone et
enregistre le service **Movviz** (démarrage automatique au boot, redémarrage sur
erreur). Interface : <http://localhost:9810>.

Désinstaller : `npm run service:uninstall` (en administrateur).

---

## Linux (systemd)

À la racine du projet :

```bash
sudo ./packaging/linux/install.sh
```

Crée l'utilisateur système `movviz`, déploie dans `/opt/movviz`, installe l'unité
systemd et l'active.

```bash
systemctl status movviz      # état
journalctl -u movviz -f      # logs
sudo ./packaging/linux/uninstall.sh [--purge]
```

---

## NAS via Git + Docker

Sur le NAS (SSH), cloner le dépôt et lancer la stack :

```bash
git clone <url-du-depot-movviz> movviz
cd movviz
docker compose -f packaging/docker/docker-compose.yml up -d --build
```

Mise à jour :

```bash
cd movviz
git pull
docker compose -f packaging/docker/docker-compose.yml up -d --build
```

Ajuster le montage `/volume1/media:/media` dans `docker-compose.yml` selon le
partage média du NAS. Les données applicatives persistent dans le volume
`movviz-data`. Interface : `http://<ip-du-nas>:9810`.

---

## Ports

| Service | Port | Variable |
| --- | --- | --- |
| Interface + API | `9810` | `MOVVIZ_WEB_PORT` |
| Moteur (téléchargement) | `9820` | `MOVVIZ_ENGINE_PORT` |

## Stockage — où vont les fichiers

Movviz sépare deux racines, résolues **automatiquement selon la plateforme** et
toujours surchargeables par variable d'environnement :

| Racine | Rôle | Variable |
| --- | --- | --- |
| Config | config, base de données, état du moteur | `MOVVIZ_CONFIG_DIR` |
| Média | racine des téléchargements **et** de la médiathèque | `MOVVIZ_DATA_DIR` |

Emplacements par défaut :

| Plateforme | Config | Média |
| --- | --- | --- |
| Windows (service) | `%ProgramData%\Movviz` | `%ProgramData%\Movviz\data` |
| Linux (service) | `/var/lib/movviz` | `/var/lib/movviz/data` |
| NAS / Docker | `/config` | `/data` |
| Développement | `./.movviz-data` | `./.movviz-data` |

Sous la racine média, Movviz range :

```
<MÉDIA>/torrents/movies   ← téléchargements films (en cours)
<MÉDIA>/torrents/tv       ← téléchargements séries (en cours)
<MÉDIA>/media/movies      ← médiathèque films (terminés)
<MÉDIA>/media/tv          ← médiathèque séries (terminés)
```

> **Important — un seul volume.** Les dossiers `torrents` et `media` sont sous la
> **même** racine exprès : une fois un téléchargement terminé, l'import est un
> **déplacement instantané** (rename) au lieu d'une copie lente. Ne les séparez
> pas sur deux volumes différents.

### Mapping NAS (Docker)

Sur un NAS, on monte **une seule** part pour tout le média + une pour la config :

```yaml
volumes:
  - ./config:/config          # config de l'app (petit)
  - /volume1/data:/data        # UNE part média (Synology : /volume1/...,
                               #                 QNAP : /share/...)
```

Movviz crée alors tout seul `/data/torrents/{movies,tv}` et
`/data/media/{movies,tv}` à l'intérieur. Adaptez `/volume1/data` au chemin réel
de votre part NAS. Réglez `PUID`/`PGID` sur l'utilisateur propriétaire de la part.

### Changer le dossier de téléchargement

- **Windows / Linux (service)** : modifiez `MOVVIZ_DATA_DIR` dans le service
  (`packaging/windows/installer/movviz-service.xml` ou
  `packaging/linux/movviz.service`), p. ex. `D:\Media` ou `/mnt/media`, puis
  redémarrez le service.
- **NAS** : changez le mapping `- /votre/part:/data` dans `docker-compose.yml`.
- **Par instance** : chaque catégorie (Films / Séries) garde ses propres
  `downloadPath` / `completedPath`, visibles dans Réglages.
