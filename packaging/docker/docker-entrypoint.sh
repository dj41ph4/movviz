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

# Docker's group_add grants the initial process access to the render device,
# but su-exec rebuilds supplementary groups from /etc/group. Mirror the host
# render GID there before dropping privileges, without touching host devices.
if [ -n "${MOVVIZ_RENDER_GID:-}" ]; then
  case "$MOVVIZ_RENDER_GID" in
    *[!0-9]*|'') echo "[movviz] Ignoring invalid render device group: $MOVVIZ_RENDER_GID" >&2 ;;
    0) echo "[movviz] Refusing to join the root group for a render device." >&2 ;;
    *)
      render_group="$(awk -F: -v id="$MOVVIZ_RENDER_GID" '$3==id{print $1; exit}' /etc/group)"
      if [ -z "$render_group" ]; then
        if addgroup -g "$MOVVIZ_RENDER_GID" movviz-render; then
          render_group=movviz-render
        else
          echo "[movviz] Could not create render device group; hardware encoding may be unavailable." >&2
        fi
      fi
      if [ -n "$render_group" ] && [ "$render_group" != movviz ]; then
        addgroup movviz "$render_group" || echo "[movviz] Could not join render device group; hardware encoding may be unavailable." >&2
      fi
      ;;
  esac
fi

# Sur certains NAS (UGOS, ACL, partages réseau) le chown d'un dossier monté peut être refusé.
# Ce n'est pas fatal : si le dossier est déjà accessible en écriture, l'application démarre.
# Un échec ici faisait tomber tout le conteneur (set -e) sans autre message.
mkdir -p /config /data 2>/dev/null || true
for dir in /config /data; do
  chown movviz:movviz "$dir" 2>/dev/null || echo "[movviz] chown $dir refusé par le système de fichiers — poursuite du démarrage." >&2
done
# /config doit être inscriptible (état, base, jetons) : sinon rien ne peut fonctionner, autant le dire
# clairement dans les logs du conteneur. /data : simple avertissement, le dossier peut être préparé après coup.
su-exec movviz test -w /config || { echo "[movviz] ERREUR : /config n'est pas accessible en écriture pour uid=$PUID gid=$PGID. Choisir un PUID/PGID propriétaire du dossier de configuration." >&2; exit 1; }
su-exec movviz test -w /data || echo "[movviz] ATTENTION : /data n'est pas accessible en écriture pour uid=$PUID gid=$PGID — téléchargements et bibliothèque échoueront." >&2

# Specifying "movviz:movviz" makes su-exec discard supplementary groups.
# The account's primary group is already movviz; using its name also retains
# the render device group added above.
exec su-exec movviz "$@"
