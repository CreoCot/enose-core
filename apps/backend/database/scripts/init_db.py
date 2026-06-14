"""
Создаёт схему БД напрямую — Python-эквивалент sql/schema.sql.

    DATABASE_URL=postgresql+psycopg2://enose:enose@localhost:5432/enose \
        python scripts/init_db.py

(см. .env.example для DATABASE_URL по умолчанию)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from shared import models  # noqa: E402,F401  (регистрирует таблицы в Base.metadata)
from shared.database import Base, engine  # noqa: E402


def main() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()

    Base.metadata.create_all(bind=engine)
    print("Схема БД создана (или уже существовала).")


if __name__ == "__main__":
    main()
