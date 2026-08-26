#!/usr/bin/env bash
#
# Movviz — installateur Linux (systemd).
#
# Détecte une installation existante et propose : mise à jour, réinstallation
# complète, ou désinstallation. Installe depuis le dépôt cloné localement
# (build depuis les sources — comportement historique) si le script est
# lancé depuis un checkout, sinon télécharge le bundle pré-construit de la
# dernière release GitHub (plus rapide, pas besoin de cloner le dépôt).
#
# Usage :
#     sudo ./packaging/linux/install.sh          (depuis un checkout du dépôt)
#     curl -fsSL <raw-url>/install.sh | sudo bash   (autonome)
#
set -euo pipefail

APP_USER="movviz"
APP_DIR="/opt/movviz"
DATA_DIR="/var/lib/movviz"
UNIT="/etc/systemd/system/movviz.service"
WEB_PORT="${MOVVIZ_WEB_PORT:-9810}"
REPO="dj41ph4/movviz"
VERSION_FILE="$APP_DIR/.movviz-version"

# --- Style --------------------------------------------------------------
if [[ -t 1 ]]; then
  P=$'\033[38;5;135m'; M=$'\033[38;5;213m'; C=$'\033[38;5;51m'
  G=$'\033[38;5;114m'; Y=$'\033[38;5;220m'; GR=$'\033[38;5;244m'
  R=$'\033[0m'; B=$'\033[1m'
else
  P=""; M=""; C=""; G=""; Y=""; GR=""; R=""; B=""
fi

ok()   { echo -e "${G}[✓]${R} $1"; }
info() { echo -e "${C}[i]${R} $1"; }
warn() { echo -e "${Y}[!]${R} $1"; }
step() { echo -e "${Y}[…]${R} $1"; }
die()  { echo -e "${Y}[✗]${R} $1" >&2; exit 1; }

banner() {
  echo -e "${P} __  __   ___   __     __  __     __  ___   _____${R}"
  echo -e "${P}|  \\/  | / _ \\  \\ \\   / /  \\ \\   / / |_ _| |__  /${R}"
  echo -e "${P}| |\\/| || | | |  \\ \\ / /    \\ \\ / /   | |    / / ${R}"
  echo -e "${P}| |  | || |_| |   \\ V /      \\ V /    | |   / /_ ${R}"
  echo -e "${P}|_|  |_| \\___/     \\_/        \\_/    |___| /____|${R}"
  echo -e "${GR}                    installateur Linux${R}"
  echo -e "${GR}                    v${1} · by ${M}${B}DJ41PH4${R}"
  echo
}

if [[ $EUID -ne 0 ]]; then
  die "Cet installateur doit être lancé en root (sudo)."
fi

# --- Version à installer --------------------------------------------------
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd || true)"
FROM_SOURCE=false
if [[ -n "$SRC_DIR" && -f "$SRC_DIR/package.json" ]]; then
  FROM_SOURCE=true
  TARGET_VERSION="$(node -pe "require('$SRC_DIR/package.json').version" 2>/dev/null || echo "?")"
else
  command -v curl >/dev/null 2>&1 || { echo "curl est requis." >&2; exit 1; }
  TARGET_VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -m1 '"tag_name"' | sed -E 's/.*"v?([0-9.]+)".*/\1/')"
  [[ -n "$TARGET_VERSION" ]] || die "Impossible de déterminer la dernière version (réseau ?)."
fi

banner "$TARGET_VERSION"

CURRENT_VERSION=""
if [[ -f "$VERSION_FILE" ]]; then
  CURRENT_VERSION="$(cat "$VERSION_FILE" 2>/dev/null || true)"
elif [[ -f "$APP_DIR/.next/standalone/package.json" ]]; then
  CURRENT_VERSION="$(node -pe "require('$APP_DIR/.next/standalone/package.json').version" 2>/dev/null || echo "")"
fi

# --- Menu -----------------------------------------------------------------
ACTION="install"
if [[ -n "$CURRENT_VERSION" ]]; then
  warn "Installation existante détectée : ${M}v${CURRENT_VERSION}${R}"
  info "Version disponible          : ${G}v${TARGET_VERSION}${R}"
  echo
  echo -e "  ${P}1)${R} Mettre à jour   ${GR}(conserve la bibliothèque et la config)${R}"
  echo -e "  ${P}2)${R} Réinstaller     ${GR}(efface tout, repart de zéro)${R}"
  echo -e "  ${P}3)${R} Désinstaller Movviz"
  echo -e "  ${P}4)${R} Annuler"
  echo
  read -rp "Ton choix [1-4] : " CHOICE
  case "$CHOICE" in
    1) ACTION="update" ;;
    2) ACTION="reinstall" ;;
    3) ACTION="uninstall" ;;
    *) echo "Annulé."; exit 0 ;;
  esac
else
  echo "Installer Movviz v${TARGET_VERSION} dans ${APP_DIR} ?"
  echo
  echo -e "  ${P}1)${R} Oui, installer"
  echo -e "  ${P}2)${R} Annuler"
  echo
  read -rp "Ton choix [1-2] : " CHOICE
  [[ "$CHOICE" == "1" ]] || { echo "Annulé."; exit 0; }
fi
echo

