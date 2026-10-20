# Mises à jour Windows

L'installateur enregistre deux services Windows automatiques sous SYSTEM :

- **Movviz** : interface web, API et démarrage des moteurs.
- **Movviz Update** (`MovvizUpdate`) : attend une demande de mise à jour. Il ne recherche et n'installe aucune release spontanément.

Le réglage de mise à jour automatique conserve son fonctionnement : désactivé,
seul un clic sur Installer déclenche une demande. L'interface attend le chargement
de ce réglage et le serveur le vérifie à nouveau pour les demandes automatiques.
Les demandes manuelles restent disponibles indépendamment de ce réglage.

L'API administrateur dépose uniquement une version dans
`%ProgramData%\MovvizUpdater`, accessible en écriture à SYSTEM et aux
administrateurs. Le service récupère la release officielle correspondante,
refuse les rétrogradations, vérifie la taille et l'empreinte SHA256 GitHub,
puis exécute l'installateur silencieux depuis son propre arbre de processus.
Il utilise PowerShell Windows ; la suppression de `app`, `runtime` et `service`
pendant l'installation ne touche donc pas son exécution.

Le wrapper `updater\movviz-updater.exe` porte un nom distinct, reste hors des
dossiers remplacés et n'est pas écrasé tant qu'il existe. Les scripts sont
chargés une fois au démarrage du service ; leur remplacement n'interrompt pas
le travail en cours et ils seront rechargés au prochain redémarrage du service.

L'installateur vérifie les codes de retour de l'enregistrement et du démarrage
des deux services. Le service Update attend ensuite que `/api/healthz` réponde
avec la version exacte demandée. L'interface garde l'état de progression jusqu'à
cette confirmation et affiche les erreurs remontées.

Diagnostic : `status.json`, les journaux WinSW et `setup-<version>-<date>.log`
restent dans `%ProgramData%\MovvizUpdater`. Une installation interrompue n'est
pas rejouée silencieusement au redémarrage. En cas d'échec, le service essaie de
relancer Movviz ; il ne restaure pas automatiquement une ancienne installation.
Les données de `%ProgramData%\Movviz` restent conservées.

Pour les installations antérieures à cette version, installer une fois la
nouvelle release manuellement afin de créer Movviz Update : l'ancien mécanisme
ne peut pas se réparer lui-même de manière fiable.

Vérifications : tests Node de la file et de l'API, sept scénarios PowerShell
avec réseau/installateur/services simulés, compilation réelle du script Inno
Setup avec charge utile inerte, puis build de production. Ces contrôles ne
remplacent pas un essai d'installation et de mise à jour sur une machine Windows
avec les deux services en fonctionnement. La CI de release effectue aussi cet
essai sur un runner jetable : installation réelle, simulation de métadonnées
d'une ancienne version, téléchargement de l'EXE publié et mise à jour complète.
Elle vérifie la version HTTP finale et que le PID du service Update ne change
pas pendant le remplacement de Movviz.
