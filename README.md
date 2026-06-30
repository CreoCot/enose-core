# enose-core

Repository for the `enose-core` project — the core system for piezosensor data processing and analysis.

## Tech Stack

- **Backend:** Go 1.23+ (Gin, GORM, golang-migrate)
- **Frontend:** React 19 (Vite, TypeScript, Tailwind CSS)
- **ML:** Python 3.12+ (managed via `uv`)
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
> `${VAR}` substitution and for injecting variables into containers via
> `env_file:`. `apps/backend/.env` is only needed for running the backend
> outside Docker (`task backend:run`).

### 3. Run

Start all services (backend, frontend, postgres, pgadmin, migrations):

```bash
task dev:run
```

Or directly:

```bash
docker compose up --build
```

Services will be available at:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **Swagger UI:** http://localhost:8080/swagger/index.html
- **pgAdmin:** http://localhost:5050
- **PostgreSQL:** localhost:5432

---

## Local Development (without Docker)

### 1. System Requirements

Install the following on your local machine:

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
docker run --name enose-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=enose -p 5432:5432 -d postgres:15
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

---

## API Documentation

The backend automatically generates Swagger documentation from code annotations.

**Access Swagger UI:** http://localhost:8080/swagger/index.html

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
task backend:db:init
```

**Rollback all migrations (destructive):**

```bash
task backend:db:down
```

**Check current migration version:**

```bash
task backend:db:status
```

**Create a new migration:**

```bash
cd apps/backend
migrate create -ext sql -dir database/migrations -seq your_migration_name
```

---

## Testing

### Backend

Check backend health (public endpoint, no auth required):

```bash
curl http://localhost:8080/api/v1/health | jq
```

Run backend unit tests:

```bash
cd apps/backend
go test ./... -v
```

### Auth endpoints (via Taskfile)

Requires running backend (`task backend:run`) and `jq` installed.

```bash
# 1. Зарегистрировать admin и operator
task dev:auth:register
task dev:auth:register-user

# 2. Войти — кука сохранится в /tmp/enose-cookies.txt
task dev:auth:login        # admin
task dev:auth:login-user   # operator

# 3. Проверить текущего пользователя
task dev:auth:me

# 4. Проверить разграничение доступа к данным
task dev:auth:entries-admin  # видит все измерения
task dev:auth:entries-user   # видит только свои

# 5. Проверить, что без куки приходит 401
task dev:auth:no-cookie

# 6. Выйти
task dev:auth:logout
```

### Auth endpoints (вручную через curl)

Токен хранится в httpOnly cookie — `Secure` включается автоматически только в production, в dev работает по HTTP.

```bash
# Регистрация admin
curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123","role":"admin"}' | jq

# Вход — сохраняем куку в файл
curl -s -c /tmp/enose-cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' | jq

# Получить текущего пользователя
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/auth/me | jq

# Список измерений (admin видит все, operator — только свои)
curl -s -b /tmp/enose-cookies.txt \
  http://localhost:8080/api/v1/entries | jq

# Без куки → 401
curl -s http://localhost:8080/api/v1/entries | jq

# Выйти
curl -s -b /tmp/enose-cookies.txt -c /tmp/enose-cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/logout | jq
```

Альтернатива — через Swagger UI (поддерживает `Authorization: Bearer <token>`):
http://localhost:8080/swagger/index.html

### Frontend

Visit http://localhost:5173 and verify the application loads correctly.

Run frontend tests (if configured):

```bash
cd apps/frontend
npm test
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

## Core Project Structure

```
enose-core/
├── apps/
│   ├── backend/          # Go API server
│   │   ├── cmd/
│   │   │   └── api/      # Main API entry point
│   │   ├── internal/
│   │   │   ├── config/   # Configuration management
│   │   │   ├── database/ # Database connection
│   │   │   ├── handlers/ # HTTP handlers
│   │   │   ├── middleware/ # Gin middleware
│   │   │   └── server/   # Router setup
│   │   ├── database/
│   │   │   └── migrations/ # SQL migration files
│   │   └── docs/
│   │       └── swagger/  # Auto-generated Swagger docs
│   ├── frontend/         # React application
│   └── ml/               # Python ML service
├── docker-compose.yml    # Docker orchestration
├── Taskfile.yml          # Task automation
└── README.md
```

---

## Troubleshooting

### Port already in use

If port 8080 or 5173 is occupied, stop the conflicting service or change the port in `.env` files.

### Database connection failed

Ensure PostgreSQL is running and credentials in `apps/backend/.env` are correct. Check with:

```bash
docker exec -i enose-postgres psql -U postgres -d enose -c "SELECT 1"
```

### Swagger documentation not loading

Regenerate the docs:

```bash
cd apps/backend
swag init -g cmd/api/main.go -o docs/swagger
```

Then restart the backend.
