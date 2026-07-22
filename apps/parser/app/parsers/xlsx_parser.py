from __future__ import annotations

import io
from datetime import datetime
import openpyxl

from .common import finalize
from ..schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor


def parse_xlsx(content: bytes) -> ParsedMeasurement:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:
        raise ValueError(f"Некорректный XLSX/XLS: {exc}") from exc

    ws = wb.active
    rows = ws.iter_rows(values_only=True)

    meta: dict[str, any] = {}
    sensors_row = None
    units_row = None

    for row in rows:
        if not row or all(c is None for c in row):
            continue
        
        first_cell = row[0]
        if isinstance(first_cell, str) and first_cell.strip().lower() == "sensors":
            sensors_row = row
            break
            
        if first_cell is not None:
            key = str(first_cell).strip().lower()
            val = row[1] if len(row) > 1 else None
            if val is not None:
                meta[key] = val

    if not sensors_row:
        raise ValueError("В файле не найдена строка с сенсорами ('Sensors')")

    for row in rows:
        if not row or all(c is None for c in row):
            continue
            
        first_cell = row[0]
        if isinstance(first_cell, str) and first_cell.strip().lower() == "time":
            units_row = row
            break

    sensor_labels = [str(c).strip() for c in sensors_row[1:] if c is not None]
    if not sensor_labels:
        raise ValueError("В файле не найдено ни одной колонки сенсоров")

    units = []
    if units_row:
        for c in units_row[1 : 1 + len(sensor_labels)]:
            unit_str = str(c).strip() if c is not None else "Hz"
            if unit_str in ("?F", "∆F"):
                unit_str = "ΔF"
            units.append(unit_str)
    else:
        units = ["Hz"] * len(sensor_labels)

    sensors = [
        ParsedSensor(position=i + 1, label=label, unit=unit)
        for i, (label, unit) in enumerate(zip(sensor_labels, units))
    ]

    data_points: list[ParsedDataPoint] = []
    times: list[float] = []

    for row_num, row in enumerate(rows, start=1):
        if not row or row[0] is None:
            continue
            
        try:
            time_offset_s = float(row[0])
            times.append(time_offset_s)
        except ValueError:
            continue
            
        for i, raw_value in enumerate(row[1 : 1 + len(sensor_labels)]):
            if raw_value is None or str(raw_value).strip() == "":
                continue
            try:
                val = float(raw_value)
                data_points.append(
                    ParsedDataPoint(
                        time_offset_s=time_offset_s,
                        sensor_position=i + 1,
                        value=val,
                    )
                )
            except ValueError:
                pass

    if not data_points:
        raise ValueError("В файле нет корректных строк с данными")

    interval_ms = 1000
    if len(times) >= 2:
        interval_ms = int(round(abs(times[1] - times[0]) * 1000))

    start_time = meta.get("start")
    if not isinstance(start_time, datetime):
        if isinstance(start_time, str):
            try:
                start_time = datetime.strptime(start_time, "%m/%d/%Y %I:%M:%S %p")
            except ValueError:
                try:
                    start_time = datetime.fromisoformat(start_time)
                except ValueError:
                    start_time = datetime.now()
        else:
            start_time = datetime.now()

    parsed = ParsedMeasurement(
        device_serial=str(meta.get("device_serial", "UNKNOWN")),
        device_type_code=str(meta.get("device_type", "UNKNOWN")),
        measurement_name=str(meta.get("title", "Unknown")),
        measurement_object=str(meta.get("object", "")),
        start_time=start_time,
        interval_ms=interval_ms,
        description=f"Duration: {meta.get('duration', 'N/A')}s, Type: {meta.get('type', 'N/A')}",
        sensors=sensors,
        data_points=data_points,
    )

    return finalize(parsed)