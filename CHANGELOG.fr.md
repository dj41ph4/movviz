# Journal des modifications

Toutes les nouveautés notables de Movviz, regroupées par étape de développement.

---

## v1.12.79 — août 2026

### Durcissement du correctif précédent après une revue indépendante

- Une revue indépendante du correctif de récupération de la v1.12.78 a repéré deux vraies lacunes avant qu'elles ne posent problème : la nouvelle résolution « faire confiance à l'enregistrement d'origine du téléchargement » aurait pu écraser un numéro de saison explicite et différent porté par le nom du fichier lui-même — c'est-à-dire qu'une release mal étiquetée aurait pu être silencieusement classée dans le mauvais dossier de saison. Elle ne fait désormais que compléter une saison/épisode que le nom du fichier ne fournissait pas déjà, sans jamais écraser celle qu'il fournissait. Par ailleurs, un cas restant (un film intégré dans un pack de type série) était encore sur l'ancien chemin de simple supposition alors que tous les autres cas avaient déjà été mis à niveau — désormais cohérent partout.

## v1.12.78 — août 2026

### Cause racine du fait que la récupération de téléchargements n'arrivait pas non plus à relier — elle jetait une information qu'elle avait déjà

- **Corrigé, confirmé en conditions réelles** : investigation d'un cas précis (Wakfu) où l'outil de récupération de téléchargements ne trouvait aucune correspondance pour des fichiers terminés, alors même que la série était déjà correctement présente dans la bibliothèque. Cause racine : la récupération redevinait la série de chaque fichier uniquement à partir de son nom de fichier et de son chemin de dossier, même pour des fichiers dont le téléchargement d'origine savait déjà — avec certitude, depuis l'instant même où il avait été récupéré — exactement à quelle série et quelle saison il appartenait. Cette information faisant autorité était jetée avant que la correspondance par fichier ne s'exécute, forçant chaque fichier à passer par une supposition floue basée sur le nom de fichier. Pour une série organisée en `NomSérie/Saison 01/episode.avi` avec un fichier d'épisode dont le nom ne porte aucun repère de saison reconnaissable, cette supposition retombait sur la lecture du dossier de saison lui-même ("Saison 01") comme titre de la série — ne partageant aucun mot avec le vrai nom, donc ne correspondant jamais.
- La récupération résout désormais directement la série/saison d'un fichier à partir de l'enregistrement de son téléchargement d'origine quand disponible, au lieu de deviner — et quand elle doit malgré tout se rabattre sur la lecture des noms de dossiers, elle vérifie désormais un niveau plus haut chaque fois que le dossier le plus proche s'avère être un simple repère de saison sans titre réel dedans, plutôt que de s'arrêter au premier dossier quel que soit son contenu réel. Les deux corrections sont génériques — elles s'appliquent à toute série organisée ainsi, pas seulement à celle ayant révélé le bug.

## v1.12.77 — août 2026

### Le Mode Théâtre laissait la page de fond transparaître visiblement

