# MediaMTX + OBS Studio

Эта инструкция подключает первый тестовый поток OBS Studio к 21miron Streaming Platform.

## Порты

| Назначение | Порт | Адрес |
|---|---:|---|
| OBS → MediaMTX RTMP | 1935 | `rtmp://10.77.77.1:1935/test1` |
| HLS playback | 8888 | `http://10.77.77.1:8888/test1/index.m3u8` |
| WebRTC playback | 8889 | `http://10.77.77.1:8889/test1` |
| RTSP | 8554 | `rtsp://10.77.77.1:8554/test1` |
| Local API | 9997 | `http://127.0.0.1:9997/v3/paths/list` |

## Установка MediaMTX

Текущая проверенная на момент подготовки инструкции версия: `v1.19.2`.

```bash
cd /tmp
wget https://github.com/bluenviron/mediamtx/releases/download/v1.19.2/mediamtx_v1.19.2_linux_amd64.tar.gz

tar -xzf mediamtx_v1.19.2_linux_amd64.tar.gz
sudo install -m 755 mediamtx /usr/local/bin/mediamtx
```

## Конфигурация

```bash
sudo mkdir -p /etc/mediamtx
sudo cp /opt/video-platform/mediamtx/mediamtx.yml /etc/mediamtx/mediamtx.yml
```

## systemd-сервис

```bash
sudo nano /etc/systemd/system/mediamtx.service
```

```ini
[Unit]
Description=MediaMTX streaming server
After=network.target

[Service]
ExecStart=/usr/local/bin/mediamtx /etc/mediamtx/mediamtx.yml
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mediamtx
sudo systemctl status mediamtx
```

## Проверка портов

```bash
sudo ss -tulpn | grep -E '1935|8888|8889|8554|9997'
```

## Настройка OBS Studio

OBS Studio → Настройки → Трансляция:

```text
Сервис: Пользовательский
Сервер: rtmp://10.77.77.1:1935
Ключ потока: test1
```

Итоговый поток:

```text
rtmp://10.77.77.1:1935/test1
```

## Проверка HLS

После запуска трансляции в OBS:

```text
http://10.77.77.1:8888/test1/index.m3u8
```

## Проверка API MediaMTX

```bash
curl http://127.0.0.1:9997/v3/paths/list
```
