"""
Генерирует examples/sample.xlsx в формате, ожидаемом
shared/parsers/xlsx_parser.py.

    python examples/generate_sample_xlsx.py
"""
from pathlib import Path

import openpyxl

OUT_PATH = Path(__file__).parent / "sample.xlsx"

META = [
    ("key", "value"),
    ("device_serial", "NANOVES-001"),
    ("device_type", "NANOVESICLE"),
    ("name", "Проба воздуха №16"),
    ("object", "Этанол 96%"),
    ("start_time", "2026-06-10T11:00:00"),
    ("interval_ms", "2000"),
    ("description", "тестовый прогон, 3 точки, 3 сенсора"),
]

DATA = [
    ("time_s", "S1", "S2", "S3"),
    (0.0, 10500.0, 10510.2, 10498.7),
    (2.0, 10501.1, 10511.0, 10499.0),
    (4.0, 10502.4, 10511.8, 10499.6),
]


def main() -> None:
    wb = openpyxl.Workbook()

    meta_ws = wb.active
    meta_ws.title = "Meta"
    for row in META:
        meta_ws.append(row)

    data_ws = wb.create_sheet("Data")
    for row in DATA:
        data_ws.append(row)

    wb.save(OUT_PATH)
    print(f"Сохранено: {OUT_PATH}")


if __name__ == "__main__":
    main()
