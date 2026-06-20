"""
Общие утилиты для парсеров XML/CSV/XLSX.
"""
from __future__ import annotations

import hashlib
import json

from shared.schemas import ParsedMeasurement


def compute_group_key(
    device_serial: str,
    measurement_object: str | None,
    interval_ms: int,
    sensor_positions: list[int],
    description: str | None = None,
) -> str:
    """
    sha256 от "сигнатуры" измерения — всех существенных полей КРОМЕ
    start_time/id.

    Измерения с одинаковым group_key — это повторы одного и того же
    эксперимента (то же устройство, тот же объект, тот же набор
    сенсоров и интервал опроса), снятые в разное время. db_api
    автоматически объединяет такие измерения в один
    measurement_group для совместного анализа/усреднения.
    """
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
    """
    Финальная проверка консистентности после парсинга конкретного
    формата: каждая точка данных должна ссылаться на объявленный
    сенсор, позиции сенсоров не должны повторяться.
    """
    positions = [s.position for s in parsed.sensors]
    if len(positions) != len(set(positions)):
        raise ValueError("Дублирующиеся position в списке сенсоров")

    known = set(positions)
    for dp in parsed.data_points:
        if dp.sensor_position not in known:
            raise ValueError(
                f"Точка данных ссылается на неизвестный сенсор "
                f"position={dp.sensor_position}"
            )

    if not parsed.data_points:
        raise ValueError("Файл не содержит данных измерения")

    return parsed
