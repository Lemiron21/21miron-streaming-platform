# 21miron — развёртывание на физическом сервере

Полная настройка параметров описана в [`CONFIGURATION.md`](CONFIGURATION.md). Целевая схема — в [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 1. Рекомендуемая ОС

```text
Ubuntu Server 24.04 LTS
Minimal installation
Без GUI
Статический LAN IP
```

Сервер администрируется с отдельного доверенного ПК. Сетевую фильтрацию между подсетями и проброс портов выполняет MikroTik.

## 2. Схема миграции

Старый MediaMTX не отключать до приёмки нового сервера.

1. Новый сервер получает отдельный IP.
2. OME и 21miron разворачиваются независимо от старого сервера.
3. OBS-тесты используют новый IP и тестовые ключи.
4. Проверяются WebRTC, LL-HLS, нагрузка, права и сеть.
5. Рабочие источники переводятся по одному.
6. Старый сервер остаётся rollback-вариантом.

## 3. Установка пакетов

```bash
sudo apt update
sudo apt install -y \
  git python3-venv python3-pip \
  nodejs npm \
  nginx \
  postgresql postgresql-contrib postgresql-client \
  docker.io docker-compose-v2 \
  ffmpeg curl jq openssl

sudo systemctl enable --now nginx postgresql docker
```

## 4. Системный пользователь и код

```bash
sudo useradd --system \
  --home /opt/video-platform \
  --shell /usr/sbin/nologin \
  video-platform || true

sudo git clone \
  https://github.com/Lemiron21/21miron-streaming-platform \
  /opt/video-platform

sudo chown -R video-platform:video-platform /opt/video-platform
```

## 5. Центральный несекретный конфиг

Файл:

```text
/opt/video-platform/frontend/src/config/platform.json
```

Перед сборкой изменить:

- `server.publicHost`;
- порты при необходимости;
- названия отделов;
- привязки потоков к отделам;
- OME application и ICE-диапазон.

```bash
sudo -u video-platform nano /opt/video-platform/frontend/src/config/platform.json
```

Проверка JSON:

```bash
jq . /opt/video-platform/frontend/src/config/platform.json
```

## 6. Секреты

```bash
sudo mkdir -p /etc/21miron
sudo cp /opt/video-platform/.env.example /etc/21miron/video-platform.env
sudo chown root:video-platform /etc/21miron/video-platform.env
sudo chmod 640 /etc/21miron/video-platform.env
sudo nano /etc/21miron/video-platform.env
```

Обязательно изменить:

```text
DB_PASSWORD
DEFAULT_ADMIN_PASSWORD
FREEIPA_BIND_PASSWORD
SESSION_SECRET
```

Реальный файл не хранить в GitHub.

## 7. PostgreSQL

Сгенерировать пароль:

```bash
openssl rand -base64 48
```

Создать пользователя и базу:

```bash
sudo -u postgres psql
```

```sql
CREATE USER video_user WITH PASSWORD 'ВСТАВИТЬ_СЛОЖНЫЙ_ПАРОЛЬ';
CREATE DATABASE video_platform OWNER video_user;
GRANT ALL PRIVILEGES ON DATABASE video_platform TO video_user;
\q
```

Этот же пароль указать как `DB_PASSWORD`.

Проверка:

```bash
PGPASSWORD='ПАРОЛЬ' psql \
  -h 127.0.0.1 \
  -U video_user \
  -d video_platform \
  -c 'SELECT current_database(), current_user;'
```

PostgreSQL не публиковать через MikroTik. Он должен быть доступен приложению локально.

## 8. Python backend

```bash
cd /opt/video-platform
sudo -u video-platform python3 -m venv venv
sudo -u video-platform ./venv/bin/pip install --upgrade pip
sudo -u video-platform ./venv/bin/pip install -r requirements.txt
```

## 9. Frontend

```bash
cd /opt/video-platform/frontend
sudo -u video-platform npm install
sudo -u video-platform npm run build
```

## 10. Systemd

```bash
sudo cp \
  /opt/video-platform/deploy/video-platform.service \
  /etc/systemd/system/video-platform.service

sudo systemctl daemon-reload
sudo systemctl enable --now video-platform.service
sudo systemctl status video-platform.service --no-pager
```

Проверки backend:

```bash
curl http://127.0.0.1:8000/config
curl http://127.0.0.1:8000/streams
curl http://127.0.0.1:8000/system/metrics
```

## 11. Nginx

```bash
sudo cp \
  /opt/video-platform/deploy/nginx-video-platform.conf \
  /etc/nginx/sites-available/video-platform

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn \
  /etc/nginx/sites-available/video-platform \
  /etc/nginx/sites-enabled/video-platform

sudo nginx -t
sudo systemctl reload nginx
```

## 12. OvenMediaEngine

OME работает в Docker. Перед переносом боевой конфигурации сохранить проверенный `Server.xml` отдельно.

Основные порты:

```text
1935/tcp          RTMP ingest
3333/tcp          WebRTC signaling / LL-HLS
3478/tcp          WebRTC TCP relay
10000-10004/udp   WebRTC ICE media
```

OBS:

```text
Server: rtmp://SERVER_IP:1935/app
Stream key: test1
```

Запись потоков/DVR не включать.

## 13. MikroTik

Разрешить только необходимые направления:

- веб-доступ к `80/tcp` или `443/tcp`;
- RTMP `1935/tcp` от разрешённых операторских/VPN-сетей;
- WebRTC `3333/tcp`, `3478/tcp`, `10000-10004/udp` от зрителей;
- SSH `22/tcp` только с административного ПК или административной VLAN/VPN.

Не пробрасывать наружу:

```text
5432/tcp PostgreSQL
8000/tcp FastAPI/Uvicorn
```

## 14. FreeIPA VM

FreeIPA разворачивается в отдельной VM на том же физическом сервере.

После установки:

1. создать группы `video-admins`, `video-operator`, `video-viewer`;
2. создать сервисный LDAP-аккаунт для видеоплатформы;
3. скопировать CA-сертификат FreeIPA на хост;
4. заполнить `FREEIPA_*` в `/etc/21miron/video-platform.env`;
5. проверить LDAPS с хоста;
6. только после успешного теста включать LDAP-вход.

## 15. Резервное копирование

```bash
sudo chmod +x /opt/video-platform/scripts/*.sh
sudo /opt/video-platform/scripts/backup-database.sh
```

Рекомендуется запускать через systemd timer или cron и копировать резервные копии на отдельный носитель/VPS.

## 16. Обновление

```bash
cd /opt/video-platform
sudo -u video-platform git pull
sudo -u video-platform ./venv/bin/pip install -r requirements.txt

cd frontend
sudo -u video-platform npm install
sudo -u video-platform npm run build

sudo systemctl restart video-platform.service
sudo systemctl reload nginx.service
```

## 17. Финальная проверка

```bash
jq . /opt/video-platform/frontend/src/config/platform.json
sudo systemctl status video-platform.service --no-pager
sudo nginx -t
curl http://127.0.0.1:8000/config
curl http://127.0.0.1:8000/streams
curl http://127.0.0.1:8000/system/metrics
curl http://SERVER_IP/api/streams
sudo ss -lntup | grep -E ':(22|80|1935|3333|3478|5432|8000)\b'
```

## 18. Что ещё требует отдельного этапа

Перед промышленным вводом необходимо окончательно реализовать и протестировать:

- LDAP/FreeIPA-аутентификацию;
- серверный WebSocket вместо polling `/streams`;
- обнаружение потоков через OME API вместо перебора диапазона;
- браузерную публикацию потока без OBS;
- резервный LL-HLS playback при проблемах WebRTC;
- журнал действий пользователей.
