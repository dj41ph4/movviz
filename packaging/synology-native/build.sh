#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARCH="${1:?Usage: build.sh x86_64|armv8}"
case "$ARCH" in x86_64|armv8) ;; *) echo "Unsupported DSM architecture: $ARCH" >&2; exit 2 ;; esac
VERSION="$(node -p "require('$ROOT/package.json').version")"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
test -f "$ROOT/.next/standalone/server.js"
test -d "$ROOT/engine/node_modules"
test -f "$ROOT/engine/node_modules/node-datachannel/build/Release/node_datachannel.node"
OUT="$ROOT/dist/nas"
mkdir -p "$OUT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/package"
mkdir -p "$STAGE/app/.next" "$WORK/spk/scripts" "$WORK/spk/conf"
cp -a "$ROOT/.next/standalone/." "$STAGE/app/"
cp -a "$ROOT/.next/static" "$STAGE/app/.next/static"
cp -a "$ROOT/public" "$STAGE/app/public"
cp -a "$ROOT/engine" "$STAGE/app/engine"
cp "$ROOT"/CHANGELOG*.md "$STAGE/app/"
cp -a "$(dirname "$0")/scripts/." "$WORK/spk/scripts/"
cp -a "$(dirname "$0")/conf/." "$WORK/spk/conf/"
cp "$(dirname "$0")/PACKAGE_ICON.PNG" "$WORK/spk/"
cp "$(dirname "$0")/PACKAGE_ICON_256.PNG" "$WORK/spk/"
chmod 755 "$WORK/spk/scripts/"*
cat > "$WORK/spk/INFO" <<EOF
package="movviz"
version="${VERSION}-0001"
arch="${ARCH}"
maintainer="dj41ph4"
displayname="Movviz"
description="Movviz media library and downloads"
beta="yes"
os_min_ver="7.2-60000"
install_dep_packages="Node.js_v22"
adminprotocol="http"
adminport="9810"
EOF
tar -C "$STAGE" -czf "$WORK/spk/package.tgz" .
FILE="$OUT/movviz-${VERSION}-synology-${ARCH}.spk"
tar -C "$WORK/spk" -cf "$FILE" INFO package.tgz scripts conf PACKAGE_ICON.PNG PACKAGE_ICON_256.PNG
test -s "$FILE"
tar -tf "$FILE" | grep -qx 'package.tgz'
tar -tzf "$WORK/spk/package.tgz" | grep -qx './app/server.js'
(cd "$OUT" && sha256sum "$(basename "$FILE")" > "$(basename "$FILE").sha256")
printf '%s\n' "$FILE"
