#!/bin/sh
set -e

# Recreate the movviz user/group to match the PUID/PGID the NAS admin set —
# without this, the container always writes as the image's baked-in uid
# (1001), which almost never matches whatever user actually owns the bind-
# mounted NAS folders (Plex library, existing qBittorrent downloads, etc.),
# so every write fails with EACCES. PUID/PGID were already declared in
# docker-compose.yml but never actually consumed anywhere — this is what
# wires them up.
PUID="${PUID:-1001}"
PGID="${PGID:-1001}"

# The node:alpine base image ships its own "node" user at uid/gid 1000 —
# exactly the most common PUID/PGID on a NAS — so whatever already sits on
# the requested ids has to be cleared first, or adduser/addgroup below just
# fails with "already exists".
existing_group="$(awk -F: -v id="$PGID" '$3==id{print $1; exit}' /etc/group)"
if [ -n "$existing_group" ] && [ "$existing_group" != "movviz" ]; then
  delgroup "$existing_group" 2>/dev/null || true
fi
existing_user="$(awk -F: -v id="$PUID" '$3==id{print $1; exit}' /etc/passwd)"
if [ -n "$existing_user" ] && [ "$existing_user" != "movviz" ]; then
  deluser "$existing_user" 2>/dev/null || true
fi

if [ "$(id -g movviz 2>/dev/null)" != "$PGID" ]; then
  delgroup movviz 2>/dev/null || true
  addgroup -g "$PGID" movviz
fi
if [ "$(id -u movviz 2>/dev/null)" != "$PUID" ]; then
  deluser movviz 2>/dev/null || true
  adduser -D -H -G movviz -u "$PUID" movviz
fi

mkdir -p /config /data
chown movviz:movviz /config /data

exec su-exec movviz:movviz "$@"
