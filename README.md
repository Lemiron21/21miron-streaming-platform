# 21miron Streaming Platform

Корпоративная веб-платформа для просмотра видеотрансляций через закрытый доступ по WireGuard.

## v0.1

В текущей версии заложен React-интерфейс:

- тёмная панель управления;
- выбор отдела;
- сетки 2×2, 3×3, 4×4, 5×5 и адаптивный режим «Все»;
- карточки трансляций;
- правая панель с логином и задержками;
- подготовка под FastAPI, MediaMTX и OBS Studio.

## Локальный запуск frontend

```bash
cd frontend
npm install
npm run dev
```

После запуска Vite:

```text
http://SERVER_IP:5173
```

## План

- v0.1 — React dashboard
- v0.2 — интеграция FastAPI API
- v0.3 — OBS Studio → MediaMTX → сайт
- v0.4 — админ-панель
- v0.5 — FreeIPA
