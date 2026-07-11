import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from urllib.error import URLError
from urllib.request import Request as UrlRequest, urlopen

import psutil
import psycopg2
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from passlib.hash import bcrypt


app = FastAPI()
templates = Jinja2Templates(directory="/opt/video-platform/templates")

DB = {
    "dbname": os.getenv("DB_NAME", "video_platform"),
    "user": os.getenv("DB_USER", "video_user"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "5432")),
}

SERVER_IP = os.getenv("VIDEO_SERVER_IP", "10.77.77.1")
OME_HTTP_URL = os.getenv("OME_HTTP_URL", "http://127.0.0.1:3333")

DISCOVERY_PREFIX = os.getenv("STREAM_DISCOVERY_PREFIX", "test")
DISCOVERY_START = int(os.getenv("STREAM_DISCOVERY_START", "1"))
DISCOVERY_END = int(os.getenv("STREAM_DISCOVERY_END", "200"))
DISCOVERY_TIMEOUT = float(os.getenv("STREAM_DISCOVERY_TIMEOUT", "0.35"))
DISCOVERY_WORKERS = int(os.getenv("STREAM_DISCOVERY_WORKERS", "32"))
DISCOVERY_CACHE_TTL = float(os.getenv("STREAM_DISCOVERY_CACHE_TTL", "2"))
STREAM_DEPARTMENT_SIZE = int(os.getenv("STREAM_DEPARTMENT_SIZE", "50"))

EXPLICIT_STREAM_IDS = [item.strip() for item in os.getenv("STREAM_IDS", "").split(",") if item.strip()]
AUTO_STREAM_IDS = [f"{DISCOVERY_PREFIX}{index}" for index in range(DISCOVERY_START, DISCOVERY_END + 1)]
CANDIDATE_STREAM_IDS = EXPLICIT_STREAM_IDS or AUTO_STREAM_IDS

STREAM_DEPARTMENTS = {
    "test1": ("department-1", "Отдел 1"),
    "test2": ("department-1", "Отдел 1"),
    "test3": ("department-1", "Отдел 1"),
}

_DISCOVERY_CACHE = {"updated_at": 0.0, "streams": []}
_DISCOVERY_LOCK = Lock()
_METRICS_LOCK = Lock()
_METRICS_NETWORK_SAMPLE = {
    "timestamp": time.monotonic(),
    "sent": psutil.net_io_counters().bytes_sent,
    "received": psutil.net_io_counters().bytes_recv,
}


def db():
    return psycopg2.connect(**DB)


def ome_llhls_url(stream_id: str) -> str:
    return f"{OME_HTTP_URL}/app/{stream_id}/llhls.m3u8"


