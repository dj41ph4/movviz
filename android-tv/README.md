# Movviz TV — client Android TV

Client natif pour Android TV/Fire TV, écrit en Kotlin + Jetpack Compose for
TV. Se connecte à un serveur Movviz existant via son API REST — aucun
changement côté serveur, ce module consomme les routes `/api/*` déjà
utilisées par l'app web.

## État actuel — premier increment

Ce qui est en place et fonctionnel (structure du code, non compilé/testé
faute de SDK Android disponible dans l'environnement où il a été écrit —
**à valider dans Android Studio avant tout autre chose**) :

- **Wizard** — saisie de l'URL du serveur + test de connexion réel avant validation
- **Login** — nom d'utilisateur/mot de passe, réutilise `/api/auth/login` (cookie de session, comme le navigateur)
- **Session persistante** — le cookie est stocké dans un `PersistentCookieJar` (SharedPreferences), et un ping authentifié (`/api/auth/me`) au lancement saute directement l'écran de login si la session tient encore — comme Plex/Netflix, jamais de re-login systématique
- **Accueil** — rangées Films/Séries chargées depuis `/api/library/movies` et `/api/library/series`, cartes focusables au D-pad
- **Fiche titre** — reprend la composition du hero desktop (`TitleContent.tsx` / `DashboardHero.tsx`) transposée au 10-foot UI : backdrop plein écran + double dégradé, pastille "dans la bibliothèque", titre, ligne méta (étoile/année/durée/genres), tagline, synopsis, bouton principal en dégradé de marque ("Ajouter à la bibliothèque") ou blanc plein ("Lire") — même hiérarchie visuelle, sans les éléments propres à la souris (survol, popovers "pourquoi ce titre")
- **Fiche série** — saisons + épisodes en rangées horizontales (façon liste de saisons Plex), chaque épisode disponible se lance directement ; les épisodes pas encore téléchargés sont visibles mais désactivés
- **Lecteur** — Media3/ExoPlayer pointé sur `/api/stream/{ratingKey}`, réutilise le même client HTTP (donc le même cookie de session) que le reste de l'app

## Ce qui manque encore (prochaines itérations)

- **Effet "wow" visuel** — Ken Burns/autoplay bande-annonce sur le backdrop de la fiche titre et de l'accueil, flou d'arrière-plan derrière le focus : la base fonctionnelle est là (composition, dégradés, pastilles), l'animation est la prochaine étape une fois l'app testée sur un vrai boîtier
- **Recherche** (y compris vocale, native Android TV)
- **Sélection de profil** multi-utilisateur
- **Icônes/banner réels** — les assets actuels (`res/drawable/ic_launcher_*.xml`, `ic_banner.xml`) sont des placeholders vectoriels aux couleurs de marque, à remplacer par le vrai logo
- **Logo TMDb sur la fiche titre** — le web affiche le logo transparent du titre (`/api/metadata/images`) à la place du texte quand il existe ; pas encore repris côté TV
- **Écran Paramètres** — changer de serveur / se déconnecter (`AppViewModel.logout()` existe déjà côté code, pas encore d'écran pour l'appeler)

## Build

Le wrapper Gradle (`gradlew`/`gradlew.bat` + le jar binaire) n'a **pas** été
généré automatiquement — nécessite d'ouvrir le dossier `android-tv/` dans
Android Studio une première fois (il complète le wrapper tout seul), ou de
lancer `gradle wrapper` manuellement si Gradle est déjà installé sur la
machine.

```bash
cd android-tv
./gradlew assembleDebug
```

## CI/CD

`.github/workflows/android-tv-build.yml` compile un APK **debug** (non
signé) à chaque push touchant `android-tv/**`, sur les pull requests, et
manuellement (`workflow_dispatch`) ; sur un tag `vX.Y.Z` il attache aussi
l'APK à la Release GitHub, à côté de l'installeur Windows. Comme le wrapper
Gradle n'est pas versionné (voir plus haut), le job utilise directement le
binaire Gradle fourni par `gradle/actions/setup-gradle` plutôt que
`./gradlew`.

Un APK **debug** s'installe directement (`adb install app-debug.apk` ou
transfert manuel) mais n'est pas signé pour la distribution — la signature
release (keystore en secret GitHub, variant `assembleRelease`) est une
amélioration ultérieure, pas un prérequis pour tester l'app sur un vrai
boîtier.
