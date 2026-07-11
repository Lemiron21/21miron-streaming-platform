# 21miron — справочник конфигурации

Этот документ описывает, где находятся настройки, что разрешено менять и какие файлы нельзя публиковать.

## 1. Главный файл настроек платформы

Путь в репозитории и на установленном сервере:

```text
/opt/video-platform/frontend/src/config/platform.json
```

Это **единый файл несекретных настроек**. В нём изменяются:

- IP-адрес или DNS-имя видеосервера;
- порты RTMP и WebRTC;
- имя приложения OvenMediaEngine;
- диапазон автоматического поиска потоков;
- названия отделов;
- добавление новых отделов;
- привязка ключей потоков к отделам;
- названия групп FreeIPA.

После изменения файла необходимо пересобрать frontend и перезапустить backend:

```bash
cd /opt/video-platform/frontend
npm run build
sudo systemctl restart video-platform.service
sudo systemctl reload nginx.service
```

### Изменение IP-адреса

Открыть:

```bash
sudo nano /opt/video-platform/frontend/src/config/platform.json
```

Изменить:

```json
"server": {
  "publicHost": "192.168.1.50"
}
```

Можно указать DNS-имя, например:

```json
"publicHost": "video.example.local"
```

При использовании HTTPS/WebSocket Secure также изменить:

```json
"webScheme": "https",
"webrtcScheme": "wss"
```

### Переименование отдела

Найти раздел `departments`:

```json
{
  "id": "department-1",
  "name": "Отдел 1"
}
```

Изменить только `name`. Поле `id` лучше не менять после запуска системы.

### Добавление нового отдела

Добавить новый объект в массив `departments`:

```json
{
  "id": "department-4",
  "name": "Новый отдел"
}
```

Запятая между объектами обязательна.

### Привязка потока к отделу

Раздел `streamAssignments`:

```json
"streamAssignments": {
  "test1": "department-1",
  "test2": "department-1",
  "drone-01": "department-4"
}
```

Слева указывается ключ потока OBS или браузерного источника, справа — `id` отдела.

Потоки без явной привязки попадают в отдел из:

```json
"defaults": {
  "departmentId": "department-1"
}
```

## 2. Пароли и секреты

Боевой файл:

```text
/etc/21miron/video-platform.env
```

Он создаётся из шаблона:

```text
/opt/video-platform/.env.example
```

Команды:

```bash
sudo mkdir -p /etc/21miron
sudo cp /opt/video-platform/.env.example /etc/21miron/video-platform.env
sudo chown root:video-platform /etc/21miron/video-platform.env
sudo chmod 640 /etc/21miron/video-platform.env
sudo nano /etc/21miron/video-platform.env
```

Здесь хранятся:

- пароль PostgreSQL;
- аварийный локальный пароль администратора;
- пароль сервисного аккаунта FreeIPA;
- секрет веб-сессий;
- LDAP DN и адрес FreeIPA;
- локальные переопределения IP и OME.

**Реальный файл `/etc/21miron/video-platform.env` нельзя добавлять в GitHub.**

Для генерации паролей:

```bash
openssl rand -base64 48
```

Для `SESSION_SECRET`:

```bash
openssl rand -hex 64
```

## 3. PostgreSQL

Рекомендуемые значения:

```text
База: video_platform
Пользователь: video_user
Хост: 127.0.0.1
Порт: 5432
```

Создание:

```bash
sudo -u postgres psql
```

```sql
CREATE USER video_user WITH PASSWORD 'СЛОЖНЫЙ_ПАРОЛЬ';
CREATE DATABASE video_platform OWNER video_user;
GRANT ALL PRIVILEGES ON DATABASE video_platform TO video_user;
\q
```

Тот же пароль указать в:

```text
/etc/21miron/video-platform.env
```

```text
DB_PASSWORD=...
```

Текущие таблицы создаются FastAPI автоматически при первом запуске. В дальнейшем миграции должны выполняться отдельным инструментом миграций, а не ручным редактированием таблиц.

### Резервная копия базы

```bash
sudo -u postgres pg_dump -Fc video_platform > /var/backups/21miron/video_platform_$(date +%F_%H-%M).dump
```

