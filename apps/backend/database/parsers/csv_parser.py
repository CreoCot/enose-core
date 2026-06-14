"""
Парсер CSV.

Ожидаемый формат файла (UTF-8):

    # device_serial: MAG8-0007
    # device_type: MAG8
    # name: Проба воздуха #14
    # object: Образец A
    # start_time: 2026-06-01T12:00:00
    # interval_ms: 1000
    # description: тестовый прогон
    time_s,S1,S2,S3,S4,S5,S6,S7,S8
    0.0,29999801,30001120,...
    1.0,29999795,30001118,...
    ...

Правила:
  - строки, начинающиеся с "#", — это метаданные "# ключ: значение"
    (регистр ключей не важен);
  - обязательные ключи: device_serial, device_type, name, start_time,
    interval_ms;
  - первая не-комментированная строка — заголовок: первая колонка —
    время в секундах от начала измерения (имя колонки не важно),
    остальные колонки — по одному сенсору каждая, имя колонки
    становится label сенсора, порядок колонок — его position
    (начиная с 1);
  - единица измерения всех сенсоров по умолчанию "Hz" (как FreqValue
    в legacy-схеме); чтобы задать другую — добавьте метаданные
    "# unit: <ед.изм.>".
"""
from __future__ import annotations

import csv
import io
from datetime import datetime

from apps.backend.database.parsers.common import finalize
from shared.schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor

REQUIRED_META = ("device_serial", "device_type", "name", "start_time", "interval_ms")


def parse_csv(content: bytes) -> ParsedMeasurement:
    text = content.decode("utf-8-sig")
    meta: dict[str, str] = {}
    data_lines: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            key_value = stripped.lstrip("#").strip()
            if ":" in key_value:
                key, value = key_value.split(":", 1)
                meta[key.strip().lower()] = value.strip()
        else:
            data_lines.append(line)

    missing = [k for k in REQUIRED_META if k not in meta]
    if missing:
        raise ValueError(f"В CSV отсутствуют обязательные метаданные: {', '.join(missing)}")

    if not data_lines:
        raise ValueError("В CSV нет строк с данными")

    unit = meta.get("unit", "Hz")

    reader = csv.reader(io.StringIO("\n".join(data_lines)))
    header = next(reader)
    sensor_labels = [h.strip() for h in header[1:]]
    if not sensor_labels:
        raise ValueError("В CSV не найдено ни одной колонки сенсоров")

    sensors = [
        ParsedSensor(position=i + 1, label=label, unit=unit)
        for i, label in enumerate(sensor_labels)
    ]

    data_points: list[ParsedDataPoint] = []
    for row_num, row in enumerate(reader, start=2):
        if not row or all(not c.strip() for c in row):
            continue
        if len(row) != len(header):
            raise ValueError(f"Строка {row_num}: ожидалось {len(header)} колонок, получено {len(row)}")
        time_offset_s = float(row[0])
        for i, raw_value in enumerate(row[1:]):
            data_points.append(
                ParsedDataPoint(
                    time_offset_s=time_offset_s,
                    sensor_position=i + 1,
                    value=float(raw_value),
                )
            )

    parsed = ParsedMeasurement(
        device_serial=meta["device_serial"],
        device_type_code=meta["device_type"].upper(),
        measurement_name=meta["name"],
        measurement_object=meta.get("object"),
        start_time=datetime.fromisoformat(meta["start_time"]),
        interval_ms=int(meta["interval_ms"]),
        description=meta.get("description"),
        sensors=sensors,
        data_points=data_points,
    )
    return finalize(parsed)
