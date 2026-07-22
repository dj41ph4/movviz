#!/usr/bin/env bash
#
# Movviz — Linux uninstaller. Stops and removes the service and app files.
# Data under /var/lib/movviz is preserved unless --purge is passed.
#
#     sudo ./packaging/linux/uninstall.sh [--purge]
#
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "This uninstaller must be run as root (use sudo)." >&2
  exit 1
fi

echo "Stopping and removing the Movviz service…"
systemctl disable --now movviz.service 2>/dev/null || true
rm -f /etc/systemd/system/movviz.service
systemctl daemon-reload

echo "Removing application files…"
rm -rf /opt/movviz

if [[ "${1:-}" == "--purge" ]]; then
  echo "Purging data directory…"
  rm -rf /var/lib/movviz
  userdel movviz 2>/dev/null || true
else
  echo "Data preserved at /var/lib/movviz (use --purge to remove)."
fi

echo "Movviz uninstalled."
