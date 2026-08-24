# Movviz TV — client Android TV

Client natif pour Android TV/Fire TV, écrit en Kotlin + Jetpack Compose for
TV. Se connecte à un serveur Movviz existant via son API REST — aucun
changement côté serveur, ce module consomme les routes `/api/*` déjà
utilisées par l'app web.

> **Ce README est la référence de maintenance pour les agents IA.** Lire
> cette section **Build**, **Signature**, **Auto-update** et **Release**
> avant toute modification — plusieurs pièges (secrets, PNG, tags, versions)
> y sont documentés.

---

## Architecture

- **Wizard** — saisie de l'URL du serveur + test de connexion réel avant validation
- **Login** — nom d'utilisateur/mot de passe, réutilise `/api/auth/login` (cookie de session)
- **Session persistante** — `PersistentCookieJar` (SharedPreferences) + ping `/api/auth/me` au lancement : jamais de re-login systématique
- **Accueil / catalogues** — rangées `/api/library/movies`, `/api/library/series`, `/api/metadata/rows` (carrousels séparés Films / Séries / mixte)
- **Fiche titre** — transposition 10-foot UI du hero desktop : backdrop + double dégradé, pastille "dans la bibliothèque", méta, tagline, bouton d'action, saisons/épisodes en rangées horizontales, titres similaires
- **Lecteur** — Media3/ExoPlayer sur `/api/stream/{ratingKey}`, même client HTTP (même cookie) que le reste de l'app

### Lecture en 3 niveaux (`PlayerActivity.kt`)

`fallbackLevel` (0→2), **une seule tentative par niveau et par item**, reprise à la même position :

| Niveau | URL | Quand |
|---|---|---|
| 0 — direct | `/api/stream/{ratingKey}` | ExoPlayer décode tout nativement |
| 1 — audio seul | `transcodeUrl` = `?tv=0&ta=1&fmt=dash` | Audio non décodable (DTS/AC3/TrueHD) : la vidéo est copiée en bitstream (x264/x265 jamais ré-encodés), seul le son passe en aac, via **DASH** (seul format où Plex honore le copy bitstream, HEVC compris) |
| 2 — complet | `transcodeFullUrl` = `?tv=1&ta=1` | Vidéo copiée toujours indécodable (ex. AV1) : transcodage complet h264/aac en HLS |

MIME par niveau : direct = auto, niveau 1 = `APPLICATION_MPD`, niveau 2 = `APPLICATION_M3U8`.

---

## Un seul APK : « Movviz TV » (auto-update intégrée)

Depuis la v1.16.47, il n'existe **plus qu'un seul APK** — la variante
`retail` (sans auto-update) a été supprimée. L'application unique s'appelle
**Movviz TV** :

| applicationId | `BuildConfig.AUTO_UPDATE` | Label |
|---|---|---|
| `com.movviz.tv.au` | `true` | « Movviz TV » |

L'`applicationId` gardé est celui de l'ancienne variante AU : les
installations existantes et l'auto-update continuent de se remplacer
proprement (même package = mise à jour, pas une 2e app).

### Auto-update sans magasin

Flux complet, vivant dans `data/UpdateManager.kt` + `ui/update/UpdateOverlay.kt` :

1. **Check** (`UpdateManager.checkForUpdate()`) — au lancement, GET
   `https://api.github.com/repos/dj41ph4/movviz/releases/latest` (repo public,
   API sans auth). Compare le tag semver au `BuildConfig.VERSION_NAME`
   (`isNewerVersion`). Cherche l'asset `Movviz-Android-TV-client.apk` +
   son `digest` SHA-256. Toute erreur (réseau/HTTP) → `null`, l'app démarre normalement.
2. **Permission** — si `canInstallUnknown()` est faux (Android 8+), overlay
   « Autorise l'installation d'applications inconnues » → ouvre
   `ACTION_MANAGE_UNKNOWN_APP_SOURCES`. Un observateur `LifecycleEventObserver`
   sur `ON_RESUME` relance le flux automatiquement au retour des réglages.
   Bouton « Plus tard » = `dismissed` (silencieux jusqu'au prochain lancement).
3. **Téléchargement** — streaming avec progression 0→1
   (`download(info, onProgress)`), écrit dans `cacheDir/update/update.part`,
   puis **SHA-256 vérifié** contre le digest publié — un fichier corrompu ou
   falsifié n'est jamais installé. Renommé en `update.apk`.
4. **Installation** — `FileProvider` (authority `${applicationId}.fileprovider`,
   `<cache-path name="update" path="update/">`) + `ACTION_VIEW` avec
   `application/vnd.android.package-archive` et `FLAG_GRANT_READ_URI_PERMISSION`.

L'overlay (plein écran, « Mise à jour, veuillez patienter… » + barre custom
dessinée à la main — pas de material3 LinearProgressIndicator dans le projet)
est monté **par-dessus** le `NavHost` (`MainActivity.kt`, Box parent) et
bloque l'interaction pendant le téléchargement/installation.

