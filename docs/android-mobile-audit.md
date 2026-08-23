# Movviz Android smartphone — audit de départ

Ce document fige le périmètre avant toute extraction. Le client smartphone
consomme le contrat `/api/*` existant et ne crée aucune route backend.

| Fonction | Android TV actuel | Desktop de référence | Mobile prévu | API / logique |
|---|---|---|---|---|
| Serveur | Wizard URL + ping | Sélection serveur | Onboarding tactile | `system/changelog` |
| Session | CookieJar + DataStore | Session web | Même cookie/session, stockage mobile séparé | `auth/login`, `auth/me`, logout |
| Plex | PIN TV + polling | Connexion Plex web | Même flux PIN/polling adapté au tactile | `auth/plex/tv-pin`, `auth/plex/poll` |
| Profils | Profils foyer TV | Menu utilisateur | Sélecteur tactile + profils enregistrés | `tv-profiles`, `auth/me` |
| Accueil | Hero + rangées TV | Hero cinématique + recommandations | Hero portrait/paysage + `LazyRow` | `dashboard/hero`, metadata rows |
| Catalogue | Films / séries | Filtres, genres, collections | Explorer tactile | bibliothèque + metadata |
| Recherche | Écran recherche TV | Recherche riche | Clavier natif + debounce | metadata search |
| Fiches | `TitleDetailScreen` | `TitleContent` flottant | Fiche mobile tactile | detail, images, saisons |
| Lecture | Media3 direct → DASH → HLS | UX player | Même moteur Media3, commandes tactiles | stream, sessions, heartbeat |
| Activité | Activity V2 | Activité / téléchargements | Liste tactile | `activity/v2` |

## Règles de non-régression

- Aucun fichier de `android-tv/` n'est modifié par le socle initial.
- Aucun fichier `src/app/api/` ou backend n'est modifié.
- Aucun WebView et aucune logique de lecture parallèle.
- Le D-pad TV reste dans l'application TV ; le mobile utilise uniquement le
  tactile, les gestes et les retours haptiques.
- Toute extraction future devra compiler Android TV avant de passer à l'écran
  smartphone suivant.