# --- Désinstallation --------------------------------------------------------
uninstall() {
  local wipe_data="$1"
  if systemctl is-active --quiet movviz.service 2>/dev/null; then
    step "Arrêt du service"
    systemctl stop movviz.service
  fi
  systemctl disable movviz.service >/dev/null 2>&1 || true
  rm -f "$UNIT"
  systemctl daemon-reload
  step "Suppression de ${APP_DIR}"
  rm -rf "$APP_DIR"
  if [[ "$wipe_data" == "yes" ]]; then
    step "Suppression de ${DATA_DIR}"
    rm -rf "$DATA_DIR"
  else
    ok "Bibliothèque conservée dans ${DATA_DIR}"
  fi
  id -u "$APP_USER" >/dev/null 2>&1 && userdel "$APP_USER" >/dev/null 2>&1 || true
  echo
  echo -e "${G}${B}Movviz désinstallé.${R} Merci d'avoir utilisé Movviz !"
}

if [[ "$ACTION" == "uninstall" ]]; then
  echo "Cette action va supprimer Movviz. La bibliothèque"
  echo "(${DATA_DIR}) peut être conservée ou effacée."
  echo
  echo -e "  ${P}1)${R} Désinstaller, garder la bibliothèque"
  echo -e "  ${P}2)${R} Désinstaller, tout effacer"
  echo -e "  ${P}3)${R} Annuler"
  echo
  read -rp "Ton choix [1-3] : " CHOICE
  case "$CHOICE" in
    1) uninstall "no" ;;
    2)
      read -rp "Confirme : taper OUI en majuscules pour tout effacer définitivement : " CONFIRM
      [[ "$CONFIRM" == "OUI" ]] || { echo "Annulé."; exit 0; }
      uninstall "yes"
      ;;
    *) echo "Annulé."; exit 0 ;;
  esac
  exit 0
fi

if [[ "$ACTION" == "reinstall" ]]; then
  read -rp "Confirme : taper OUI en majuscules pour tout effacer et repartir de zéro : " CONFIRM
  [[ "$CONFIRM" == "OUI" ]] || { echo "Annulé."; exit 0; }
  uninstall "yes"
  echo
fi

# --- Dépendances système ----------------------------------------------------
if [[ "$FROM_SOURCE" == true ]]; then
  command -v node >/dev/null 2>&1 || die "Node.js est requis mais introuvable."
  command -v npm  >/dev/null 2>&1 || die "npm est requis mais introuvable."
else
  command -v node >/dev/null 2>&1 || die "Node.js est requis mais introuvable (installe-le d'abord, ex. via NodeSource)."
fi

if ! command -v aria2c >/dev/null 2>&1; then
  step "Installation d'aria2 (moteur de téléchargement haute performance)"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y aria2 >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y aria2 >/dev/null 2>&1 || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache aria2 >/dev/null 2>&1 || true
  fi
fi

# --- Arrêt de l'ancienne instance avant de toucher ses fichiers ------------
if systemctl is-active --quiet movviz.service 2>/dev/null; then
  step "Arrêt du service existant"
  systemctl stop movviz.service
fi

# --- Récupération du bundle -------------------------------------------------
mkdir -p "$APP_DIR/.next/standalone"

if [[ "$FROM_SOURCE" == true ]]; then
  echo "Movviz — installation depuis ${SRC_DIR}"
  step "Installation des dépendances"
  ( cd "$SRC_DIR" && npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent )
  step "Compilation du bundle de production"
  ( cd "$SRC_DIR" && npm run build --silent )
  step "Installation du moteur de téléchargement"
  ( cd "$SRC_DIR/engine" && ( npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund --silent ) )

  cp -r "$SRC_DIR/.next/standalone/." "$APP_DIR/.next/standalone/"
  cp -r "$SRC_DIR/.next/static" "$APP_DIR/.next/standalone/.next/static"
  [[ -d "$SRC_DIR/public" ]] && cp -r "$SRC_DIR/public" "$APP_DIR/.next/standalone/public"
  cp -r "$SRC_DIR/engine" "$APP_DIR/.next/standalone/engine"
else
  step "Téléchargement du bundle v${TARGET_VERSION}"
  TMP_TARBALL="$(mktemp -d)/movviz.tar.gz"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/v${TARGET_VERSION}/movviz-linux-x64.tar.gz"
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_TARBALL" || die "Téléchargement échoué (${DOWNLOAD_URL})."
  step "Extraction"
  tar -xzf "$TMP_TARBALL" -C "$(dirname "$TMP_TARBALL")"
  rm -rf "$APP_DIR/.next/standalone"
  mkdir -p "$APP_DIR/.next"
  mv "$(dirname "$TMP_TARBALL")/movviz" "$APP_DIR/.next/standalone"
fi

echo "$TARGET_VERSION" > "$VERSION_FILE"

# --- Utilisateur système + répertoire de données ----------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  step "Création de l'utilisateur système ${APP_USER}"
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

# --- Service systemd ---------------------------------------------------------
step "Installation du service systemd"
if [[ "$FROM_SOURCE" == true ]]; then
  cp "$SRC_DIR/packaging/linux/movviz.service" "$UNIT"
else
  cp "$APP_DIR/.next/standalone/packaging/linux/movviz.service" "$UNIT" 2>/dev/null || curl -fsSL "https://raw.githubusercontent.com/$REPO/v${TARGET_VERSION}/packaging/linux/movviz.service" -o "$UNIT"
fi
systemctl daemon-reload
systemctl enable movviz.service >/dev/null 2>&1
systemctl restart movviz.service

echo
if [[ "$ACTION" == "update" ]]; then
  ok "Bibliothèque et configuration conservées"
  echo -e "${G}${B}Movviz mis à jour vers v${TARGET_VERSION}.${R}"
else
  echo -e "${G}${B}Movviz v${TARGET_VERSION} installé et démarré.${R}"
fi
echo "  Interface : http://localhost:${WEB_PORT}"
echo "  Logs      : journalctl -u movviz -f"
echo "  Statut    : systemctl status movviz"
echo "  Relancer  : sudo ./packaging/linux/install.sh"
