# enose-core

Repository for the `enose-core` project — the core system for piezosensor data processing and analysis.

## Tech Stack

- **Backend:** Go 1.23+ (Gin, GORM, golang-migrate, swaggo)
- **Frontend:** React 19 (React Router v7, Vite, TypeScript, Tailwind CSS)
- **Parser:** Python 3.12+ (FastAPI, managed via `uv`)
- **Database:** PostgreSQL 15+
- **Automation:** Taskfile, pre-commit hooks
- **API Documentation:** Swagger (auto-generated via swaggo)

---

## Quick Start with Docker

### 1. Prerequisites

- Docker Compose v2.0+
- [Task](https://taskfile.dev/) (optional, for convenient commands)

### 2. Setup

Copy environment files and configure as needed:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
```

> `.env` (root) is the single source of truth for Docker Compose — both for
> `${VAR}` substitution in `docker-compose.yml` and for injecting variables
> into containers via `env_file:`. `apps/backend/.env` is used only when
> running the backend **outside Docker** (`task backend:run`).

### 3. Run

Start all services (backend, frontend, parser, postgres, pgadmin, migrations):

```bash
task start
```

Or directly:

```bash
docker compose up --build
```

Services will be available at:

| Service        | URL                                      |
| -------------- | ---------------------------------------- |
| Frontend       | http://localhost:5173                    |
| Backend API    | http://localhost:8080                    |
| Swagger UI     | http://localhost:8080/swagger/index.html |
| Parser service | http://localhost:8001                    |
| Report service | http://localhost:8002                    |
| ML service     | http://localhost:8003                    |
| pgAdmin        | http://localhost:5050                    |
| PostgreSQL     | localhost:5432                           |

---

## Local Development (without Docker)

### 1. System Requirements

- Go 1.23+
- Node.js v20+ and npm
- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- [Task](https://taskfile.dev/)
- PostgreSQL 15+

### 2. Clone and Setup

```bash
git clone git@github.com:CreoCot/enose-core.git
cd enose-core

# Install dependencies and pre-commit hooks
task setup
```

### 3. Backend Configuration

Copy and configure environment variables:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` with your local PostgreSQL credentials.

Start a local PostgreSQL instance (or use existing):

```bash
docker run --name enose-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=enose \
  -p 5432:5432 -d postgres:15
```

Apply database migrations:

```bash
task db:migrate-up
```

Start the backend:

```bash
task backend:run
```

### 4. Frontend

```bash
task frontend:run
```

### 5. Parser service

```bash
cd apps/parser
uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 6. Report service

```bash
docker compose up -d report
```

| Method | Path       | Auth    | Description                 |
| ------ | ---------- | ------- | --------------------------- |
| GET    | `/health`  | —       | Report service health check |
| POST   | `/reports` | API Key | Generate a PDF report       |
| GET    | `/example` | —       | Download an example report  |

### 7. ML service

```bash
docker compose up -d ml
```

| Method | Path       | Auth    | Description                   |
| ------ | ---------- | ------- | ----------------------------- |
| GET    | `/health`  | —       | ML service health check       |
| POST   | `/analyze` | API Key | Compute sensor curve features |

---

## API Overview

| Method | Path                    | Auth | Description                                                     |
| ------ | ----------------------- | ---- | --------------------------------------------------------------- |
| GET    | `/api/v1/health`        | —    | Service health check                                            |
| POST   | `/api/v1/auth/register` | —    | Register a new user                                             |
| POST   | `/api/v1/auth/login`    | —    | Login (sets httpOnly JWT cookie)                                |
| POST   | `/api/v1/auth/logout`   | —    | Logout (clears cookie)                                          |
| GET    | `/api/v1/auth/me`       | JWT  | Get current user info                                           |
| GET    | `/api/v1/entries`       | JWT  | List measurements (admin: all, operator: own)                   |
| POST   | `/api/v1/upload`        | JWT  | Upload a measurement file (CSV/XML/XLSX), bound to the uploader |
| GET    | `/api/v1/table/:id`     | JWT  | Table view of measurement data                                  |
| GET    | `/api/v1/plots/:id`     | JWT  | Time-series data per sensor for plotting                        |
| GET    | `/api/v1/report/:id`    | JWT  | Generate a PDF report (proxies the report service)              |
| GET    | `/api/v1/features/:id`  | JWT  | Sensor curve features (proxies the ML service)                  |

Authentication uses httpOnly cookies (`SameSite=Lax`). The `Secure` flag is enabled only in production.

The backend orchestrates the stateless Python services: `/upload` → parser, `/report/:id` → report, `/features/:id` → ML. Those services have no DB access; the backend is the sole DB owner.

Full interactive docs: **http://localhost:8080/swagger/index.html**

---

## API Documentation

The backend automatically generates Swagger documentation from code annotations.

**Regenerate documentation** (after adding new endpoints):

```bash
cd apps/backend
swag init -g cmd/api/main.go -o docs/swagger
```

---

## Database Migrations

Migrations are managed via `golang-migrate` and stored in `apps/backend/database/migrations/`.

**Apply pending migrations:**

```bash
task db:migrate-up
```

**Roll back the last migration:**

```bash
task db:migrate-down
```

**Create a new migration:**

```bash
task db:migrate-create seq=your_migration_name
```

**Apply migrations from inside the backend** (local dev without Docker):

```bash
cd apps/backend
task db:init
```

---

## Testing

### Health check

```bash
curl http://localhost:8080/api/v1/health | jq
```

### Auth endpoints (via Taskfile)

Requires running backend and `jq` installed. Cookies are stored in `/tmp/enose-cookies*.txt`.

```bash
# 1. Register admin and operator
task dev:auth:register
task dev:auth:register-user

# 2. Login — cookie saved to /tmp/enose-cookies*.txt
task dev:auth:login        # admin
task dev:auth:login-user   # operator

# 3. Check current user
task dev:auth:me

# 4. Check access control
task dev:entries:admin   # sees all measurements
task dev:entries:user    # sees only own measurements

# 5. Check that a request without a cookie returns 401
task dev:entries:no-cookie

# 6. Logout
task dev:auth:logout
```

### Upload and measurement data endpoints

```bash
# Upload a file (any authenticated user; the measurement is bound to the uploader)
task dev:upload:file file=apps/parser/tests/fixtures/sample.xml

# Get table view of measurement id=1
task dev:upload:table id=1

# Get plot data for measurement id=1
task dev:upload:plots id=1
```

### Parser service (direct)

```bash
# Health check
task dev:parser:health

# Send a file directly to the parser (bypasses backend auth)
task dev:parser:parse file=apps/parser/tests/fixtures/sample.xml
```

### Report service (direct)

1. Navigate to the report service:

   ```bash
   cd apps/report
   ```

2. Generate a report using the provided example request:

   ```bash
   curl -X POST http://localhost:8002/reports \
     -H "Content-Type: application/json" \
     -H "Accept: application/pdf" \
     -H "X-API-Key: example_api_key" \
     --data @report.json \
     --output report.pdf
   ```

3. Generate the bundled example report:

   ```bash
   curl -X GET http://localhost:8002/example \
     -H "Accept: application/pdf" \
     --output example.pdf
   ```

4. Verify that both `report.pdf` and `example.pdf` are generated successfully and can be opened.

#### Unit Tests

1. Navigate to the report service:

   ```bash
   cd apps/report
   ```

2. Create a virtual environment:

   ```bash
   python3 -m venv .venv
   ```

3. Activate it:

   ```bash
   source .venv/bin/activate
   ```

   > **Windows (PowerShell):**
   >
   > ```powershell
   > .venv\Scripts\Activate.ps1
   > ```
   >
   > **Windows (Git Bash):**
   >
   > ```bash
   > source .venv/Scripts/activate
   > ```

4. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

5. Run the tests:

   ```bash
   pytest
   ```

6. Verify that all tests pass.

### Auth endpoints (manual curl)

```bash
# Register admin
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123","role":"admin"}' | jq

# Login — save cookie to file
curl -s -c /tmp/enose-cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' | jq

# Get current user
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/auth/me | jq

# List measurements (admin sees all, operator sees own)
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/entries | jq

# Upload a file
curl -s -b /tmp/enose-cookies.txt \
  -X POST http://localhost:8080/api/v1/upload \
  -F "file=@sample.xml" | jq

# Get measurement table (id=1)
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/table/1 | jq

# Get measurement plot data (id=1)
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/plots/1 | jq

# Without cookie → 401
curl -s http://localhost:8080/api/v1/entries | jq

# Logout
curl -s -b /tmp/enose-cookies.txt -c /tmp/enose-cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/logout | jq
```

### Backend unit tests

```bash
cd apps/backend
go test ./... -v
```

### Database

Verify migrations were applied:

```bash
docker exec -i enose-postgres psql -U postgres -d enose -c '\dt'
```

Or connect via pgAdmin at http://localhost:5050:

- **Host:** `postgres` (inside Docker network) or `localhost` (from host)
- **Port:** 5432
- **Username:** postgres
- **Password:** postgres

---

## Git Workflow

Direct pushes to `dev` and `main` branches are **blocked**. All changes must go through Pull Requests.

### Branches

- **`dev`** — main development branch (default). All features merge here.
- **`main`** — release branch. Updated infrequently.

### Creating a Feature Branch

Always create branches from the latest `dev`:

```bash
git checkout dev
git pull
git checkout -b <type>/<task-name>
```

**Branch types (lowercase, with slash):**

- `feature/` — new features (e.g., `feature/login-page`)
- `bugfix/` — bug fixes in dev environment (e.g., `bugfix/api-cors`)
- `refactor/` — code refactoring and optimization (e.g., `refactor/auth-middleware`)

### Commits

Use **Conventional Commits** format. The linter will reject incorrectly named commits. Write in English, keep it concise:

- `feat: add email login support`
- `fix: resolve crash on null response`
- `refactor: simplify auth middleware`

### Pull Request Process

1. Push your local branch: `git push origin feature/my-feature`
2. Open a PR on GitHub. Target branch defaults to `dev`.
3. Requires at least **1 approval** from a Code Owner.
4. Merge via **Squash and Merge** (all your commits will be squashed into one in `dev`).

### Hotfixes

If a critical bug appears on production (`main`) while `dev` is unstable:

1. Create branch from `main`: `git checkout main && git checkout -b hotfix/critical-bug`
2. Fix the bug and open **two PRs**: one to `main` (to fix production), one to `dev` (to preserve the fix for the next release).

---

## Project Structure

```
enose-core/
├── apps/
│   ├── backend/                  # Go API server
│   │   ├── cmd/
│   │   │   └── api/              # Entrypoint (main.go)
│   │   ├── internal/
│   │   │   ├── config/           # Configuration (env loading)
│   │   │   ├── database/         # DB connection
│   │   │   ├── handlers/         # HTTP handlers (auth, upload, measurements)
│   │   │   ├── middleware/        # Gin middleware (auth, CORS, logger)
│   │   │   ├── models/           # GORM models
│   │   │   ├── repository/       # Data access layer
│   │   │   ├── services/         # Business logic (auth, parser client)
│   │   │   └── server/           # Router setup
│   │   ├── database/
│   │   │   └── migrations/       # SQL migration files
│   │   └── docs/
│   │       └── swagger/          # Auto-generated Swagger docs
│   ├── frontend/                 # React application (React Router v7)
│   │   └── app/
│   │       ├── routes/           # Page components with clientLoader/clientAction
│   │       └── components/       # Shared UI components
│   ├── parser/                   # FastAPI parser microservice
│   │   └── app/
│   │       ├── main.py           # FastAPI app + /measurements/parse endpoint
│   │       └── parsers/          # CSV, XML, XLSX parsers
│   ├── report/                   # FastAPI PDF report service
│   │   └── app/
│   │       ├── main.py           # FastAPI app
│   │       ├── charts.py         # Chart generation (Matplotlib)
│   │       ├── features.py       # Features generation (numpy)
│   │       ├── pdf.py            # PDF generation (ReportLab)
│   │       ├── schemas.py        # Request models
│   │       └── tests/            # Unit tests
│   └── ml/                       # Python ML service
├── docker-compose.yml            # Docker orchestration (all services)
├── Taskfile.yaml                 # Task automation
└── README.md
```

---

## Troubleshooting

### Port already in use

Change the port in root `.env` (e.g. `BACKEND_PORT=8081`) and restart:

```bash
task stop && task start
```

### Database connection failed

Ensure PostgreSQL is running and credentials in `apps/backend/.env` are correct:

```bash
docker exec -i enose-postgres psql -U postgres -d enose -c "SELECT 1"
```

### `connection refused` when the backend calls a service (parser/report/ml)

Inside Docker the backend reaches the Python services by their Docker service names, set in root `.env`:

```
PARSER_URL=http://parser:8001
REPORT_URL=http://report:8002
ML_URL=http://ml:8003
```

If the error mentions `http://localhost:8002` (or `:8001` / `:8003`), the backend is falling back to its default because the `*_URL` variable never reached the container — usually because the container was created **before** that line was added to `.env`.

`env_file` is read only when a container is **created**. `air` hot-reloads Go code but **not** environment variables, and `docker compose restart` restarts the process **without** re-reading `.env`. After editing `.env` you must recreate the container:

```bash
docker compose up -d --force-recreate backend
# verify the value is now present inside the container:
docker compose exec backend env | grep -E 'REPORT_URL|ML_URL|PARSER_URL'
```

Also confirm the target service is healthy:

```bash
docker compose ps        # report/ml/parser should be "healthy"
```

### Swagger documentation not loading

Regenerate the docs and restart the backend:

```bash
cd apps/backend
swag init -g cmd/api/main.go -o docs/swagger
```
