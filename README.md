# Uni-project

The Teaching Assistant Management System uses Django for the API and React with Vite for the frontend.

## Run locally on Windows

Use Python 3.12 and Node.js 24. From the repository root, install the pinned dependencies on a fresh checkout.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
```

For native development, Django reads the root `.env.local` and defaults to SQLite. Create the file once with a random `SECRET_KEY`. The following PowerShell commands create the file only when it is absent.

```powershell
if (-not (Test-Path .env.local)) {
    $localKey = .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(56))"
    @("SECRET_KEY=$localKey", "ALLOWED_HOSTS=localhost,127.0.0.1", "REDIS_URL=locmem") |
        Set-Content -LiteralPath .env.local -Encoding utf8
}
```

Run the migrations and start Django in one PowerShell window.

```powershell
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Start the frontend in a second window from the repository root.

```powershell
npm.cmd --prefix frontend run dev
```

Open [http://localhost:18765](http://localhost:18765) and sign in with an account from your local database. Vite forwards API requests to Django. See the [frontend guide](frontend/README.md) for dev fixtures and frontend configuration. Docker Compose uses its own root `.env`, based on `.env.example`, and runs PostgreSQL and Redis.
