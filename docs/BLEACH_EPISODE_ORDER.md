# Numérotation de Bleach

Bleach conserve l'identité TMDb `30984` et TVDB `74796`. Deux fiches Movviz
avec le même identifiant créeraient des conflits de suivi, de recherche et de
synchronisation. La séparation est donc faite dans les saisons et dans les
adaptateurs de numérotation.

| Référence | Série originale | Thousand-Year Blood War |
| --- | --- | --- |
| TMDb, ordre par défaut | S1, épisodes 1–366 | S2, numérotation cumulée |
| Movviz réparé / TVDB diffusion | S1–S16 | S17, numérotation cumulée |
| Releases TYBW indépendantes | — | Peuvent recommencer à S1E1 ou numéroter les volets |

Les métadonnées TMDb sont converties à la frontière de l'API. Par exemple,
Movviz S2E1 demande TMDb S1E21 ; Movviz S17E1 demande TMDb S2E1. Le nombre
d'épisodes de TYBW vient des métadonnées, pas d'un nombre final figé.

## Trois coordonnées distinctes lors d'un téléchargement

Une cible moteur explicite contient les coordonnées source `season/episode`,
ainsi que `library` (identité Movviz) et `placement` (nom attendu par Plex).
Le moteur annonce sa prise en charge via `capabilities.episodePlacementV1`.
Un moteur plus ancien bloque le téléchargement concerné avant son lancement.

| Exemple | Source | Bibliothèque Movviz | Fichier pour Plex en ordre TMDb |
| --- | --- | --- | --- |
| Saison historique 11 | S11E1 | S11E1 | S1E206 |
| TYBW The Separation, premier épisode | S2E1 | S17E14 | S2E14 |

L'ordre physique est celui déclaré sur la fiche Plex, ou celui de sa
bibliothèque si elle en hérite. Movviz ne change pas ces préférences. Sans
Plex configuré, le placement par défaut suit TMDb.

Le nom final est établi avant le déplacement et la création du lien de seed,
y compris si le renommage général est désactivé. Le callback conserve les
trois coordonnées et `originalPath`. L'application les vérifie contre la cible
enregistrée avec le hash du téléchargement. Un redémarrage conserve ces champs
pour rejouer un callback perdu.

Le remplacement conserve exactement le chemin entrant, suffixe de collision
compris, pour ne pas casser un lien de seed déjà créé. Les contrôles de racine,
taille et intégrité des anciens fichiers restent nécessaires. Un fichier
multiépisode dont la couverture ne peut pas être représentée dans les trois
ordres est refusé avant tout déplacement.

## Réparation d'une entrée existante

L'administrateur dispose d'un aperçu et d'une confirmation sur la fiche unique
du titre. Le serveur contrôle une empreinte de l'état et écrit une sauvegarde
avant de convertir les saisons. Il conserve l'identifiant de la série, les
fichiers et leurs liens Plex. Il bloque les téléchargements en cours et les
historiques dont l'identité ne peut pas être établie.

Cette opération convertit les métadonnées Movviz. Elle ne renomme pas les
anciens fichiers et ne prouve pas leur contenu. Un nom S2E1, un GUID ou un titre
Plex exprime un classement ; cela ne permet pas à lui seul de déterminer quelle
vidéo se trouve dans le MKV.

La synchronisation Plex utilise l'ordre déclaré et réunit les fiches reconnues
comme Bleach. Une lecture partielle peut ajouter des associations prouvées,
mais ne sert pas à déclarer les autres épisodes absents. Les fichiers sans
association fiable restent non résolus.

## Vérifications

- `npm test` : correspondance des 366 épisodes, garde-fous de réparation,
  sélection des releases et intégration dans la bibliothèque.
- `node --test scripts/engine-*.test.mjs` : nom physique, pack de 13 épisodes,
  fichiers combinés, refus avant déplacement, callback après redémarrage et
  lecture des données de seed via leur chemin original.
- L'aperçu et la confirmation doivent être vérifiés avec une copie isolée des
  données. Aucun test ne doit télécharger une vraie release ou modifier Plex.

Références : [ordre TMDb](https://www.themoviedb.org/tv/30984-bleach/episode_group/663fb548c10d4be3e80b2f6d),
[TVDB](https://www.thetvdb.com/series/bleach),
[ordre et nommage Plex](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/).
