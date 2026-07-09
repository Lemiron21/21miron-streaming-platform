import os
from urllib.error import URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from passlib.hash import bcrypt
import psycopg2


app = FastAPI()

app.mount("/static", StaticFiles(directory="/opt/video-platform/static"), name="static")
templates = Jinja2Templates(directory="/opt/video-platform/templates")


DB = {
    "dbname": os.getenv("DB_NAME", "video_platform"),
    "user": os.getenv("DB_USER", "video_user"),
    "password": os.getenv("DB_PASSWORD", "StrongPassword123!"),
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "5432")),
}

SERVER_IP = os.getenv("VIDEO_SERVER_IP", "10.77.77.1")
OME_HTTP_URL = os.getenv("OME_HTTP_URL", "http://127.0.0.1:3333")
STREAM_IDS = [item.strip() for item in os.getenv("STREAM_IDS", "test1,test2,test3").split(",") if item.strip()]
STREAM_DEPARTMENTS = {
    "test1": ("department-1", "Отдел 1"),
    "test2": ("department-2", "Отдел 2"),
    "test3": ("department-3", "Отдел 3"),
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
        with urlopen(request, timeout=1.5) as response:
            return 200 <= response.status < 300
    except (URLError, TimeoutError, OSError):
        return False


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
            ("admin", bcrypt.hash("admin123"), True)
        )

    cur.execute("SELECT id FROM departments LIMIT 1;")
    if not cur.fetchone():
        cur.execute("INSERT INTO departments (name) VALUES (%s);", ("Отдел 1",))
        cur.execute("INSERT INTO departments (name) VALUES (%s);", ("Отдел 2",))
        cur.execute("INSERT INTO departments (name) VALUES (%s);", ("Отдел 3",))

        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (1, "Камера 1 - Вход", f"http://{SERVER_IP}:3333/app/test1/llhls.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (1, "Камера 2 - Офис", f"http://{SERVER_IP}:3333/app/test2/llhls.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (2, "Камера 3 - Коридор", f"http://{SERVER_IP}:3333/app/test3/llhls.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (2, "Камера 4 - Склад", f"http://{SERVER_IP}:3333/app/test4/llhls.m3u8")
        )

    conn.commit()
    cur.close()
    conn.close()


@app.get("/streams")
def streams_api():
    streams = []

    for index, stream_id in enumerate(STREAM_IDS, start=1):
        if not is_ome_stream_online(stream_id):
            continue

        department_id, department_name = STREAM_DEPARTMENTS.get(
            stream_id,
            (f"department-{index}", f"Отдел {index}"),
        )

        streams.append({
            "id": stream_id,
            "name": stream_id,
            "departmentId": department_id,
            "departmentName": department_name,
            "status": "online",
            "latency": 1,
            "webrtcUrl": f"ws://{SERVER_IP}:3333/app/{stream_id}",
            "llhlsUrl": f"http://{SERVER_IP}:3333/app/{stream_id}/llhls.m3u8",
            "hlsUrl": f"http://{SERVER_IP}:3333/app/{stream_id}/llhls.m3u8",
        })

    return {"streams": streams}


@app.get("/", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "title": "Сервер трансляций: 21miron",
        }
    )


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
        response.set_cookie(
            key="user",
            value=login,
            httponly=True,
            samesite="lax"
        )
        return response

    return RedirectResponse("/", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    user = request.cookies.get("user")
    if not user:
        return RedirectResponse("/")

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        SELECT departments.name, streams.name, streams.url
        FROM streams
        JOIN departments ON streams.department_id = departments.id
        ORDER BY departments.name, streams.name;
    """)
    streams = cur.fetchall()
    cur.close()
    conn.close()

    departments = {}
    for department, name, url in streams:
        departments[department] = departments.get(department, 0) + 1

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "title": "Сервер трансляций: 21miron",
            "user": user,
            "streams": streams,
            "departments": departments,
            "server_ip": SERVER_IP,
        }
    )


@app.get("/logout")
def logout():
    response = RedirectResponse("/")
    response.delete_cookie("user")
    return response
