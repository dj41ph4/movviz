# Journal des modifications

Toutes les nouveautés notables de Movviz, regroupées par étape de développement.

---

## v1.13.22 — août 2026

### "Pour toi" redevient strictement individuel, et un échec de synchro Plex ne ressemble plus à "n'a rien regardé"

- **Changé** : retour en arrière sur le mélange "foyer" de la v1.13.21 — après retour, "Pour toi" est de nouveau construit UNIQUEMENT à partir de l'historique Plex propre au compte, sans aucun signal des autres comptes, même minime. Un compte avec seulement quelques titres vus obtient désormais une rangée personnalisée à partir de ceux-ci seuls, au lieu d'exiger un minimum avant d'afficher quoi que ce soit.
- **Corrigé** : la synchronisation des vues Plex avalait silencieusement toute erreur (coupure réseau, token expiré, section inaccessible) et enregistrait quand même un résultat vide — indiscernable de "ce compte n'a vraiment rien regardé", et capable d'effacer discrètement un vrai historique en cas d'échec passager. Elle laisse désormais les données existantes intactes quand une synchro ne parvient à atteindre aucune section, et chaque tentative — succès ou échec, et pour quel compte — est journalisée dans Réglages → Journaux, pour qu'un compte en échec silencieux soit enfin visible au lieu de simplement paraître vide.

### "Pour toi" peut désormais s'appuyer sur l'historique Plex de tout le foyer, pas seulement le tien

- **Nouveau** : quand l'historique Plex propre à un compte est mince ou vide, sa rangée "Pour toi" mélange désormais aussi ce que les autres comptes de l'instance ont regardé (avec un poids plus faible que l'historique propre du compte) — pour qu'un compte sans lien Plex puisse quand même avoir une vraie rangée personnalisée au lieu du repli générique "mieux notés". Ça ne se déclenche qu'à partir du moment où au moins deux autres comptes ont de vraies données de visionnage — les goûts d'un seul autre compte ne servent jamais de signal "foyer" de substitution, pour éviter de cloner discrètement les choix d'une personne sur quelqu'un d'autre. La rangée de chaque compte reste exactement aussi personnelle qu'avant ; ça ne fait qu'ajouter un signal plus large par-dessus, jamais remplacer l'historique propre du compte quand il existe déjà.

### Titres et résumés d'épisodes toujours renvoyés en français, quelle que soit la langue de l'interface

- **Corrigé** : l'appel de données saison/épisode (vignettes, titres, résumés — ajouté en v1.13.12, étendu aux séries possédées en v1.13.19) n'indiquait jamais à TMDb dans quelle langue répondre, donc ça retombait silencieusement sur le français pour tout le monde, même avec l'anglais (ou une autre langue) sélectionné comme langue de l'interface. C'était exactement le même bug déjà corrigé une fois pour les pages de détail — jamais appliqué à cet appel précis. Ça suit désormais la langue choisie dans l'app, comme partout ailleurs.

### Vignettes et résumés d'épisodes visibles partout, pas seulement pour les séries pas encore possédées

- **Corrigé** : la v1.13.12 avait ajouté une vignette et un court résumé à chaque ligne d'épisode, mais uniquement pour les séries pas encore dans ta bibliothèque — les épisodes des séries déjà possédées s'affichaient en simples lignes de texte, sans aperçu. Les deux vues puisent désormais dans les mêmes données TMDb en direct, donc un épisode téléchargé/disponible affiche exactement le même aperçu qu'un épisode pas encore récupéré — sans qu'aucun badge de qualité, marqueur "vu", pastille de statut ou bouton de recherche existant ne disparaisse.
- **Corrigé** : les dates de diffusion dans cette même liste s'affichaient selon le format de la locale du navigateur, indépendamment de la langue choisie dans Movviz (par exemple l'ordre mois/jour US même avec le français sélectionné) — elles suivent désormais la langue de l'app, comme toutes les autres dates de Movviz.

### La reprise d'un pack de saison partiellement importé pouvait tenter de renommer son .nfo restant en fichier d'épisode

- **Corrigé** : une fois que tous les vrais fichiers vidéo d'un pack de saison avaient déjà été appariés et déplacés lors d'une passe précédente, une reprise ne trouvait plus aucun fichier vidéo et se rabattait sur le premier fichier restant — y compris le `.nfo` de la release — en le traitant comme « l'épisode à importer », tentant de le renommer en quelque chose comme `S03E02.nfo` et échouant dès que ça ne correspondait pas à ce qui était réellement sur le disque. Les `.nfo`/`.txt`/images/checksums restants ne sont jamais du contenu d'épisode et sont déjà nettoyés automatiquement une fois l'import terminé — ils sont désormais exclus de cet appariement au lieu de provoquer une erreur d'import visible par l'utilisateur.