def is_ome_stream_online(stream_id: str) -> bool:
    request = UrlRequest(
        ome_llhls_url(stream_id),
        headers={"User-Agent": "21miron-video-platform/1.0"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=DISCOVERY_TIMEOUT) as response:
            return 200 <= response.status < 300
    except (URLError, TimeoutError, OSError):
        return False


def department_for_stream(stream_id: str, fallback_index: int) -> tuple[str, str]:
    if stream_id in STREAM_DEPARTMENTS:
        return STREAM_DEPARTMENTS[stream_id]

    match = re.search(r"(\d+)$", stream_id)
    stream_number = int(match.group(1)) if match else fallback_index
    department_number = max(1, ((stream_number - 1) // STREAM_DEPARTMENT_SIZE) + 1)
    return f"department-{department_number}", f"Отдел {department_number}"


def stream_payload(stream_id: str, index: int) -> dict:
    department_id, department_name = department_for_stream(stream_id, index)
    return {
        "id": stream_id,
        "name": stream_id,
        "departmentId": department_id,
        "departmentName": department_name,
        "status": "online",
        "latency": 1,
        "webrtcUrl": f"ws://{SERVER_IP}:3333/app/{stream_id}",
        "llhlsUrl": f"http://{SERVER_IP}:3333/app/{stream_id}/llhls.m3u8",
        "hlsUrl": f"http://{SERVER_IP}:3333/app/{stream_id}/llhls.m3u8",
    }


def discover_ome_streams() -> list[dict]:
    now = time.monotonic()
    with _DISCOVERY_LOCK:
        if now - _DISCOVERY_CACHE["updated_at"] < DISCOVERY_CACHE_TTL:
            return list(_DISCOVERY_CACHE["streams"])

    online_streams = []
    with ThreadPoolExecutor(max_workers=DISCOVERY_WORKERS) as executor:
        future_map = {
            executor.submit(is_ome_stream_online, stream_id): (index, stream_id)
            for index, stream_id in enumerate(CANDIDATE_STREAM_IDS, start=1)
        }
        for future in as_completed(future_map):
            index, stream_id = future_map[future]
            try:
                if future.result():
                    online_streams.append(stream_payload(stream_id, index))
            except Exception:
                continue

    online_streams.sort(key=lambda item: item["id"])
    with _DISCOVERY_LOCK:
        _DISCOVERY_CACHE["updated_at"] = time.monotonic()
        _DISCOVERY_CACHE["streams"] = online_streams
    return online_streams


def cpu_temperature() -> float | None:
    try:
        temperatures = psutil.sensors_temperatures()
    except (AttributeError, OSError):
        return None

    for entries in temperatures.values():
        for entry in entries:
            if entry.current is not None:
                return round(float(entry.current), 1)
    return None


def collect_system_metrics() -> dict:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    network = psutil.net_io_counters()
    now = time.monotonic()

    with _METRICS_LOCK:
        elapsed = max(now - _METRICS_NETWORK_SAMPLE["timestamp"], 0.001)
        upload_bps = max(0.0, (network.bytes_sent - _METRICS_NETWORK_SAMPLE["sent"]) / elapsed)
        download_bps = max(0.0, (network.bytes_recv - _METRICS_NETWORK_SAMPLE["received"]) / elapsed)
        _METRICS_NETWORK_SAMPLE.update(
            timestamp=now,
            sent=network.bytes_sent,
            received=network.bytes_recv,
        )

    load_average = os.getloadavg() if hasattr(os, "getloadavg") else (0.0, 0.0, 0.0)
    return {
        "cpuPercent": round(psutil.cpu_percent(interval=0.1), 1),
        "cpuCores": psutil.cpu_count(logical=True) or 1,
        "temperatureC": cpu_temperature(),
        "memoryPercent": round(memory.percent, 1),
        "memoryUsedBytes": memory.used,
        "memoryTotalBytes": memory.total,
        "diskPercent": round(disk.percent, 1),
        "diskUsedBytes": disk.used,
        "diskTotalBytes": disk.total,
        "networkUploadBytesPerSecond": round(upload_bps),
        "networkDownloadBytesPerSecond": round(download_bps),
        "uptimeSeconds": max(0, round(time.time() - psutil.boot_time())),
        "loadAverage": [round(value, 2) for value in load_average],
    }


@app.on_event("startup")
def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            login TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS streams (
            id SERIAL PRIMARY KEY,
            department_id INTEGER REFERENCES departments(id),
            name TEXT NOT NULL,
            url TEXT NOT NULL
        );
    """)

    cur.execute("SELECT id FROM users WHERE login=%s;", ("admin",))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users (login, password_hash, is_admin) VALUES (%s, %s, %s)",
            ("admin", bcrypt.hash(os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")), True),
        )

    cur.execute("SELECT id FROM departments LIMIT 1;")
    if not cur.fetchone():
        for department_name in ("Отдел 1", "Отдел 2", "Отдел 3", "Отдел 4"):
            cur.execute("INSERT INTO departments (name) VALUES (%s);", (department_name,))

    conn.commit()
    cur.close()
    conn.close()


@app.get("/streams")
def streams_api():
    return {"streams": discover_ome_streams()}


@app.get("/system/metrics")
def system_metrics_api():
    return collect_system_metrics()


@app.get("/", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "title": "Сервер трансляций: 21miron"})


@app.post("/login")
def login(login: str = Form(...), password: str = Form(...)):
    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE login=%s;", (login,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row and bcrypt.verify(password, row[0]):
        response = RedirectResponse("/dashboard", status_code=302)
        response.set_cookie(key="user", value=login, httponly=True, samesite="lax")
        return response
    return RedirectResponse("/", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    user = request.cookies.get("user")
    if not user:
        return RedirectResponse("/")
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "title": "Сервер трансляций: 21miron", "user": user, "server_ip": SERVER_IP},
    )


@app.get("/logout")
def logout():
    response = RedirectResponse("/")
    response.delete_cookie("user")
    return response
