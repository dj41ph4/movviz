#!/usr/bin/env bash
#
# Movviz — Linux installer (systemd).
#
# Builds Movviz, installs it under /opt/movviz, creates a dedicated system user,
# and registers a systemd service that starts at boot and restarts on failure.
#
# Usage (from the project root):
#     sudo ./packaging/linux/install.sh
#
set -euo pipefail

APP_USER="movviz"
APP_DIR="/opt/movviz"
DATA_DIR="/var/lib/movviz"
UNIT="/etc/systemd/system/movviz.service"
WEB_PORT="${MOVVIZ_WEB_PORT:-9810}"

if [[ $EUID -ne 0 ]]; then
  echo "This installer must be run as root (use sudo)." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "Node.js is required but not found." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm is required but not found." >&2; exit 1; }

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "Movviz — installing from ${SRC_DIR}"

# --- Build ------------------------------------------------------------------
echo "Installing dependencies…"
( cd "$SRC_DIR" && npm ci --no-audit --no-fund || npm install --no-audit --no-fund )
echo "Building production bundle…"
( cd "$SRC_DIR" && npm run build )
echo "Installing download engine dependencies…"
( cd "$SRC_DIR/engine" && ( npm ci --no-audit --no-fund || npm install --no-audit --no-fund ) )

# --- Stop any previous install before touching its files -------------------
# Avoids a brief window where the old server.js and a newly-copied engine/
# are mismatched, and matches the Windows installer's update behavior.
if systemctl is-active --quiet movviz.service 2>/dev/null; then
  echo "Stopping existing Movviz service…"
  systemctl stop movviz.service
fi

# --- Deploy to /opt/movviz --------------------------------------------------
echo "Deploying to ${APP_DIR}…"
mkdir -p "$APP_DIR/.next/standalone"
cp -r "$SRC_DIR/.next/standalone/." "$APP_DIR/.next/standalone/"
cp -r "$SRC_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
[[ -d "$SRC_DIR/public" ]] && cp -r "$SRC_DIR/public" "$APP_DIR/.next/standalone/public"
# Download engine, next to server.js so the web server spawns it on boot.
cp -r "$SRC_DIR/engine" "$APP_DIR/.next/standalone/engine"

# --- System user + data dir -------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  echo "Creating system user ${APP_USER}…"
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

# --- systemd unit -----------------------------------------------------------
echo "Installing systemd unit…"
cp "$SRC_DIR/packaging/linux/movviz.service" "$UNIT"
systemctl daemon-reload
systemctl enable movviz.service
systemctl restart movviz.service

echo
echo "Movviz installed and running."
echo "  Interface : http://localhost:${WEB_PORT}"
echo "  Logs      : journalctl -u movviz -f"
echo "  Status    : systemctl status movviz"
echo "  Remove    : sudo ./packaging/linux/uninstall.sh"
