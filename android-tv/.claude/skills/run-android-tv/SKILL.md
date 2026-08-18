---
name: run-android-tv
description: Build, install, launch, and drive the Movviz Android TV client (Kotlin/Compose for TV) on the running emulator — use this to "run android-tv", "screenshot the TV app", "test the TV app", or "check the TV build".
---

Paths below are relative to `android-tv/` (this skill's unit root — the
skill itself lives at `android-tv/.claude/skills/run-android-tv/`).

This is a native Kotlin/Jetpack Compose for TV app, not a web app — the
driver is `driver.sh`, a thin wrapper around `gradle` (build) and `adb`
(install/launch/screenshot/input). There is no headless-browser
equivalent for a real Android app; `adb` on a running emulator/device
**is** the programmatic handle.

## Prerequisites

- A running Android TV emulator or device, visible in `adb devices`.
  This project's dev machine already has one running as `emulator-5554`
  (`sdk_google_atv64_x86_64`) — verified via `driver.sh devices`.
- JDK 17, Android SDK, and Gradle 8.9 installed locally. This machine's
  paths (already the driver's defaults, override via env vars if yours
  differ):
  - `JAVA_HOME_PATH=C:/devtools/jdk-17.0.20+8`
  - `ANDROID_HOME_PATH=C:/devtools/android-sdk`
  - `GRADLE_BIN=C:/devtools/gradle/gradle-8.9/bin/gradle`

## Run (agent path) — use the driver

```bash
# One-shot: build + install + launch
bash .claude/skills/run-android-tv/driver.sh up

# Or step by step
bash .claude/skills/run-android-tv/driver.sh build
bash .claude/skills/run-android-tv/driver.sh install
bash .claude/skills/run-android-tv/driver.sh launch

# Screenshot — prints the local PNG path, read it with the Read tool
bash .claude/skills/run-android-tv/driver.sh screenshot home
# => /tmp/home.png

# D-pad / remote input
bash .claude/skills/run-android-tv/driver.sh key DPAD_DOWN
bash .claude/skills/run-android-tv/driver.sh key DPAD_CENTER
bash .claude/skills/run-android-tv/driver.sh key BACK

# Mouse/touch tap (coordinates from a screenshot you just took)
bash .claude/skills/run-android-tv/driver.sh tap 400 300

# Type text into a focused field (spaces handled automatically)
bash .claude/skills/run-android-tv/driver.sh text "black-ish"

# Logs (last 200 lines, optional grep -iE filter)
bash .claude/skills/run-android-tv/driver.sh logcat
bash .claude/skills/run-android-tv/driver.sh logcat "FATAL|AndroidRuntime|JsonDataException"
```

Verified this session: `up` → `screenshot home` produced a real PNG of
the running app's home screen (hero carousel, nav rail, poster rows).

**Set `MOVVIZ_TV_SCRATCH=/some/dir`** to change where screenshots land
(defaults to `/tmp`).

## Run (human path)

Open Android Studio, open `android-tv/`, run the `app` configuration on
a connected device/emulator. Only useful if you want to interact with
it yourself — an agent should always use the driver above.

## Session persistence — read this before testing login-gated screens

The emulator already has a **real, logged-in Movviz session** with real
library data (movies, series, download queue). This is valuable and has
been wiped by mistake multiple times during development.

- **`driver.sh install` uses `adb install -r`** (reinstall, keep app
  data) — safe, use it freely.
- **NEVER run `adb uninstall`** — it wipes app data, including the
  saved session, and drops you at the "server address" wizard screen.
- If you land on a login screen anyway: **do not type the password
  yourself**, under any circumstances, even in a test context. Verify
  your change via code reading + direct server `fetch()` calls (the
  desktop site at the configured server URL keeps its own authenticated
  browser session, separate from the TV app) instead of live D-pad
  testing, and say so plainly in your report.

## Gotchas

- **`/sdcard/...` paths get mangled by Git Bash's path translation on
  Windows.** The driver already handles this (`MSYS_NO_PATHCONV=1` +
  a leading `//sdcard/...`) — if you ever bypass the driver and call
  `adb shell`/`adb pull` directly, remember this or your screenshot
  pull will silently fail with "No such file or directory" against a
  mangled `C:/Program Files/Git/sdcard/...` path.
- **`adb install -r` can report "Success" without actually replacing
  `base.apk`** in rare cases (observed once this session) — if a code
  change doesn't seem to show up after `install`, diff the APK's
  SHA-256 against the freshly built one, or just `driver.sh up` again.
- Gradle's first run in a session forks a daemon and is slower
  (~1 min); subsequent builds with unchanged files are `UP-TO-DATE` in
  under 30s.
- The emulator's screen is 1920×1080 physical at 320dpi (2x density) —
  a Compose `140.dp` poster renders at ~280 physical px. Keep this in
  mind when reasoning about on-screen sizes from a screenshot.

## Troubleshooting

- **`adb: no devices/emulators found`** → the emulator isn't running.
  This session's emulator is normally already up; if not, it needs to
  be started separately (outside this skill's scope — ask the user
  before starting a new emulator instance, it's not a cheap action).
- **Build fails with a Kotlin "unresolved reference"** that looks
  unrelated to your change → check for a stray literal `/*` inside a
  KDoc comment a few lines above; Kotlin's block comments nest, and a
  KDoc that mentions a path like `/api/*` opens a comment that
  swallows the rest of the file, producing cascading unrelated errors
  further down.
- **App crashes immediately on a screen showing real data (not on
  launch)** → check `driver.sh logcat "JsonDataException|FATAL"` first.
  This codebase mirrors TypeScript API types into Kotlin DTOs by hand;
  a field declared non-null in Kotlin that the server sometimes omits,
  or a numeric field declared `Long` that the server sometimes sends
  as a decimal, are the two concrete crashes already hit this way —
  verify a DTO's shape against a live `fetch()` of the real endpoint
  before trusting it, not just the TypeScript type it was copied from.
