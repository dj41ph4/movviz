#!/usr/bin/env bash
set -euo pipefail

ARCH="${1:-}"
IMAGE_TAG="${2:-}"

if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
  echo "usage: bash packaging/terramaster/build.sh <x86_64|aarch64> <sha-COMMIT>" >&2
  exit 2
fi
if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "IMAGE_TAG must be an immutable sha-<40 hex commit> Docker Hub tag" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/packaging/terramaster"
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["version"])' "$ROOT/package.json")"
OUT="$ROOT/dist/terramaster"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

sed "s/__MOVVIZ_VERSION__/${VERSION}/g" "$SRC/config.${ARCH}.ini" > "$STAGE/config.ini"
sed "s/__MOVVIZ_IMAGE_TAG__/${IMAGE_TAG}/g" "$SRC/docker-compose.yml" > "$STAGE/docker-compose.yml"
cp "$SRC/movviz.lang" "$STAGE/movviz.lang"
cp "$SRC/movviz.svg" "$STAGE/movviz.svg"

python3 "$SRC/validate.py" "$STAGE" "$ARCH"

docker compose -f "$STAGE/docker-compose.yml" config -q

mkdir -p "$OUT"
ARCHIVE="movviz_${ARCH}.tar.gz"
tar -C "$STAGE" -czf "$OUT/$ARCHIVE" config.ini movviz.lang movviz.svg docker-compose.yml

mapfile -t MEMBERS < <(tar -tzf "$OUT/$ARCHIVE" | sed 's#^\./##' | sort)
EXPECTED=(config.ini docker-compose.yml movviz.lang movviz.svg)
if [[ "${MEMBERS[*]}" != "${EXPECTED[*]}" ]]; then
  echo "Archive does not contain exactly the four TOS 7 files" >&2
  printf 'got: %s\n' "${MEMBERS[@]}" >&2
  exit 1
fi

(
  cd "$OUT"
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
)

printf 'Built %s for MOVVIZ %s using Docker image dj41ph4/movviz:%s\n' "$OUT/$ARCHIVE" "$VERSION" "$IMAGE_TAG"
