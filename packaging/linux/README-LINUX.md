# Movviz pour Linux

Cette archive contient Movviz **déjà compilé** pour Linux x64, son moteur de
téléchargement, l'installateur, le désinstallateur et le service systemd. Il
n'est pas nécessaire de cloner le dépôt ni de compiler l'application.

## Installation en trois commandes

```bash
tar -xzf movviz-linux-x64.tar.gz
cd movviz
sudo ./packaging/linux/install.sh
```

L'installateur affiche ce qu'il va faire et demande confirmation. Une fois le
service démarré, ouvrez :

```text
http://ADRESSE_IP_DU_SERVEUR:9810
```

## Ce que l'installateur configure

| Élément | Valeur |
|---|---|
| Application | `/opt/movviz/.next/standalone` |
| Configuration et état | `/var/lib/movviz` |
| Médias par défaut | `/var/lib/movviz/data` |
| Service | `movviz.service` |
| Interface et API | port TCP `9810` |
| Moteur local | port TCP `9820` |
| Compte système | `movviz:movviz` |

Vous ne devez créer **aucun utilisateur Linux manuellement**. L'installateur
crée le compte système `movviz` avec un shell désactivé. Ce n'est pas un compte
humain : il sert uniquement à exécuter l'application sans privilèges root.

Les comptes administrateur et utilisateur de Movviz se créent ensuite depuis
l'interface web. Ils sont indépendants du compte système Linux.

## Prérequis

- Linux x64 avec `systemd` ;
- Node.js 22 ou plus récent dans `/usr/bin/node` ;
- accès administrateur via `sudo` ;
- ports `9810` et `9820` libres.

Vérification rapide :

```bash
node --version
systemctl --version
```

L'installateur tente d'ajouter automatiquement `aria2` et `ffmpeg` avec le
gestionnaire de paquets disponible. Sans FFmpeg, l'interface fonctionne mais
le remux et le transcodage locaux ne sont pas disponibles.

## Première ouverture

Depuis le serveur :

```text
http://localhost:9810
```

Depuis le réseau local :

```text
http://ADRESSE_IP_DU_SERVEUR:9810
```

Si un pare-feu bloque l'interface :

```bash
# Ubuntu / Debian
sudo ufw allow 9810/tcp

# Fedora / Rocky Linux
sudo firewall-cmd --permanent --add-port=9810/tcp
sudo firewall-cmd --reload
```

Le port `9820` est réservé au moteur local et ne doit normalement pas être
exposé sur Internet.

## Utiliser un disque ou un NAS

Pour stocker les médias ailleurs que dans `/var/lib/movviz/data`, modifiez
`/etc/systemd/system/movviz.service` :

```ini
Environment=MOVVIZ_DATA_DIR=/mnt/media
```

Si Movviz peut devenir propriétaire du dossier :

```bash
sudo chown -R movviz:movviz /mnt/media
```

Si le dossier appartient déjà à un groupe partagé, conservez son propriétaire
et autorisez le compte `movviz` via ce groupe :

```bash
sudo usermod -aG media movviz
sudo chmod -R g+rwX /mnt/media
```

Appliquez ensuite la configuration :

```bash
sudo systemctl daemon-reload
sudo systemctl restart movviz
```

Pour un montage SMB ou NFS, le partage doit être monté avant le démarrage de
Movviz. Vérifiez l'accès réel avec :

```bash
sudo -u movviz test -w /mnt/media && echo "Écriture autorisée"
```

## Mettre Movviz à jour

Téléchargez et extrayez la nouvelle archive, puis relancez son installateur :

```bash
cd movviz
sudo ./packaging/linux/install.sh
```

Choisissez **Mettre à jour**. Le contenu de `/var/lib/movviz` — utilisateurs,
réglages, bibliothèque et données — est conservé. L'installateur présent dans
`/opt/movviz/.next/standalone` peut aussi rechercher la dernière release.

## Administrer le service

```bash
sudo systemctl status movviz                # état
sudo systemctl restart movviz               # redémarrage
sudo systemctl stop movviz                  # arrêt
sudo journalctl -u movviz -f                # logs en direct
sudo journalctl -u movviz -n 200 --no-pager # derniers logs
```

## Vérifier l'archive

La release contient un fichier `movviz-linux-x64.tar.gz.sha256`. Placez-le à
côté de l'archive, puis exécutez :

```bash
sha256sum -c movviz-linux-x64.tar.gz.sha256
```

## Désinstaller

Conserver la configuration et les médias :

```bash
sudo ./packaging/linux/uninstall.sh
```

Supprimer également `/var/lib/movviz` :

```bash
sudo ./packaging/linux/uninstall.sh --purge
```

L'option `--purge` est définitive. Utilisez-la uniquement après avoir vérifié
vos sauvegardes.

## Dépannage

### Le service ne démarre pas

```bash
sudo systemctl status movviz --no-pager
sudo journalctl -u movviz -n 200 --no-pager
command -v node
node --version
```

Le service attend Node dans `/usr/bin/node`. Si votre distribution l'installe
ailleurs, adaptez `ExecStart` dans `/etc/systemd/system/movviz.service`, puis :

```bash
sudo systemctl daemon-reload
sudo systemctl restart movviz
```

### L'interface reste inaccessible

```bash
ss -lntp | grep 9810
sudo systemctl status movviz --no-pager
```

Vérifiez ensuite le pare-feu et l'adresse IP du serveur. Pour un accès distant,
préférez un VPN ou un reverse proxy HTTPS correctement protégé ; n'exposez pas
directement Movviz sur Internet.

### Movviz ne peut pas écrire sur le disque média

```bash
sudo -u movviz test -w /chemin/des/medias && echo "Écriture autorisée"
```

Si le message ne s'affiche pas, corrigez le propriétaire, le groupe ou les
options de montage avant de redémarrer le service.
