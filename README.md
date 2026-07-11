# 21miron Video Platform

Корпоративная платформа оперативных видеотрансляций для операторов, дронов, камер и экранных источников.

## Целевая схема

- Ubuntu Server 26.04 LTS без GUI;
- Docker Engine + Docker Compose;
- Nginx + React/Vite;
- FastAPI/Uvicorn;
- PostgreSQL 18;
- OvenMediaEngine;
- KVM/libvirt и FreeIPA в отдельной виртуальной машине;
- MikroTik как сетевой Firewall, NAT и маршрутизатор;
- VPN-серверы, Grafana, Zabbix, BookStack и другие сервисы остаются на VPS.

## Роли FreeIPA

```text
video-admins     администрирование, просмотр и диагностика
video-operator   только запуск собственной трансляции
video-viewer     только просмотр разрешённых трансляций
```

## Основные документы

- [`docs/DOCKER_COMPOSE_DEPLOYMENT.md`](docs/DOCKER_COMPOSE_DEPLOYMENT.md) — поддерживаемое промышленное развёртывание;
- [`docs/INSTALL_UBUNTU_26_04.md`](docs/INSTALL_UBUNTU_26_04.md) — подготовка Ubuntu Server 26.04;
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — миграция и ввод в эксплуатацию;
- [`CONFIGURATION.md`](CONFIGURATION.md) — IP, отделы, пароли, базы данных и пути файлов;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — хост, VM FreeIPA, MikroTik и VPS;
- [`.env.example`](.env.example) — шаблон секретных переменных;
- [`frontend/src/config/platform.json`](frontend/src/config/platform.json) — несекретные настройки интерфейса.

## Первичный запуск на физическом сервере

Репозиторий размещается в:

```text
/opt/21miron/repository
```

Команды:

```bash
cd /opt/21miron/repository
git pull --ff-only
cp .env.example .env
chmod 600 .env
nano .env
chmod +x scripts/compose-*.sh
./scripts/compose-install.sh
```

Проверка:

```bash
./scripts/compose-healthcheck.sh
docker compose ps
```

## Обновление

```bash
cd /opt/21miron/repository
./scripts/compose-update.sh
```

## Резервная копия PostgreSQL

```bash
./scripts/compose-backup-database.sh
```

Файлы создаются в `/opt/21miron/repository/backups/` и должны дополнительно копироваться на внешний сервер или отдельное хранилище.

## Основные функции

- автоматическое обнаружение активных потоков;
- WebRTC как основной режим просмотра;
- LL-HLS как резервный режим;
- современный dashboard;
- отдельные интерфейсы для администратора, оператора и просматривающего;
- реальные системные метрики для администратора;
- подготовка к LDAP/FreeIPA;
- запись трансляций на сервер отключена.

## Разработка frontend

```bash
cd frontend
npm install
npm run dev
```

## Секреты

Реальные пароли и LDAP-реквизиты хранятся только в локальном файле:

```text
/opt/21miron/repository/.env
```

Файл `.env` исключён из Git и не должен добавляться в GitHub.

## Текущие ограничения

LDAP-аутентификация FreeIPA, обнаружение потоков через OME API Manager, WebSocket-события и публикация потока из браузера ещё требуют отдельной реализации и приёмочного тестирования. Текущая рабочая схема: OBS → OvenMediaEngine → WebRTC/LL-HLS → сайт.
