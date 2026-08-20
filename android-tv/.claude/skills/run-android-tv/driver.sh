#!/usr/bin/env bash
# Driver for the Movviz Android TV client — build, install, launch, and
# drive it via adb (D-pad/keyboard/tap), same commands used interactively
# throughout development. Run from anywhere; paths are resolved relative to
# this script's location, one level up from android-tv/.claude/skills/run-android-tv/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_TV_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# --- Toolchain: adjust these three if your machine differs -----------------
JAVA_HOME_PATH="${JAVA_HOME_PATH:-C:/devtools/jdk-17.0.20+8}"
ANDROID_HOME_PATH="${ANDROID_HOME_PATH:-C:/devtools/android-sdk}"
GRADLE_BIN="${GRADLE_BIN:-C:/devtools/gradle/gradle-8.9/bin/gradle}"
# -----------------------------------------------------------------------

ADB="$ANDROID_HOME_PATH/platform-tools/adb.exe"
# Canal unique depuis le retrait de la variante retail (v1.16.47) :
# applicationId com.movviz.tv.au, APK unique en release.
APK_PATH="$ANDROID_TV_DIR/app/build/outputs/apk/release/app-release.apk"
PKG="com.movviz.tv.au"
ACTIVITY="$PKG/.MainActivity"
SCRATCH_DIR="${MOVVIZ_TV_SCRATCH:-/tmp}"

cmd="${1:-help}"
shift || true

usage() {
  cat <<'EOF'
Usage: driver.sh <command> [args]

  build              gradle assembleRelease (canal unique, applicationId com.movviz.tv.au)
  install            adb install -r the last-built APK (NEVER uninstall — wipes the logged-in session)
  launch             force-stop + start MainActivity fresh
  screenshot <name>  screencap the device, pull to $MOVVIZ_TV_SCRATCH/<name>.png (default /tmp), print the local path
  key <KEYCODE>      adb shell input keyevent KEYCODE_<KEYCODE>  (e.g. `key DPAD_DOWN`, `key BACK`, `key DPAD_CENTER`)
  tap <x> <y>        adb shell input tap x y
  text <string>      adb shell input text (spaces become %s automatically)
  logcat [grep]       last 200 logcat lines, optionally grep -iE filtered
  devices            adb devices -l
  up                 build + install + launch, in one call
EOF
}

require_adb() {
  if [ ! -x "$ADB" ] && [ ! -f "$ADB" ]; then
    echo "adb not found at $ADB — set ANDROID_HOME_PATH or edit driver.sh" >&2
    exit 1
  fi
}

case "$cmd" in
  build)
    (cd "$ANDROID_TV_DIR" && JAVA_HOME="$JAVA_HOME_PATH" ANDROID_HOME="$ANDROID_HOME_PATH" "$GRADLE_BIN" assembleRelease --no-daemon)
    ;;
  install)
    require_adb
    [ -f "$APK_PATH" ] || { echo "No APK at $APK_PATH — run 'build' first." >&2; exit 1; }
    # -r (reinstall, keep data) only. Never `adb uninstall` — it wipes the
    # logged-in Movviz/Plex session and nobody here can type the password
    # back in on your behalf.
    "$ADB" install -r "$APK_PATH"
    ;;
  launch)
    require_adb
    "$ADB" shell am force-stop "$PKG"
    "$ADB" shell am start -n "$ACTIVITY"
    ;;
  up)
    "$0" build
    "$0" install
    "$0" launch
    ;;
  screenshot)
    require_adb
    name="${1:-screen}"
    out="$SCRATCH_DIR/$name.png"
    mkdir -p "$SCRATCH_DIR"
    # /sdcard/... gets mangled by Git Bash's path translation on Windows —
    # MSYS_NO_PATHCONV + a leading double-slash sidesteps it.
    MSYS_NO_PATHCONV=1 "$ADB" shell "screencap -p /sdcard/movviz_driver_screen.png"
    MSYS_NO_PATHCONV=1 "$ADB" pull "//sdcard/movviz_driver_screen.png" "$out" >/dev/null
    echo "$out"
    ;;
  key)
    require_adb
    code="${1:?usage: driver.sh key <KEYCODE, e.g. DPAD_DOWN|DPAD_UP|DPAD_LEFT|DPAD_RIGHT|DPAD_CENTER|BACK|ENTER|HOME>}"
    "$ADB" shell input keyevent "KEYCODE_$code"
    ;;
  tap)
    require_adb
    x="${1:?x}"; y="${2:?y}"
    "$ADB" shell input tap "$x" "$y"
    ;;
  text)
    require_adb
    str="${1:?text string}"
    "$ADB" shell input text "${str// /%s}"
    ;;
  logcat)
    require_adb
    filter="${1:-}"
    if [ -n "$filter" ]; then
      "$ADB" logcat -d | grep -iE "$filter" | tail -200
    else
      "$ADB" logcat -d | tail -200
    fi
    ;;
  devices)
    require_adb
    "$ADB" devices -l
    ;;
  help|*)
    usage
    ;;
esac