## v1.13.17 — août 2026

### Les logs de ralentissement annoncés s'affichent désormais vraiment dans Réglages → Journaux

- **Corrigé** : le journal de diagnostic de recherche pouvait saturer son buffer de 2000 lignes en quelques minutes pendant les grosses passes d'arrière-plan (chaque recherche d'épisode écrit ~10 lignes, dont plusieurs en debug), éjectant silencieusement les lignes info importantes — y compris les nouvelles lignes de ralentissement de l'arrière-plan. Le buffer contient désormais 4000 lignes, les entrées `priority.yield` survivent donc au bruit.
- **Nouveau** : le panneau de logs de Réglages → Journaux se met à jour en direct — rafraîchissement toutes les 5 secondes tant que l'onglet est visible, les lignes écrites par l'arrière-plan apparaissent donc au fil de l'eau au lieu d'attendre un rafraîchissement manuel. Pas de re-render si rien n'a changé.
- **Corrigé** : toutes les sources de logs sont désormais regroupées au même endroit — le panneau des logs transcode a été déplacé de l'onglet Diagnostics vers Réglages → Journaux, qui regroupe maintenant search/diagnostic, moteur, resolver et transcode.
- **Modifié** : les lignes de ralentissement de l'arrière-plan ont leur propre couleur dans le panneau, pour repérer « Arrière-plan bridé [bulk manquants]… » d'un coup d'œil.

## v1.13.16 — août 2026

### Les ralentissements de l'arrière-plan sont désormais visibles dans les logs — avec l'utilisateur responsable

- **Nouveau** : le travail d'arrière-plan (le bulk manuel « Rechercher les manquants », le matching RSS planifié, les upgrades qualité, les relances des sorties manquantes) se met désormais en pause quand tu utilises activement l'application et reprend quelques secondes après ton arrêt — tu ne le ressens jamais. À chaque ralentissement réel, le journal de diagnostic le consigne en une ligne propre et lisible : quelle tâche d'arrière-plan a été bridée, quel utilisateur était actif (nom + id) et combien de temps l'attente a duré (ex. « Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1) »).
- **Corrigé** : le polling silencieux du frontend ne compte plus comme activité utilisateur. Les sondes d'état (torrents du moteur toutes les 500 ms, jobs toutes les 2 s, mesures perf toutes les 5 s, activité Plex toutes les 5 s, progression de lecture toutes les 10 s…) maintenaient l'application marquée « active » à vie dès qu'une seule page restait ouverte — donc l'arrière-plan ne reprenait jamais vraiment. Seules les vraies interactions comptent désormais (navigation, recherches, clics) : laisse l'app ouverte et l'arrière-plan reprend quelques secondes après ton dernier clic.
- **Modifié** : le bulk manuel de recherche passe désormais en voie d'arrière-plan comme les tâches planifiées — il hérite du quota indexeur réduit (tes propres recherches restent prioritaires) et cède la main entre chaque item.

## v1.13.15 — août 2026

### La barre de navigation restait opaque après un retour en haut de page

- **Corrigé** : la barre de navigation transparente-puis-opaque ajoutée en v1.13.12 devenait bien opaque en défilant vers le bas, mais ne redevenait jamais transparente en remontant tout en haut. Passage à une méthode de détection plus fiable pour que ça reflète correctement la position de défilement dans les deux sens.

## v1.13.14 — août 2026

### Les rangées du tableau de bord peuvent désormais ouvrir une grille complète — « Voir plus » n'avait en réalité jamais été branché

- **Corrigé** : les carrousels du tableau de bord ("Pour toi", "Récemment ajoutés", "À venir", "Tendances") avaient un affichage « Voir plus » intégré dans le composant de rangée lui-même, mais aucune rangée du tableau de bord ne lui transmettait jamais de destination — donc ça n'apparaissait jamais, sur aucune rangée, depuis que cette partie du tableau de bord a été construite. Les rangées restent exactement les mêmes bandes horizontales compactes ; « Voir plus » ouvre désormais l'ensemble complet sous forme de vraie grille filtrable (Découverte pour les rangées de recommandations/tendances, ta Bibliothèque — pré-filtrée pour correspondre — pour les rangées tirées de ce que tu possèdes déjà).

## v1.13.13 — août 2026

### Le lecteur bêta est désormais un choix personnel par compte, désactivé par défaut

