# 21miron — развертывание на физическом сервере

## Важное состояние проекта

Последние изменения интерфейса уже находятся в GitHub, но на старом VPS они не применялись. Новый физический сервер должен устанавливаться напрямую из текущей ветки `main`.

Архитектура:

- Nginx — frontend и reverse proxy;
- React/Vite — интерфейс;
- FastAPI/Uvicorn — backend API;
- PostgreSQL — данные;
- OvenMediaEngine — RTMP ingest и WebRTC playback;
- FreeIPA — будущая авторизация и группы `video-admins`, `video-operator`, `video-viewer`.

## Безопасная схема миграции

Старый сервер MediaMTX не отключать и не изменять до полного приемочного теста нового сервера.

Рекомендуемая схема:

1. Старый сервер продолжает принимать рабочие трансляции.
2. Новый сервер получает отдельный IP-адрес.
3. OBS-тесты отправляются только на новый IP и отдельные тестовые ключи.
4. Проверяются frontend, API, OME, WebRTC, нагрузка, права и сеть.
5. После приемки источники переводятся на новый сервер поэтапно.
6. Старый MediaMTX остается доступным как временный rollback.

## Установка приложения

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip nodejs npm nginx postgresql postgresql-contrib

sudo useradd --system --home /opt/video-platform --shell /usr/sbin/nologin video-platform || true
sudo git clone https://github.com/Lemiron21/21miron-streaming-platform /opt/video-platform
sudo chown -R video-platform:video-platform /opt/video-platform

cd /opt/video-platform
sudo -u video-platform python3 -m venv venv
sudo -u video-platform ./venv/bin/pip install --upgrade pip
sudo -u video-platform ./venv/bin/pip install -r requirements.txt

cd /opt/video-platform/frontend
sudo -u video-platform npm install
sudo -u video-platform npm run build
```

## Переменные окружения

```bash
sudo mkdir -p /etc/21miron
sudo cp /opt/video-platform/.env.example /etc/21miron/video-platform.env
sudo chmod 600 /etc/21miron/video-platform.env
sudo nano /etc/21miron/video-platform.env
```

Обязательно изменить:

- `DB_PASSWORD`;
- `VIDEO_SERVER_IP`;
- `DEFAULT_ADMIN_PASSWORD`.

Секреты не должны храниться в GitHub.

## PostgreSQL

Пример первичной подготовки:

```bash
sudo -u postgres psql
```

```sql
CREATE USER video_user WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE video_platform OWNER video_user;
\q
```

Пароль должен совпадать с `DB_PASSWORD` в `/etc/21miron/video-platform.env`.

## Systemd

```bash
sudo cp /opt/video-platform/deploy/video-platform.service /etc/systemd/system/video-platform.service
sudo systemctl daemon-reload
sudo systemctl enable --now video-platform.service
sudo systemctl status video-platform.service --no-pager
```

## Nginx

Перед включением проверить, нет ли другого сервиса на портах 80/443.

```bash
sudo cp /opt/video-platform/deploy/nginx-video-platform.conf /etc/nginx/sites-available/video-platform
sudo ln -s /etc/nginx/sites-available/video-platform /etc/nginx/sites-enabled/video-platform
sudo nginx -t
sudo systemctl reload nginx
```

## OvenMediaEngine

OME должен быть развернут отдельно и проверен до запуска frontend.

Необходимые сетевые порты в текущей схеме:

- `1935/tcp` — RTMP ingest;
- `3333/tcp` — WebRTC signaling;
- UDP-диапазон OME, заданный в его конфигурации;
- `80/tcp` и позднее `443/tcp` — веб-интерфейс.

OME и старый MediaMTX не могут одновременно слушать один и тот же IP и один и тот же порт `1935/tcp`. Для параллельной работы нужны разные IP-адреса либо разные host-порты.

## Проверки

```bash
curl http://127.0.0.1:8000/streams
curl http://SERVER_IP/api/streams
sudo systemctl status video-platform.service --no-pager
sudo nginx -t
sudo ss -lntup | grep -E ':(80|1935|3333|8000)\b'
```

OBS для нового сервера:

```text
Server: rtmp://NEW_SERVER_IP:1935/app
Stream key: test1
```

## Обновление после установки

```bash
cd /opt/video-platform
sudo -u video-platform git pull

cd frontend
sudo -u video-platform npm install
sudo -u video-platform npm run build

sudo systemctl restart video-platform.service
sudo systemctl reload nginx
```

## Откат

До окончательного запуска сохранить:

- старый IP MediaMTX;
- старые OBS-профили;
- конфигурации Nginx и MediaMTX;
- список рабочих ключей потоков;
- резервную копию PostgreSQL;
- возможность быстро вернуть источники на старый RTMP URL.
