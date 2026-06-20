from __future__ import annotations

import io
from datetime import datetime
import openpyxl

# ИЗМЕНЕНО: Локальные импорты
from apps.parser.app.parsers.common import finalize
from apps.parser.app.schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor

REQUIRED_META = ("device_serial", "device_type", "name", "start_time", "interval_ms")


def _read_meta(ws) -> dict[str, str]:
    meta: dict[str, str] = {}
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None:
            continue
        key = str(row[0]).strip().lower()
        if key == "key":
            continue
        value = row[1] if len(row) > 1 else None
        if value is None:
            continue
        meta[key] = str(value).strip()
    return meta


def parse_xlsx(content: bytes) -> ParsedMeasurement:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:
        raise ValueError(f"Некорректный XLSX: {exc}") from exc

    if "Meta" not in wb.sheetnames:
        raise ValueError("В книге отсутствует лист 'Meta'")
    if "Data" not in wb.sheetnames:
        raise ValueError("В книге отсутствует лист 'Data'")

    meta = _read_meta(wb["Meta"])
    missing = [k for k in REQUIRED_META if k not in meta]
    if missing:
        raise ValueError(f"На листе 'Meta' отсутствуют обязательные поля: {', '.join(missing)}")

    unit = meta.get("unit", "Hz")
    data_ws = wb["Data"]
    
    rows = data_ws.iter_rows(values_only=True)
    try:
        header = next(rows)
    except StopIteration:
        raise ValueError("Лист 'Data' пуст")

    if header[0] is None:
        raise ValueError("Первая колонка листа 'Data' должна быть временем (заголовок не пуст)")

    sensor_labels = [str(h).strip() for h in header[1:] if h is not None]
    if not sensor_labels:
        raise ValueError("На листе 'Data' не найдено ни одной колонки сенсоров")

    sensors = [
        ParsedSensor(position=i + 1, label=label, unit=unit)
        for i, label in enumerate(sensor_labels)
    ]

    data_points: list[ParsedDataPoint] = []
    for row_num, row in enumerate(rows, start=2):
        if row[0] is None:
            continue
        time_offset_s = float(row[0])
        for i, raw_value in enumerate(row[1 : 1 + len(sensor_labels)]):
            if raw_value is None:
                raise ValueError(f"Строка {row_num}: пустое значение в колонке сенсора {i + 1}")
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