### Восстановление

```bash
sudo -u postgres pg_restore --clean --if-exists -d video_platform /path/to/backup.dump
```

## 4. FreeIPA

FreeIPA размещается в отдельной виртуальной машине. Видеохостинг использует LDAP/LDAPS.

Группы:

```text
video-admins
video-operator
video-viewer
```

Права:

- `video-admins` — мониторинг, администрирование, диагностика и системные метрики;
- `video-operator` — только запуск собственной трансляции, без просмотра;
- `video-viewer` — только просмотр разрешённых трансляций.

Параметры FreeIPA указываются в `/etc/21miron/video-platform.env`.

Рекомендуется создать отдельный сервисный аккаунт FreeIPA только для LDAP-поиска. Не использовать пароль администратора FreeIPA в приложении.

LDAP-интеграция подготовлена конфигурационно, но должна быть окончательно включена и протестирована перед удалением аварийного локального входа.

## 5. Основные пути на сервере

```text
/opt/video-platform/                         код проекта
/opt/video-platform/main.py                 FastAPI backend
/opt/video-platform/frontend/               React frontend
/opt/video-platform/frontend/dist/          собранный frontend
/opt/video-platform/frontend/src/config/platform.json
                                             главный несекретный конфиг
/opt/video-platform/deploy/                 шаблоны systemd и Nginx
/etc/21miron/video-platform.env              пароли и секреты
/etc/systemd/system/video-platform.service   systemd unit
/etc/nginx/sites-available/video-platform    Nginx-конфигурация
/etc/nginx/sites-enabled/video-platform      активная ссылка Nginx
/var/log/nginx/                              журналы Nginx
/var/log/ovenmediaengine/                    журналы OME внутри/через контейнер
/var/lib/postgresql/                         данные PostgreSQL
/var/backups/21miron/                        рекомендуемое место резервных копий
```

## 6. OvenMediaEngine

Основные параметры в `platform.json`:

```json
"ovenMediaEngine": {
  "internalBaseUrl": "http://127.0.0.1:3333",
  "application": "app",
  "candidateUdpRange": "10000-10004",
  "tcpRelayPort": 3478
}
```

OBS:

```text
Server: rtmp://SERVER_IP:1935/app
Stream key: test1
```

Контейнер и конфигурацию OME необходимо хранить отдельно от секретов приложения. Перед изменением `Server.xml` делать резервную копию.

## 7. Сеть и MikroTik

На самом Linux-хосте сервисы могут слушать необходимые порты, но доступ между сетями и из интернета ограничивается Firewall на MikroTik.

Минимальные порты:

```text
80/tcp или 443/tcp       сайт
1935/tcp                 RTMP ingest
3333/tcp                 OME signaling/LL-HLS
3478/tcp                 WebRTC TCP relay
10000-10004/udp          WebRTC ICE media
22/tcp                   SSH только с административного ПК/сети
5432/tcp                 не публиковать; только localhost
8000/tcp                 не публиковать; только localhost через Nginx
```

Правила MikroTik должны разрешать управление только с административного ПК и доверенных VPN-подсетей. PostgreSQL и Uvicorn не должны пробрасываться наружу.

## 8. Изменения и обновления

Перед обновлением:

```bash
cd /opt/video-platform
git status
```

Обновление:

```bash
sudo -u video-platform git pull
sudo -u video-platform ./venv/bin/pip install -r requirements.txt
cd frontend
sudo -u video-platform npm install
sudo -u video-platform npm run build
sudo systemctl restart video-platform.service
sudo systemctl reload nginx.service
```

Проверка:

```bash
curl http://127.0.0.1:8000/config
curl http://127.0.0.1:8000/streams
curl http://127.0.0.1:8000/system/metrics
sudo systemctl status video-platform.service --no-pager
sudo nginx -t
```

## 9. Что не должно храниться в GitHub

- реальные пароли;
- `/etc/21miron/video-platform.env`;
- приватные ключи TLS;
- FreeIPA bind password;
- дампы PostgreSQL;
- резервные копии конфигураций с секретами;
- пользовательские видеозаписи (запись потоков в проекте отключена).
