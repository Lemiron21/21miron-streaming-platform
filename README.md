# 21miron Streaming Platform

Корпоративная платформа оперативных видеотрансляций для операторов, дронов, камер и экранных источников.

## Целевая схема

- Ubuntu Server 24.04 LTS без GUI;
- Nginx + React/Vite;
- FastAPI/Uvicorn;
- PostgreSQL;
- OvenMediaEngine в Docker;
- FreeIPA в отдельной виртуальной машине;
- MikroTik как сетевой Firewall и маршрутизатор;
- VPN-серверы и мониторинг остаются на облачном VPS.

## Роли

```text
video-admins     администрирование, просмотр и диагностика
video-operator   только запуск собственной трансляции
video-viewer     только просмотр разрешённых трансляций
```

## Главные документы

- [`DEPLOYMENT.md`](DEPLOYMENT.md) — установка на физический сервер;
- [`CONFIGURATION.md`](CONFIGURATION.md) — IP, отделы, пароли, базы данных и пути файлов;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — целевая схема хоста, FreeIPA, MikroTik и VPS;
- [`.env.example`](.env.example) — шаблон секретных переменных;
- [`frontend/src/config/platform.json`](frontend/src/config/platform.json) — единый несекретный файл настроек.

## Основные функции

- автоматическое обнаружение активных потоков;
- WebRTC как основной режим просмотра;
- LL-HLS как резервный режим;
- современный dashboard;
- отдельные интерфейсы для администратора, оператора и просматривающего;
- системные метрики для администратора;
- подготовка к LDAP/FreeIPA;
- запись трансляций на сервер отключена.

## Быстрый frontend-запуск для разработки

```bash
cd frontend
npm install
npm run dev
```

## Производственное обновление

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

## Важное ограничение текущего этапа

Конфигурация FreeIPA/LDAP уже предусмотрена, но окончательная LDAP-аутентификация и браузерная публикация потока будут включаться и тестироваться отдельными этапами перед вводом в промышленную эксплуатацию.
