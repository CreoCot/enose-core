from __future__ import annotations
from datetime import datetime
from defusedxml import ElementTree as DET

# ИЗМЕНЕНО: Локальные импорты
from apps.parser.app.parsers.common import finalize
from apps.parser.app.schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor


def _text(node, tag: str) -> str | None:
    el = node.find(tag)
    if el is None or el.text is None:
        return None
    return el.text.strip()


def parse_xml(content: bytes) -> ParsedMeasurement:
    text_content = content.decode("utf-8-sig", errors="ignore")
    measure_idx = text_content.find("<measure>")
    if measure_idx != -1:
        text_content = text_content[measure_idx:]

    clean_content = text_content.encode("utf-8")

    try:
        root = DET.fromstring(clean_content)
    except Exception as exc:
        raise ValueError(f"Некорректный XML: {exc}") from exc

    if root.tag != "measure":
        raise ValueError(f"Ожидался корневой элемент <measure>, получен <{root.tag}>")

    name = _text(root, "name") or "Без названия"
    description = _text(root, "description")

    start_str = _text(root, "start")
    if not start_str:
        raise ValueError("В XML отсутствует тег <start>")

    try:
        start_time = datetime.strptime(start_str, "%d.%m.%Y %H:%M:%S")
    except ValueError as e:
        raise ValueError(f"Некорректный формат времени <start>: {start_str}") from e

    device_serial = "MAG8-LEGACY"
    device_type_code = "MAG8"
    interval_ms = 1000
    default_unit = "Hz"

    sensors: list[ParsedSensor] = []
    data_points: list[ParsedDataPoint] = []

    sensor_nodes = root.findall("sensor")
    if not sensor_nodes:
        raise ValueError("В XML отсутствует блок <sensor>")

    for position, sensor_el in enumerate(sensor_nodes, start=1):
        label = sensor_el.attrib.get("sid", f"S{position}")
        sensors.append(ParsedSensor(position=position, label=label, unit=default_unit))

        for point_el in sensor_el.findall("point"):
            time_str = point_el.attrib.get("time")
            val_str = point_el.attrib.get("value")

            if time_str is None or val_str is None:
                continue

            try:
                t = float(time_str.replace(",", "."))
                v = float(val_str.replace(",", "."))
            except ValueError:
                continue

            data_points.append(
                ParsedDataPoint(
                    time_offset_s=t,
                    sensor_position=position,
                    value=v,
                )
            )

    parsed = ParsedMeasurement(
        device_serial=device_serial,
        device_type_code=device_type_code,
        measurement_name=name,
        measurement_object=name,
        start_time=start_time,
        interval_ms=interval_ms,
        description=description,
        sensors=sensors,
        data_points=data_points,
    )

    return finalize(parsed)
