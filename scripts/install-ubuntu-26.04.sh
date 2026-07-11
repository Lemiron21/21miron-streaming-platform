#!/usr/bin/env bash
set -Eeuo pipefail

APP_USER="video-platform"
APP_GROUP="video-platform"
APP_DIR="/opt/video-platform"
ENV_DIR="/etc/21miron"
ENV_FILE="${ENV_DIR}/video-platform.env"
SERVICE_FILE="/etc/systemd/system/video-platform.service"
NGINX_SITE="/etc/nginx/sites-available/video-platform"

log() { printf '\n[21miron] %s\n' "$*"; }
fail() { printf '\n[21miron] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root: sudo bash scripts/install-ubuntu-26.04.sh"

source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "Ubuntu is required"
[[ "${VERSION_ID:-}" == "26.04" ]] || fail "This installer targets Ubuntu Server 26.04 LTS; detected ${VERSION_ID:-unknown}"

log "Updating packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg git \
  python3 python3-venv python3-pip \
  nodejs npm \
  nginx postgresql postgresql-contrib \
  ffmpeg jq openssl \
  qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine from the official repository"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "${UBUNTU_CODENAME:-resolute}" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

log "Creating service account and directories"
getent group "$APP_GROUP" >/dev/null || groupadd --system "$APP_GROUP"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --gid "$APP_GROUP" --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$ENV_DIR" /var/backups/21miron
chmod 750 "$ENV_DIR" /var/backups/21miron

[[ -d "$APP_DIR/.git" ]] || fail "Repository must be cloned to ${APP_DIR} before running this installer"
chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"

log "Creating Python virtual environment"
if [[ ! -x "$APP_DIR/venv/bin/python" ]]; then
  sudo -u "$APP_USER" python3 -m venv "$APP_DIR/venv"
fi
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --upgrade pip wheel
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

log "Building frontend"
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm install
sudo -u "$APP_USER" npm run build

if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating environment file template"
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  chown root:root "$ENV_FILE"
fi

log "Installing systemd and Nginx configuration"
cp "$APP_DIR/deploy/video-platform.service" "$SERVICE_FILE"
cp "$APP_DIR/deploy/nginx-video-platform.conf" "$NGINX_SITE"
ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/video-platform
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl daemon-reload
systemctl enable nginx postgresql docker libvirtd video-platform.service

log "Installation files are ready"
printf '\nNext steps:\n'
printf '1. Edit %s\n' "$ENV_FILE"
printf '2. Create PostgreSQL user and database according to docs/INSTALL_UBUNTU_26_04.md\n'
printf '3. Deploy OvenMediaEngine\n'
printf '4. Run: sudo systemctl start video-platform.service\n'
printf '5. Run: sudo bash %s/scripts/healthcheck.sh\n' "$APP_DIR"
