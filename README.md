# enose-core

Репозиторий проекта `enose-core`.

## Стек

- **Backend:** Go 1.26.2 (Go Workspaces)
- **Frontend:** React 19 (Vite, TS, ESLint)
- **ML:** Python 3.13 (управление через `uv`)
- **Автоматизация:** Taskfile, pre-commit

---

## Start using Docker:

### 1. System requirements

- docker compose (>5.0.0)

### 2. Preparation

Copy all `.env.example` to `.env` files (Change some fields if needed)
Copy `.env.docker.example` to `.env.docker`
Install `task` to run services easily

### 3. Run

- To run all the services at once run:

```
task all:run
```

- Or use:

```
docker compose up --build
```

### 4. Testing

#### Backend

- Check heartbeat of backend api service:

```
curl http://localhost:8080/api/v1/health | jq
```

- Check table generation:

```
curl http://localhost:8080/api/v1/table | jq
```

#### Frontend

- Visit `localhost:5173`

#### Postgres

To check that migrations applied run:

```
docker exec -i enose-postgres psql -U postgres -d enose -c '\d'
```

Or visit PgAdmin4 on `localhost:5050`

## Старт без Docker

### 1. Системные требования

Установи на локальную машину перед началом работы:

- Go (1.26.3+)
- Node.js (v20+) и npm
- Python 3.13 и пакетный менеджер **[uv](https://docs.astral.sh/uv/)**
- **[Task](https://taskfile.dev/)** (раннер для запуска команд)
- PostgreSQL 14+

### 2. Клонирование и настройка

Склонируй проект и запусти подготовку окружения с помощью Task. Она установит нужные версии pre-commit хуков, Go-модули, npm-зависимости и виртуальное окружение Python:

```bash
git clone git@github.com:CreoCot/enose-core.git
cd enose-core

# Установка хуков и всех зависимостей (Go, Node, Python)
task setup
```

### 3. Backend: переменные окружения и база данных

Скопируй пример окружения и заполни значения под локальную PostgreSQL:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Минимальный локальный PostgreSQL через Docker:

```bash
docker run --name enose-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=enose -p 5432:5432 -d postgres:17
```

Запуск backend:

```bash
task backend:run
```

Проверка подключения к базе:

```bash
curl http://localhost:8080/api/v1/health
```

В ответе поле `database` должно быть `ok`. Для тестовой БД см. `apps/backend/.env.test.example`.

---

## Правила работы с Git

Прямые пуши в ветки `dev` и `main` **заблокированы**. Код вливается только через Pull Request.

### 1. Ветки

- **`dev`** — основная ветка разработки (дефолтная). Все фичи тащим сюда.
- **`main`** — релизная ветка. Обновляется редко.

### 2. Создание задачи

Ветки для фич создаем только от актуальной `dev`:

```bash
git checkout dev
git pull
git checkout -b <тип>/<название-задачи>
```

**Типы веток (строго строчными буквами через слэш):**

- `feature/` — новые фичи (например, `feature/login-page`)
- `bugfix/` — исправление багов в dev-окружении (например, `bugfix/api-cors`)
- `refactor/` — рефакторинг и оптимизация существующего кода

### 3. Коммиты

Используем формат **Conventional Commits**. Линтер не пропустит коммит с неверным названием. Пиши на английском, кратко и по делу:

- `feat: add email login support`
- `fix: resolve crash on null response`
- `refactor: simplify auth middleware`

### 4. Создание Pull Request

1. Пушишь свою локальную ветку: `git push origin feature/my-feature`.
2. Открываешь PR на GitHub. Целевая ветка по умолчанию — `dev`.
3. Для слияния требуется как минимум **1 одобрение (Approve)** от Code Owner (тимлид или девопс).
4. История сливается через **Squash and Merge** (все твои мелкие коммиты схлопнутся в один коммит в `dev`).

### 5. Экстренные исправления на проде (Hotfixes)

Если на проде (`main`) упал баг, а ветка `dev` ушла далеко вперед и нестабильна:

1. Создаем ветку от `main`: `git checkout main && git checkout -b hotfix/critical-bug`
2. Фиксим баг и открываем **два PR**: один в `main` (чтобы починить прод), второй в `dev` (чтобы фикс не потерялся при следующем релизе).