---

## Signature & keystore

- La clé de signature vit **localement** dans `C:\Users\dj41ph4\.movviz\keys\movviz-tv-retail.jks`
  (+ `movviz-tv-retail.password.txt`).
- `android-tv/keystore.properties` référence cette clé pour le build local.
  **NE JAMAIS le commiter** (déjà dans `.gitignore` — vérifier avant tout
  `git add`).
- En CI, la même clé est reconstruite depuis les **secrets GitHub**
  (`Settings → Secrets and variables → Actions`) :
  `MOVVIZ_ANDROID_KEYSTORE_B64` (base64 du `.jks`),
  `MOVVIZ_ANDROID_KEYSTORE_PASSWORD`, `MOVVIZ_ANDROID_KEY_ALIAS`
  (`movviz-retail`), `MOVVIZ_ANDROID_KEY_PASSWORD`.
- **Sans ces secrets, la CI signe avec une clé éphémère** → l'APK publié ne
  peut PAS être installé par-dessus un APK existant
  (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Si une release est publiée sans
  secrets, il faut refaire le tag avec les secrets configurés.

---

## Build & vérification locale

Le wrapper Gradle (`gradlew`) n'est **pas** versionné — deux options :

- Ouvrir `android-tv/` dans Android Studio (il complète le wrapper) ;
- Utiliser directement les outils **déjà présents sur la machine** :

```powershell
$env:JAVA_HOME = "C:\Users\dj41ph4\.movviz\jdk-17"          # JDK 17 (le JDK 25 ne passe PAS avec Gradle 8.9)
& "C:\Users\dj41ph4\.movviz\gradle-8.9\bin\gradle.bat" :app:assembleRelease --no-daemon
```

`assembleRelease` compile l'unique canal et produit :
`app/build/outputs/apk/release/app-release.apk`.

Pour valider le Kotlin seul (rapide) :

```powershell
& "C:\Users\dj41ph4\.movviz\gradle-8.9\bin\gradle.bat" :app:compileReleaseKotlin --no-daemon
```

Le build web n'est pas impacté par `android-tv/`, mais un push complet passe
aussi par `npm run typecheck` à la racine.

---

## CI/CD (`.github/workflows/android-tv-build.yml`)

- Déclenché sur : push `main` touchant `android-tv/**` ou le workflow, PR,
  tags `v*`, et `workflow_dispatch`.
- JDK 17 + Android SDK 35 + Gradle 8.9 (binaire `setup-gradle`, pas le wrapper).
- `Prepare release signing key` : reconstruit le keystore depuis les secrets
  (ou clé éphémère avec warning).
- `gradle assembleRelease` → **1 APK** renommé :
  `Movviz-Android-TV-client.apk`
- Sur tag `v*` : l'APK est attaché à la Release (softprops/action-gh-release),
  avec le digest SHA-256 généré automatiquement par GitHub (utilisé par l'auto-update).
- L'APK embarque `BuildConfig.AUTO_UPDATE=true` : c'est l'asset qu'il
  télécharge pour se mettre à jour.

---

## Procédure de release — à respecter à chaque mise à jour

1. Modifier le code dans `android-tv/app/src/main/kotlin/com/movviz/tv/`.
2. **Bump de version partout, en même temps** :
   - `android-tv/app/build.gradle.kts` → `versionCode` (incrément, format `1XXXX`)
     et `versionName` (ex. `1.19.36`) ;
   - `package.json`, `package-lock.json`, `README.md` (ligne « Version actuelle »),
     `CHANGELOG.md` (entrée française, en tête). Le badge README n'est pas touché.
3. Compiler/vérifier localement (voir plus haut) + `npm run typecheck` à la racine.
4. **Commit sans jamais inclure** : `android-tv/*.png`, `android-tv/ui.xml`,
   `android-tv/keystore.properties`, les `*.png` à la racine. N'ajouter que les
   fichiers source concernés.
5. `git tag vX.Y.Z` puis `git push origin main --tags` — le CI publie l'APK.
6. Vérifier la Release GitHub : l'asset présent avec son digest.
