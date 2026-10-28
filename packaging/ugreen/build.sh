#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARCH="${1:?Usage: build.sh amd64|arm64|all}"
case "$ARCH" in amd64|arm64|all) ;; *) echo "Unsupported architecture: $ARCH" >&2; exit 2 ;; esac
for tool in node docker ugcli sha256sum; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
docker buildx version >/dev/null
VERSION="$(node -p "require('$ROOT/package.json').version")"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid version: $VERSION" >&2; exit 1; }
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -a "$(dirname "$0")/." "$WORK/"
sed -i "s/^version: 0\.0\.0$/version: $VERSION/" "$WORK/project.yaml"
sed -i "s/movviz:0\.0\.0-ugreen/movviz:${VERSION}-ugreen/" "$WORK/rootfs_common/docker-compose.yaml"
if [[ "$ARCH" == amd64 ]]; then sed -i '/^  - arm64$/d' "$WORK/project.yaml"; fi
if [[ "$ARCH" == arm64 ]]; then sed -i '/^  - amd64$/d' "$WORK/project.yaml"; fi
build_one() {
  local arch="$1" image="docker.io/dj41ph4/movviz:${VERSION}-ugreen"
  docker buildx build --platform "linux/$arch" --load -f "$ROOT/packaging/docker/Dockerfile" -t "$image" "$ROOT"
  mkdir -p "$WORK/rootfs_${arch}/images"
  docker save -o "$WORK/rootfs_${arch}/images/movviz.tar" "$image"
}
if [[ "$ARCH" == all ]]; then build_one amd64; build_one arm64; else build_one "$ARCH"; fi
cd "$WORK"
ugcli check
ugcli pack --arch "$ARCH" --build 1 --product-series nasync
OUT="$ROOT/dist/nas"
mkdir -p "$OUT"
find build_dir -type f -name '*.upk' -exec cp {} "$OUT/" \;
(cd "$OUT" && sha256sum ./*.upk > ugreen-SHA256SUMS)
test -s "$OUT/ugreen-SHA256SUMS"
cat "$OUT/ugreen-SHA256SUMS"
