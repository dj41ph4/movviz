# Movviz NX — client Android TV (variante Netflix-style)

Client natif Android TV/Fire TV, écrit en Kotlin + Jetpack Compose for TV,
avec une navigation et un shell repensés façon Netflix. Se connecte à un
serveur Movviz existant via son API REST — aucun changement côté serveur.

> **Ce README est la référence de maintenance pour les agents IA.** Lire
> cette section **Identité**, **Signature**, **Build** et **Release**
> avant toute modification.

---

## Identité

`applicationId` : `com.movviz.nx` · Asset GitHub Release :
`Movviz-NX-Android-TV-client.apk`.

---

## Signature & keystore

- En CI, `keystore.properties` est créé directement dans `android-tv-nx/`
  avant le build. Ne jamais committer ce
  fichier copié (déjà couvert par `.gitignore` racine — vérifier avant tout
  `git add`).
- En local, générer/récupérer `android-tv-nx/keystore.properties` avec les
  secrets GitHub
  GitHub `MOVVIZ_ANDROID_KEYSTORE_*`).

---

## Build & vérification locale

Toolchain : JDK 17, Gradle 8.9, en pointant sur ce module :

```powershell
$env:JAVA_HOME = "C:\Users\dj41ph4\.movviz\jdk-17"
& "C:\Users\dj41ph4\.movviz\gradle-8.9\bin\gradle.bat" -p android-tv-nx :app:assembleRelease --no-daemon
```

Pour valider le Kotlin seul (rapide) :

```powershell
& "C:\Users\dj41ph4\.movviz\gradle-8.9\bin\gradle.bat" -p android-tv-nx :app:compileReleaseKotlin --no-daemon
```

`assembleRelease` produit `app/build/outputs/apk/release/app-release.apk`,
renommé `Movviz-NX-Android-TV-client.apk` par le CI avant publication.

---

## CI/CD (`.github/workflows/android-tv-build.yml`)

- Le workflow compile uniquement Movviz NX TV et crée
  `android-tv-nx/keystore.properties` avant le build.
- `gradle -p android-tv-nx assembleRelease` → APK renommé
  `Movviz-NX-Android-TV-client.apk`, attaché à la Release GitHub au même tag
  `v*`.

---

## Procédure de release — à respecter à chaque mise à jour

Movviz NX est buildé et versionné à chaque tag. À chaque cycle de release :

1. Modifier le code dans `android-tv-nx/app/src/main/kotlin/com/movviz/tv/`.
2. **Bump de version partout, en même temps** (voir aussi
   - `android-tv-nx/app/build.gradle.kts` → `versionCode`/`versionName` de
     repli ;
   - `package.json`, `package-lock.json`, `README.md` (badge racine),
     `CHANGELOG.md` (entrée française, en tête).
3. Compiler/vérifier localement (voir plus haut) + `npm run typecheck` à la
   racine.
4. **Commit sans jamais inclure** : `android-tv-nx/*.png`,
   `android-tv-nx/keystore.properties`, les captures/dumps de debug
   (`.tmp-nx-*.png`, `.tmp-nx-*.xml`, `.qa-dpad-evidence/`). N'ajouter que
   les fichiers source concernés.
5. `git tag vX.Y.Z` puis `git push origin main --tags` — le CI publie l'APK NX.
6. Vérifier la Release GitHub et son digest.
