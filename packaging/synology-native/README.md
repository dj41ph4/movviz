# Synology SPK natif

Le workflow `Build Synology native SPK` vise DSM 7.2+ avec deux familles de
processeurs indiquées par Synology : `x86_64` et `armv8`. Il utilise la sortie
Next.js standalone et les dépendances du moteur construites sur le runner
GitHub de chaque architecture. Le SPK démarre directement Node.js ; il ne
dépend pas de Container Manager ni de Docker. Il déclare une dépendance au
paquet officiel Synology `Node.js_v22`.

L'interface utilise le port 9810 ; les services internes 9820 et 9830, et les
ports torrent 55000 et 55001, doivent rester disponibles. L'état et les
téléchargements sont placés dans `/var/packages/movviz/var`. Le compte de
service DSM doit recevoir les permissions d'accès aux dossiers partagés via
**Panneau de configuration > Dossier partagé > Permissions > Utilisateur système
interne**. Aucun `chmod -R` n'est exécuté sur les médias.

Le build local est seulement un outil de diagnostic : après `npm ci`, `npm ci`
dans `engine/` et `npm run build`, exécuter
`bash packaging/synology-native/build.sh x86_64` sur Linux AMD64 ou `armv8`
sur Linux ARM64. Le build officiel est assuré par GitHub Actions.

**Limites à valider sur DSM réel avant installation de production :** les
modules natifs du moteur WebTorrent ont été construits dans l'environnement du
runner GitHub, pas avec la toolchain DSM ; leur compatibilité ABI/glibc doit
être prouvée sur un NAS. FFmpeg/FFprobe et le navigateur Playwright du
résolveur ne sont pas embarqués dans ce premier SPK. Les fonctions qui en
dépendent ne sont donc pas garanties. La conservation de `var` lors d'une
désinstallation dépend du comportement DSM et doit être vérifiée. Le SPK doit
être considéré comme expérimental jusqu'aux essais installation, démarrage,
arrêt, mise à jour, désinstallation et permissions sur un NAS.

Documentation : https://help.synology.com/developer-guide/synology_package/introduction.html
