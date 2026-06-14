"""
Заполняет справочники device_types и coatings базовыми значениями.
Запускать после init_db.py.

    python scripts/seed_lookups.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from shared import models  # noqa: E402
from shared.database import SessionLocal  # noqa: E402

DEVICE_TYPES = [
    ("MAG8", "МАГ-8", "8-канальный пьезосенсорный электронный нос"),
    ("BIOSCAN", "BioScan", "Биосенсорная система"),
    ("NANOVESICLE", "NanoVesicle", "Анализатор на основе нановезикул"),
]

COATINGS = [
    ("Carbowax 20M", "Полиэтиленгликоль 20000"),
    ("PEG-2000", "Полиэтиленгликоль 2000"),
    ("Apiezon L", "Углеводородная вакуумная смазка"),
    ("Triton X-100", "Неионогенный сурфактант"),
]


def main() -> None:
    db = SessionLocal()
    try:
        for code, name, description in DEVICE_TYPES:
            exists = db.scalar(select(models.DeviceType).where(models.DeviceType.code == code))
            if not exists:
                db.add(models.DeviceType(code=code, name=name, description=description))

        for name, description in COATINGS:
            exists = db.scalar(select(models.Coating).where(models.Coating.name == name))
            if not exists:
                db.add(models.Coating(name=name, description=description))

        db.commit()
        print("Справочники заполнены.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
