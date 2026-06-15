from pathlib import Path
from typing import Union
import xml.etree.ElementTree as ET
import pandas as pd

__all__ = ["load_measurement", "parse_measurement_xml"]


def _to_float(raw: str) -> float:
    return float(raw.strip().replace(",", "."))


def parse_measurement_xml(xml_text: str) -> pd.DataFrame:
    xml_text = xml_text.lstrip("\ufeff")
    root = ET.fromstring(xml_text)

    name = root.findtext("name", default="")
    start = root.findtext("start", default="")
    length_raw = root.findtext("length", default="")
    length = int(length_raw) if length_raw.strip().isdigit() else None
    ismeasured = root.findtext("ismeasured", default="").strip().lower() == "true"

    rows = []
    for sensor in root.findall("sensor"):
        sensor_id = sensor.get("sid", "")
        initial = _to_float(sensor.get("initial", "0"))
        for point in sensor.findall("point"):
            freq = _to_float(point.get("value", "0"))
            rows.append(
                {
                    "timestamp": _to_float(point.get("time", "0")),
                    "sensor_id": sensor_id,
                    "frequency": freq,
                    "delta": freq - initial,
                }
            )

    df = pd.DataFrame(rows, columns=["timestamp", "sensor_id", "frequency", "delta"])
    df["name"] = name
    df["start"] = start
    df["length"] = length
    df["ismeasured"] = ismeasured
    return df


def load_measurement(path: Union[str, Path]) -> pd.DataFrame:
    path = Path(path)
    xml_text = path.read_text(encoding="utf-8-sig")
    return parse_measurement_xml(xml_text)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 2:
        print("usage: python data_loader.py <measurement.xml>")
        raise SystemExit(1)

    frame = load_measurement(sys.argv[1])
    print(
        f"Loaded '{frame['name'].iloc[0]}': "
        f"{frame['sensor_id'].nunique()} sensors, {len(frame)} points"
    )
    print(frame.head())
