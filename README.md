# 21miron Video Platform

Корпоративная платформа оперативных видеотрансляций для операторов, дронов, камер и экранных источников.

## Целевая схема

- Ubuntu Server 26.04 LTS без GUI;
- Nginx + React/Vite;
- FastAPI/Uvicorn;
- PostgreSQL;
- OvenMediaEngine в Docker;
- KVM/libvirt и FreeIPA в отдельной виртуальной машине;
- MikroTik как сетевой Firewall, NAT и маршрутизатор;
- VPN-серверы, Grafana, Zabbix, BookStack и другие сервисы остаются на VPS.

## Роли FreeIPA

```text
video-admins     администрирование, просмотр и диагностика
video-operator   только запуск собственной трансляции
video-viewer     только просмотр разрешённых трансляций
```

## Главные документы

- [`docs/INSTALL_UBUNTU_26_04.md`](docs/INSTALL_UBUNTU_26_04.md) — установка на новый физический сервер;
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — миграция и ввод в эксплуатацию;
- [`CONFIGURATION.md`](CONFIGURATION.md) — IP, отделы, пароли, базы данных и пути файлов;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — хост, VM FreeIPA, MikroTik и VPS;
- [`.env.example`](.env.example) — шаблон секретных переменных;
- [`frontend/src/config/platform.json`](frontend/src/config/platform.json) — единый несекретный файл настроек.

## Автоматизация

Первичная установка после клонирования репозитория в `/opt/video-platform`:

```bash
sudo bash scripts/install-ubuntu-26.04.sh
```

Обновление:

```bash
sudo bash scripts/update.sh
```

Проверка компонентов:

```bash
sudo bash scripts/healthcheck.sh
```

Резервное копирование PostgreSQL:

```bash
sudo bash scripts/backup-postgresql.sh
```

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

Реальные пароли и LDAP-реквизиты хранятся только в:

```text
/etc/21miron/video-platform.env
```

Они не должны добавляться в GitHub.

## Текущие ограничения

LDAP-аутентификация FreeIPA, обнаружение потоков через OME API, WebSocket-события и публикация потока из браузера ещё требуют отдельной реализации и приёмочного тестирования перед промышленным запуском. Текущая версия сохраняет рабочую схему OBS → OvenMediaEngine → WebRTC/LL-HLS → сайт.
