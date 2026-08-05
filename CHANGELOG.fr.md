# Journal des modifications

Toutes les nouveautés notables de Movviz, regroupées par étape de développement.

---

## v1.12.72 — août 2026

### Mode Théâtre — un vrai lecteur immersif, pas une vidéo dans une fenêtre

- **Nouveau** : le lecteur Bêta s'ouvre désormais dans un véritable « Mode Théâtre » — la page en cours reste exactement où elle était derrière lui (scroll, état, tout est conservé), le lecteur s'étend depuis le bouton cliqué avec une vraie transition géométrique (pas un simple fondu), et la page derrière s'assombrit et se floute progressivement plutôt que de simplement disparaître.
- Toute bande-annonce ou aperçu en lecture à l'écran s'arrête à l'instant où le vrai lecteur s'ouvre — jamais deux vidéos en même temps.
- Le fond du lecteur adopte désormais une ambiance colorimétrique subtile extraite de l'affiche du titre (teintes dominantes, sensible à la luminosité) au lieu d'un noir plat — analysée une seule fois par titre puis mise en cache, jamais pendant la lecture.
- « Lire dans Plex » devient « Lire » partout où le lecteur Bêta gère réellement la lecture, et reste « Lire sur Plex » partout où c'est un vrai renvoi vers Plex — cohérent sur chaque carte de titre, la fiche détaillée, la page épisode et le grand visuel du tableau de bord (qui n'avait jusqu'ici aucune intégration avec le lecteur Bêta).
- Les trois copies séparées de cette logique de déclenchement dans l'application ne forment désormais plus qu'une seule implémentation partagée, fermant l'écart où un futur correctif aurait pu atterrir à un seul endroit et être oublié ailleurs.

### La fenêtre « nouveautés » suit désormais la langue de l'interface

- Les notes de version sont désormais localisées selon la langue de l'interface (repli sur l'anglais pour ce qui n'est pas encore traduit), au lieu d'un seul fichier dans une langue fixe.
- **Corrigé** : les notes de version étaient silencieusement absentes à la fois sur les builds Docker et Windows — le fichier dont elles sont lues n'était en réalité jamais inclus dans les deux builds packagés, donc la fenêtre « nouveautés » n'avait rien à afficher.

## v1.12.70 — août 2026

### Moteur de téléchargement — cause racine des téléchargements jamais liés

- **Corrigé, confirmé en conditions réelles** : la suppression d'un torrent dans le moteur de téléchargement était considérée comme réussie et effaçait tout son suivi (y compris le titre de bibliothèque auquel il était rattaché), même quand le client de téléchargement échouait silencieusement à réellement le supprimer — le torrent continuait de tourner et de partager sans interruption, mais le moteur n'en gardait plus aucune trace. C'est ce qui produisait des téléchargements qu'aucun scan de récupération ne pouvait jamais relier à un titre. Le moteur n'efface désormais son propre suivi qu'une fois la suppression confirmée de manière indépendante ; sinon, le torrent reste suivi et peut être réessayé au lieu de devenir orphelin de façon permanente.

## v1.12.51 – v1.12.69 — août 2026

Passe sur la précision de correspondance et la fiabilité du moteur : détection des packs intégrale (termes de plage de saisons, garde-fous anti-faux-positifs), récupération des téléchargements bloqués fiabilisée avec des déplacements atomiques sans écrasement et un callback d'import fiable, verrouillage d'écriture par série/film pour fermer une course qui pouvait faire perdre le statut d'un épisode terminé, et réconciliation des téléchargements en double pour qu'un fichier re-téléchargé ne laisse plus la bibliothèque bloquée sur le mauvais statut. Guide utilisateur mis à jour pour couvrir les fonctionnalités récemment livrées (modification de titre, versions de films, liaison des téléchargements non liés, réglages anime).

## v1.12.24 – v1.12.50 — août 2026

Recherche de packs intégrale (une seule requête, tenant compte des plages de saisons), fiabilité de la récupération des téléchargements (scan de dossier, correspondance de fichiers orphelins, nettoyage des doublons), suppression sécurisée des doublons, et une petite suite de tests automatisés pour le cœur de la correspondance de releases.

## v1.10.90 – v1.12.23 — juillet–août 2026

Flux de mise à niveau qualité (Optimiser / Ignorer, détection de mise à niveau significative), un système de badges résolution/codec repensé, des profils de performance GPU/animations, et une stabilisation du moteur sur l'ensemble des clients de téléchargement interchangeables (correctifs de plantage, règle anti-blocage, verrouillage de recherche par série).

## v1.10.39 – v1.10.89 — juillet 2026

Refonte du moteur de téléchargement avec des clients interchangeables (natif/aria2, WebTorrent, libtorrent), un outil de maintenance « récupérer les téléchargements » pour les fichiers orphelins, un système de notifications toast premium, des badges de codec audio, et des améliorations de lecture intégrée bêta (lecture directe, journalisation du transcodage).

## v1.10.12 – v1.10.17 — juillet 2026

Passe sur la précision de détection de langue : langue des pistes audio lue depuis Plex, les tags de variantes françaises (VF/VFQ/VFF/TRUEFRENCH) satisfont désormais correctement les profils de qualité, nettoyage des épisodes en double, et correction d'un abandon prématuré de torrent.

## v1.10.1 – v1.10.6 — juillet 2026

Decision Guard (application de la liste de mots bloqués avant téléchargement), détection de franchises/collections, file de téléchargement et tableau de diagnostic repensés, et affinements des bandes-annonces/calendrier.

## v1.8.0 – v1.9.9 — juillet 2026

Panneau de titre unifié (un seul composant pour les vues glissantes et plein écran), un filet de sécurité corbeille pour les titres supprimés, passe de réactivité mobile, et correction d'une fuite mémoire dans le cache de métadonnées.

## v1.4.5 – v1.7.9 — juillet 2026

Renforcement de la sécurité (traversée de chemin, protections base de données, alertes CodeQL), les dernières protections du système de corbeille, un lecteur intégré en direct, des mises à jour en temps réel dans toute l'interface, surveillance de l'activité Plex, et prise en charge des collections.

## v1.1.67 – v1.4.4 — juillet 2026

Lecteur intégré avec repli automatique vers le transcodage Plex, import des requêtes Overseerr (Seerr), builds Docker multi-architecture, et une réduction de la navigation des réglages de 26 à 18 onglets.

## v1.1.50 – v1.1.66 — juillet 2026

Sortie publique initiale : découverte TMDb, recherche sur indexeurs Torznab/Newznab, bibliothèque films/séries unifiée, requêtes multi-utilisateurs, moteur BitTorrent intégré, et synchronisation Plex — plus des correctifs de stabilité et de sécurité précoces (gestion de session, déduplication de la bibliothèque, mises à jour des dépendances).
