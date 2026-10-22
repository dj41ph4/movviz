#!/bin/sh
set -e

# TerraMaster TOS 7 starts the service with an explicit non-root user from
# docker-compose.yml. Do not perform UID/GID remapping or chown operations
# here: those require root and are intentionally handled only by the standard
# MOVVIZ Docker entrypoint outside the TerraMaster package.

if [ "$(id -u)" = "0" ]; then
  echo "ERROR: TerraMaster package must run MOVVIZ as a non-root user." >&2
  exit 1
fi

exec "$@"
