# Установка 21miron Video Platform на Ubuntu Server 26.04 LTS

## 1. Целевая архитектура

На физическом сервере:

- Ubuntu Server 26.04 LTS без GUI;
- 21miron Video Platform;
- Nginx;
- PostgreSQL;
- Docker + OvenMediaEngine;
- KVM/libvirt;
- отдельная VM с FreeIPA.

На VPS остаются Zabbix, Grafana, BookStack, Draw.io и облачные VPN-сервисы. Внешний Firewall, NAT и проброс портов выполняет MikroTik.

## 2. Подготовка ОС

При установке Ubuntu:

- выбрать минимальную серверную установку;
- включить OpenSSH Server;
- задать статический IP;
- задать корректное имя хоста;
- включить аппаратную виртуализацию VT-x/AMD-V в BIOS;
- синхронизировать время через systemd-timesyncd или chrony.

Проверка:

```bash
cat /etc/os-release
hostnamectl
ip address
ip route
systemd-detect-virt --vm-cpu
```

## 3. Клонирование проекта

```bash
sudo apt update
sudo apt install -y git
sudo git clone https://github.com/Lemiron21/21miron-streaming-platform.git /opt/video-platform
cd /opt/video-platform
```

## 4. Установка компонентов

```bash
sudo bash scripts/install-ubuntu-26.04.sh
```

Скрипт устанавливает базовые пакеты, Docker Engine из официального репозитория, PostgreSQL, Nginx, Python, Node.js, FFmpeg и KVM/libvirt. Он не создаёт реальные пароли и не запускает приложение до заполнения конфигурации.

## 5. Основной конфигурационный файл

```bash
sudo nano /etc/21miron/video-platform.env
```

Файл создаётся из `.env.example`. Обязательно изменить:

```text
VIDEO_SERVER_IP=
DB_PASSWORD=
DEFAULT_ADMIN_PASSWORD=
FREEIPA_HOST=
FREEIPA_BASE_DN=
FREEIPA_BIND_DN=
FREEIPA_BIND_PASSWORD=
```

Права:

```bash
sudo chown root:root /etc/21miron/video-platform.env
sudo chmod 600 /etc/21miron/video-platform.env
```

Реальные пароли не должны попадать в GitHub.

## 6. PostgreSQL

Создание пользователя и базы:

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE video_user LOGIN PASSWORD 'СЛОЖНЫЙ_ПАРОЛЬ';
CREATE DATABASE video_platform OWNER video_user;
\q
```

Пароль должен совпадать с `DB_PASSWORD`.

Проверка:

```bash
PGPASSWORD='СЛОЖНЫЙ_ПАРОЛЬ' psql -h 127.0.0.1 -U video_user -d video_platform -c 'SELECT 1;'
```

PostgreSQL оставляем доступным только локально, если база находится на том же хосте.

## 7. OvenMediaEngine

OME запускается в Docker. Конфигурация должна храниться вне контейнера, например:

```text
/etc/ovenmediaengine/Server.xml
/etc/ovenmediaengine/Logger.xml
```

Рекомендуемый контейнерный каталог данных:

```text
/var/lib/ovenmediaengine
```

Минимально необходимые порты в текущей архитектуре:

- `1935/tcp` — RTMP ingest;
- `3333/tcp` — WebRTC signaling;
- `10000/udp` или настроенный UDP-диапазон — WebRTC ICE;
- `3478/tcp/udp` — TURN, только если он включён;
- `80/tcp`, `443/tcp` — интерфейс через Nginx.

Точный UDP-диапазон должен совпадать с `Server.xml` и правилами MikroTik.

## 8. Запуск приложения

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now video-platform.service
sudo nginx -t
sudo systemctl reload nginx
```

Проверка:

```bash
sudo systemctl status video-platform.service --no-pager
curl http://127.0.0.1:8000/streams
curl http://127.0.0.1:8000/system/metrics
sudo bash /opt/video-platform/scripts/healthcheck.sh
```

## 9. KVM/libvirt для FreeIPA

Проверка виртуализации:

```bash
sudo kvm-ok || true
sudo virsh list --all
```

Рекомендуемые начальные ресурсы VM FreeIPA:

- 4 vCPU;
- 8 ГБ RAM;
- 60 ГБ диска;
- статический IP;
- отдельное DNS-имя;
- постоянная синхронизация времени.

FreeIPA устанавливается в отдельную VM. До подключения LDAP приложение может временно использовать аварийную локальную учётную запись.

## 10. MikroTik

На Ubuntu не требуется открывать сервисы напрямую в интернет. MikroTik выполняет:

- Firewall;
- NAT/port forwarding;
- маршрутизацию VPN;
- ограничение административного доступа;
- доступ к FreeIPA только из административной сети;
- доступ к PostgreSQL извне запрещён.

Рекомендуется разрешать SSH, веб-панель и FreeIPA только с административного ПК/VLAN/VPN.

## 11. Обновление

```bash
cd /opt/video-platform
sudo bash scripts/update.sh
```

Скрипт откажется обновляться при незакоммиченных локальных изменениях.

## 12. Резервные копии

```bash
sudo bash scripts/backup-postgresql.sh
```

Хранить отдельно:

- `/etc/21miron/video-platform.env`;
- конфигурацию OME;
- конфигурацию Nginx;
- дампы PostgreSQL;
- настройки MikroTik;
- параметры VM FreeIPA;
- список RTMP-ключей и OBS-профилей.
