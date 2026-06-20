from __future__ import annotations

import hashlib
import json

# ИЗМЕНЕНО: Локальный импорт
from apps.parser.app.schemas import ParsedMeasurement


def compute_group_key(
    device_serial: str,
    measurement_object: str | None,
    interval_ms: int,
    sensor_positions: list[int],
    description: str | None = None,
) -> str:
    signature = {
        "device_serial": device_serial,
        "measurement_object": (measurement_object or "").strip().lower(),
        "interval_ms": interval_ms,
        "sensor_positions": sorted(sensor_positions),
        "description": (description or "").strip(),
    }
    payload = json.dumps(signature, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def finalize(parsed: ParsedMeasurement) -> ParsedMeasurement:
    positions = [s.position for s in parsed.sensors]
    if len(positions) != len(set(positions)):
        raise ValueError("Дублирующиеся position в списке сенсоров")

    known = set(positions)
    for dp in parsed.data_points:
        if dp.sensor_position not in known:
            raise ValueError(
                f"Точка данных ссылается на неизвестный сенсор position={dp.sensor_position}"
            )

    if not parsed.data_points:
        raise ValueError("Файл не содержит данных измерения")

    return parsed