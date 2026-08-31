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
# the requested ids has to be cleared first. ORDER MATTERS: a user must be
# deleted BEFORE its primary group, because busybox refuses to delete a group
# that is still an existing user's primary group ("group in use") — and the
# leftover name/gid then makes the following addgroup fail the same way,
# which, under `set -e`, aborts the entrypoint and leaves the container in a
# restart loop.

# 1) Free the requested UID: remove whatever user sits on it (never movviz
#    itself — that one is handled in step 3).
user_on_puid="$(awk -F: -v id="$PUID" '$3==id{print $1; exit}' /etc/passwd)"
if [ -n "$user_on_puid" ] && [ "$user_on_puid" != "movviz" ]; then
  deluser "$user_on_puid" 2>/dev/null || true
fi

# 2) Free the requested GID: remove whatever group sits on it. The group may
#    still be locked by its owner user (the user whose primary gid it is) —
#    remove that owner first, then the group.
group_on_pgid="$(awk -F: -v id="$PGID" '$3==id{print $1; exit}' /etc/group)"
if [ -n "$group_on_pgid" ] && [ "$group_on_pgid" != "movviz" ]; then
  group_owner="$(awk -F: -v g="$group_on_pgid" '$4==g{print $1; exit}' /etc/passwd)"
  if [ -n "$group_owner" ] && [ "$group_owner" != "movviz" ]; then
    deluser "$group_owner" 2>/dev/null || true
  fi
  delgroup "$group_on_pgid" 2>/dev/null || true
fi

# 3) The movviz user/group themselves: remove (user first, then group), then
#    recreate both with the requested ids whenever either id does not match.
if [ "$(id -u movviz 2>/dev/null)" != "$PUID" ] || [ "$(id -g movviz 2>/dev/null)" != "$PGID" ]; then
  deluser movviz 2>/dev/null || true
  delgroup movviz 2>/dev/null || true
fi
if ! id movviz >/dev/null 2>&1; then
  addgroup -g "$PGID" movviz
  adduser -D -H -G movviz -u "$PUID" movviz
fi

mkdir -p /config /data
chown movviz:movviz /config /data

exec su-exec movviz:movviz "$@"
