# Récupération automatique

L'image Docker lance un superviseur indépendant du serveur web. Il interroge
`/api/healthz` toutes les 30 secondes, avec un délai de réponse de 10 secondes.
Après une grâce de 10 minutes au démarrage, 5 minutes d'échecs continus
déclenchent une relance du serveur web. Une réponse saine annule le compteur.
Le superviseur attend 30 secondes après SIGTERM avant de forcer l'arrêt.
Les relances sont espacées d'au moins 15 minutes et limitées à 3 par heure.
Une sortie spontanée du serveur est aussi récupérée, avec ces mêmes limites.
Les décisions sont visibles dans les logs sous `[watchdog]`.

Le worker de sauvegarde JSON dispose de 2 minutes par tâche, attente comprise.
Une tâche expirée en attente est retirée de la file. Un worker actif bloqué
est arrêté puis remplacé avant de libérer le verrou d'écriture du fichier.
La sauvegarde échouée est réessayée après 30 secondes avec la dernière valeur
en mémoire. Après 5 minutes d'échec de persistance, `/api/healthz` répond 503 :
le superviseur peut donc intervenir si la récupération locale ne suffit pas.

La RAM élevée seule, les erreurs TMDb et les erreurs Plex ne déclenchent pas
de relance. Les moteurs de téléchargement déjà démarrés restent séparés du
serveur web et gardent leur sortie de logs lors de sa relance. Le superviseur
n'a pas accès au socket Docker et ne redémarre pas le conteneur.

Pour activer ce mécanisme, construire et déployer la nouvelle image ; il
n'est pas ajouté aux conteneurs existants par une modification des sources.
Le compose fourni utilise désormais `/api/healthz` pour sa sonde sans connexion.
En cas de gel complet imposant SIGKILL, les changements non enregistrés peuvent
être perdus ; les fichiers enregistrés restent protégés par le remplacement
atomique. Un disque plein ou défaillant nécessite toujours une intervention.
