# Movviz NX — Android TV client

Native Android TV and Fire TV client built with Kotlin and Jetpack Compose for TV. It connects to an existing Movviz server through its REST API.

## App identity

- Application ID: `com.movviz.nx`
- Release APK: `Movviz-NX-Android-TV-client.apk`

## Signing

CI creates `keystore.properties` for the release build from the repository's configured signing secrets. Keep signing files and private keys out of source control.

## Build and verify

Use JDK 17 and Gradle 8.9 from `PATH`. From the repository root:

```powershell
gradle -p android-tv-nx :app:assembleRelease --no-daemon
gradle -p android-tv-nx :app:compileReleaseKotlin --no-daemon
```

The release APK is created at `android-tv-nx/app/build/outputs/apk/release/app-release.apk`. CI renames it to `Movviz-NX-Android-TV-client.apk` before publishing.

## Release

The Android TV app is built for each version tag. Keep its `versionCode` and fallback `versionName` in `android-tv-nx/app/build.gradle.kts` aligned with the project release. Verify the build and typecheck, commit only source and required release files, then push the version tag. The Android TV workflow attaches the APK to the matching GitHub release.
