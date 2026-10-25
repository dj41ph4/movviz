#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if [ -c /dev/dri/renderD128 ]; then
  render_gid=$(stat -c '%g' /dev/dri/renderD128 2>/dev/null || true)
  case "$render_gid" in
    ''|*[!0-9]*) echo "[movviz] GPU present, but render group detection failed; using the CPU-safe compose." >&2 ;;
    0) echo "[movviz] GPU render device belongs to root; refusing to add the app to the root group." >&2 ;;
    *)
      export MOVVIZ_RENDER_GID="$render_gid"
      echo "[movviz] GPU render device detected (group $render_gid); enabling /dev/dri."
      exec docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d "$@"
      ;;
  esac
fi

echo "[movviz] No usable /dev/dri/renderD128; using the CPU-safe compose."
exec docker compose -f docker-compose.yml up -d "$@"
