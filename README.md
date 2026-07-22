# enose-core

Core system for piezosensor ("electronic nose") data processing and analysis: ingest measurement files, extract features, run ML analysis, and generate PDF reports.

## Tech Stack

- **Backend:** Go 1.23+ (Gin, GORM, golang-migrate, swaggo) — sole orchestrator and DB owner
- **Frontend:** React 19 (React Router v7, Vite, TypeScript, Tailwind CSS)
- **Parser / Report / ML:** Python 3.12+ (FastAPI, `uv`) — stateless services called by the backend
- **Database:** PostgreSQL 15+
- **Monitoring:** VictoriaMetrics + Grafana
- **Automation:** Taskfile, pre-commit hooks

---

## Quick Start

```bash
cp .env.example .env
docker compose up --build
```

`docker-compose.yml` is the shared base; `docker-compose.override.yml` is auto-merged for local dev (build from source, bind-mounted hot reload). Production uses `docker-compose.prod.yml` instead (pinned images, no bind mounts) — see `deploy.yml`.

| Service     | URL                                      |
| ----------- | ---------------------------------------- |
| Frontend    | http://localhost:5173                    |
| Backend API | http://localhost:8080                    |
| Swagger UI  | http://localhost:8080/swagger/index.html |
| Parser      | http://localhost:8001                    |
| Report      | http://localhost:8002                    |
| ML          | http://localhost:8003                    |
| pgAdmin     | http://localhost:5050                    |
| Grafana     | http://localhost:3000                    |

**Local dev without Docker:** `task backend:run`, `task frontend:run`, `task report:run`. The ML service has no `run` task yet — start it with `cd apps/ml && uv run uvicorn app.main:app --port 8003`.

---

## API Documentation

- **Backend (public API):** Swagger UI at `/swagger/index.html`, regenerate after adding endpoints:
  ```bash
  cd apps/backend && swag init -g cmd/api/main.go -o docs/swagger
  ```
- **All services in one place:** `/api-docs/` (nginx-only, i.e. behind `docker-compose.prod.yml`'s `proxy`) — a single Swagger UI page with a spec switcher covering the backend plus the three internal Python services (parser, report, ML). Their `POST` endpoints aren't callable from there ("Try it out" targets an internal Docker hostname) — it's for browsing the internal contract, not calling it.

### Key endpoints (`/api/v1`)

| Method | Path                       | Auth | Description                                                       |
| ------ | -------------------------- | ---- | ----------------------------------------------------------------- |
| POST   | `/auth/register`           | —    | Register a user                                                   |
| POST   | `/auth/login`              | —    | Login (httpOnly JWT cookie; `remember_me` issues a refresh token) |
| POST   | `/auth/refresh`            | —    | Rotate refresh token → new access token                           |
| POST   | `/auth/logout`             | —    | Logout, revokes refresh token                                     |
| GET    | `/auth/me`                 | JWT  | Current user + profile                                            |
| GET    | `/entries`                 | JWT  | List measurements (admin: all, operator: own)                     |
| POST   | `/upload`                  | JWT  | Upload a measurement file (CSV/XML/XLSX)                          |
| DELETE | `/delete/:id`              | JWT  | Delete a measurement                                              |
| GET    | `/table/:id`, `/plots/:id` | JWT  | Table / time-series view                                          |
| GET    | `/report/:id`              | JWT  | Generate a PDF report (proxies the report service)                |
| GET    | `/features/:id`            | JWT  | Sensor curve features (proxies the ML service)                    |

The backend is the only service with DB access; parser/report/ML are stateless and called internally over HTTP with an `X-API-Key`.

---

## Database Migrations

```bash
task db:migrate-up                          # apply
task db:migrate-down                        # roll back last
task db:migrate-create seq=your_migration_name
```

---

## Testing

```bash
task backend:test
task frontend:test
task ml:test
cd apps/parser && uv run pytest    # apps/report: same, via its own venv/uv env
```

For manual API checks, use the Swagger UI (`/swagger/index.html`) or `curl` against `/api/v1/*` directly.

---

## Git Workflow

Direct pushes to `dev`/`main` are blocked — all changes go through PRs.

- `dev` — main development branch (default target)
- `main` — release branch
- Branches: `feature/...`, `bugfix/...`, `refactor/...`, created from latest `dev`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/), enforced by a linter
- PRs: target `dev`, require 1 Code Owner approval, merged via **Squash and Merge**
- Hotfixes: branch from `main`, open PRs to both `main` and `dev`

---

## Project Structure

```
enose-core/
├── apps/
│   ├── backend/            # Go API server (sole orchestrator + DB owner)
│   │   ├── cmd/api/        # Entrypoint
│   │   ├── internal/       # config, database, handlers, middleware, models,
│   │   │                   # repository, services, server (router)
│   │   ├── database/migrations/
│   │   └── docs/swagger/   # Auto-generated
│   ├── frontend/           # React Router v7 app (app/routes, app/components)
│   ├── parser/             # FastAPI: CSV/XML/XLSX → normalized measurement
│   ├── report/             # FastAPI: measurement → PDF (charts, features, ReportLab)
│   └── ml/                 # FastAPI: sensor curves → features
├── infra/
│   ├── nginx/              # Reverse proxy + combined /api-docs page (prod)
│   ├── grafana/            # Dashboards provisioning
│   ├── victoriametrics/    # Metrics scrape config
│   ├── ansible/            # VM provisioning
│   └── pgadmin/
├── docker-compose.yml            # Shared base
├── docker-compose.override.yml   # Dev-only (auto-merged, build+bind mounts)
├── docker-compose.prod.yml       # Prod-only (pinned images, monitoring, proxy)
└── Taskfile.yaml
```

---

## Troubleshooting

**`connection refused` when the backend calls parser/report/ml:** the backend caches env vars at container creation. After editing `.env`, `docker compose restart` is not enough — recreate the container:

```bash
docker compose up -d --force-recreate backend
```

**Port already in use:** change the port in root `.env` (e.g. `BACKEND_PORT=8081`), then `docker compose down && docker compose up --build`.

**Database connection failed:**

```bash
docker exec -i enose-postgres psql -U postgres -d enose -c "SELECT 1"
```
