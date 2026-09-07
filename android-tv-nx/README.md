# Movviz NX — client Android TV (variante Netflix-style)

Second client natif Android TV/Fire TV, écrit en Kotlin + Jetpack Compose
for TV — fork expérimental de [`android-tv/`](../android-tv/README.md)
(voir ce README pour l'architecture serveur/lecteur détaillée, identique ici)
avec une navigation et un shell repensés façon Netflix. Se connecte à un
serveur Movviz existant via son API REST — aucun changement côté serveur.

> **Ce README est la référence de maintenance pour les agents IA.** Lire
> cette section **Identité**, **Signature**, **Build** et **Release**
> avant toute modification — les pièges (secrets, PNG, tags, versions)
> documentés dans `android-tv/README.md` s'appliquent aussi ici.

---

## Identité — isolée de Movviz TV, jamais un remplacement

| | Movviz TV (`android-tv/`) | Movviz NX (`android-tv-nx/`) |
|---|---|---|
| `applicationId` | `com.movviz.tv.au` | `com.movviz.nx` |
| Label | « Movviz TV » | « Movviz NX » |
| Asset GitHub Release | `Movviz-Android-TV-client.apk` | `Movviz-NX-Android-TV-client.apk` |
| Icône | clapperboard historique | icône circulaire dédiée + marque « M » dans l'UI |

Les deux applications s'installent **côte à côte** sur le même appareil :
`applicationId` distinct → jamais de collision, jamais d'écrasement, jamais
de confusion dans l'auto-update (chacune ne compare son propre
`BuildConfig.VERSION_NAME` qu'à son propre asset GitHub).

---

## Signature & keystore

- **Même clé de signature** que Movviz TV (`movviz-tv-retail.jks`) — en CI,
  `keystore.properties` est **copié depuis `android-tv/`** avant le build NX
  (voir `.github/workflows/android-tv-build.yml`). Ne jamais committer ce
  fichier copié (déjà couvert par `.gitignore` racine — vérifier avant tout
  `git add`).
- En local, générer/récupérer `android-tv-nx/keystore.properties` de la même
  façon que pour `android-tv/` (voir ce README pour le détail des secrets
  GitHub `MOVVIZ_ANDROID_KEYSTORE_*`).
- Partager la clé est volontaire (mêmes développeurs, même confiance) — ce
  qui isole vraiment les deux apps, c'est l'`applicationId`, pas la clé.

---

## Build & vérification locale

Même toolchain que `android-tv/` (JDK 17, Gradle 8.9), en pointant sur ce
module :

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

- **Même workflow, même job** que Movviz TV : les deux apps sont buildées et
  taguées ensemble, donc partagent toujours le même `versionName`/`versionCode`
  dérivé du tag Git (`movvizVersionName`/`movvizVersionCode`).
- Le keystore `android-tv/keystore.properties` est copié vers
  `android-tv-nx/keystore.properties` avant le build NX (même clé, deux
  applicationId).
- `gradle -p android-tv-nx assembleRelease` → APK renommé
  `Movviz-NX-Android-TV-client.apk`, attaché à la Release GitHub au même tag
  `v*` que l'APK Movviz TV.

---

## Procédure de release — à respecter à chaque mise à jour

Movviz NX est buildé et versionné **en même temps** que Movviz TV — un seul
tag couvre les deux apps. À chaque cycle de release :

1. Modifier le code dans `android-tv-nx/app/src/main/kotlin/com/movviz/tv/`.
2. **Bump de version partout, en même temps** (voir aussi
   `android-tv/README.md` § Procédure de release, identique) :
   - `android-tv-nx/app/build.gradle.kts` → `versionCode`/`versionName` de
     repli (même valeurs que `android-tv/app/build.gradle.kts` et
     `android-mobile/app/build.gradle.kts` — les **trois** doivent rester
     synchronisés, sinon boucle de mise à jour infinie en build local) ;
   - `android-tv/app/build.gradle.kts`, `android-mobile/app/build.gradle.kts` ;
   - `package.json`, `package-lock.json`, `README.md` (badge racine),
     `CHANGELOG.md` (entrée française, en tête).
3. Compiler/vérifier localement (voir plus haut) + `npm run typecheck` à la
   racine.
4. **Commit sans jamais inclure** : `android-tv-nx/*.png`,
   `android-tv-nx/keystore.properties`, les captures/dumps de debug
   (`.tmp-nx-*.png`, `.tmp-nx-*.xml`, `.qa-dpad-evidence/`). N'ajouter que
   les fichiers source concernés.
5. `git tag vX.Y.Z` puis `git push origin main --tags` — le CI publie les
   deux APK (Movviz TV et Movviz NX) sur la même Release.
6. Vérifier la Release GitHub : les deux assets présents, chacun avec son
   digest.
