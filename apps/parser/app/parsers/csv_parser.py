from __future__ import annotations

import csv
import io
from datetime import datetime

from .common import finalize
from ..schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor


def parse_csv(content: bytes) -> ParsedMeasurement:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("windows-1251")

    lines = text.splitlines()
    meta: dict[str, str] = {}
    idx = 0

    while idx < len(lines):
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue
        if line.startswith("Sensors;"):
            break
        if ";" in line:
            key, value = line.split(";", 1)
            meta[key.strip().lower()] = value.strip()
        idx += 1

    sensors_line = None
    units_line = None

    while idx < len(lines):
        line = lines[idx].strip()
        if line.startswith("Sensors;"):
            sensors_line = line
        elif line.startswith("Time;"):
            units_line = line
            idx += 1
            break
        idx += 1

    if not sensors_line:
        raise ValueError("В CSV не найдена строка с сенсорами ('Sensors;')")

    sensor_labels = [s.strip() for s in sensors_line.split(";")[1:]]
    if not sensor_labels:
        raise ValueError("В CSV не найдено ни одной колонки сенсоров")

    units = []
    if units_line:
        units = [u.strip() for u in units_line.split(";")[1:]]
    else:
        units = ["Hz"] * len(sensor_labels)

    sensors = []
    for i, (label, unit) in enumerate(zip(sensor_labels, units)):
        if unit == "?F":
            unit = "ΔF"
        sensors.append(ParsedSensor(position=i + 1, label=label, unit=unit))

    data_points: list[ParsedDataPoint] = []
    times: list[float] = []
    
    reader = csv.reader(lines[idx:], delimiter=";")
    for row_num, row in enumerate(reader, start=idx + 1):
        if not row or all(not c.strip() for c in row):
            continue
            
        try:
            time_offset_s = float(row[0].replace(",", "."))
            times.append(time_offset_s)
        except ValueError:
            continue
            
        for i, raw_value in enumerate(row[1:]):
            if not raw_value.strip():
                continue
            try:
                val = float(raw_value.replace(",", "."))
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
        raise ValueError("В CSV нет корректных строк с данными")

    interval_ms = 1000
    if len(times) >= 2:
        interval_ms = int(round(abs(times[1] - times[0]) * 1000))

    start_time_str = meta.get("start")
    start_time = datetime.now()
    if start_time_str:
        try:
            start_time = datetime.strptime(start_time_str, "%m/%d/%Y %I:%M:%S %p")
        except ValueError:
            pass

    parsed = ParsedMeasurement(
        device_serial=meta.get("device_serial", "UNKNOWN"),
        device_type_code=meta.get("device_type", "UNKNOWN"),
        measurement_name=meta.get("title", "Unknown"),
        measurement_object=meta.get("object"),
        start_time=start_time,
        interval_ms=interval_ms,
        description=f"Duration: {meta.get('duration', 'N/A')}s, Type: {meta.get('type', 'N/A')}",
        sensors=sensors,
        data_points=data_points,
    )
    
    return finalize(parsed)