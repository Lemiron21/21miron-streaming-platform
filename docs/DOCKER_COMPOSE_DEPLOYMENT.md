# 21miron Video Platform — Docker Compose deployment

This is the supported production deployment for Ubuntu Server 26.04 LTS.

## Architecture

- `frontend` — React build served by Nginx on TCP/80;
- `backend` — FastAPI API on the internal Docker network;
- `postgres` — PostgreSQL 18 on the internal Docker network;
- `ovenmediaengine` — OME with host networking for RTMP and WebRTC;
- FreeIPA — a separate virtual machine and a later integration stage.

PostgreSQL and FastAPI are not exposed directly to the corporate network.

## Required host ports

The MikroTik firewall should permit only the networks that need these services:

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH administration |
| 80 | TCP | Web interface during the initial deployment |
| 443 | TCP | Web interface after TLS is configured |
| 1935 | TCP | RTMP ingest from OBS |
| 3333 | TCP | OvenMediaEngine WebRTC signaling and LL-HLS |
| 10000-10009 | UDP | WebRTC ICE media range; confirm against OME Server.xml |

Do not expose PostgreSQL port 5432 or FastAPI port 8000 through MikroTik.

## First deployment

```bash
cd /opt/21miron/repository
git pull --ff-only
cp .env.example .env
chmod 600 .env
nano .env
```

At minimum, change:

- `VIDEO_SERVER_IP`;
- `DB_PASSWORD`;
- `DEFAULT_ADMIN_PASSWORD`;
- every remaining `CHANGE_ME` value.

Generate passwords, for example:

```bash
openssl rand -base64 36
```

Make the operational scripts executable:

```bash
chmod +x scripts/compose-*.sh
```

Validate and start the stack:

```bash
./scripts/compose-install.sh
```

The first start downloads base images and builds the frontend and backend, so it can take several minutes.

## Verification

```bash
./scripts/compose-healthcheck.sh
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 ovenmediaengine
```

Open:

```text
http://VIDEO_SERVER_IP/
```

OBS test settings:

```text
Server: rtmp://VIDEO_SERVER_IP:1935/app
Stream key: test1
```

## Updating

```bash
cd /opt/21miron/repository
./scripts/compose-update.sh
```

The updater refuses to continue when local tracked files were modified. Host-specific values must remain only in `.env`.

## Database backup

```bash
./scripts/compose-backup-database.sh
```

Backups are written to:

```text
/opt/21miron/repository/backups/
```

Copy them to another server or backup storage. A backup stored only on the same SSD is not sufficient.

## Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f ovenmediaengine
```

## Stop and start

```bash
docker compose stop
docker compose start
```

Complete removal of containers without deleting named data volumes:

```bash
docker compose down
```

Never use `docker compose down -v` in production unless the PostgreSQL data volume is intentionally being destroyed and a verified backup exists.

## Current limitations

- FreeIPA variables are prepared, but LDAP authentication still has to be implemented and tested;
- stream discovery still uses the configured candidate list/range and will later move to OME API Manager;
- browser publishing and backend WebSocket events are later stages;
- OME recording remains disabled as a product requirement.
