# Movviz Android et navigateur tactile

Comparaison du code Android Mobile NX et des entrées du changelog, avec vérifications dans Chromium aux formats 390 × 844, 820 × 1180 et 1440 × 900. Le code Android actuel sert de référence fonctionnelle. L’émulateur Mobile disponible contenait la version 1.28.109.

| Écran | Référence Android | État du navigateur |
| --- | --- | --- |
| Navigation | `MainActivity.kt`, `PortraitHeader.kt`, `UnfoldedScaffold.kt`, v1.25.191 | Dock à quatre onglets en portrait, rail sur tablette, loupe avec mise au point immédiate, menu pour les fonctions web et administrateur. |
| Accueil | `HomeScreen.kt`, v1.28.47 et v1.25.199 | Rangées et reprise partagées, carrousel balayable. La densité des cartes et les visuels restent à comparer sur plusieurs titres. |
| Recherche et Découverte | `SearchScreen.kt`, `DiscoverHubScreen.kt`, v1.25.194 et v1.28.109 | Onglets Tout, Films, Séries et Personnes, résultats reliés aux fiches, recherche tolérante aux fautes. Les feuilles de filtres et la disposition des résultats restent à aligner. |
| Mon espace | `LibraryHubScreen.kt`, v1.25.196 | Ma liste, historique de lecture dédoublonné et collections. Affiches sur trois colonnes en portrait. La bibliothèque complète et les titres recherchés sont aussi accessibles. |
| Téléchargements | `DownloadsScreen.kt`, v1.25.194 | Progression globale, débit et estimation de fin calculés sur la file active. Les commandes existantes restent accessibles. Les cartes et les onglets restent à rapprocher d’Android. |
| Fiches et épisodes | `TitleDetailScreen.kt`, v1.25.192 | Les actions de lecture, de suivi, de liste et de téléchargement existent. Restent la fiche en deux volets et la feuille d’épisode du portrait. |
| Lecteur | `PlayerActivity.kt`, v1.25.201, v1.26.002 et entrées Image dans l’image | Double appui ±10 s, piste audio, sous-titres, reprise et passage des repères présents dans le code web. Restent les contrôles visuels, la validation du plein écran, la fenêtre flottante et le comportement hors onglet sur les appareils cibles. |
| Profil, réglages et assistant | `ui/profile`, `ui/settings`, `ui/ai`, v1.25.194 et entrées de l’assistant Android | Profil, préférences, conversation et commandes vocales web existants. Restent le sélecteur de comptes Android, la présentation des réglages et les essais du clavier, de la dictée et des vibrations sur appareil. |
| Icônes | `mipmap-xxxhdpi/ic_launcher*` | Favicon tactile issu du PNG Android et icônes d’installation standard, Apple et avec masque système. |

La barre latérale, la recherche permanente et les onglets Bibliothèque, Collections et Recherchés ont été vérifiés en mode desktop à 1440 × 900.
