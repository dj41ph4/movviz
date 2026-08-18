# Changelog

All notable changes to Movviz, grouped by development milestone.

---

## v1.16.2 — August 2026

### Nouveau : bibliothèque dissociée — pages dédiées Films et Séries

- La bibliothèque est désormais scindée en **trois pages fixes** : `/library` (Tout, les deux types mélangés), `/movies` (films uniquement) et `/series` (séries uniquement) — accessibles depuis le sous-menu « Bibliothèque » de la sidebar.
- Les pages Films et Séries n'ont plus de boutons de filtrage par type (c'est leur nature fixe) ; tri, filtre de statut et tags restent disponibles. Les anciens liens `?type=movie|series` redirigent automatiquement vers les nouvelles pages.

## v1.16.1 — August 2026

### Nouveau : sous-menu Bibliothèque dans la sidebar (desktop)

- Le menu « Bibliothèque » se déplie désormais sous trois entrées : **Tout**, **Films** et **Séries** — un chevron ouvre/ferme le sous-menu, et l'entrée active est mise en évidence. Les filtres, tri et tags déjà appliqués sont conservés quand on bascule entre les trois vues.

### Correctif : le build échouait par manque d'espace disque

- **Cause racine identifiée** : le build Turbopack de Next.js 16 ignorait les exclusions de tracing et copiait les dossiers de développement (`dta/`, `.movviz-data/`) — jusqu'à ~480 Go — dans le bundle standalone, jusqu'à saturer le disque. Le build repasse en webpack (où les exclusions fonctionnent) et un script `clean-standalone` purge ce qui doit rester hors du bundle : le standalone final passe de ~480 Go à ~64 Mo.

## v1.16.0 — August 2026

### Nouveau : client Android TV

- **Premier client natif Movviz** pour Android TV / Fire TV (télécommande, clavier et souris tous pris en charge) : connexion à un serveur Movviz existant, bibliothèque Films/Séries, fiche titre, lecture des épisodes, recherche, réglages — se télécharge en APK depuis les Releases GitHub, à côté de l'installeur Windows.
- Session conservée entre les lancements, comme sur Plex ou Netflix — plus besoin de se reconnecter à chaque fois.

## v1.15.17 — August 2026

### Correctif : une simple interpellation prise pour un titre de film

- **Cause racine confirmée en direct** : écrire « hep » pour attirer l'attention déclenchait une recherche, et Movviz enchaînait sur un obscur film tchèque de 2013 comme si c'était le sujet de la conversation. La liste des salutations et interjections reconnues comme telles (hep, hé, eh, ho, wesh, hmm, bref, ciao…) a été nettement élargie — les vrais titres courts comme « 300 » ou « Up » restent bien reconnus.

## v1.15.16 — August 2026

### Correctif : un mauvais titre pouvait être ajouté quand film et série se ressemblent

- **Cause racine confirmée en direct** : demander « télécharge Lanterns » ajoutait « Human Lanterns » (film de 1982 sans aucun rapport) alors que la série « Lanterns » (2026) était pourtant le tout premier résultat de la recherche. L'assistant avait supposé qu'il s'agissait d'un film, et cette supposition écartait d'office toutes les séries — y compris la correspondance exacte. Un titre qui correspond nettement mieux l'emporte désormais sur cette supposition, qu'il s'agisse d'un film ou d'une série.
- Quelques mots courants supplémentaires (« de », « en », « et »…) ne peuvent plus être pris pour un prénom.

## v1.15.15 — August 2026

### Correctif : un mot ordinaire pouvait être enregistré comme ton prénom

- **Cause racine confirmée en direct** : écrire une phrase du type « je l'ai pas vu, c'est avec DiCaprio ? » faisait enregistrer « Avec » comme prénom, en écrasant le vrai. Le détecteur prenait n'importe quel mot suivant un « c'est » au fil d'une phrase. Cette forme n'est désormais reconnue qu'en tout début de message (la réponse « c'est Seb » à la question du prénom reste captée), et une liste élargie de mots courants ne peut plus jamais devenir un prénom.

### Correctif : une notation réussie s'affichait comme un échec

- **Cause racine confirmée en direct** : sur une demande du type « mets 5 étoiles à X, Y et Z », les notes étaient bien enregistrées mais la réponse affichée était « j'ai un vrai blocage » — l'assistant n'avait produit aucune phrase autour de ses notes. La confirmation est maintenant construite à partir des notes réellement enregistrées, avec la liste des titres et leur note.

## v1.15.14 — August 2026

### Correctif : les notes annoncées en lot n'étaient pas réellement enregistrées

- **Cause racine confirmée en direct** : après avoir passé en revue les titres vus un par un, répondre "j'ai adoré, mets 5 étoiles à tous" affichait une liste soignée ("Solo Leveling : 5/5", "Jurassic Park : 5/5"…) et annonçait "voici les notes mises à jour" — alors qu'**aucune note n'était enregistrée**. Deux causes cumulées : un plafond interne de 2 notes maximum par réponse rendait la notation groupée structurellement impossible, et rien n'empêchait d'annoncer des notes sans les poser réellement.
- La notation en lot accepte désormais jusqu'à 10 titres d'un coup, et toute réponse qui annonce des notes sans les enregistrer réellement est détectée et corrigée automatiquement — plus jamais de note annoncée mais absente.

## v1.15.13 — August 2026

### Movviz AI — le sujet de la conversation est désormais suivi explicitement

- **Cause racine identifiée à l'audit** : en dehors d'une fiche film/série ouverte, rien n'indiquait à l'assistant de quel titre vous étiez en train de parler — il devait le deviner en relisant l'historique, ce qui échouait sur les enchaînements naturels ("Solo Leveling" → "j'adore" → "le top c'est contre X") et pouvait relancer une recherche inutile au troisième message. Le titre en cours de discussion est maintenant mémorisé dès qu'il a été réellement identifié, et rappelé à chaque message suivant : les réactions courtes, les références implicites et les noms de personnages se rapportent par défaut à ce titre, sans repartir en recherche.

## v1.15.12 — August 2026

### Movviz AI — filmographie et notes croisées pour prioriser un titre manquant

- Quand une recherche de filmographie révèle des titres manquants et que l'utilisateur a des notes attribuées, l'assistant peut désormais croiser les deux pour suggérer lequel des titres manquants a le plus de chances de plaire, en s'appuyant sur des caractéristiques réellement partagées (ton, genre, structure) — jamais une intuition inventée.

## v1.15.11 — August 2026

### Movviz AI — hiérarchie de décision unifiée

- Les nombreuses règles ajoutées séparément (réponses courtes, corrections, mentions de titre, avis ponctuel...) sont désormais rassemblées sous un ordre de priorité explicite et unique, pour éviter que des règles isolées se contredisent : réaction à la conversation en cours > référence au sujet actif (un personnage, une scène, "le deuxième"...) > correction de la réponse précédente > intention conversationnelle > œuvre déjà connue > œuvre potentiellement nouvelle > recherche externe en dernier recours.
- L'avis sur un personnage précis (ex. "Beru est clairement le meilleur") est désormais traité comme les avis sur une scène/un acteur/une fin déjà couverts : mémorisé pour ce qu'il est, jamais transformé en note globale du titre.

## v1.15.10 — August 2026

### Movviz AI — badge discret au lieu d'une ouverture forcée

- Quand Movviz relance spontanément la conversation après une absence, le chat ne s'ouvre plus automatiquement — le bouton flottant affiche désormais un badge numéroté avec une brève pulsation, jusqu'à ce que l'utilisateur l'ouvre lui-même.

## v1.15.9 — August 2026

### Movviz AI — la relance spontanée peut désormais porter sur une note

- Quand Movviz relance spontanément la conversation après une absence (mécanisme déjà existant, avec son propre temps d'attente), il peut désormais, à l'occasion, demander directement la note d'un titre vu mais jamais évalué plutôt qu'une question générique — jamais deux fois via deux canaux différents dans la même fenêtre de temps.

## v1.15.8 — August 2026

### Correctif : une note ne mettait pas à jour le contexte en temps réel

- **Cause racine confirmée en direct** : contrairement à toute autre activité réelle (vue, retour 👍/👎, import Netflix), poser une note — via le widget étoiles ou en conversation — ne déclenchait pas la mise à jour du contexte consolidé ("Ce que Movviz AI sait de toi"). Il fallait cliquer manuellement sur "Régénérer le contexte" pour que les notes soient prises en compte. Une note se propage désormais automatiquement, comme le reste.

### Movviz AI — question occasionnelle sur un titre vu mais jamais noté

- De temps en temps, quand la conversation s'y prête naturellement, l'assistant peut désormais demander la note d'un titre entièrement vu mais jamais évalué — jamais systématique (limité à une occasion toutes les quelques heures, jamais imposé si le moment ne convient pas).

### Panneau profil — retirer un retour 👍/👎

- Chaque titre apprécié/rejeté du panneau "Ce que Movviz AI sait de toi" a maintenant un bouton pour le retirer du contexte (utile pour un vote posé par erreur).

## v1.15.7 — August 2026

### Movviz AI — un titre déjà rejeté n'est plus jamais reproposé

- Un titre marqué "mauvaise recommandation" (👎) est désormais définitivement exclu des futures recommandations — jusqu'ici, seule une pénalité légère s'appliquait aux titres au ton similaire, ce qui n'empêchait pas le titre exact déjà rejeté de revenir.

## v1.15.6 — August 2026

### Movviz AI — distinction entre un avis ponctuel et une note globale

- Un commentaire sur un élément précis ("j'adore cette scène", "cet acteur est excellent", "la fin est ratée") ne fait plus déduire une note globale du titre entier — seul un avis exprimé sur l'ensemble du film ou de la série est traduit en note.

## v1.15.5 — August 2026

### Movviz AI — identité de compagnon cinéphile renforcée

- L'assistant raisonne désormais explicitement comme un compagnon cinéphile qui cherche à comprendre l'utilisateur (pourquoi il aime un titre, pas seulement quel genre) plutôt qu'un moteur de recherche avec du texte autour.
- Les réponses courtes ("pourtant si", "celui-là", "je l'ai déjà vu"...) ne déclenchent plus jamais de recherche inutile — elles sont désormais reconnues comme des réactions/corrections à comprendre par rapport au message précédent, jamais comme un nouveau titre à chercher.
- Quand la conversation est une simple discussion cinéphile, la collecte de préférences et les relances passent au second plan au profit de l'échange naturel.
- Formulations d'assistant générique ("Voulez-vous que je vous aide ?"...) explicitement bannies.

## v1.15.4 — August 2026

### Correctif : garantie renforcée contre la ligne technique brute (suite du correctif précédent)

- **Cause racine confirmée en direct** : le correctif v1.15.3 reposait sur une nouvelle tentative de réponse de Movviz, qui pouvait reproduire la même ligne technique au lieu d'une vraie phrase. Une reformulation automatique déterministe (sans dépendre d'une nouvelle tentative du modèle de langage) est désormais en place pour garantir qu'aucune ligne technique brute n'atteint jamais l'utilisateur.

## v1.15.3 — August 2026

### Correctif : mention d'un titre parfois répondue par une ligne technique au lieu d'une vraie phrase

- **Cause racine confirmée en direct** : le correctif v1.15.2 empêchait bien l'ajout silencieux, mais dans certains cas l'assistant répondait quand même par une seule ligne au format "• Déjà dans la bibliothèque — Titre (année)" — une imitation du format technique utilisé en interne pour les résultats d'ajout, recopiée par erreur au lieu d'une vraie réaction naturelle. Ce format mécanique est désormais détecté et corrigé automatiquement pour toujours obtenir une vraie phrase.

## v1.15.2 — August 2026

### Correctif : mention d'un titre parfois traitée comme un ajout silencieux

- **Cause racine confirmée en direct** : la vérification ajoutée en v1.15.1 (bibliothèque/historique/note avant de réagir à un titre mentionné) ne se déclenchait en réalité jamais dans certains cas, car l'assistant interprétait parfois une simple mention de titre ("Hurlevent", "the nice guys") comme une demande d'ajout implicite — résultat : une ligne technique ("Déjà dans la bibliothèque — X") sans aucune réaction, au lieu d'une vraie réponse. Corrigé : une mention de titre sans verbe d'action explicite (ajoute, mets, télécharge...) ne déclenche plus jamais d'ajout silencieux et passe désormais bien par la réponse naturelle attendue.

## v1.15.1 — August 2026

### Correctif : Movviz AI ne consultait pas ce qu'il savait déjà avant de répondre

- **Cause racine confirmée en direct** : à la simple mention d'un titre ("zootopie 2"), l'assistant demandait "tu veux l'ajouter ?" pour un titre déjà présent, ou "tu l'as vu ?" alors que l'historique le savait déjà — il n'avait tout simplement aucune vérification réelle à consulter pour une mention casuelle (seules les questions explicites en déclenchaient une). Il consulte désormais systématiquement la bibliothèque, l'historique de visionnage et la note existante avant de réagir à un titre mentionné, et ne repose plus une question dont il connaît déjà la réponse.
- Quand un titre mentionné est vu mais jamais noté, l'assistant en profite naturellement pour demander l'avis, en une phrase, sans en faire un interrogatoire.
- Correctif d'une promesse sans suite : l'assistant pouvait répondre "je vais vérifier ça tout de suite !" puis ne jamais revenir avec la réponse — une conversation n'ayant pas de second temps automatique, ce genre de promesse est désormais bannie ; soit la vérification a lieu dans le message même, soit l'assistant dit honnêtement qu'il ne peut pas vérifier.
- Personnalité resserrée : usage plus régulier du prénom connu, emojis plus présents mais sans excès, réaction avant question plutôt que l'inverse.
- Filet de sécurité supplémentaire pour qu'un format technique interne ne s'affiche jamais tel quel dans une réponse.

## v1.15.0 — August 2026

### Notes 1 à 5 étoiles (nouveau)

- Chaque film et série peut désormais recevoir une note de 1 à 5 étoiles, directement depuis sa fiche — une seule note par titre et par utilisateur, jamais partagée entre comptes.
- Movviz AI comprend aussi une note donnée en conversation ("j'ai adoré", "quelle déception", "je lui mets 4 étoiles") et l'enregistre automatiquement, sans jamais deviner quand ce n'est pas assez clair — une note posée manuellement sur la fiche prime toujours sur une note déduite d'une phrase.
- Ces notes affinent à la fois les recommandations du chatbot et les suggestions de la page Découverte, qui partagent désormais la même compréhension de tes goûts au lieu de deux logiques séparées.
- Le panneau « Ce que Movviz AI sait de toi » (page Profil) affiche désormais tes notes récentes, en distinguant celles posées à la main de celles déduites d'une conversation.

## v1.14.48 — August 2026

### Correctif : bouton corbeille visible par tout le monde dans la bibliothèque

- **Cause racine confirmée en direct** : le bouton de suppression d'un film (carte bibliothèque et fiche film) s'affichait pour n'importe quel utilisateur, alors que le serveur, lui, refusait déjà correctement la suppression aux comptes non-administrateurs — aucune donnée n'était donc en danger, mais un utilisateur normal voyait un bouton qui échouait silencieusement au clic. Le bouton n'apparaît désormais que pour les comptes administrateur, comme partout ailleurs dans l'app.

## v1.14.47 — August 2026

### Correctif : rangée « Continuer à regarder » vidée à tort