- **Changé** : auparavant, le lecteur bêta n'avait qu'un seul interrupteur pour toute l'instance — un admin l'activant changeait silencieusement le comportement de lecture pour tous les comptes. Il y a désormais deux niveaux : un interrupteur admin dans Réglages qui rend simplement la fonctionnalité disponible, et un interrupteur personnel dans la page Profil de chaque utilisateur qui l'active réellement pour son propre compte — désactivé par défaut, quel que soit le réglage de l'admin.

## v1.13.12 — août 2026

### Six améliorations de navigation, choisies lors d'une revue de design

- **Nouveau** : les rangées affichent désormais un fin indicateur de position au défilement et des flèches au survol des bords, avec un défilement par page entière au lieu du glissement libre.
- **Nouveau** : la rangée "Tendances" met désormais en avant son top 10 avec un traitement numéroté, en utilisant le même vrai classement de popularité selon lequel la rangée était déjà triée.
- **Nouveau** : survoler une carte (bureau) affiche désormais brièvement l'année, la durée et les genres quand ils sont disponibles, au lieu de rien.
- **Changé** : la barre de navigation du haut est désormais transparente tout en haut de la page et redevient opaque dès qu'on défile.
- **Changé** : la liste d'épisodes d'un titre pas encore dans ta bibliothèque affiche désormais une vignette et une courte description par épisode, plus une simple ligne. (Les épisodes des titres déjà dans ta bibliothèque n'ont pas encore ça — ça nécessite de nouvelles données collectées au moment de l'import, suivi séparément.)
- **Nouveau** : sur mobile, le hero du tableau de bord utilise désormais un visuel portrait dédié au lieu d'une version recadrée de la bannière bureau.

## v1.13.11 — août 2026

### La personnalisation de l'affichage suit désormais ton compte, pas seulement ton navigateur

- **Changé** : le profil de performance GPU, les animations, le thème (clair/sombre/auto), la langue de l'interface et la densité d'affichage de la bibliothèque n'étaient enregistrés que dans le navigateur — changer d'appareil ou de navigateur remettait chacun à zéro. Ils sont désormais enregistrés sur ton compte et te suivent partout où tu te connectes, tout en s'appliquant toujours instantanément sur l'appareil utilisé.
- **Déplacé** : le réglage « Animations » se trouve désormais dans Réglages → Performance GPU, juste à côté du profil qu'il affecte réellement, au lieu d'être sous Tableau de bord.

## v1.13.10 — août 2026

### Boutons de la barre de navigation mobile qui ne fonctionnaient que si on tapait au-dessus de l'icône

- **Corrigé, confirmé en conditions réelles** : sur mobile, taper directement sur les boutons Calendrier/Demandes/Plus ne faisait souvent rien — mais taper juste au-dessus fonctionnait. Cause racine : le conteneur des notifications toast est monté partout et reste présent sur la page en permanence, même sans aucune notification affichée. Sa couche mobile s'étend sur toute la largeur de l'écran, se trouve juste au-dessus de la barre d'onglets du bas, et est invisible — mais un élément invisible bloque quand même les clics en dessous de lui, sauf indication contraire explicite. Les taps atterrissant dans cette zone de chevauchement touchaient silencieusement le vide au lieu d'atteindre le bouton d'onglet.
- Le conteneur invisible ne bloque désormais plus rien en dessous de lui ; seule une notification réellement visible (rare et brève) reste tapable/fermable, exactement comme avant.

## v1.13.09 — août 2026

### Le correctif Blood+ de la v1.13.06 n'a jamais réellement pris effet — trouvé la vraie raison

- **Corrigé, confirmé en conditions réelles** : la v1.13.06 avait corrigé la fonction de correspondance de titres pour traiter le "+" comme le mot "plus" (pour que "Blood+" ne soit plus confondu avec des séries sans rapport). Mais la recherche manuelle continuait d'afficher "Blood Of Zeus", "Dexter New Blood", "Blood-C" et d'autres comme candidats valides pour "Blood+" — parce qu'une étape complètement différente et antérieure (celle qui transforme une requête tapée dans la barre de recherche en texte effectivement envoyé aux indexeurs) supprimait le "+" avant même que la fonction corrigée ne le voie, annulant silencieusement ce correctif pour chaque recherche réelle. Une recherche pour "Blood+" arrivait au comparateur sous la forme du simple mot "Blood", qui bien sûr correspond à quasiment tout ce qui contient "Blood" dans le titre.
- Cette étape antérieure préserve désormais elle aussi "+" et "&" comme des mots, de la même façon que la fonction de correspondance le faisait déjà — fermant la vraie brèche, pas seulement la fonction qui semblait être la source du problème.

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
