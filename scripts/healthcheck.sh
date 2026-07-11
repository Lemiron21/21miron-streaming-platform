#!/usr/bin/env bash
set -u

ENV_FILE="/etc/21miron/video-platform.env"
FAILED=0

ok() { printf '[ OK ] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
fail() { printf '[FAIL] %s\n' "$*"; FAILED=1; }

[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a
SERVER_IP="${VIDEO_SERVER_IP:-127.0.0.1}"

check_service() {
  local service="$1"
  if systemctl is-active --quiet "$service"; then ok "$service is active"; else fail "$service is not active"; fi
}

check_port() {
  local proto="$1" port="$2" label="$3"
  if [[ "$proto" == "tcp" ]] && ss -lnt | awk '{print $4}' | grep -Eq "(^|:)$port$"; then
    ok "$label listens on TCP $port"
  elif [[ "$proto" == "udp" ]] && ss -lnu | awk '{print $5}' | grep -Eq "(^|:)$port$"; then
    ok "$label listens on UDP $port"
  else
    warn "$label is not visible on $proto/$port"
  fi
}

printf '21miron Video Platform health check\n\n'
check_service postgresql.service
check_service nginx.service
check_service docker.service
check_service video-platform.service

if systemctl is-active --quiet libvirtd.service; then ok "libvirtd is active"; else warn "libvirtd is not active yet"; fi

if curl -fsS http://127.0.0.1:8000/streams >/dev/null; then ok "FastAPI /streams"; else fail "FastAPI /streams unavailable"; fi
if curl -fsS http://127.0.0.1:8000/system/metrics >/dev/null; then ok "FastAPI /system/metrics"; else fail "FastAPI /system/metrics unavailable"; fi
if curl -fsS "http://${SERVER_IP}/api/streams" >/dev/null; then ok "Nginx /api/streams"; else warn "Nginx API unavailable through ${SERVER_IP}"; fi

if docker ps --format '{{.Names}}' | grep -qx ovenmediaengine; then
  ok "OvenMediaEngine container is running"
else
  warn "OvenMediaEngine container named ovenmediaengine is not running"
fi

check_port tcp 80 "Nginx"
check_port tcp 8000 "FastAPI"
check_port tcp 1935 "RTMP ingest"
check_port tcp 3333 "OME signaling"
check_port udp 10000 "OME ICE"

printf '\nDisk: '
df -h / | awk 'NR==2 {print $3 " used of " $2 " (" $5 ")"}'
printf 'Memory: '
free -h | awk '/Mem:/ {print $3 " used of " $2}'
printf 'Load: '
cat /proc/loadavg

exit "$FAILED"