- **Cause racine confirmée en direct** : la double vérification ajoutée en v1.14.44 (par précaution, sans certitude que c'était nécessaire) comparait chaque titre "en cours" avec l'historique de vue déjà synchronisé — historique qui ne se met à jour que toutes les 2 heures. Un titre commencé récemment n'y figure pas encore, donc il disparaissait à tort de la rangée alors qu'il t'appartenait bien. Résultat : la rangée est passée de 10 titres réels à seulement 3. Cette double vérification est retirée ; la protection d'origine (le jeton propre à chaque compte) reste en place.

### Correctif : Movviz AI et l'accès web (suite)

- **Cause racine confirmée en direct, deux fois** : malgré le correctif de la version précédente, Movviz AI continuait parfois à nier catégoriquement tout accès à internet même quand la recherche web était bien activée dans les réglages — la consigne seule ne suffisait pas à empêcher ça de façon fiable. Movviz AI détecte désormais ce déni erroné et se corrige immédiatement avant d'afficher quoi que ce soit, la même approche que pour les autres corrections automatiques déjà en place.

## v1.14.46 — August 2026

### Correctif : Movviz AI et l'accès web

- **Cause racine confirmée** : Movviz AI répondait "je n'ai pas accès à internet" comme une impossibilité technique fixe, sans jamais tenir compte du réglage "Recherche web" réellement activé ou non sur le compte (section IA des Réglages). Il connaît désormais l'état réel de ce réglage : s'il est désactivé, il l'explique comme un choix de configuration réversible plutôt qu'une limite définitive ; s'il est activé, il ne prétend plus n'avoir aucun accès alors qu'une vraie recherche a bien lieu pour certaines fonctionnalités précises (comme retrouver une scène mémorable). Pour rappel, ce réglage prend effet immédiatement au prochain message, sans recharger la page ni se reconnecter.

## v1.14.45 — August 2026

### Nouveauté : Movviz AI peut enfin répondre à "donne-moi la filmographie de X"

- **Cause racine confirmée en direct** : demander la filmographie d'un acteur ou réalisateur ("donne-moi la filmographie de Brad Pitt") recevait toujours le même refus, mot pour mot, même en insistant plusieurs fois de suite — Movviz AI n'avait tout simplement aucune donnée réelle pour ce type de question précis, contrairement à "qu'est-ce qu'il me manque de X" qui, lui, était déjà branché sur une vraie recherche. Une vraie recherche de la personne sur TMDb (avec sa filmographie réelle, croisée avec ta bibliothèque) est désormais déclenchée pour cette question précise.
- Movviz AI ne répète plus une réponse mot pour mot d'un message à l'autre dans la même conversation — la formulation varie toujours, même quand la réponse de fond reste la même.

## v1.14.44 — August 2026

### Correctif : deuxième filet de sécurité pour « Continuer à regarder »

- La rangée « Continuer à regarder » vérifie désormais, en plus des données renvoyées par Plex, que le titre concerné figure réellement dans l'historique de vue propre au compte qui consulte la page avant de l'afficher — un titre sans aucune trace dans cet historique n'est jamais montré, quoi que Plex ait pu renvoyer. Cette double vérification protège contre une éventuelle confusion de compte côté Plex, indépendamment de la cause exacte.

## v1.14.43 — August 2026

### Correctif majeur : isolation des comptes utilisateurs

- **Cause racine confirmée** : sur un appareil partagé, se déconnecter puis se reconnecter avec un autre compte ne réinitialisait jamais les données déjà affichées en mémoire (vues, préférences, demandes, tout ce qui est personnel) — un correctif précédent n'avait réinitialisé qu'un seul élément technique (l'état de connexion), pas le reste. Résultat : le compte suivant pouvait voir un instant, ou parfois durablement, les données du compte précédent avant qu'elles ne se rafraîchissent d'elles-mêmes. Toutes les données personnelles sont désormais intégralement réinitialisées à chaque connexion et déconnexion — plus aucune fuite d'un compte à l'autre.
- **Deuxième cause trouvée en creusant** : un profil Plex secondaire (compte "maison"/enfant rattaché par l'admin, sans connexion Plex qui lui soit propre) ne voyait jamais ses films/épisodes vus se synchroniser depuis Plex — la tâche de fond ignorait purement et simplement ces profils. Corrigé : chaque profil, y compris les profils secondaires, a maintenant ses propres vues synchronisées indépendamment.

## v1.14.42 — August 2026

### Correctif : rangée « Optimisations disponibles » en erreur

- **Cause racine confirmée en direct** (panneau Réglages > Performance) : même après le correctif précédent, la rangée « Optimisations disponibles » du tableau de bord échouait systématiquement au bout d'une minute — elle lançait, à chaque ouverture du tableau de bord, jusqu'à 50 recherches en direct sur les indexeurs (une par film/épisode concerné), l'une après l'autre, largement de quoi dépasser le délai d'attente du serveur. Cette rangée se limite désormais au cache déjà en mémoire, rapide par nature ; la recherche complète en direct reste entièrement disponible dans le panneau « Rechercher et remplacer », déclenchée volontairement.

## v1.14.41 — August 2026

### Correctif : lenteur générale de l'application

- **Cause racine confirmée en direct** (panneau Réglages > Performance) : la recherche d'optimisations disponibles (rangée « Optimisations disponibles » du tableau de bord, et le panneau « Rechercher et remplacer ») réanalysait l'intégralité des releases en cache pour CHAQUE film et CHAQUE épisode de la bibliothèque, au lieu de le faire une seule fois puis réutiliser le résultat — sur une grosse bibliothèque, ce travail répété saturait le serveur pendant plusieurs dizaines de secondes et ralentissait TOUTES les autres pages en même temps (chargement du tableau de bord, de la bibliothèque, des demandes...), même sans rapport avec les optimisations. Le calcul se fait désormais une seule fois, avec un résultat strictement identique.

## v1.14.40 — August 2026

### Correctif : Movviz AI

- **Cause racine confirmée en direct** : une demande de recommandation ("surprends-moi") pouvait recevoir une réponse qui annonce une liste ("Voici ce qui devrait te surprendre...") sans qu'aucun titre ne suive — une promesse jamais tenue, sans carte de recommandation ni message d'erreur. Movviz AI détecte désormais ce cas et redemande immédiatement une vraie liste avant d'afficher quoi que ce soit.

## v1.14.39 — August 2026

### Correctif : rangée « Continuer à regarder »

- **Cause racine confirmée en direct** : Plex mélange dans sa liste « on deck » deux choses différentes — ce qui est vraiment en pause en cours de lecture, et le prochain épisode d'une série jamais commencé mais mise en avant parce qu'un épisode précédent a été vu. La rangée affichait donc des dizaines de vignettes avec une barre de progression à 0%, jamais réellement démarrées. Seul le contenu réellement repris s'affiche désormais.

## v1.14.38 — August 2026

### Nouveauté : rangée « Continuer à regarder »

- Le tableau de bord affiche désormais une rangée « Continuer à regarder », entre « Tendances Movviz » et « Suggestions adaptées » — les films et épisodes en cours, avec la barre de progression réelle, qu'ils aient été repris depuis une appli Plex classique ou directement depuis le lecteur intégré de Movviz. Activable/désactivable dans Réglages comme les autres rangées.
- **Cause racine corrigée en même temps** : le lecteur intégré de Movviz signalait bien sa progression à Plex à chaque lecture, mais un paramètre technique manquant faisait que Plex ignorait silencieusement ce signal — la progression n'était donc jamais réellement prise en compte côté serveur. Corrigé, avec en prime l'attribution au bon compte quand plusieurs utilisateurs partagent le même Plex.

## v1.14.37 — August 2026

### Correctif : Movviz AI

- **Cause racine confirmée en direct** : chaque recommandation affichait un message d'excuse générique ("j'ai un vrai blocage...") juste au-dessus des suggestions, alors même que la recommandation avait parfaitement réussi — un vrai problème de confiance sur le chemin le plus utilisé de la fonctionnalité. La phrase d'accompagnement d'une recommandation n'était en réalité jamais construite, et retombait donc par défaut sur le message d'erreur générique. Une vraie phrase d'introduction s'affiche désormais à chaque recommandation.

## v1.14.36 — August 2026

### Correctif : Movviz AI

- **Cause racine confirmée en direct** : demander « tu te souviens de mon prénom ? » pouvait recevoir un « je ne sais pas encore » alors que Movviz AI l'avait pourtant déjà utilisé quelques messages plus tôt dans la même conversation — le prénom était bien retenu, mais la réponse le niait quand même. Movviz AI détecte désormais ce genre de faux déni et se corrige immédiatement avant d'afficher quoi que ce soit.

## v1.14.35 — August 2026

### Correctif : Movviz AI

- **Cause racine confirmée en direct, après le correctif de la version précédente** : la consigne seule ne suffisait pas à empêcher certains modèles de recopier telle quelle la note technique interne au lieu de la reformuler — le problème persistait malgré une consigne renforcée. Movviz AI détecte désormais lui-même quand ça arrive et redemande immédiatement une vraie reformulation avant d'afficher quoi que ce soit ; si même cette relance échoue, la note est nettoyée automatiquement de tout ce qui la trahissait comme technique. Le libellé interne ne peut plus apparaître dans une réponse, quel que soit le modèle utilisé.

## v1.14.34 — August 2026

### Movviz AI

- **Cause racine confirmée en direct** : quand une vérification réelle était faite pour répondre à une question précise (possession, visionnage, casting, statut d'une série, ce qu'il manque d'une franchise), Movviz AI recopiait parfois telle quelle la note technique interne au lieu de formuler une vraie phrase — une réponse qui sonnait comme un extrait de base de données plutôt qu'une conversation. Corrigé : les faits vérifiés restent exacts, mais sont désormais toujours reformulés naturellement.
- Personnalité renforcée de façon plus générale : consigne explicite pour ne plus jamais laisser transparaître de formatage ou de structure technique interne dans une réponse, quel que soit le type de question.
- **Cause racine confirmée en direct** : une recommandation ou un ajout un peu long pouvait, sur certains modèles, être coupé en plein milieu avant la fin — jusqu'ici, la moindre coupure faisait tout perdre et affichait un message d'erreur générique à la place. Movviz AI récupère désormais les éléments déjà complets d'une réponse coupée au lieu de tout jeter.

## v1.14.33 — August 2026

### Correctif : import Netflix

- **Cause racine confirmée sur un vrai export** : deux bugs de reconnaissance faisaient rater une grosse partie des titres. D'abord, un numéro d'épisode isolé (« Épisode 24 ») était pris à tort pour un numéro de saison — recherché comme "saison 24" d'une série qui n'en a que 2 ou 3, forcément introuvable. Ensuite, une série sans étiquette de saison du tout (juste « Série : Titre d'épisode ») pouvait être mal aiguillée pendant la recherche et perdre l'épisode précis au passage.
- Les libellés « Partie N » et « Volume N » sont maintenant reconnus comme des saisons au même titre que « Saison N ».

## v1.14.32 — August 2026

### Movviz AI

- Movviz AI vérifie désormais réellement, avant de répondre, quatre types de questions sur un titre précis plutôt que de deviner à partir de sa seule mémoire : si tu possèdes déjà un titre ("est-ce que j'ai Alien ?"), si tu l'as déjà vu (en entier ou seulement en partie), qui joue dedans et qui l'a réalisé, et si une série est terminée ou toujours en cours. Quand la question ne peut pas être vérifiée de façon fiable (titre introuvable), il le dit clairement au lieu d'inventer une réponse.

## v1.14.31 — August 2026

### Correctif

- **Cause racine confirmée en direct** : quand tu demandes ce qui te manque d'un acteur, d'un réalisateur ou d'une franchise ("il me manque quel film de..."), Movviz AI pouvait encore inventer une réponse fausse ("tu n'as aucun film Pokémon") malgré un correctif précédent sur ce même type d'erreur — la consigne seule ne suffisait pas à empêcher ça de façon fiable. Pour cette formulation précise, Movviz AI lance désormais une vraie recherche dans le catalogue et vérifie réellement, titre par titre, ce qui est déjà dans ta bibliothèque avant de répondre, au lieu de deviner.

## v1.14.30 — August 2026

### Movviz AI

- Movviz AI sait désormais depuis quand tu n'as rien regardé et à quel rythme tu regardes en ce moment (nombre de visionnages sur les 7 et 30 derniers jours) — un signal réel, basé sur tes vues datées, pour des réponses mieux ajustées à ton activité récente plutôt que de simples compteurs bruts. Ces informations sont aussi visibles dans le panneau « Ce que Movviz AI sait de toi » du profil.

## v1.14.29 — August 2026

### Correctif

- **Cause racine confirmée en direct** : le bouton « Forcer la synchronisation Plex » demandait bien à Plex de rescanner, mais enchaînait immédiatement la synchronisation Movviz — avant que Plex ait fini son propre scan en arrière-plan. Résultat : le bouton affichait un succès sans jamais résoudre le blocage « en attente de synchronisation Plex ». Corrigé : un vrai délai est respecté avant de vérifier, avec une seconde vérification automatique quelques secondes plus tard pour les bibliothèques plus lentes à scanner.

## v1.14.28 — August 2026

### Movviz AI

- Quand tu corriges l'assistant parce qu'il a affirmé à tort qu'un titre n'est pas dans ta bibliothèque, cette correction est désormais retenue — si la même erreur se reproduit plusieurs fois, l'assistant devient nettement plus prudent avant d'affirmer une absence, plutôt que de répéter la même erreur à chaque conversation.

## v1.14.27 — August 2026

### Movviz AI

- Le contexte consolidé (« ce que Movviz AI sait de toi ») se met désormais à jour près de chaque action réelle (film/épisode marqué vu, vote 👍/👎, import Netflix terminé) plutôt que seulement en ouvrant le chat — toujours au plus un seul calcul à la fois, jamais un traitement continu.

## v1.14.26 — August 2026

### Correctifs Movviz AI

- **Cause racine confirmée en direct** : quand le modèle de langage répondait sans une seule vraie phrase (par exemple parce que toute sa réponse ne servait qu'à mémoriser une information en interne), le chat Movviz renvoyait un « D'accord ! » complètement hors sujet — y compris face à une remarque directe de l'utilisateur ou à une vraie question comme « quoi d'autre ? ». Une nouvelle vérification détecte ce cas et redemande aussitôt une vraie réponse avant de l'afficher, sans que ça se voie ni ne ralentisse la conversation ; en dernier recours seulement, un message reconnaît honnêtement la difficulté au lieu d'un « D'accord ! » incongru.
- **Cause racine confirmée en direct** : demander « qu'est-ce qu'il me manque de [tel humoriste/acteur/réalisateur] ? » pouvait produire une liste de titres complètement inventés, présentée à tort comme vérifiée dans la bibliothèque (« d'après ton historique ») — au point d'affirmer qu'un titre manquait alors qu'il était déjà présent. Ce type de question n'a désormais plus le droit d'inventer une liste : le chat explique honnêtement qu'il ne peut pas vérifier ça de façon fiable ici et oriente vers la recherche Movviz, où chaque titre affiche vraiment s'il est déjà dans la bibliothèque.

## v1.14.25 — August 2026

### Correctif Movviz AI

- **Cause racine confirmée en direct** : répondre en un seul mot (« Seb ») à sa propre question « comment tu t'appelles ? » ne suffisait pas — le prénom n'était jamais retenu, alors qu'il continuait à l'utiliser normalement dans la conversation en cours. Résultat : il pouvait affirmer « tu ne m'as pas donné ton prénom » tout en l'utilisant dans la même phrase. Corrigé : une réponse courte à sa propre question sur le prénom est désormais bien reconnue et retenue.

## v1.14.24 — August 2026

### Correctifs Movviz AI

- **Cause racine confirmée en direct** : coller une longue liste de titres (ex. copiée depuis un historique Netflix) faisait échouer la réponse en boucle, quelle que soit la reformulation — la réponse générée dépassait la limite de longueur autorisée et arrivait tronquée, donc invalide. Limite relevée, et un ajout de plus de 25 titres à la fois se limite désormais proprement aux 25 premiers au lieu d'essayer (et d'échouer) sur tout d'un coup.
- Un titre collé au format « Série : Titre d'épisode » (typique d'un export Netflix, ex. « Sakamoto Days: L'assassin légendaire ») était cherché tel quel et ne trouvait jamais rien — reconnu maintenant comme la série seule, ET l'épisode précis est retrouvé et marqué vu (plus seulement la série ajoutée).
- Nouveau : demander la liste des épisodes d'une série (en étant sur sa fiche) renvoie la vraie liste depuis Movviz, avec le statut vu — plus de refus ni d'invention.

## v1.14.23 — August 2026

### Nouveau

- Un titre bloqué sur « En attente de synchronisation Plex » (fichier présent mais pas encore repéré par Plex) propose maintenant un bouton pour forcer la synchronisation immédiatement (admin), au lieu d'attendre le prochain passage automatique (jusqu'à 5 minutes).

## v1.14.22 — August 2026

### Correctif : import Netflix

- **Cause racine confirmée en direct** (export réel de 3217 lignes) : l'import tenait dans une seule requête HTTP, qui expirait avant la fin sur un historique volumineux — chaque titre/épisode nécessite une recherche en ligne, et un historique de plusieurs années en accumule des centaines.
- **Corrigé** : l'import tourne maintenant en arrière-plan sur le serveur avec une barre de progression directement dans le bouton — tu peux quitter la page Réglages pendant l'import, il continue et reprend son affichage si tu reviens dessus.
- Deux bugs de reconnaissance corrigés au passage : la date d'un visionnage était mal interprétée (jour/mois inversés selon les exports), et les séries dont le titre contient lui-même un « : » (ex. minisérie) étaient mal découpées.

## v1.14.21 — August 2026

### Netflix

- Réglages → Netflix propose maintenant un lien direct vers ta page d'activité de visionnage Netflix (bouton « Télécharger tout »), pour ne plus avoir à chercher où trouver le fichier à importer.

## v1.14.20 — August 2026

### Nouveau : intégration Netflix

- Réglages → Netflix : importe ton historique Netflix (fichier téléchargé depuis ton propre compte Netflix, aucun mot de passe requis) pour marquer ces films et épisodes vus dans Movviz — strictement propre à chaque compte.
- Le statut « Vu » coché manuellement, ou importé depuis Netflix, est désormais répercuté vers ton compte Plex lié (film, série, saison, épisode) — jusqu'ici la synchronisation ne marchait que dans l'autre sens (Plex vers Movviz).

## v1.14.19 — August 2026

### Correctif

- Le popup « nouveautés » affichait parfois du texte non traduit pour les interfaces non françaises — la traduction par langue de ce popup avait cessé d'être maintenue depuis plusieurs versions sans que le mécanisme de repli s'en aperçoive. Simplifié : une seule source de vérité, en français, cohérente avec le reste du dépôt.

## v1.14.18 — August 2026

### Movviz AI

- L'assistant s'adapte maintenant au style de chacun (direct, familier, avec humour...) au lieu d'un ton figé, et varie ses formulations pour ne jamais se répéter.
- Quand tu reviens sur Movviz après un moment d'absence, l'assistant peut ouvrir la conversation tout seul avec une question sur le cinéma — jamais plus d'une fois toutes les quelques heures.
- Nouveau bouton « Créer le contexte » sur ta page de profil : une analyse de ton activité réelle (vues, demandes, retours) construit une compréhension durable de tes goûts — le mécanisme qui te plaît, pas juste le genre — et continue de s'enrichir toute seule au fil de l'usage, sans jamais tourner en continu.
- Les recommandations reconnaissent mieux la logique de franchise : le prochain épisode non vu d'une saga passe désormais en priorité, et plusieurs pistes peuvent être proposées (continuer la saga / même énergie ailleurs / encore plus extrême) plutôt qu'un seul choix imposé.
- Nouveau, optionnel et désactivé par défaut : recherche web (via Mistral uniquement) pour évoquer avec parcimonie une scène marquante d'un titre déjà vu — jamais de spoiler sur une série en cours, activable dans Réglages.
- L'assistant peut retenir qu'un titre a été vu simplement en te lisant le dire en conversation, sans devoir passer par sa fiche.
- Plusieurs affinages du moteur de recommandation (confiance pondérée sur les goûts appris, légère lassitude après un enchaînement du même type de contenu) et une consigne claire : ne jamais demander de reformuler, toujours essayer de comprendre.

## v1.14.17 — August 2026

### Movviz AI

- Deux audits complets ont trouvé et corrigé 7 bugs réels de compréhension : le moteur d'ambiance comparait des noms de traits qui ne correspondaient plus toujours d'une analyse à l'autre, une série était exclue des recommandations dès un seul épisode vu (au lieu de toute la série), un excès de contradictions internes dans les instructions de conversation, et une poignée d'autres corrections plus discrètes autour de la mémoire.
- Nouveau : « Ce que Movviz AI sait de toi », un panneau sur ta page de profil qui montre en clair (jamais du code brut) ce que l'assistant a retenu — faits, activité, recommandations aimées ou rejetées.

## v1.14.16 — August 2026

### Movviz AI

- Correction d'un bug sérieux : une recommandation citant un mot entre guillemets pouvait s'afficher en JSON brut au lieu de cartes — corrigé à la racine, plus aucun risque de fuite quoi qu'il arrive.
- Les conversations survivent maintenant à un redémarrage du serveur — seul le bouton corbeille les vide.
- Poster et titre d'une recommandation sont cliquables et ouvrent la fiche.
- Ajouter une recommandation déclenche maintenant une vraie réaction de l'assistant sur ce titre.
- Nouveaux modes de recommandation reconnus : « plus sombre », « moins violent », « propose-moi un truc » sans référence précise, ou volontairement méconnu.
- Les recommandations tiennent compte de tes retours 👍/👎 passés de façon plus fine (ce qui a plu ET ce qui a été rejeté, pas juste un des deux) et de l'appartenance à une même franchise que ce que tu regardes.
- Un besoin exprimé clairement dans l'instant ("là j'ai besoin de plus léger") passe désormais devant tes habitudes générales plutôt que d'être ignoré.
- L'assistant comprend mieux les demandes qui sortent du genre évident (« comme tel film, mais sans tel élément ») et pose une question ciblée plutôt que deviner au hasard quand ta demande est vraiment ambiguë.

### Réglages

- Nouvel onglet « Expérience » (vidéo sur les fiches, épisodes spéciaux) séparé du Tableau de bord.
- Nouveau réglage : les épisodes spéciaux ne comptent plus dans le statut « série vue complètement » (désactivé par défaut), et une saison pas encore sortie ne bloque plus ce statut non plus.

## v1.14.15 — August 2026

### Movviz AI

- Correction d'une dernière subtilité de mémoire : l'assistant ne dit plus « je vais noter ça » sans le faire réellement dans le même message — soit il utilise directement ce qu'il sait déjà, soit il dit clairement qu'il ne le sait pas encore.

## v1.14.14 — August 2026

### Movviz AI

- Nouveau bouton corbeille directement dans le chat sur une entrée « déjà présente » : si c'est en fait la mauvaise entrée, tu peux la supprimer toi-même en deux clics sans quitter la conversation (réservé aux admins, comme partout ailleurs dans Movviz — l'assistant ne supprime jamais rien lui-même).
- Ton prénom reste fixe une fois connu — il ne le redemande plus, et ne le change que si tu lui en donnes explicitement un autre.
- L'assistant peut désormais accorder naturellement ses phrases selon ton prénom, avec prudence et sans jamais insister si le contexte suggère autre chose.

## v1.14.13 — August 2026

### Movviz AI

- Correction d'un bug où l'assistant pouvait ajouter le mauvais film en cas de faux ami entre langues (ex. « un homme un vrai » ajoutait un film espagnol sans rapport) — il vérifie désormais la vraie ressemblance du titre avant d'ajouter quoi que ce soit, et préfère dire « introuvable » plutôt que de se tromper de film.

## v1.14.12 — August 2026

### Fiches film/série

- Retiré le doublon d'année à côté du titre — l'année reste affichée une seule fois, à côté de la durée.

## v1.14.11 — August 2026

### Movviz AI

- Nouvelle source de suggestions : en plus de ses propres idées, Movviz AI puise maintenant aussi dans les recommandations TMDb pour le titre que tu regardes — les deux sources passent par le même tri final (qualité, mood, historique, retours).
- Les recommandations ne s'affichent plus comme un bloc de cartes silencieux : chaque suggestion est maintenant introduite par une petite phrase différente ("Tiens, je pense que ça devrait te plaire", "Sinon il y a ça"...), pour une vraie sensation d'échange plutôt qu'une liste brute.

## v1.14.10 — August 2026

### Movviz AI

- L'humour de l'assistant s'adapte maintenant à n'importe quel genre (pas seulement l'horreur) et ne réutilise jamais la même blague deux fois.
- Les anecdotes restent désormais toujours courtes — une phrase glissée naturellement, jamais un pavé.

## v1.14.9 — August 2026

### Movviz AI

- Correction d'un bug de fond : un prénom donné en conversation ne survivait pas à un « vider la conversation » — une erreur de calcul faisait que la détection de première conversation ne se déclenchait en réalité jamais correctement.
- Le prénom d'un utilisateur est maintenant aussi capté directement au niveau du code (plusieurs formulations reconnues), sans dépendre uniquement de la bonne volonté du modèle de langage à le noter.
- Correction d'une fuite d'affichage où un texte technique interne pouvait apparaître en clair dans une réponse, et d'un cas où l'assistant notait une absence d'information comme si c'était un souvenir.
- Movviz AI demande maintenant explicitement le prénom dès la première conversation si tu ne le lui as pas donné, et relance naturellement tant qu'il ne le connaît pas.
- Il évite désormais de reposer la même question d'ouverture à chaque message.

## v1.14.8 — August 2026

### Movviz AI

- Panneau « Je me souviens de toi » retiré du chat.
- Correction d'un bug où l'assistant répondait par de simples points de suspension au lieu d'une vraie réponse — notamment quand tu réagissais à une recommandation déjà proposée (une question, une blague) au lieu d'en demander une nouvelle.
- L'assistant ne prétend plus avoir mémorisé quelque chose qu'il n'a en réalité jamais reçu (ex. ton prénom avant que tu l'aies donné).

## v1.14.7 — August 2026

### Movviz AI

- Pour une demande vague ou générale ("un truc de nana", "un film pour toute la famille"...), Movviz AI se base désormais explicitement sur le vécu réel de la personne qui demande (ses propres vues, ses propres demandes — jamais celles d'un autre compte du foyer) plutôt que sur un cliché générique ; sans indice exploitable, il pose une question plutôt que de deviner au hasard.

## v1.14.6 — August 2026

### Movviz AI

- Nouveau mode « Surprends-moi » : demande explicitement d'être surpris ou de sortir de tes habitudes, et l'assistant privilégie des titres compatibles avec ton goût mais volontairement différents du choix évident — en te disant pourquoi.
- L'assistant nuance désormais ses recommandations : il distingue ce dont il est sûr de ce qui est plus exploratoire, plutôt que de présenter chaque suggestion comme une certitude.

## v1.14.5 — August 2026

### Réglages

- Bouton « Enregistrer » de Movviz AI dupliqué en haut du panneau : après avoir activé l'IA ou collé une clé API, plus besoin de faire défiler toute la liste des fournisseurs pour sauvegarder.

### Movviz AI

- Correction : le champ de message du chat rognait le bas du texte d'exemple (placeholder) au lieu de l'afficher en entier sur deux lignes.

## v1.14.4 — August 2026

### Movviz AI

- Nouveau moteur de mood : quand tu demandes une recommandation depuis une fiche, Movviz analyse le ton profond du titre de référence et de chaque candidat (humour, énergie, tonalité...) pour classer les suggestions selon la vraie proximité d'ambiance, pas juste le genre TMDb.
- Première conversation avec l'assistant : il se présente et pose jusqu'à 3 petites questions (prénom, ce que tu aimes regarder en ce moment...) pour commencer à te connaître — jamais plus, jamais un formulaire.
- Personnalité affirmée : toujours content de te retrouver, une pointe d'humour bien placée (ex. un film d'horreur), et parfois une anecdote sur un titre — toujours formulée avec prudence, jamais présentée comme une certitude absolue.
- Garde-fou permanent : l'assistant ne peut et ne pourra jamais supprimer quoi que ce soit dans Movviz, quelle que soit la façon dont on le lui demande.

## v1.14.3 — August 2026

### Découverte

- Correction du fond : la rangée « Plateformes » utilisait une correspondance approximative par nom sur le catalogue TMDb, qui pouvait accrocher un service obscur au lieu du bon (ex. un module complémentaire méconnu au lieu du vrai service attendu). Remplacée par une liste fixe et vérifiée des 10 plateformes les plus utilisées en France, avec leurs vrais logos en meilleure qualité.
- Suppression de la rangée « Diffuseurs », qui faisait doublon avec « Plateformes » (mêmes marques, en moins bien : limitée aux séries).
- Sur mobile, les tuiles Plateformes/Studios passent en icônes rondes et compactes au lieu du grand format rectangulaire pensé pour desktop.

### Movviz AI

- L'assistant retient maintenant les faits que tu lui donnes en conversation (prénom, préférence explicite…) d'une session à l'autre, en plus de ses souvenirs déjà existants (titres ajoutés, recommandations acceptées).
- Nouveau retour 👍/👎 sur chaque recommandation — sert de base à un classement plus pertinent des futures suggestions.
- Le modèle propose maintenant davantage de candidats en coulisses ; Movviz les filtre et les classe lui-même (qualité, nouveauté, retours passés, déjà demandé) avant de n'afficher que les meilleurs — et exclut désormais purement et simplement tout titre déjà entièrement vu.

## v1.14.2 — August 2026

### Découverte

- Les filtres de plateforme de streaming (Prime Video, Netflix, Disney+, etc.) sont maintenant de vraies plateformes reconnues par TMDb, valables pour films ET séries à la fois — aucune clé API supplémentaire requise.
- Correctif : choisir une plateforme repassait de force sur « Séries » même en étant sur « Films », et rebasculer sur « Films » supprimait le filtre plateforme en revenant au tableau de bord. Le filtre reste maintenant actif quel que soit le type parcouru.
- Nouvelle rangée « Plateformes » sur la page Découverte.

### Movviz AI

- Correction : l'assistant confondait le nombre de films vus par l'utilisateur avec le nombre total de films dans la bibliothèque, donnant des réponses fausses sur la taille de la collection.

### Fiabilité

- Correctif d'un plantage aléatoire du carrousel du tableau de bord (Hero) et des fiches à vidéo d'ambiance : deux animations de transition imbriquées pouvaient entrer en conflit pour retirer les mêmes éléments de la page au même moment, provoquant occasionnellement une erreur générale de l'application.

## v1.14.1 — August 2026

### Movviz AI

- Correction : le bouton de chat n'apparaissait qu'après un rechargement complet de la page une fois Movviz AI activé dans Réglages — il apparaît maintenant immédiatement.
- Nouveau journal (Réglages → Movviz AI, admin) : historique des derniers appels au chat avec fournisseur utilisé, succès/échec, latence — pour comprendre ce qui s'est passé sans deviner.
- Chaque fournisseur affiche maintenant où obtenir une clé API gratuite directement dans Réglages.
- Détection de quota/clé invalide élargie (403 en plus de 429) pour une bascule plus fiable entre les clés d'un même fournisseur.
- Nouvelle étape, entièrement optionnelle, pour activer Movviz AI et ajouter une clé dès la première configuration de Movviz.
- Le fond et le logo personnalisés d'une fiche privilégient maintenant la langue de l'interface (logo français si disponible pour un utilisateur en français, etc.) plutôt que la simple popularité.
- Le logo s'affiche aussi dans le carrousel Hero du tableau de bord, pas seulement sur la fiche.

### Fiabilité et confirmations

- Suppression d'une fiche (bouton corbeille) et suppression définitive depuis la Corbeille : une confirmation est désormais toujours demandée, plus aucune suppression accidentelle en un clic.
- Synchronisation Plex accélérée après un téléchargement : Movviz déclenche sa propre synchro quelques secondes après un import au lieu d'attendre jusqu'à 5 minutes.
- Correctif de plein écran : le conteneur du lecteur avait des classes CSS de mise en page inertes (variante non enregistrée), remplacées par une logique fiable.
- Éditeur d'image de fiche fusionné avec « Modifier la fiche » (un seul bouton crayon) — la personnalisation d'image reste ouverte à tout utilisateur, les réglages structurels restent réservés aux admins.
- Sous-titres YouTube désormais bien désactivés sur les vidéos d'ambiance (fiches et carrousel).

## v1.14.0 — August 2026

### Movviz AI — chatbox intelligente (nouveau)

- Nouvel assistant conversationnel (bulle flottante, désactivé par défaut) : comprend les demandes en langage naturel, ajoute des films/séries à la bibliothèque, recommande dans le même ton (« après Scary Movie, propose Naked Gun » plutôt qu'une comédie au hasard), répond aux questions courantes.
- Multi-fournisseur (Mistral, OpenRouter, Gemini) avec plusieurs clés par fournisseur, rotation automatique en cas de quota atteint, et bascule vers le fournisseur suivant si besoin — configurable depuis Réglages (admin).
- Mémoire par utilisateur : l'assistant se souvient des titres ajoutés et des recommandations acceptées, et connaît un résumé chiffré de l'activité (films/séries/épisodes vus, demandes, séries les plus regardées) — strictement isolée par compte, jamais mélangée entre utilisateurs.
- N'appelle jamais le modèle de langage sans une demande explicite de l'utilisateur : aucune analyse en arrière-plan, aucun impact sur le fonctionnement normal de Movviz si l'IA reste désactivée.

### Suivi « vu » enrichi

- Les fiches film/série et les épisodes affichent désormais un historique daté (« vu hier », « il y a 3 jours »…), combinant Plex et la lecture directe depuis Movviz.
- Nouveau bouton « marquer comme vu / non vu » manuel sur les films, les saisons et les épisodes — complète Plex pour tout ce qui a été regardé ailleurs.

### Fiches film/série

- Bouton de reprise repensé : quand une lecture est en cours, la fiche propose directement « Reprendre à HH:MM:SS » (avec l'avancement visible) au lieu d'un bouton « Lire » générique — le choix « reprendre ou recommencer » reste toujours proposé à l'ouverture du lecteur.
- Nouveau réglage (Réglages → Expérience) pour désactiver la bande-annonce en fond animé sur les fiches et garder une image fixe.
- Le fond et le logo d'une fiche peuvent maintenant être personnalisés : un nouveau bouton ouvre un sélecteur d'images alternatives issues de TMDb (tout utilisateur peut ajuster, comme pour les tags).

### File d'attente

- Nouvel état « En attente » et « Vérification » dans le suivi des téléchargements, pour mieux distinguer une recherche qui traîne d'un import en cours de contrôle.

### Fiabilité

- Correction d'un bug de configuration de build qui pouvait, sur une machine de développement, faire gonfler démesurément la sortie de compilation — sans impact sur les images Docker/l'installeur Windows.

## v1.13.92 — August 2026

### Téléchargement manuel : la règle des mots interdits ne s'applique plus

- **Cause** : le contrôle « terme interdit » post-téléchargement (`checkPostImportBlockedWord`) s'appliquait à TOUS les imports, y compris ceux lancés manuellement par l'utilisateur. Un téléchargement manuel dont le nom contenait un mot interdit (ex. VOSTFR) était supprimé et la bibliothèque remise en « missing » au lieu d'être renommé/déplacé.
- **Correctif** : un grab manuel (page recherche, fiche film, panneau « Ajouter une version ») marque désormais son infoHash comme manuel (`manualGrab.ts`, mémoire TTL 6 h) dès que le moteur l'accepte. À l'import, ce torrent est exempté du contrôle des mots interdits : il est renommé, déplacé et importé normalement. Seuls les grabs automatiques gardent la règle.
- Première acquisition automatique, séries, épisodes : comportement inchangé.

## v1.13.91 — August 2026

### « Mise à jour par qualité » ne crée plus de doublons (2) (3) (4)

- **Cause** : la décision « remplacer la vidéo existante » n'était marquée que par le flux « Ajout de version » (LOT6). Tous les autres chemins de grab d'un film déjà disponible — bouton loupe de la fiche (recherche qualité), upgrade automatique 6 h, upgrade-candidates, recherche manuelle — ne marquaient aucune intention : le moteur renommait le nouveau fichier avec un suffixe de collision « (2) »/« (3) » dès que le nom final était occupé par l'ancien fichier, qui n'était jamais supprimé.
- **Correctif** : toute nouvelle version grabée pour un film déjà disponible (`movie.file`) marque désormais une intention « replace » sur l'infoHash avant le grab (`autoGrab`, `searchAndReplace`, route grab avec recherche manuelle). À l'import, l'ancien fichier primaire est supprimé du disque (gardes de sécurité : racine moteur validée, profondeur ≥ 2, nom assaini, unlink non-récursif) puis le nouveau fichier est renommé vers son nom final — plus aucun doublon « (n) » dans Plex.
- Première acquisition, séries et épisodes : comportement inchangé.

## v1.13.90 — August 2026

### « Année minimale des carrousels » enfin respectée partout

- **Cause** : le réglage `minYear` (Réglages → Expérience dashboard) n'était appliqué qu'aux rangées « Découverte » et « Recommandé pour toi » du dashboard — le Hero cinématique, « Récemment ajoutés », « Prochainement », les upgrades, et TOUTE la page Découverte (carrousels + « Tout voir ») ignoraient le filtre : un film de 1931 pouvait apparaître malgré une limite à 1985.
- **Correctif** : le filtre est maintenant appliqué partout de façon uniforme :
  - Hero cinématique : `buildHeroSlides` reçoit `minYear` et n'inclut aucun slide sorti avant.
  - Dashboard : toutes les rangées (Découverte, Recommandé, Récemment ajoutés, Prochainement, Upgrades) passent par le même filtre.
  - Découverte : carrousels TMDb + rangées C411 + pages « Tout voir » filtrés ; une recherche explicite (ou un filtre année manuel) reste non filtrée.

## v1.13.89 — August 2026

### Plus jamais de crash « removeChild » (erreur d'affichage globale)

- **Cause** : `NotFoundError: Failed to execute 'removeChild' on 'Node'` envoyait l'app entière dans l'écran d'erreur global. Le déclencheur : le menu utilisateur ouvert (dropdown framer-motion/AnimatePresence) au clic « Déconnexion » — la navigation vers `/login` démontait le shell pendant que l'animation de fermeture était encore en cours, et framer-motion/React se disputaient le même noeud DOM pendant la phase de commit.
- **Correctif 1 (cause)** : `UserMenu.logout` ferme le dropdown immédiatement et laisse son exit animation se terminer (~300 ms) avant le fetch de déconnexion et la navigation — le shell n'est plus jamais démonté avec une animation en vol.
- **Correctif 2 (filet)** : nouvel `AppErrorBoundary` (React error boundary) autour de tout l'arbre AppShell — une erreur de commit (manipulation DOM externe concurrente : hls.js/dash.js/YouTube pendant un unmount) ne peut plus tuer la session dans le global-error par défaut : écran de récupération + remontage propre via « Réessayer ».
- Testé en Edge headless : login → logout avec dropdown ouvert → redirection `/login` sans aucune erreur console.

## v1.13.88 — August 2026

### Déconnexion : la redirection vers /login fonctionne enfin

- **Cause** : dans `UserMenu.logout`, `router.refresh()` était appelé immédiatement après `router.push("/login")`. Un refresh émis juste après une navigation vers une autre page annule la navigation en cours (il re-synchronise la page courante) — la requête RSC de `/login` partait, répondait 200, mais l'URL ne changeait jamais. Reproduit en Edge headless : cookie de session bien supprimé, back sain, mais l'utilisateur restait sur le dashboard jusqu'au rechargement manuel.
- **Correctif** : plus de `router.refresh()` après le push dans les 3 navigations de fin de session (`UserMenu.logout`, `PendingApprovalScreen.logout` et le factory reset d'`AboutPanel` — même pattern, même risque). La page de login revalide déjà `/api/auth/me` elle-même au montage, le refresh était inutile.
- **Bonus** : `destroySession()` comparait le cookie complet (`raw.sig`) aux sessions stockées (`raw`) — la session n'était jamais réellement supprimée de `sessions.json` (elle moisissait jusqu'à l'expiration). Il extrait maintenant le `raw` comme `resolveSession()`.
- Photos des acteurs en carrés arrondis (cohérent avec les posters, au lieu des ronds).

## v1.13.87 — August 2026

### « Rechercher et remplacer » : les remplacements de codec (x264 → x265/AV1) enfin suggérés

- **Cause** : les upgrades de codec et de formats personnalisés n'étaient cherchées que dans le cache RSS (~50-150 releases les plus récentes) — seule l'upgrade de langue déclenchait une recherche directe chez les indexeurs. Avec un cache ne couvrant presque jamais le catalogue (710 films en x264 alors que x265/AV1 sont préférés, constaté sur les données réelles), le panneau affichait « Aucun remplacement suggéré » alors que des versions meilleures existent — et que le bouton « Remplacer » en trouvait une.
- **Correctif** : les scans films et épisodes répliquent maintenant le fallback du grab — si le cache ne contient aucun candidat et que le film/épisode peut gagner au score de codec (score inférieur au meilleur codec configuré), une recherche directe bornée (25 par run, même budget que le fallback langue) est lancée sur les indexeurs non rate-limités. Les épisodes gagnent aussi les upgrades par score de codec (jusqu'ici réservées aux films), sans nécessiter `preferredVideoCodec`.
- Le bouton « Remplacer » est inchangé : il refait sa propre recherche directe, comme avant.

## v1.13.86 — August 2026

### Priorité au clic : désormais garantie côté client

- **Cause** : le marquage d'activité au re-rendu du layout serveur ne couvrait pas les navigations client — l'App Router ne re-rend pas les layouts à chaque navigation (ils sortent du cache routeur). Un clic de lien restait donc invisible de l'arrière-plan, qui ne cédait pas la main pendant le chargement de la page.
- **Correctif** : un nouveau composant client (UserActivityPing) écoute chaque clic réel (pointerdown en phase capture, limité à ~1/s, keepalive) et envoie un ping POST à `/api/activity/ping` qui marque l'activité dans le processus serveur. L'arrière-plan cède maintenant dès le clic, quel que soit le chemin de navigation — clic, chargement de page et recherche restent prioritaires pendant les scans, bulk et téléchargements.

### Ré-téléchargement : l'ancienne version est réellement remplacée

- **Cause** : la lecture est résolue via Plex (ratingKey → version primaire du film). Après un ré-téléchargement, l'ancien fichier restait sur disque → Plex conservait deux versions du même film et servait toujours l'ANCIENNE (observé en direct : Alita en SBS, version non-SBS téléchargée, lecture encore en SBS).
- **Correctif** : tout import de remplacement (sélection manuelle, mise à niveau qualité) supprime l'ancien fichier du disque dès qu'un fichier primaire existait — sauf choix explicite « Ajouter comme version supplémentaire ». Suppression gardée (jamais le fichier importé lui-même, jamais hors racine bibliothèque) ; Plex rescanne ensuite et ne voit plus qu'une seule version : la lecture sert la nouvelle.

### Réinitialisation d'usine — plus de dossier config, retour au wizard

- **Problème** : supprimer le dossier config à chaud ne servait à rien — le serveur en cours d'exécution régénère les fichiers depuis sa mémoire (cache globalThis, écritures coalescées 300 ms) et la session cookie reste valide ; l'app continuait de s'afficher normalement, sans wizard.
- **Correctif 1 — détection automatique** : si plus aucun compte n'existe (dossier config supprimé), l'AppShell redirige automatiquement vers le wizard (`/setup`) au lieu d'afficher une app cassée.
- **Correctif 2 — bouton « Réinitialisation complète »** dans Réglages → À propos (admin) : purge tous les caches mémoire du serveur, supprime le dossier config (suppression validée : chemin absolu + profondeur), efface le cookie de session, puis ouvre le wizard au rechargement.

## v1.13.85 — August 2026

### Correction : le plafond de 10 cartes ne concerne que la rangée tendance à classement

- **Rappel du problème** : seule la rangée « Tendances Movviz » (celle avec les chiffres du top 10) affichait plus de 10 cartes — les autres rangées fonctionnaient parfaitement avec leur longueur d'origine.
- **Correctif v1.13.84 ajusté** : la limite de 10 cartes est restreinte à la seule rangée tendance fusionnée (tendances ∪ populaires), à la source. Toutes les autres rangées — recommandé pour toi, nouveautés, kids, etc. — reprennent exactement leur longueur d'origine ; aucune régression d'affichage sur les rangées qui n'étaient pas concernées.

## v1.13.84 — August 2026

### Rangées « Tendances Movviz » : toujours 10 cartes maximum

- **Cause** : la rangée fusionnée « tendances ∪ populaires » n'était pas plafonnée — contrairement à la rangée « Tendances » simple (10 max) — et le Dashboard affichait la liste complète (jusqu'à ~40 cartes) dès que la fusion dépassait 10. Résultat : des rangées surchargées avec cartes sans rang, chargement lourd et affichage problématique (observé notamment sur Mac ARM).
- **Correctif** : toutes les rangées de `/api/metadata/rows` sont désormais plafonnées à 10 cartes (même règle que « Tendances »), et le Dashboard applique aussi la limite en ceinture de sécurité. Le bouton « Voir tout » ouvre toujours la version paginée complète.

## v1.13.83 — August 2026

### Priorité absolue au clic et au chargement de page

- **Navigation et chargement marquent désormais l'activité utilisateur** : le layout racine (re-rendu serveur à chaque navigation App Router) marque l'activité dès qu'une session est présente — avant, une navigation pure (sans appel API derrière) restait invisible du système de priorité, et l'arrière-plan ne cédait pas la main pendant le chargement de la page. Chaque clic de lien fait donc céder l'arrière-plan immédiatement (yieldToUser), qui reprend 4 s après la dernière interaction.
- **Le sync Plex cède maintenant la main** : c'était le dernier gros consommateur sans cession — ses boucles (films, séries, sections) faisaient des centaines de fetch Plex/TMDb séquentiels sans jamais s'interrompre pendant que vous cliquiez. `yieldToUser("sync Plex films/séries")` est désormais appelé à chaque item et à chaque section ; une navigation le met en pause jusqu'à 30 s, puis il reprend.
- **Recherches manuelles plafonnées** : la recherche en direct (fallback indexeurs) lançait `Promise.all` sur tous les indexeurs sans aucune limite — 3 onglets + un grab pendant une bulk = des dizaines de sockets ouverts, et tout le serveur (clics inclus) ralentissait. Un sémaphore global limite à **2 recherches directes simultanées** (la suivante attend un slot ≤ 15 s puis passe quand même) : le chargement de page reste fluide pendant les pics.
- **Rappel** : le reste du mécanisme était déjà en place — lanes (`runBackground`), rate-limit indexeur avec réserve garantie à l'utilisateur (5 slots/hôte + 10 global), file de jobs avec watchdog 10 min et concurrency réduite pendant les téléchargements.

## v1.13.82 — August 2026

### Logs de diagnostic sous-titres (mode ffmpeg)

- Le démarrage du remux logue la sortie WebVTT ajoutée (`[remux] sortie WebVTT piste=0:s:N`) ; la route des sous-titres logue le chemin emprunté à chaque demande (`[subtitle] FAST PATH fichier=...` vs `[subtitle] pas de session live — extraction dédiée`). Permet de trancher immédiatement dans `docker logs` si le lecteur instantané est utilisé.

## v1.13.81 — August 2026

### Sous-titres mode ffmpeg : quasi instantanés (0,5 s au lieu de ~1 min)

- **Nouveau fast path** : le process de remux (qui lit déjà le fichier pour produire la vidéo) écrit **aussi** la piste de sous-titres texte en WebVTT dans un fichier temp, en sortie secondaire — au rythme de la lecture du film, sans aucune lecture disque/réseau supplémentaire. La route des sous-titres tail-e ce fichier et streame les cues au lecteur : **le premier cue arrive en ~0,4 s** (vérifié par reproduction locale), au lieu d'attendre qu'une extraction séparée relise tout le fichier depuis le début (~1 min sur NAS).
- **Bascule automatique de session** : au seek, au changement de qualité ou d'audio, le remux redémarre avec un nouveau fichier temp — le stream de sous-titres bascule seul dessus (temps absolus identiques, aucun trou dans les cues), sans interruption pour le lecteur. En pause, l'extraction suit la vidéo (backpressure) et reprend seule.
- **Fallback conservé** : piste texte non pré-extraite (autre langue que la piste par défaut) → extraction ffmpeg dédiée comme avant ; pistes image (PGS/VobSub) → repli transcode Plex (HLS) inchangé.
- **Sécurité** : fichiers WebVTT temporaires supprimés à la mort de la session (unlink ciblé, nom restreint dans le répertoire temp système uniquement — jamais de suppression récursive).

## v1.13.80 — August 2026

### Sous-titres mode ffmpeg : 2e bug racine — le parseur ne comprenait pas le format de ffmpeg

- **Corrigé** : les sous-titres restaient invisibles même après le fix du double-annulation — cause confirmée par reproduction locale de l'extraction : le muxer WebVTT de ffmpeg écrit les lignes de timing en `MM:SS.mmm` quand les heures valent 0 (film de moins d'1h → **aucun** cue parsé ; film plus long → seulement les cues après la 1ère heure). Le parseur exigeait `HH:MM:SS.mmm` : les heures sont désormais optionnelles dans la regex, les deux formats sont acceptés et les temps restent corrects (0h36m12s → 2172s).
- **Vérifié par reproduction** : fichier MKV de test avec 3 cues (1s, 5.5s, 1h02m) → ancienne regex : 1 cue sur 3 ; nouvelle regex : 3 sur 3, secondes exactes.

## v1.13.79 — August 2026

### Sous-titres du mode ffmpeg : bug racine corrigé (ils ne chargeaient jamais)

- **Corrigé** : en mode ffmpeg, les sous-titres textes (SRT/ASS/SSA/WebVTT) ne s'affichaient jamais — cause racine confirmée en direct : au chargement d'une piste, la fonction de nettoyage annulait le fetch de sous-titres qu'on venait tout juste de lancer (double `abort()` sur le même AbortController), et le gestionnaire d'erreur considérait cette annulation volontaire comme un cas normal → retour silencieux, aucun repli, aucun message. Les pistes sont désormais chargées sans être sabotées : extraction WebVTT locale (méthode Plex : sous-titres servis à part et rendus par le client, jamais incrustés dans la vidéo), rendu via la balise `<track>` native, temps réels du film (décalage `seekBase` recalculé à chaque seek).
- **Amélioré** : le track est construit **immédiatement** au chargement de la piste — les sous-titres apparaissent au fil de l'arrivée des paquets d'extraction au lieu d'attendre la fin de lecture du fichier entier (long sur NAS, ffmpeg lit tout le film pour extraire la piste).
- **Rappel** : pistes image (PGS/VobSub, non convertibles en texte) → bascule automatique sur le transcode Plex (HLS) comme avant.

## v1.13.78 — August 2026

### Plein écran : les contrôles Movviz restent maîtres

- **Corrigé** : le bouton plein écran passait le `<video>` seul en fullscreen natif → le navigateur imposait ses propres contrôles, qui affichaient le temps du **flux** (repart de 0, relatif au seek) au lieu de la position réelle du film, et dont le seek natif ne rechargeait pas la session serveur — le « temps du buffer au lieu du film, impossible d'avancer » signalé en plein écran. Le plein écran s'applique désormais au **conteneur du player** : nos contrôles (barre de progression avec `seekBase + currentTime`, menus, header, double-tap, gestes) restent affichés et fonctionnels, fond noir cinématique. iPhone conservé sur le plein écran natif du `<video>` (la Fullscreen API n'existe pas sur un conteneur iOS — limite navigateur, inévitable).

## v1.13.77 — August 2026

### Transcode vidéo optimisé NAS + crash serveur corrigé

- **Optimisé — transcode vidéo local pensé pour le NAS** : l'encodeur passe de `veryfast` à **`ultrafast` + `zerolatency`** (frames livrées dès encodées, pas de lookahead) — sur un NAS ARM/SoC, le premier buffer arrive ~2× plus vite et les reprises après rebuffer repartent immédiatement. Le **GOP est raccourci à 2 s** (`g 48`) : un seek ou un changement de qualité re-synchronise en moins de 2 s au lieu d'attendre un keyframe tiré au hasard (souvent 10 s+ — c'est ce qui donnait « le transcode vidéo rame »). Profil `main` pour un décodage hardware garanti sur tous les clients. Débits sobres inchangés (10/6,5/4/2,2 Mb/s) — la qualité reste correcte, c'est la latence qui chute.
- **Corrigé — crash serveur « Invalid state: Controller is already closed »** : quand le client abandonnait une session de transcode vidéo (seek, changement de qualité, fermeture du lecteur), la course entre la propagation asynchrone du cancel HTTP et l'arrêt de ffmpeg pouvait détruire un flux dont le controller Web était déjà fermé → exception non rattrapée qui tuait le process serveur (503 généralisé). Les flux abandonnés sont désormais marqués dès l'abort de la requête et ne sont plus jamais détruits avec erreur ; l'erreur reste propagée pour les vrais échecs d'encodage (repli HLS intact).

## v1.13.76 — August 2026

### Smartphone : lecteur niveau Netflix, option « année minimale » pour les carrousels

- **Nouveau — Réglages → Dashboard → Hero → Année minimale des carrousels** : choisis l'année à partir de laquelle les films sont affichés dans les carrousels « Découverte » et « Recommandé pour toi » — fini les vieilleries de 1955. « Toutes les années » par défaut, aucune modification de bibliothèque, filtrage uniquement à l'affichage.
- **Nouveau — lecteur smartphone (375px/768px)** : double-tap gauche/droite sur la vidéo = recul/avance rapide ±10 s avec retour haptique et toast (comme Netflix), le tap simple affiche les contrôles sans jamais couper la lecture, la barre de contrôles ne déborde plus (boutons transcode/lecture directe repliés sur tablette+, volume réservé au desktop où son curseur apparaît au survol).
- **Corrigé — iPhone** : bouton plein écran fonctionnel (webkitEnterFullscreen), respect des zones de sécurité (notch et barre d'accueil), surface tactile du slider agrandie (32px), plus de rebond élastique parasite.
- **Corrigé — mode clair** : boutons du header, badges d'état et menus du lecteur sont désormais forcés en sombre cinématique (noir translucide) — fini les icônes blanches sur fond blanc ; l'auto-masquage des contrôles ne ferme plus un menu en cours de lecture.
- **Perf mobile** : flou de l'ambiance réduit sur petit GPU (max-sm:blur-2xl), Ken Burns conservé.

## v1.13.75 — August 2026

### Lecteur : HLS devient une option manuelle, profils de compression ffmpeg, design premium

- **Nouveau — stratégie de lecture** : le transcode HLS (Plex) n'est plus choisi automatiquement. En mode « Auto », la lecture passe par la **lecture directe ou le remux FFmpeg local** ; si aucun moteur local ne peut lire le fichier, une erreur explicite s'affiche au lieu de basculer silencieusement sur le transcode Plex. HLS reste disponible **manuellement** dans Réglages → Plex → Moteur de lecture (« HLS (transcode Plex) — manuel ») pour les situations où il reste utile (sous-titres image PGS/VobSub, piste audio exotique, réseau limité).
- **Nouveau — profils de compression ffmpeg** : le menu Qualité du lecteur propose désormais **Original / 4K / 2K / FHD / HD** avec un véritable transcode local (libx264 très rapide, CRF 23, débits sobres pensés NAS : 10 / 6,5 / 4 / 2,2 Mb/s, downscale sans jamais dépasser la source). « Original » conserve la copie bit-exacte actuelle (zéro CPU). Le changement de qualité recharge la session ffmpeg à la position courante ; sur une leg directe/MSE, le lecteur bascule sur le transcode local.
- **Nouveau — design premium du lecteur** : scrim dégradé en bas de l'écran (fini le bandeau opaque), barre de progression fine qui s'épaissit au survol avec fill dégradé lumineux et vignette de scrub qui zoome, bouton lecture/pause central géant, menus en verre dépoli avec coche sur l'élément actif, toast de feedback sur les skips ±10 s, anneau de chargement à la marque, carte de reprise et écran d'erreur redessinés, header en surimpression dégradée en mode plein écran, vignette cinématique et respiration Ken Burns de l'ambiance, curseur masqué quand les contrôles disparaissent.

## v1.13.74 — August 2026

### Lecteur : position de lecture correcte en mode ffmpeg, sous-titres 100 % locaux sans Plex

- **Corrigé** : en mode ffmpeg, la barre de progression se remettait au début après un clic au milieu de la vidéo (le contenu, lui, se positionnait bien). Le flux remuxé est un MP4 fragmenté sans index : le navigateur repart de zéro à chaque seek/rechargement, même si le serveur cherche à la bonne position. Le lecteur affiche et sauvegarde désormais `seekBase + currentTime` (position du dernier seek + temps rejoué), et le repère est aussi conservé quand on change de piste audio ou qu'on coupe le lecteur.
- **Nouveau** : les sous-titres fonctionnent maintenant **sans passer par Plex** en mode ffmpeg — Movviz extrait lui-même la piste de sous-titres du fichier brut via ffmpeg (conversion en WebVTT) et la rend via la balise `<track>` native du navigateur, avec un décalage recalculé à chaque seek. La vidéo reste copiée bit-exacte, aucun transcode vidéo n'est nécessaire. Les pistes **texte** (SRT, ASS, SSA, WebVTT, mov_text…) restent sur le moteur ffmpeg ; les pistes **image** (PGS/VobSub des remux Blu-ray, non convertibles en texte) basculent sur la leg HLS comme avant. Retirer les sous-titres ne quitte plus le mode ffmpeg.

## v1.13.73 — August 2026

### Lecteur : moteur ffmpeg respecté, détection de son en moins d'une seconde, choix de piste audio en mode ffmpeg

- **Corrigé** : quand le moteur **ffmpeg** est sélectionné dans Réglages → Plex, le lecteur relançait parfois une lecture directe au lieu du remux local — le choix du moteur n'entrait pas dans le calcul de stratégie. Désormais, moteur ffmpeg = remux ffmpeg pour tout fichier (le bouton ⚡ relance aussi le remux plutôt qu'une lecture directe), avec HLS en dernier recours si ffmpeg est indisponible.
- **Amélioré** : la veille de silence de la lecture directe détecte désormais une piste audio muette en **moins d'une seconde** (fenêtre 800 ms) au lieu de 6 s, puis escalade vers le **remux ffmpeg local** (son transcodé en AAC, vidéo copiée) avant de retomber sur le transcodage Plex. Le verdict ne tombe qu'une fois le décodage réellement commencé, pour ne jamais confondre un démarrage lent avec un vrai silence (aucune régression pour les vidéos compatibles).
- **Nouveau** : les menus piste audio / sous-titres sont maintenant disponibles quand le moteur ffmpeg est actif — changement de langue audio direct (session remux rechargée avec la bonne piste, position conservée), et bascule automatique vers la leg HLS (Plex) quand un sous-titre est demandé (le remux local ne grave aucun sous-titre).

## v1.13.72 — August 2026

### Nouveau : réglage de langue audio préférée pour le lecteur

- **Nouveau** : Réglages → Plex propose désormais une langue audio préférée pour le choix de piste par défaut à la lecture (français, anglais, espagnol, allemand, italien, néerlandais) — sur "Automatique" (par défaut), suit la langue de l'interface comme avant ; un compte qui utilise Movviz en français mais préfère l'audio anglais peut désormais le dire explicitement, sans que ça change son interface.

## v1.13.71 — August 2026

### La piste audio dans la langue de l'interface était choisie... puis silencieusement écrasée par une autre piste du même codec

- **Cause racine confirmée en direct** (Jurassic Park 499959, deux pistes AC-3 français/anglais) : la piste française était correctement choisie — à la fois par la nouvelle règle de langue et par le "selected" de Plex lui-même — mais un mécanisme de repli plus ancien (pensé pour fuir un codec vraiment indécodable, ex. DTS → AC-3) ne vérifiait jamais si la piste de secours avait un codec réellement différent. Les deux pistes de ce film étant toutes les deux en AC-3, ce repli "réussissait" en basculant vers l'autre piste (anglaise) simplement parce qu'elle n'était pas exclue — sans apporter la moindre compatibilité supplémentaire, écrasant silencieusement le bon choix français.
- **Corrigé** : le repli exige désormais un codec réellement différent de celui de la piste déjà rejetée.

## v1.13.40 – v1.13.70 — August 2026

### Lecture vidéo : chaîne de secours multi-niveaux, remux ffmpeg local, lecteur mis à niveau

- **Nouveau** : la lecture d'un fichier passe désormais par une chaîne de secours à plusieurs niveaux, chacun essayé automatiquement selon ce que le navigateur peut réellement décoder — lecture directe → MSE (copie bit-exacte, parseur MP4 maison) → **remux ffmpeg local** (nouveau moteur, prend le relais pour tout conteneur/codec que le parseur MSE ne gère pas, MKV en particulier) → DASH/HLS (transcodage Plex, dernier recours). Le remux ffmpeg récupère le fichier source brut directement chez Plex et le remuxe lui-même (copie vidéo à coût CPU nul, audio copié ou transcodé en AAC selon le codec) — zéro dépendance à la décision de transcodage de Plex, qui s'est révélée être une heuristique interne non documentée et non influençable de l'extérieur (refus de copier le bitstream HEVC en HLS quel que soit le paramètre envoyé côté client, quelle que soit la variante testée).
- **Corrigé** : le protocole DASH est désormais utilisé pour toute source HEVC/AV1 ou toute session de transcodage — c'est le seul protocole où Plex honore la copie du bitstream HEVC (le HLS ré-encode systématiquement ces sources, y compris en mode "audio seul", ce qui était la vraie cause du lag ressenti). Le profil client déclaré à Plex ("Plex Web") couvre désormais HEVC/AV1 pour HLS ET DASH, et les deux modes "Transcodé (audio)"/"Transcodé (vidéo)" du menu — un temps inversés — pointent vers le bon comportement Plex.
- **Corrigé** : plusieurs pièges de décodage audio identifiés et résolus en conditions réelles — l'AC-3 copié dans un MP4 progressif n'est pas décodé nativement par Chrome/Edge (contexte différent du transmux hls.js/MSE, corrigé en restreignant la copie du remux aux codecs universellement décodables et en transcodant le reste en AAC), et Dolby Digital(+) ne peut pas être observé par la veille de silence (elle se base sur le graphe Web Audio, hors de portée pour ces codecs) — chacun de ces cas est maintenant détecté ou évité correctement plutôt que de produire une lecture silencieuse sans erreur visible.
- **Corrigé** : robustesse du pipeline durcie au fil de tests en conditions réelles — conditions de course dans le moteur MSE et dans les sessions ffmpeg (buffers, seek, arrêt propre du flux serveur quand le client abandonne, y compris un cas qui pouvait faire planter tout le serveur), durée et position de lecture fiabilisées pour le flux ffmpeg (conteneur fragmenté sans durée connue à l'avance côté navigateur).
- **Nouveau** : le lecteur choisit désormais la piste audio par défaut selon la langue de l'interface Movviz (même règle que le badge audio), n'active des sous-titres automatiquement que si aucune piste audio ne correspond à cette langue, affiche une vignette d'aperçu au survol de la barre de progression (relayée depuis Plex, qui la génère déjà pour son propre lecteur), et gère de nouveaux raccourcis clavier (volume, saut direct par pourcentage) en plus des raccourcis existants (lecture, ±10s, plein écran, muet, fermer).

## v1.13.65 — August 2026

### Le Hero épinglait toujours les mêmes titres

- **Corrigé** : les pools sans ordre naturel (suggestions personnalisées, découverte, jamais regardés) sont désormais mélangées avec une graine déterministe par jour et par utilisateur — rotation toutes les 24 h au lieu des mêmes 2-3 titres épinglés indéfiniment ; les pools chronologiques (recentlyAdded, upcoming, recentActivity) ne sont pas touchés.

## v1.13.63 — August 2026

### Une série avec un seul épisode "à venir" s'affichait comme manquante — la carte série ignorait le statut "upcoming"

- **Cause racine confirmée** : `LibrarySeriesCard` calculait l'exhaustivité d'une série avec `available === monitored.length`, en comptant les épisodes non encore diffusés ("à venir") comme s'ils devaient déjà être disponibles — une série entièrement téléchargée avec un seul épisode pas encore diffusé retombait donc sur le badge ambre "manquant", alors que `SeasonAccordion`, `TitleContent` et la page Bibliothèque traitent déjà correctement "disponible OU à venir" comme complet.
- **Corrigé** : la carte série applique désormais la même règle que partout ailleurs dans l'app.

### « Rechercher et remplacer » proposait de remplacer un fichier par un fichier quasi identique quand la langue actuelle était inconnue

- **Cause racine confirmée en direct** : quand la langue du fichier possédé n'est pas connue (non détectée), toute release en cache dans la langue cible (VF) était proposée comme "amélioration", sans jamais vérifier si elle apportait quoi que ce soit de réel — la même résolution, le même codec (x264≈H.264, x265≈HEVC affichés différemment mais identiques) et une taille quasi identique déclenchaient quand même une proposition de remplacement. Le garde-fou existant (`isMeaningfulUpgrade`, écart de taille ≥ 10 %) était explicitement contourné pour ce cas précis ; côté séries, ce garde-fou n'existait tout simplement pas.
- **Corrigé** : les propositions basées sur la langue exigent désormais le même écart de taille minimum (10 %) que les autres types d'amélioration, côté films comme côté épisodes — les suggestions de résolution/codec réels ne sont pas affectées.

## v1.13.39 — August 2026

### Added an opt-in toggle for YouTube trailer search — off by default explains why trailers stayed in English

- **Added**: the YouTube search fallback for trailers (used whenever TMDb has none in the viewer's language) is a page scrape, not an official API — it depends on YouTube not rate-limiting the server's IP, and a single silent failure gets cached for 24h, so it was always off by default. That default is why trailers kept showing in English despite the mechanism existing and working correctly when tested directly. A new toggle in Réglages → Tableau de bord ("Bandes-annonces") turns it on — off by default still, but now an explicit, visible choice instead of a silent one.

### Titles stuck "searching" gave the "Downloading" tile a nonzero count with nothing there to explain it

- **Added**: instead of just no longer counting "searching" items as downloading (last release), they now get their own dedicated "Recherche en cours" dashboard tile — so that number doesn't just disappear, it moves to where it actually belongs.

---

## v1.13.36 — August 2026

### The "Downloading" dashboard tile could show a nonzero count with nothing actually downloading

- **Fixed**: the tile counted episodes/movies still "searching" (actively looking for a release, no torrent grabbed yet) as if they were downloading. Confirmed live: a whole season stuck in "searching" with no active torrent inflated the count to 9 while zero downloads were actually running. The tile now only counts items with a real active download.

### A title's play button could disappear entirely with no explanation

- **Fixed**: the watch button on a title page was gated entirely on Plex having already linked the file — a file Movviz already has ready, but that Plex hasn't scanned into its own library yet (a normal async timing gap), showed no button at all instead of something explaining the wait. It now shows a clearly disabled placeholder with a tooltip instead of vanishing.

### Two unrelated title-page buttons shared the exact same icon

- **Fixed**: "manage versions" and "view saga/collection" both used the same stack icon, confusing on a title that has both. The collection link now uses a visually distinct icon.

---

## v1.13.34 — August 2026

### The same notification could keep firing for content that had been available for days

- **Fixed**: notifications were never deduplicated — a scheduled job re-scanning content it couldn't fully clean up after import could re-emit the exact same "now available" notification every run, confirmed live with a season-available notification repeating every ~30 minutes for a title that had actually been available for a week. The same notification kind with the same details now only fires once within a one-hour window; a genuine repeat further out (e.g. days later) still comes through normally.

### The "Classic" dashboard mode was reworked to match "Cinema" minus the hero

- **Changed**: Classic mode now reuses everything Cinema mode offers — the compact stat pills and the full row layout (Tendances, Suggestions adaptées, Ajouts récents, etc.) — just without the large hero banner at the top, per feedback. It previously fell back to a bare stat-tile grid and a flat "recently added" list with none of Cinema's rows.

---

## v1.13.33 — August 2026

### Added a manual seed toggle for completed downloads

- **Added**: a completed download in the queue now has a dedicated button to start or stop seeding it, independent of the pause/resume controls used for active downloads. Turning it off genuinely halts upload activity rather than just hiding a status — for the default download engine this fully detaches the torrent from peers; turning it back on re-establishes it, rebuilding the original file layout as needed if the files were already moved into the library, without ever touching or re-downloading the library copy.

### Poster row titles weren't centered under their cards

- **Changed**: the title under each poster card in the dashboard rows (Tendances, Suggestions, Ajouts récents) is now centered under the poster, per feedback — previously it could sit off-center, especially in the ranked Top-10 row.

---

## v1.13.32 — August 2026

### Downloads never showed a time remaining

- **Fixed**: the queue's "temps restant" (ETA) field was only ever computed by two of the three download-engine backends — the default one (the engine actually used day to day) never passed a `timeRemaining` value through at all, so the field was always empty in the queue view. It's now computed the same way the other backends already do (remaining bytes over current speed), so an active download shows a real estimate.

---

## v1.13.31 — August 2026

### A working file path could get silently overwritten by Plex's own view of the filesystem

- **Fixed**: on every Plex sync, an already-correct, working file path for a movie or episode could be overwritten by whatever path Plex itself reports for that file. When Plex and Movviz run in separate containers with different volume mounts for the same physical media, Plex's reported path doesn't exist from Movviz's own filesystem view — so a perfectly good, working path silently turned into a broken one, flooding "Réparer les chemins" with false positives for titles that were never actually broken. Movviz now learns the correspondence between Plex's path layout and its own automatically — by comparing, for a title it already tracks correctly, its own verified working path against what Plex reports for that exact same title — and translates future Plex reports through that learned mapping instead of trusting them blindly. No settings screen, no manual configuration: it deduces the mapping itself from data it already knows for certain. A path is only ever written if it's independently verified to exist on disk first — a wrong or stale mapping can at worst produce a false "missing" flag (recoverable by hand), never a silently lost reference to a real file.

---
## v1.13.30 — August 2026

### "Réparer les chemins" could suggest hundreds of completely unrelated files as candidates

- **Fixed**: when a broken episode file couldn't be found by its exact recorded filename, the last-resort fallback matched it against every video file in the whole library sharing the same season/episode numbers — regardless of which show it actually belonged to. Confirmed live: a single broken episode could come back with 500+ "candidates" that were really just every other show's own episode 1, episode 2, etc. This fallback now only offers files that plausibly belong to the actual series (by filename or folder name), so the suggestion list is short and relevant again. Present since v1.12.86 — not something changed in this recent batch of fixes, and no other matching path (exact filename, expected-path, or the duplicate-conflict warning) was touched.

### Trending row's Top-10 numerals overlapped too much of the poster

- **Changed**: the ranking numeral behind each Top-10 card in the "Tendances" row sat too far under the poster, leaving only a sliver visible to the left. It now overlaps far less — most of the number is visible to the left of the card, with just its trailing edge tucked behind, per feedback.
- **Changed**: the "Tendances" row now shows first on the dashboard, above "Ajouts récents", per feedback.

### Collection "download missing" could grab the wrong title instead of the actually missing one

- **Fixed**: two compounding bugs, both confirmed live across several collections. First, the button computed which titles were missing from a shared, app-wide cached library/collection snapshot that could be stale with nothing visibly wrong on screen — both the library and the collection's part list are now re-fetched fresh right before downloading. Second, and the more consequential one: a duplicate-detection guard meant to catch TMDb listing the same released film under two ids used fuzzy title matching with no real year requirement — it could silently reuse an unrelated, already-owned entry for an unconfirmed franchise placeholder, or confuse a real film with a same-franchise featurette a year off with an extra title suffix. That guard now requires an exact normalized title AND an exact, confirmed release year on both sides before ever trusting a match.

### Friend accounts were all getting the server owner's own Plex watch history

- **Fixed**: every linked friend account carried a genuinely distinct Plex identity and token, yet all of them synced the exact same watch counts as the account that owns the server. Root cause confirmed against Plex's own documented behavior: the endpoints used to sync watch status report `viewCount` from the server owner's perspective only, regardless of which valid account's token makes the request — no request header can change that. Watch-status sync now uses Plex's session-history endpoint instead, queried with the admin token and filtered by each account's own Plex id — the way Plex actually tracks per-account viewing — working the same for friend accounts and Home-managed profiles now, instead of two separate paths.

## v1.13.22 — August 2026

### "For you" recommendations are strictly per-account again, and a Plex watch-sync failure no longer looks like "watched nothing"

- **Changed**: reverted v1.13.21's household-blending — after more feedback, "For you" is back to being built ONLY from an account's own Plex watch history, with no signal from any other account, even a small one. An account with just a couple of watched titles now gets a personalized row from those alone, instead of needing a minimum before anything shows.
- **Fixed**: the Plex watch-status sync silently swallowed every error (network hiccup, expired token, unreachable section) and saved an empty result regardless — indistinguishable from "this account genuinely hasn't watched anything," and capable of quietly erasing real watch history on a transient failure. It now leaves existing data untouched when a sync can't reach any library section, and every sync attempt — success or failure, and for which account — is logged to Réglages → Journaux, so a silently-failing account is finally visible instead of just looking empty.

### "For you" recommendations can now draw on the whole household's Plex history, not just your own

- **New**: when an account's own Plex watch history is thin or empty, its "For you" row now also blends in what other accounts on the same instance have watched (weighted lower than the account's own history) — so someone without their own Plex link can still get a real, personalized row instead of the flat generic "top rated" fallback. This only kicks in once at least two other accounts have real watch data of their own — a single other account's taste is never used as a stand-in "household" signal, to avoid quietly cloning one person's picks onto someone else. Each account's own row stays exactly as personal as before; this only ever adds a broader signal on top, never replaces the account's own history when it's already there.

### Episode titles and descriptions always came back in French, regardless of the interface language

- **Fixed**: the season/episode data call (thumbnails, titles, descriptions — added in v1.13.12 and extended to owned series in v1.13.19) never told TMDb which language to answer in, so it silently defaulted to French for every user, even with English (or any other) selected as the interface language. This was the exact same bug already fixed once for title detail pages — just never applied to this specific call. It now follows the app's selected language like everywhere else.

### Episode thumbnails and descriptions now show up everywhere, not just for series you don't own yet

- **Fixed**: v1.13.12 added a thumbnail and short description to each episode row, but only for series not yet in your library — episodes of series you already own showed as plain text rows with no preview at all. Both views now pull from the same live TMDb data, so a downloaded/available episode shows exactly the same preview as one you haven't grabbed yet — with none of the existing quality badges, watched marker, status pill, or search buttons removed.
- **Fixed**: episode air dates in that same list rendered in your browser's own locale format regardless of Movviz's selected language (e.g. showing the US month/day order even with French selected) — now consistently follows the app's language, like every other date in Movviz.

### Retrying a partially-imported season pack could try to rename its leftover .nfo into an episode file

- **Fixed**: once every real video file in a season pack had already been matched and moved on an earlier partial run, a retry would find zero video files left and fall back to treating any remaining file — including the release's `.nfo` — as "the episode to import," attempting to rename it to something like `S03E02.nfo` and failing outright once that didn't match what was actually on disk. Leftover `.nfo`/`.txt`/image/checksum files are never episode content and are already cleaned up automatically once import finishes — they're now excluded from that matching entirely instead of causing a failed, user-visible import error.

## v1.13.17 — August 2026

### The slowdown logs you were told about now actually show up in Settings → Logs

- **Fixed**: the search-diagnostics log could fill up its 2000-line buffer in a few minutes during heavy background passes (each episode search writes ~10 lines, several of them debug), silently pushing out the important info lines — including the new background-slowdown lines. The buffer now holds 4000 lines, so `priority.yield` entries survive the noise.
- **New**: the log panel in Settings → Logs now tails live — it refreshes every 5 seconds while the tab is visible, so lines written by background work appear as they happen instead of only after a manual refresh. No re-render when nothing changed.
- **Fixed**: all log sources now live in one place — the transcode log panel moved from the Diagnostics tab to Settings → Logs, which now shows search/diagnostic, engine, resolver and transcode logs together.
- **Changed**: background-slowdown log lines now get their own color in the panel, so "Arrière-plan bridé [bulk manquants]…" entries stand out at a glance.

## v1.13.16 — August 2026

### Background slowdowns are now visible in the logs — with the user responsible

- **New**: background work (the manual "search everything missing" bulk, scheduled RSS matching, quality upgrades, missing-release retries) now pauses whenever you're actively using the app and resumes a few seconds after you stop — you never feel it. Every time such a slowdown actually happens, the diagnostics search log records it in one clean, readable line: which background task was bridled, which user was active (name + id), and how long the wait lasted (e.g. "Arrière-plan bridé [bulk manquants] pendant 12.3s par l'utilisateur actif admin (id:1)").
- **Fixed**: silent frontend polling no longer counts as user activity. The status polls (engine torrents every 500ms, jobs every 2s, perf metrics every 5s, Plex activity every 5s, playback progress every 10s…) kept the app marked as "active" forever as soon as a single page was left open — so background work never properly resumed. Only real interactions count now (navigation, searches, clicks): leave the app open and background resumes a few seconds after your last click.
- **Changed**: the manual bulk search now runs in the background lane like the scheduled tasks — it inherits the reduced indexer quota (your own searches keep priority) and yields between items.

## v1.13.15 — August 2026

### Top nav stayed solid after scrolling back to the top

- **Fixed**: the transparent-to-solid top navigation bar added in v1.13.12 correctly turned solid once you scrolled down, but scrolling back up to the very top never reverted it back to transparent. Switched to a more reliable detection method so it now correctly reflects scroll position in both directions.

## v1.13.14 — August 2026

### Dashboard rows can now open a full grid — "See all" was never actually wired up

- **Fixed**: the dashboard's carousels ("For you", "Recently added", "Coming soon", "Trending") had a "See all" affordance built into the row component itself, but no dashboard row was ever passing it a destination — so it silently never appeared, on any row, since this part of the dashboard was first built. Rows stay exactly as compact horizontal strips; "See all" now opens the full set as a real, filterable grid (Discover for recommendation/trending rows, your Library — pre-filtered to match — for rows drawn from what you already own).

## v1.13.13 — August 2026

### Beta player is now a personal choice per account, off by default

- **Changed**: previously the Beta player had a single on/off switch for the whole instance — one admin turning it on silently switched playback behavior for every account. There are now two layers: an admin toggle in Settings that just makes the feature available at all, and a personal toggle in each user's own Profile page that actually turns it on for their account — off by default, regardless of what the admin has set.

## v1.13.12 — August 2026

### Six browsing improvements, picked from a design review

- **New**: rows now show a thin scroll-position indicator and hover-revealed edge arrows, and scroll by a full page instead of free-dragging.
- **New**: the "Tendances" row now highlights its top 10 with a numbered ranking treatment, using the same real popularity order the row was already sorted by.
- **New**: hovering a poster card (desktop) now briefly shows year, runtime, and genre tags when available, instead of nothing.
- **Changed**: the top navigation bar is now transparent at the very top of the page and becomes solid as soon as you scroll.
- **Changed**: the episode list for a title not yet in your library now shows a thumbnail and a short description per episode, not just a bare row. (Episodes for titles already in your library don't have this yet — that needs new data collected at import time, tracked separately.)
- **New**: on mobile, the dashboard hero now uses dedicated portrait artwork instead of a cropped-down version of the desktop banner.

## v1.13.11 — August 2026

### Display personalization now follows your account, not just your browser

- **Changed**: GPU performance profile, animations, theme (light/dark/auto), interface language, and library view density were all saved to the browser only — switching devices or browsers reset every one of them back to default. They're now saved to your account and follow you anywhere you sign in, while still applying instantly on the device you're on.
- **Moved**: the "Animations" toggle now lives in Settings → Performance GPU, next to the profile it actually affects, instead of under Dashboard.

## v1.13.10 — August 2026

### Mobile bottom nav buttons that only worked when tapped above the icon

- **Fixed, confirmed live**: on mobile, tapping the Calendrier/Demandes/Plus tab buttons directly often did nothing — but tapping just above them worked. Root cause: the toast-notification container is mounted everywhere and stays in the page at all times, even with zero notifications showing. Its mobile layer spans the full width of the screen, sits right on top of the bottom tab bar, and is invisible — but an invisible element still blocks clicks underneath it unless explicitly told not to. Taps landing in that overlap silently hit nothing instead of reaching the tab button.
- The invisible container no longer blocks anything underneath it; only an actual visible notification (which is rare and brief) is still tappable/dismissible, exactly as before.

## v1.13.09 — August 2026

### The Blood+ matching fix from v1.13.06 never actually took effect — found the real reason

- **Fixed, confirmed live**: v1.13.06 fixed the title-matching function to treat "+" as the word "plus" (so "Blood+" wouldn't be confused with unrelated shows). But manual search still showed "Blood Of Zeus", "Dexter New Blood", "Blood-C" and others as valid candidates for "Blood+" — because a completely different, earlier step (the one that turns a search box query into the actual text sent to indexers) was stripping the "+" before the fixed matching function ever got to see it, silently undoing that fix for every real search. A search for "Blood+" was arriving at the matcher as the bare word "Blood", which of course matches nearly anything with "Blood" in the title.
- That earlier step now preserves "+" and "&" as words too, the same way the matching function already did — closing the actual gap, not just the one function that looked like the source of the problem.

## v1.13.08 — August 2026

### Accordéon saisons — épisodes visibles même sans bibliothèque

- **Amélioré — liste d'épisodes disponible pour les séries non suivies** : l'accordéon des saisons affichait "Pas encore en bibliothèque" quand la série n'était pas dans la bibliothèque. Les épisodes (numéro, titre, date de diffusion) sont désormais chargés depuis TMDb à la demande (lazy, mis en cache par SWR) dès qu'une saison est ouverte — sans aucun impact sur les séries déjà en bibliothèque dont le rendu reste identique. Un squelette de chargement s'affiche pendant la requête.

---

## v1.13.07 — August 2026

### Correction changelog v1.13.05

- Retrait d'une entrée incorrecte : le carré rouge visible dans le screenshot ARM était une annotation dessinée par l'utilisateur pour indiquer la zone problématique, pas un bug visuel réel de l'UI.

---

## v1.13.06 — August 2026

### Correctif matching — titres avec `+` (Blood+, C+C Music Factory…)

- **Corrigé — faux positif de matching sur les titres contenant `+`** : le `+` était supprimé par la normalisation (seuls `a-z0-9` sont conservés), réduisant par exemple `Blood+` à `blood`. Ce mot seul étant contenu dans `Blood of Zeus` → `blood of zeus`, la série obtenait un score de 0.85 (au-dessus du seuil de 0.72) lors d'une recherche manuelle pour Blood+. Le `+` est maintenant converti en ` plus ` avant le nettoyage dans `normalizeTitle`, rendant `Blood+` → `blood plus` et `Blood of Zeus` → `blood of zeus` — deux chaînes distinctes qui ne se confondent plus. Les releases nommées `Blood Plus` matchent correctement `Blood+`. Fix appliqué dans `matching.ts` et `releaseMatchWorker.mjs`. Test de non-régression ajouté.

---

## v1.13.05 — August 2026

### Correctif accordéon saisons — compatibilité navigateur ARM

- **Corrigé — accordéon bloqué sous ARM Docker (deuxième passe)** : la transition `gridTemplateRows` CSS n'est pas supportée dans tous les navigateurs ARM. Remplacement par `max-height: 0 → 9999px` avec `overflow: hidden`, technique universelle supportée depuis IE9 — fonctionne sans ResizeObserver, sans JS d'animation, sans Framer Motion.

---

## v1.13.04 — August 2026

### Correctif accordéon saisons ARM Docker (investigation approfondie)

- **Corrigé — accordéon des saisons bloqué sous ARM Docker** : Framer Motion interprète et anime `gridTemplateRows` via JS, ce qui peut échouer sur des runtimes ARM. L'animation est désormais entièrement gérée par le moteur CSS du navigateur : transition inline sur `gridTemplateRows` + `opacity`, sans aucune dépendance JS externe. L'inner div reçoit `min-h-0` pour garantir que la row CSS Grid collapse réellement à 0. Le contenu est toujours présent dans le DOM (masqué par la grid), ce qui élimine aussi le cas où `libSeason` undefined rendait l'expansion silencieusement vide — quand une série n'est pas en bibliothèque, un message localisé est affiché à la place.

## v1.13.03 — August 2026

### Correctif accordéon saisons ARM/QEMU

- **Corrigé — accordéon des saisons bloqué sous ARM Docker** : l'animation d'ouverture des saisons reposait sur `height: "auto"` via Framer Motion, qui mesure la hauteur via `ResizeObserver`. Sous ARM Docker (Mac Apple Silicon / QEMU), `ResizeObserver` retourne 0 au premier rendu, rendant l'animation invisible et la liste d'épisodes inaccessible. L'animation passe désormais sur `gridTemplateRows: "0fr" → "1fr"`, une interpolation CSS pure sans mesure DOM — fonctionne identiquement sur x64 et ARM.

---

## v1.13.02 — August 2026

### Information 2FA C411

- **Ajouté — avertissement 2FA dans le formulaire C411** : les comptes c411.org avec double authentification (2FA) activée ne peuvent pas utiliser les listes Découvrir (chaque nouvelle session demanderait un code). Une note informative est désormais affichée sous les champs identifiant/mot de passe pour signaler cette limitation. 5 locales.

---

## v1.13.01 — August 2026

### Correctifs animations et TVDB

- **Corrigé — mode cinéma désactivé par le toggle animations** : désactiver les animations dans Réglages → Tableau de bord coupait aussi la lecture vidéo du mode cinéma (hero cinematique + en-tête de titre). Les deux paramètres sont désormais indépendants : couper les animations supprime les transitions/effets décoratifs sans jamais bloquer la lecture de la vidéo d'ambiance, qui est contrôlée uniquement par son propre toggle d'autoplay.
- **Corrigé — badge d'état TVDB absent dans l'onglet Animé** : après le déplacement de la clé TVDB vers l'onglet Métadonnées en v1.13.00, le badge « TVDB configuré / non configuré » avait disparu de l'onglet Animé — le toggle semblait inactif sans aucun retour visuel sur l'état de la clé. Le badge est restauré dans l'onglet Animé (lecture seule), avec un renvoi vers l'onglet Métadonnées pour saisir ou modifier la clé.

---

## v1.13.00 — August 2026

### Historique refonte, matching années, TVDB dans Métadonnées, event loop, bottom nav mobile

- **Refonte — page Historique** : timeline groupée par date (Aujourd'hui / Hier / Cette semaine / Ce mois / Plus ancien), cartes avec bordure colorée selon le statut, entrées d'échec en rouge avec message d'erreur affiché directement (sans clic), animations décalées à l'entrée, état vide illustré, compteur d'événements, rafraîchissement automatique toutes les 10 secondes. Traduit intégralement en 5 langues (labels de statut, groupes de dates, système, score, détails).
- **Corrigé — matching : tolérance d'année étendue à ±2** : les releases physiques (Blu-ray/DVD) publiées jusqu'à deux ans après la sortie cinéma originale étaient rejetées par le filtre d'année (ex. Tafiti, film allemand 2024 avec release française Blu-ray 2026). La tolérance passe de ±1 à ±2 dans `releaseMatchWorker.mjs` et `matching.ts`, ce qui active aussi le bonus de containment déjà présent pour les titres tronqués par les releases scène.
- **Déplacé — clé API TVDB de l'onglet Animé vers l'onglet Métadonnées** : regroupement logique avec TMDb et OMDb. L'onglet Animé conserve les deux bascules (utiliser TVDB / épisodes spéciaux) et le panneau de synchronisation. Les hints de navigation des deux onglets sont mis à jour. 5 locales.
- **Simplifié — texte event loop dans Performance** : remplacé par une phrase claire en une ligne (latence du thread principal, vert = OK, rouge = surchargé). 5 locales.

---

## v1.12.98 — August 2026

### Correction mobile — hitbox barre de navigation inférieure

- **Corrigé — boutons non cliquables en bas de la barre de navigation mobile** : sur iPhone avec indicateur d'accueil (zone safe-area ≈ 34 px), le `paddingBottom` safe-area était appliqué sur le conteneur `nav` plutôt que sur chaque bouton. Avec `items-stretch`, les enfants ne remplissent que la zone de contenu du nav (hors padding) — la zone safe-area en bas était visuellement couverte par le fond de la barre mais n'appartenait à aucun élément cliquable. Le padding est désormais porté par chaque bouton avec `max(0.5rem, env(safe-area-inset-bottom))`, ce qui étend la hitbox jusqu'en bas de l'écran tout en conservant l'icône et le libellé centrés dans la partie visible.

---

## v1.12.97 — August 2026

### Correction C411 collision d'ID TMDb + amélioration matching releases scène

- **Corrigé — collision d'espace d'ID TMDb dans les listes C411** : TMDb utilise deux espaces d'identifiants distincts (films et séries) qui se chevauchent — le même numéro peut désigner à la fois un film et une série différente. Jusqu'ici, le premier résultat trouvé (côté film) était retenu sans vérification, ce qui pouvait afficher la fiche d'un film sans rapport à la place d'une série. La résolution passe maintenant par un **hint titre + année** fourni par C411 : quand un ID existe des deux côtés, le titre et l'année stockés dans la liste permettent de choisir le bon espace. Le cache est versionné (v2) ; les anciennes entrées sans version sont ignorées et recalculées pour éviter qu'un verdict erroné survive les 30 jours de TTL.
- **Amélioré — matching releases scène avec sous-titre tronqué** : les releases de scène omettent souvent le sous-titre officiel (ex. « Tafiti » au lieu de « Tafiti - Ab durch die Wüste »), ce qui les pénalisait à 0,50 sous le seuil de matching. Un bonus de containment ramène le score à 0,85 quand le titre de la release est entièrement contenu dans le titre officiel **et** que l'année est compatible — les films différents homonymes publiés une autre année restent rejetés.

---

## v1.12.96 — August 2026

### Découvrir — libellé de la section recommandations affiné

- **Affiné — section recommandations** : le libellé de la première ligne de la page Découvrir passe de « Pour vous & meilleurs » à **« Sélection pour vous »** — plus lisible, plus propre, sans conjonction maladroite. Traduit en 5 langues.

---

## v1.12.95 — August 2026

### Désinstalleur Windows réparé, conteneur Docker réparé, wizard complété, login C411 clarifié

- **Corrigé — conteneur Docker en boucle de redémarrage** : au démarrage avec PUID/PGID différents des valeurs par défaut de l'image (le cas standard d'un NAS), le `docker-entrypoint.sh` supprimait le groupe `movviz` **avant** son utilisateur — busybox refuse de supprimer un groupe qui est le groupe principal d'un utilisateur existant (« group in use »), l'`addgroup` qui suivait échouait donc aussi et le conteneur mourait en boucle avec « addgroup: group 'movviz' in use » répété à chaque tentative. L'ordre est corrigé (utilisateur avant groupe, à chaque étape) et le script libère désormais proprement l'UID et le GID demandés, même quand le groupe cible est verrouillé par son utilisateur propriétaire. L'image amd64+arm64 publiée est régénérée avec ce correctif.
- **Corrigé — désinstalleur Windows en panne** : l'installation se terminait par une erreur d'exécution « Cannot call CreateInputOptionPage » au lancement de la désinstallation (cette fonction n'existe pas dans le runtime du désinstalleur d'Inno Setup, uniquement dans celui de l'installeur — elle avait été introduite avec la question « supprimer les données personnelles ? » en v1.12.91). La question est désormais posée via une boîte de confirmation native à la fin de la désinstallation, **par défaut NON** : rien n'est jamais effacé sans confirmation explicite, toujours en 5 langues, et les données (ProgramData) restent conservées par défaut pour permettre une réinstallation complète.
- **Nouveau — wizard** : l'étape finale affiche une carte « Activation des comptes » qui explique que le compte administrateur est déjà actif et que les prochains comptes (inscription ou Plex) devront être approuvés dans Réglages → Utilisateurs.
- **Clarifié — indexeurs C411** : le libellé « Identifiants du site » précise désormais entre parenthèses que le login est optionnel (il ne sert qu'aux listes Découvrir, la recherche fonctionne sans).

---

## v1.12.94 — August 2026

### Découvrir refondu — listes fusionnées, séries et films strictement séparés

- **Corrigé — mélange séries/films** : les listes c411.org (Populaires / Uploads récents / Sorties du jour) affichaient un mélange de films et de séries dans les deux onglets. Elles sont désormais filtrées par l'onglet actif (Films ou Séries), à l'affichage comme dans « Tout voir ».
- **Nouveau — listes fusionnées** : les sections de la page Découvrir sont regroupées avec dédoublonnage (un titre n'apparaît plus deux fois) :
  - « Pour vous & meilleurs » (suggestions + mieux notés)
  - « Tendances & populaires » (layout Movviz)
  - « En salles » (à l'affiche + box office) et « Prochainement & VOD » (layout Allociné, films)
  - « Nouvelles & renouvelées » (layout Allociné, séries)
  - De 11 à 7 sections en layout Movviz, de 14 à 9 en layout Allociné (films) et de 11 à 7 (séries). Chaque section fusionnée a son « Tout voir » paginé (cache 10 min).
- **Supprimé — tuiles Genres** : la rangée de tuiles genres (doublon du filtre genre de la barre) a été retirée.
- **Nouveau — builds Docker multi-arch** : les images publiées sur Docker Hub sont de nouveau construites pour `linux/amd64` **et** `linux/arm64` (QEMU + buildx réactivés).

---

## v1.12.93 — August 2026

### Indexeurs — statut réel, clé en mémoire et diagnostic de connexion

- **Nouveau — diagnostic C411** : la section « Identifiants du site » du crayon C411 affiche désormais le vrai statut serveur (listes actives ou inactives, avec le login concerné) et un bouton « Tester la connexion C411 » qui exécute un vrai login avec les identifiants enregistrés. En cas de config incomplète, un diagnostic détaillé indique exactement ce qui manque (listes / identifiant / mot de passe). L'échec silencieux « j'ai saisi mes identifiants mais rien ne s'affiche » devient donc visible et identifiable.
- **Nouveau — clé en mémoire** : le bouton « Afficher les catégories » d'un indexeur déjà configuré ne demande plus de resaisir la clé API — elle est reprise automatiquement depuis le serveur (le navigateur ne la voit jamais), et une mention « Clé enregistrée — utilisée automatiquement » l'indique. Fonctionne aussi pour le mode identifiants.
- **Nouveau — bouton « Tester la connexion »** sur chaque indexeur : vérifie l'URL et les identifiants en une seconde et affiche le résultat (OK ou l'erreur de l'indexeur).
- **Corrigé — sauvegarde silencieuse** : le formulaire n'accepte plus d'échouer en silence — si l'enregistrement échoue côté serveur, l'erreur est affichée et le formulaire reste ouvert.
- **Corrigé** : la clé du catalogue (ex. `c411`) est désormais aussi enregistrée lors d'une modification, pas seulement à l'ajout.

---

## v1.12.92 — August 2026

### Crayon C411 : identifiants du site modifiables

- **Corrigé** : au crayon, la section « Identifiants du site (listes Découvrir) » (login, mot de passe, toggle des listes) ne s'affichait jamais sur un indexeur C411 déjà configuré — l'identité « C411 » se perdait à l'enregistrement : seuls `kind: "torznab"` et l'URL étaient conservés, et le formulaire ne reconnaissait l'indexeur que par son `kind`.
- **Nouveau** : la clé du catalogue (ex. `c411`) est désormais persistée sur l'indexeur à l'ajout, et les indexeurs existants sont reconnus par leur URL de catalogue (repli). La section identifiants apparaît donc aussi en édition, et le toggle « listes Découvrir » n'est plus perdu à l'ajout (il est maintenant enregistré dès le POST initial).

---

## v1.12.91 — August 2026

### Intégration c411.org à la page Découvrir

- **Nouveau** : trois listes issues du site c411.org s'affichent dans l'onglet Découvrir — « Populaires sur C411 », « Uploads récents sur C411 » et « Sorties du jour sur C411 » (catégorie films/vidéos uniquement). Les identifiants du compte s'enregistrent dans Réglages → Indexeurs → C411 (section « Identifiants du site »), et chaque liste peut être activée ou désactivée indépendamment.
- Session gérée automatiquement (connexion avec CSRF, TTL 25 min, repli sur un second essai), requêtes espacées pour ne pas se faire bloquer, et résolution TMDb des releases avec cache 30 jours : un titre n'est proposé qu'à partir d'un score minimum (titre exact ou année + type), zéro faux positif.
- **Corrigé — parsing des noms de releases** : les underscores devenaient des points avant l'analyse des tags, « AD » n'est reconnu qu'en majuscules (les films comme « Ad Astra » ne sont plus mutilés), les canaux « 5.1 » et les groupes de release sont ignorés, « 10.bits » devient 10BIT.

### Crayon de modification sur tous les indexeurs

- **Nouveau** : chaque indexeur configuré (Torznab, Prowlarr, C411…) dispose d'un crayon pour éditer ses réglages sans le recréer — le formulaire affiche les secrets existants masqués et ne les écrase pas si le champ est laissé vide.

### Désinstallateur Windows — choix de suppression des données personnelles

- **Nouveau** : la désinstallation demande explicitement, via une case à cocher, si toutes les données personnelles (bibliothèques, historique, téléchargements, réglages — stockées dans ProgramData) doivent être effacées. Décochée par défaut : une réinstallation conserve tout, comme avant. Si cochée, une confirmation supplémentaire protège contre toute suppression accidentelle. Écran en 5 langues.

### Mode cinéma — option « au survol » retirée

- **Nettoyage** : le déclenchement de la bande-annonce « au survol » du Hero cinématique ne fonctionnait pas de manière fiable ; l'option a été retirée des réglages (il ne reste que « Désactivé » et « Automatique ») et la logique de survol du hero a été supprimée.

---

## v1.12.90 — August 2026

### Séries à saison unique découpées en « parties » (ordre DVD) — assemblé automatiquement

- **Corrigé** : les releases d'une série à UNE seule saison découpée dans l'ordre DVD en plusieurs parties (ex. Disjointed : 1 saison de 20 épisodes, sortie en « S01.PART.01 » + « S02.S01.PART.02 », ou simplement « S01 » + « S02 ») n'étaient jamais matchées — le numéro de saison annoncé (S02) ne correspondait à aucune saison de la bibliothèque, donc les épisodes 11-20 restaient introuvables sur les indexeurs.
- **Nouveau** : détection du marqueur « PART.N » dans le nom de la release (`S01.PART.02`, `Partie 2`…) et repli pour les séries à saison unique : une release S02 (ou part 2) couvre les épisodes de la seconde moitié de la saison (11-20 pour 20 épisodes). La sélection des fichiers du moteur et l'import sont traduits dans la même numérotation, pour que les fichiers `S02E01…E10` atterrissent bien sur S1E11-20.
- **Garde-fous** : uniquement les séries à une seule saison ; toute série multi-saisons garde son matching exact inchangé (une vraie saison 2 n'est jamais réinterprétée comme une partie). Les films ne sont pas concernés.

---

## v1.12.89 — August 2026

### Épisodes TBA traités comme « à venir » — les séries avec une saison annoncée mais non datée sont complètes

- **Corrigé** : un épisode sans date de sortie mais au titre placeholder « TBA » (TVDB/TMDb pré-créent ces épisodes pour les saisons annoncées, ex. Gachiakuta S2) était traité comme sorti → `missing` → recherché sans fin sur les indexeurs. Règle désormais en deux conditions distinctes : date future → « à venir » ; pas de date **et** titre TBA → « à venir » aussi. Un épisode sans date au titre réel garde le comportement historique (recherchable).
- **Corrigé — calculs de statut série/saison** : une série dont tout ce qui reste est « à venir » (TBA ou dates futures) est désormais **complete** (« disponible ») partout — page bibliothèque, détail, découverte, demandes, calendrier — et disparaît naturellement des recherches des manquants (search all, retries 6h, RSS). Une série entièrement « à venir » reste affichée « à venir ».
- Appliqué partout : création de série (TMDb + TVDB anime), backfill saison 0, réparation des saisons TMDb, sync Plex (création + mise à jour), tâche quotidienne de transition des dates.

---

## v1.12.88 — August 2026

### Diagnostic Plex enrichi + GUIDs externes demandés explicitement à Plex

- **Ajouté** — `GET /api/plex/diagnostic?title=...` affiche maintenant le GUID brut et le tableau `Guid[]` tels que rapportés par la liste ET par le détail (`/library/metadata/{ratingKey}`), plus le tmdbId résolu par la logique du sync — permet d'expliquer pourquoi un média n'est pas lié.
- **Amélioré — sync Plex** : les requêtes de liste incluent désormais `includeExternalMedia=1`, le paramètre Plex qui peuple le tableau `Guid[]` (tvdb://, imdb://, tmdb://) directement dans les réponses `/all`.

---

## v1.12.87 — August 2026

### Liaison Plex étendue aux GUIDs legacy + diagnostic Plex

- **Corrigé — sync Plex** : les GUIDs au format legacy (`com.plexapp.agents.thetvdb://80741?lang=fr`, agents d'avant 2021) n'étaient pas lus — seul le tableau `Guid[]` moderne l'était. Ces séries ne pouvaient jamais être liées, même avec la résolution `/find` de la v1.12.86. Le champ `guid` legacy est désormais parsé lui aussi (`thetvdb`/`imdb`/`tmdb`).
- **Ajouté — route diagnostic** `GET /api/plex/diagnostic?title=...` (admin) : affiche pour chaque titre Plex correspondant le type, le ratingKey, le GUID brut, le tableau `Guid[]` et le tmdbId résolu par la même logique que le sync — permet d'expliquer pourquoi un média n'est pas lié.

---

## v1.12.86 — August 2026

### Liaison Plex corrigée pour les médias sans GUID TMDb + outil de liaison enrichi

- **Corrigé — sync Plex** : la résolution des identifiants ne lisait que les GUID `tmdb://` rapportés par Plex. Les médias matchés par l'agent Plex uniquement en `tvdb://`/`imdb://` (séries canadiennes, anciens agents, etc.) étaient **silencieusement ignorés** — fichiers présents sur le disque et visibles dans Plex, jamais liés dans Movviz, et l'outil de liaison ne trouvait rien à réparer (aucun chemin n'était enregistré). **Corrigé** : les GUID `imdb://`/`tvdb://` sont désormais résolus vers TMDb via `/find` (mis en cache comme les autres appels TMDb), et en cas de doublons TMDb pour un même titre, l'entrée déjà présente dans la bibliothèque Movviz est prioritaire. Confirmé en production sur « Le cœur a ses raisons » : le GUID `tvdb://80741` se résout vers tmdb 2903 (2005), présent dans la bibliothèque.
- **Amélioré — liaison de fichiers** (`repair-paths`) : quand le nom de fichier enregistré n'existe plus nulle part sur le disque, l'outil propose désormais aussi les fichiers dont le nom contient le même `SxxEyy` (candidats à confirmation manuelle — jamais de reliaison automatique sur ce critère).
- **Docs** : plan d'architecture « Movviz Federation » archivé dans `docs/federation-plan.md`.

---

## v1.12.85 — August 2026

### Bug de renommage moteur corrigé + isolation de la recherche des manquants (quotas + annulation)

- **Corrigé — moteur** (`AbstractBackend.mjs`) : bug de renommage des packs — l'objet d'informations partagé (`releaseInfo`) était muté par la résolution du fichier cible, et pour tout fichier sans numéro d'épisode dans le nom, ce même objet était réutilisé pour les suivants : le PREMIER fichier apparié imposait alors son épisode à tous les autres. Confirmé en production sur un pack Trigun intégrale : 25 fichiers renommés `S01E03` (puis `S01E04` au 3ᵉ import), E1 toujours écrasé. **Corrigé** : l'objet est désormais cloné par fichier (`{ ...info }`) — reproduit localement avec les 28 vrais noms de fichiers du pack, chaque fichier obtient son propre épisode (E01-E26, uniques). Le moteur redéployé ne re-renommera plus jamais un pack entier vers le même épisode.
- **Quotas indexeurs (anti-429)** : quotas par indexeur réactivés (`c411.org` = 15 req/min documentées, 20 req/min par défaut pour tout hôte) + nouveau plafond global de 40 req/min (fenêtre glissante 60 s). Appliqués AVANT l'envoi de chaque requête (`fetchXml`), les quotas documentés ne sont donc jamais dépassés. La recherche groupée « rechercher les manquants » ne peut plus s'auto-infliger des 429 (mesuré en production : ~35 requêtes en ~35 s déclenchait déjà un 429).
- **Annulation des jobs** : nouvelle route `POST /api/jobs/[id]/cancel` (admin) + `requestCancelJob()`/`isJobCancelled()` dans la file + nouveau statut `"cancelled"` (settle propre via `JobCancelledError`, drapeau purgé à la fin). Points de contrôle coopératifs à tous les niveaux de la recherche groupée : entre items du lot, entre saisons, entre épisodes — les épisodes non encore cherchés restent simplement « manquants » et seront retentés au prochain passage. Un job en file est retiré immédiatement ; un job en cours s'arrête à son prochain point de contrôle (quelques secondes).
- **UI** : le panneau File d'attente affiche les jobs annulés (icône dédiée + libellés `jobs.statusCancelled` dans les 5 langues).

---

## v1.12.84 — August 2026

### Import fiabilisé des packs de saison/intégrale — plus jamais de "S01E" vide ni de fichiers écrasés

- **Contexte (confirmé en production)** : un pack de saison Noblesse (20,3 Go) téléchargé à 100 % n'a importé que 2 épisodes sur 13. Le grab n'avait pas de `episodeTargets` — le moteur importait alors TOUS les fichiers à l'aveugle, et chaque fichier dont le numéro d'épisode n'était pas identifiable était renommé avec un épisode VIDE (`Noblesse - S01E.mkv`). Plusieurs fichiers d'un même pack arrivaient alors sur le même chemin de destination et s'**écrasaient mutuellement** (le dernier remplaçait les précédents), les épisodes jamais importés restant "manquants".
- **Corrigé — moteur** (`AbstractBackend.mjs`) : quand le numéro d'épisode reste inconnu après tous les fallbacks (nom de fichier, release, dossier), le fichier garde désormais son nom d'origine au lieu du template `S{season:00}E{episode:00}` vide — nom unique par fichier, plus de collision ni d'écrasement, et fichier toujours découvrable par l'outil de renommage. `avoidCollision()` s'applique maintenant aussi aux séries (comme aux films).
- **Corrigé — grab manuel** (`/api/indexers/grab`) : un grab depuis une fiche série/saison passe maintenant `episodeTargets` au moteur (épisodes monitorés "manquant"/"recherche"), exactement comme un grab automatique — le moteur ne télécharge/importe alors que les épisodes ciblés.
- **Précision** : l'import côté bibliothèque n'a pas changé — un fichier sans numéro d'épisode n'est jamais attribué à tort à un épisode ("missing" tant que le lien n'est pas résolu).

---

## v1.12.83 — August 2026

### Mots autorisés — un terme présent dans le titre annule le mot interdit

- **Nouveau** : dans Réglages → Qualité, une section "Mots autorisés" vient s'ajouter à "Mots interdits". Si un mot autorisé est présent dans le titre d'une release, le mot interdit correspondant est annulé. Cas typique résolu : un debile a uploadé un épisode marqué "VOSTFR" alors que c'est en réalité un multi — `Arrow.S01E01.MULTi.VOSTFR+FRENCH.1080p...` avec "VOSTFR" interdit + "FRENCH" autorisé est désormais accepté, tandis qu'un simple VOSTFR reste rejeté.
- **Application** : la logique vit dans `matchesBlockedWord()` (`releaseRules.ts`), donc toutes les entrées la respectent — recherche auto (torznab), garde de décision, import de fichiers, récupération de téléchargements.
- **Match** : en sous-chaîne insensible à la casse, comme les mots interdits (note : "TRUEFRENCH" contient "FRENCH").
- Tests : 6 nouveaux cas dans `scripts/allowed-words.test.ts` (23/23 verts).

---

## v1.12.82 — August 2026

### Release 1.12.82 — encodage vérifié, pipeline CI relancé sur un commit sain

- **Contexte** : le premier push de la v1.12.81 a été réalisé avec un `package.json` corrompu par un BOM UTF-8 (`U+FEFF`) introduit par un écriture PowerShell — le build CI (`next build` via `build.ps1`) a échoué avec `package.json is not parseable: invalid JSON: expected value at line 1 column 1`.
- **Corrigé** : l'encodage de tous les fichiers concernés (`package.json`, `README.md`, `CHANGELOG.md`, `autoGrabSeries.ts`, `torznab.ts`, `autoGrab.ts`, `mediaMap.ts`, `rssCache.ts`) a été vérifié octet par octet — aucun BOM, UTF-8 propre. Le commit corrigé de la v1.12.81 contenait déjà le code exact sans BOM ; la v1.12.82 repart d'une base saine et relance le pipeline complet (installateur Windows + image Docker) sur le bon commit.
- **Rappel** : les fichiers source ne doivent JAMAIS être écrits via PowerShell 5.1 (`Set-Content`, redirections) — ses encodages par défaut corrompent l'UTF-8 ou ajoutent un BOM.

---

## v1.12.81 — August 2026

### Search/matching audit (TR4KER vs C411), link-before-download, Seerr notification flood, and a discovered engine-token mismatch

- **Fixed, confirmed live**: a series like "Ma vie avec les Walter Boys" (tmdbId 199001) could never be grabbed: the French localized title was used for both the indexer query and local release matching, while scene releases are always named after the ORIGINAL title ("My.Life.With.The.Walter.Boys.S03...") — every indexer returned 0 hits. Search and matching now prefer `originalTitle` (the localized title stays as an alias), and the daily metadata refresh backfills `originalTitle`/`tvdbId`/`imdbId` on pre-existing entries. TR4KER also only declares tvdb search (`tvSearchTvdb`, no tmdb) — the tvdbid was never sent to it because the field didn't exist; `searchTv` now sends `tvdbid` (TR4KER) / `tmdbid` (C411) as the indexer supports.
- **Fixed**: a failing ID-mode search (indexer-side error or HTTP 5xx) silently swallowed the whole search — the text fallback never ran. Both `searchMovie`/`searchTv` now always fall back to the text query.
- **Fixed**: the hourly RSS refresh silently showed "C411:0" — indexer errors were caught and discarded. Errors are now logged per indexer (`rss_refresh.indexer_error`) and a cycle with 0 releases while others return plenty warns with the indexer's caps (`rss_refresh.indexer_empty`).
- **Fixed**: linking a release before downloading failed with "Impossible d'ajouter ce titre à la bibliothèque" when the title was already in the library — the server's `alreadyInLibrary` response now carries the existing item so the picker can link straight to it. A duplicate-library guard (`libraryEntriesMatch`, title/originalTitle/aliases + compatible year) also stops TMDb duplicate entries from creating a second library record.
- **Fixed**: the `[seerr] mediaId not found` log flood — unknown tmdbIds are now cached as misses for 1 hour (warn at most once/hour each) with bounded pagination, and "processing" notifications are deduped to one per title per pass (`notifySeerrProcessingOnce`).
- **Fixed, environment**: the diagnostic log showed every grab rejected with `{"error":"unauthorized"}` — the web app and the download engine were using different `engine-token.json` files (dev vs Windows service install). Token files aligned; an explicit "TOKEN MOTEUR INVALIDE" hint now appears in the diagnostic log when the engine rejects a grab with unauthorized.

---

## v1.12.80 — August 2026

### "Récupérer téléchargements" crashed on large download folders — now batched, and the queue/history tabs no longer freeze with thousands of rows

- **Fixed, confirmed live**: the maintenance action processed every file in one synchronous request. With hundreds of files (big packs, long-running backlog) the request could time out or take minutes, and the response rendered every recovered/failed/duplicate entry at once — the page froze or crashed outright. The scan now runs in batches of 20 files per request: the panel re-invokes automatically with the paths already attempted (the server is idempotent per path, so a permanently-failed file is reported once and never retried within the same run), shows progress as batches complete, and caps the rendered list at 30 entries per section with a "+N more" note — the full data stays available for the delete-duplicates/unmatched actions.
- **Fixed**: the Queue tab rendered every torrent row (downloading, seeding, completed...) on every 500 ms poll — hundreds of completed items painted thousands of DOM nodes, freezing the tab. It now paints the first 50 rows immediately (active items sort first, so the live queue stays visible), grows the rest in idle time, and offers a "Show more" button. Same progressive rendering applied to the Activity history tab, which holds up to 2000 entries.
- Both changes are rendering/perf-only: filters, bulk actions, counters and cleanup buttons behave exactly as before.

---

## v1.12.79 — August 2026

### Hardened the previous fix after independent review

- An independent review of v1.12.78's recovery fix caught two real gaps before they could bite: the new "trust the original download's own record" resolution could have let it override a file's own explicit, disagreeing season number — meaning a mislabeled release could have been silently misfiled into the wrong season folder. It now only fills in a season/episode the file's own name didn't already provide, never overrides one it did. Also, one remaining spot (a movie bundled inside a series-category pack) was still on the old guess-only path while every other case had already been upgraded — now consistent across all of them.

## v1.12.78 — August 2026

### Root cause of downloads recovery couldn't relink either — recovery was discarding information it already had

- **Fixed, confirmed live**: investigated a specific case (Wakfu) where the download-recovery tool couldn't find a match for completed files even though the show was already correctly in the library. Root cause: recovery was re-guessing each file's show purely from its file name and folder path, even for files whose original download already knew — with certainty, from the moment it was grabbed — exactly which series and season it belonged to. That authoritative information was being discarded before the per-file matching ran, forcing every file through a fuzzy filename guess instead. For a show organized as `ShowName/Saison 01/episode.avi` with an episode file whose own name carries no recognizable season marker, that guess fell back to reading the season folder itself ("Saison 01") as the show's title — sharing no words at all with the real name, so it never matched.
- Recovery now resolves a file's show/season directly from its original download's own record when available, instead of guessing — and when it does have to fall back to reading folder names, it now checks one level higher whenever the closer folder turns out to be a bare season marker with no real title in it, rather than stopping at the first folder regardless of what it actually contains. Both fixes are generic — they apply to any show organized this way, not the one that surfaced the bug.

## v1.12.77 — August 2026

### Theater Mode was letting the page underneath bleed through visibly

- **Fixed, confirmed live**: the previous fix made the player's own background transparent so the color ambience could show through — but nothing behind it was actually fully opaque (the page-dim layer is only ~80% black through a blur, and the color layers themselves stack several partial-opacity effects with no solid base). The real library page ended up visibly readable through the letterbox bars — worse than the flat black it replaced. Added a permanent, fully opaque base layer underneath everything else, so the page can never show through again, with or without a title's artwork available for the color extraction.

## v1.12.76 — August 2026

### Theater Mode's content-adaptive backdrop was invisible — fixed, and rebalanced for real visual impact

- **Fixed, confirmed live**: the color ambience extracted from each title's own artwork was structurally hidden — the actual video player's own background was fully opaque, painted on top of the ambience layer, so the color only ever flashed for an instant during the opening animation before disappearing completely for the entire time spent watching. On top of that, the ambience layer itself carried a second near-opaque black scrim stacked directly on the color gradient, crushing what little showed through during that instant to almost nothing. Net effect: flat black regardless of the title's artwork.
- The player's background is now transparent where it's meant to show the backdrop through, and the scrim/gradient balance was reworked so the extracted color is actually visible in the letterboxed areas around the video — a bright, colorful poster now visibly tints the theater, a dark one stays moody, instead of everything looking identical.

## v1.12.75 — August 2026

### Root cause of a completed season-pack download that never showed up in the library

- **Fixed, confirmed live**: investigated a specific case (an anime whose season packs had fully downloaded — the queue showed them "completed" — but none of the episodes ever became available). The root cause: some season-pack releases name their episode files after the show in a heavily abbreviated or non-standard form the title parser can't recognize (in the confirmed case, an acronym sharing no words with the real title) — so when the completed download's files failed to match any tracked episode, they were correctly *not* deleted, but the recovery pass that's supposed to catch exactly this case only recorded the miss in a value nothing ever read, so the files sat there indefinitely with zero visibility.
- The recovery pass now records these the same way a truly-unlinked manual download already does: they show up in Activité → Non liés, where they can be manually pointed at the right title — generically, for any release whose name the parser can't confidently map, not specific to the one show that surfaced it.

## v1.12.74 — August 2026

### Matching bug that could grab the wrong show, and a job-queue stall that could silently freeze all background searches

- **Fixed, confirmed live**: the title-matching score treated two titles as near-identical based on raw character distance alone, even when they differed by one completely different word — confirmed live with "How I Met Your Father" (an unrelated spin-off) scoring ~91% similar to a search for "How I Met Your Mother" and getting grabbed in its place. The scorer now also checks word-by-word: a wholesale different word (not a spelling variant) is disqualifying regardless of how close the overall character count looks.
- **Fixed, confirmed live**: a single stuck background task (in this case a slow Plex sync) could occupy a job-queue slot indefinitely, silently blocking every other queued job behind it — including scheduled and manual searches — for as long as it stayed stuck, with no error or indication anything was wrong. This is what could leave a monitored, correctly-added title never actually searched. The queue now frees a job's slot after 10 minutes if it hasn't finished, so a single hung task can no longer starve everything behind it.

## v1.12.73 — August 2026

### Beta player — direct play now starts the way the manual "lightning bolt" retry always worked

- **Fixed**: the player used to decide whether to attempt direct play by pre-checking codec support with browser APIs that are known to lie for common cases (AC-3/E-AC-3 always reporting "unsupported" on Chrome/Edge, some containers reporting decodable video as unsupported) — routing many files to a transcode or WebCodecs fallback that direct play would actually have handled fine. Confirmed live: the manual retry button, which always attempted direct unconditionally with no such pre-check, worked noticeably better.
- Direct play is now the unconditional first attempt on every video, exactly matching what the manual retry already did — the two are now literally the same code path, sharing the same automatic recovery (falls back to the other playback mode on a real playback error or on genuinely silent audio, unchanged from before).
- The manual retry button now benefits from that same automatic recovery too, and resumes from the current position instead of restarting from zero.
- Removed the now-fully-unused WebCodecs playback path this pre-check used to route into — it was strictly a worse, redundant version of what direct play + the existing fallback chain already cover.

## v1.12.72 — August 2026

### Theater Mode — a real immersive player, not a video in a modal

- **New**: the Beta player now opens in a full "Theater Mode" — the current page stays exactly where it was behind it (scroll position, state, everything), the player expands from the button you clicked with a genuine geometric transition (not a fade), and the page behind dims and blurs progressively rather than just disappearing.
- Any ambient trailer or preview playing anywhere on screen stops the instant the real player opens — never two videos playing at once.
- The player's backdrop now takes on a subtle color ambience extracted from the title's own artwork (dominant tones, brightness-aware) instead of being flat black — analyzed once per title and cached, never during playback.
- "Lire dans Plex" now reads "Lire" wherever the Beta player will actually handle playback, and stays "Lire sur Plex" wherever it's a genuine hand-off to Plex — consistent across every title card, the title page, the episode page, and the dashboard hero (which previously had no Beta player integration at all).
- The three separate copies of this trigger logic across the app are now one shared implementation, closing the gap where a future fix could land in one place and be missed in the others.

### In-app "what's new" now follows your interface language

- Release notes are now localized per UI language (falling back to English for anything not yet translated), instead of a single fixed-language file.
- **Fixed**: the release notes were silently missing on both the Docker and Windows builds — the file they're read from was never actually included in either packaged build, so the "what's new" popup had nothing to show.

## v1.12.70 — August 2026

### Download engine — root cause of permanently unlinked downloads

- **Fixed, confirmed live**: removing a torrent from the download engine reported success and wiped its own tracking (including which library title it belonged to) even when the underlying download client silently failed to actually remove it — the torrent kept running and seeding untouched, but the engine had no record of it anymore. This is what produced downloads that could never be linked back to a title no matter how many times a recovery scan ran. The engine now only clears its own bookkeeping once removal is independently confirmed; otherwise the torrent stays tracked and can be retried instead of turning into a permanent orphan.

## v1.12.51 – v1.12.69 — August 2026

Matching accuracy and engine reliability pass: complete-series pack detection (season-range terms, false-positive guards), stuck-download recovery hardened to atomic no-overwrite moves with a reliable import callback, per-series/movie write locking to close a race that could drop a completed episode's status, and duplicate-download reconciliation so a re-grabbed file no longer leaves the library stuck on the wrong status. User guide refreshed to cover recently shipped features (title editing, movie versions, unlinked-download linking, anime settings).

## v1.12.24 – v1.12.50 — August 2026

Complete-series pack search (single-query, season-range aware), download recovery reliability (folder scan, orphaned-file matching, duplicate cleanup), secured duplicate deletion, and a small automated test suite for the release-matching core.

## v1.10.90 – v1.12.23 — July–August 2026

Quality-upgrade workflow (Optimize / Ignore, meaningful-upgrade detection), a redesigned resolution/codec badge system, GPU/animation performance profiles, and engine stabilization across the interchangeable download backends (crash fixes, anti-stall rule, per-series search locking).

## v1.10.39 – v1.10.89 — July 2026

Download engine rewrite with interchangeable backends (native/aria2, WebTorrent, libtorrent), a maintenance "recover downloads" tool for orphaned files, a premium toast notification system, audio-codec badges, and beta in-app playback improvements (direct play, transcode logging).

## v1.10.12 – v1.10.17 — July 2026

Language-detection accuracy pass: audio-track language read from Plex, French-variant tags (VF/VFQ/VFF/TRUEFRENCH) correctly satisfying quality profiles, duplicate-episode cleanup, and a fix for premature torrent abandonment.

## v1.10.1 – v1.10.6 — July 2026

Decision Guard (pre-grab blocklist enforcement), franchise/collection detection, a redesigned download queue and diagnostics dashboard, and trailer/calendar refinements.

## v1.8.0 – v1.9.9 — July 2026

Unified title panel (single component for the slide-in and full-page views), a trash/recycle-bin safety net for removed titles, mobile responsiveness pass, and a fix for a memory leak in the metadata cache.

## v1.4.5 – v1.7.9 — July 2026

Security hardening (path traversal, database protections, CodeQL alerts), the trash system's final protections, a live in-app player, real-time updates across the UI, Plex activity monitoring, and collections support.

## v1.1.67 – v1.4.4 — July 2026

In-app player with automatic Plex transcode fallback, Overseerr (Seerr) request import, multi-architecture Docker builds, and a reduction of the settings navigation from 26 tabs down to 18.

## v1.1.50 – v1.1.66 — July 2026

Initial public release: TMDb discovery, Torznab/Newznab indexer search, unified movie/series library, multi-user requests, the built-in BitTorrent engine, and Plex sync — plus early stability and security fixes (session handling, library deduplication, dependency upgrades).
