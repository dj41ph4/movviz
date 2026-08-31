#!/usr/bin/env bash
#
# Movviz — installateur Linux (systemd).
#
# Détecte une installation existante et propose : mise à jour, réinstallation
# complète, ou désinstallation. Installe depuis le dépôt cloné localement
# (build depuis les sources — comportement historique) si le script est
# lancé depuis un checkout, installe directement le bundle pré-construit si
# le script vient du .tar.gz, sinon télécharge la dernière release GitHub.
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

safe_remove_tree() {
  local target="$1"
  local expected="$2"
  local resolved
  resolved="$(readlink -m -- "$target")"
  [[ "$resolved" == "$expected" ]] || die "Suppression refusée : chemin inattendu (${resolved})."
  [[ "$resolved" != "/" ]] || die "Suppression refusée : chemin racine."
  rm -rf -- "$resolved"
}

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
FROM_BUNDLE=false
if [[ -n "$SRC_DIR" && -f "$SRC_DIR/server.js" && -d "$SRC_DIR/.next" && -f "$SRC_DIR/package.json" ]]; then
  if [[ "$(readlink -m -- "$SRC_DIR")" == "$(readlink -m -- "$APP_DIR/.next/standalone")" ]]; then
    command -v curl >/dev/null 2>&1 || die "curl est requis pour rechercher la mise à jour."
    TARGET_VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -m1 '"tag_name"' | sed -E 's/.*"v?([0-9.]+)".*/\1/')"
    [[ -n "$TARGET_VERSION" ]] || die "Impossible de déterminer la dernière version (réseau ?)."
  else
    FROM_BUNDLE=true
    TARGET_VERSION="$(node -pe "require('$SRC_DIR/package.json').version" 2>/dev/null || echo "?")"
  fi
elif [[ -n "$SRC_DIR" && -f "$SRC_DIR/package.json" && -d "$SRC_DIR/src" && -f "$SRC_DIR/next.config.ts" ]]; then
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
  safe_remove_tree "$APP_DIR" "/opt/movviz"
  if [[ "$wipe_data" == "yes" ]]; then
    step "Suppression de ${DATA_DIR}"
    safe_remove_tree "$DATA_DIR" "/var/lib/movviz"
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
command -v node >/dev/null 2>&1 || die "Node.js 22 ou plus récent est requis mais introuvable."
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ && "$NODE_MAJOR" -ge 22 ]] || die "Node.js 22 ou plus récent est requis (version détectée : $(node --version 2>/dev/null || echo inconnue))."
if [[ "$FROM_SOURCE" == true ]]; then
  command -v npm  >/dev/null 2>&1 || die "npm est requis mais introuvable."
fi

install_media_dependencies() {
  local packages=()
  command -v aria2c >/dev/null 2>&1 || packages+=(aria2)
  command -v ffmpeg >/dev/null 2>&1 || packages+=(ffmpeg)
  [[ ${#packages[@]} -gt 0 ]] || return 0

  step "Installation des dépendances média : ${packages[*]}"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y "${packages[@]}" >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "${packages[@]}" >/dev/null 2>&1 || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache "${packages[@]}" >/dev/null 2>&1 || true
  fi

  command -v aria2c >/dev/null 2>&1 || warn "aria2 reste introuvable : le moteur utilisera ses solutions de repli."
  command -v ffmpeg >/dev/null 2>&1 || warn "FFmpeg reste introuvable : le remux et le transcodage locaux seront indisponibles."
}
install_media_dependencies

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
elif [[ "$FROM_BUNDLE" == true ]]; then
  echo "Movviz — installation depuis le bundle Linux v${TARGET_VERSION}"
  step "Copie du bundle pré-construit"
  safe_remove_tree "$APP_DIR/.next/standalone" "/opt/movviz/.next/standalone"
  mkdir -p "$APP_DIR/.next/standalone"
  cp -a "$SRC_DIR/." "$APP_DIR/.next/standalone/"
else
  step "Téléchargement du bundle v${TARGET_VERSION}"
  TMP_TARBALL="$(mktemp -d)/movviz.tar.gz"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/v${TARGET_VERSION}/movviz-linux-x64.tar.gz"
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_TARBALL" || die "Téléchargement échoué (${DOWNLOAD_URL})."
  step "Extraction"
  tar -xzf "$TMP_TARBALL" -C "$(dirname "$TMP_TARBALL")"
  safe_remove_tree "$APP_DIR/.next/standalone" "/opt/movviz/.next/standalone"
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
elif [[ "$FROM_BUNDLE" == true ]]; then
  cp "$APP_DIR/.next/standalone/packaging/linux/movviz.service" "$UNIT"
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
