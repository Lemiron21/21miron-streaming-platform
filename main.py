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
    "dbname": "video_platform",
    "user": "video_user",
    "password": "StrongPassword123!",
    "host": "127.0.0.1",
    "port": 5432,
}


def db():
    return psycopg2.connect(**DB)


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
            (1, "Камера 1 - Вход", "http://10.77.77.1:8888/test1/index.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (1, "Камера 2 - Офис", "http://10.77.77.1:8888/test2/index.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (2, "Камера 3 - Коридор", "http://10.77.77.1:8888/test3/index.m3u8")
        )
        cur.execute(
            "INSERT INTO streams (department_id, name, url) VALUES (%s, %s, %s);",
            (2, "Камера 4 - Склад", "http://10.77.77.1:8888/test4/index.m3u8")
        )

    conn.commit()
    cur.close()
    conn.close()


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
            "server_ip": "10.77.77.1",
        }
    )


@app.get("/logout")
def logout():
    response = RedirectResponse("/")
    response.delete_cookie("user")
    return response