- **Corrigé, confirmé en conditions réelles** : le correctif précédent rendait le fond du lecteur transparent pour laisser transparaître l'ambiance colorimétrique — mais rien derrière n'était en réalité totalement opaque (la couche d'assombrissement de la page n'est qu'environ 80 % noire à travers un flou, et les couches de couleur elles-mêmes empilent plusieurs effets partiellement transparents sans base solide). La vraie page bibliothèque finissait par être visiblement lisible à travers les bandes noires — pire que le noir plat qu'elle remplaçait. Ajout d'une couche de base définitivement opaque sous tout le reste, pour que la page ne puisse plus jamais transparaître, avec ou sans visuel disponible pour l'extraction de couleur.

## v1.12.76 — août 2026

### L'ambiance colorimétrique du Mode Théâtre était invisible — corrigé, et rééquilibré pour un vrai impact visuel

- **Corrigé, confirmé en conditions réelles** : la couleur d'ambiance extraite de l'affiche de chaque titre était structurellement masquée — le fond du lecteur vidéo lui-même était totalement opaque, peint par-dessus la couche d'ambiance, donc la couleur n'apparaissait qu'un bref instant pendant l'animation d'ouverture avant de disparaître complètement pour tout le reste du visionnage. En plus de ça, la couche d'ambiance elle-même portait un second voile noir quasi opaque empilé directement sur le dégradé de couleur, écrasant le peu qui transparaissait pendant cet instant jusqu'à le rendre quasi nul. Résultat net : du noir plat quel que soit le visuel du titre.
- Le fond du lecteur est désormais transparent là où il doit laisser transparaître l'arrière-plan, et l'équilibre voile/dégradé a été retravaillé pour que la couleur extraite soit réellement visible dans les bandes noires autour de la vidéo — une affiche vive et colorée teinte désormais visiblement le théâtre, une affiche sombre reste feutrée, au lieu que tout ait le même rendu.

## v1.12.75 — août 2026

### Cause racine d'un pack de saison entièrement téléchargé qui n'apparaissait jamais dans la bibliothèque

- **Corrigé, confirmé en conditions réelles** : investigation d'un cas précis (un anime dont les packs de saison avaient entièrement fini de télécharger — la file les affichait « Terminé » — mais dont aucun épisode ne devenait jamais disponible). Cause racine : certaines releases en pack de saison nomment leurs fichiers d'épisode selon une forme du titre fortement abrégée ou non standard, que l'analyseur de titres ne peut pas reconnaître (dans le cas confirmé, un acronyme ne partageant aucun mot avec le vrai titre) — donc quand les fichiers du téléchargement terminé ne correspondaient à aucun épisode suivi, ils n'étaient à juste titre pas supprimés, mais la passe de récupération censée justement rattraper ce cas ne faisait qu'enregistrer l'échec dans une valeur que rien ne lisait jamais, laissant les fichiers là indéfiniment sans aucune visibilité.
- La passe de récupération les enregistre désormais de la même façon qu'un téléchargement manuel réellement non lié le fait déjà : ils apparaissent dans Activité → Non liés, où ils peuvent être manuellement rattachés au bon titre — de façon générique, pour toute release dont le nom ne peut pas être mappé avec confiance par l'analyseur, pas seulement pour la série ayant révélé le problème.

## v1.12.74 — août 2026

### Bug de correspondance pouvant récupérer la mauvaise série, et un blocage de la file de tâches pouvant geler silencieusement toutes les recherches en arrière-plan

- **Corrigé, confirmé en conditions réelles** : le score de correspondance des titres considérait deux titres comme quasi identiques sur la seule base de la distance de caractères, même quand ils différaient par un mot entièrement différent — confirmé en direct avec « How I Met Your Father » (un spin-off sans rapport) obtenant ~91 % de similarité avec une recherche pour « How I Met Your Mother » et étant récupéré à sa place. Le calcul vérifie désormais aussi mot par mot : un mot entièrement différent (et non une simple variante orthographique) est disqualifiant, peu importe à quel point le nombre de caractères global paraît proche.
- **Corrigé, confirmé en conditions réelles** : une seule tâche de fond bloquée (ici une synchronisation Plex lente) pouvait occuper indéfiniment une place dans la file de tâches, bloquant silencieusement toutes les autres tâches en attente derrière elle — y compris les recherches planifiées et manuelles — aussi longtemps qu'elle restait bloquée, sans aucune erreur ni indication qu'un problème existait. C'est ce qui pouvait laisser un titre pourtant correctement ajouté et surveillé sans jamais être réellement recherché. La file libère désormais la place d'une tâche au bout de 10 minutes si elle n'est pas terminée, pour qu'une seule tâche bloquée ne puisse plus affamer tout ce qui la suit.

## v1.12.73 — août 2026

### Lecteur Bêta — la lecture directe démarre désormais comme le réessai manuel « éclair » a toujours fonctionné

- **Corrigé** : le lecteur décidait de tenter ou non la lecture directe en pré-vérifiant le support des codecs via des API navigateur connues pour mentir sur des cas courants (AC-3/E-AC-3 systématiquement signalés « non supportés » sur Chrome/Edge, certains conteneurs signalant une vidéo pourtant décodable comme non supportée) — ce qui redirigeait de nombreux fichiers vers un transcodage ou un repli WebCodecs alors que la lecture directe les aurait très bien gérés. Confirmé en conditions réelles : le bouton de réessai manuel, qui tentait toujours la lecture directe sans cette pré-vérification, fonctionnait nettement mieux.
- La lecture directe est désormais la première tentative systématique sur chaque vidéo, exactement comme le faisait déjà le réessai manuel — les deux sont maintenant littéralement le même chemin de code, partageant la même récupération automatique (repli vers l'autre mode de lecture en cas d'erreur de lecture réelle ou de son réellement silencieux, inchangé par rapport à avant).
- Le bouton de réessai manuel bénéficie désormais de cette même récupération automatique, et reprend depuis la position en cours au lieu de repartir de zéro.
- Suppression du chemin de lecture WebCodecs, désormais totalement inutilisé, vers lequel cette pré-vérification redirigeait — il s'agissait strictement d'une version moins bonne et redondante de ce que la lecture directe et la chaîne de repli existante couvrent déjà.

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
