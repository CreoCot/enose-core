import json
from pathlib import Path

from app.schemas import (
    Header,
    ReportRequest,
    SensorSeries,
)


FIXTURES = Path(__file__).parent


def create_report() -> ReportRequest:
    with open(FIXTURES / "measurement.json", encoding="utf-8") as f:
        measurement = json.load(f)

    with open(FIXTURES / "metadata.json", encoding="utf-8") as f:
        metadata = json.load(f)[0]

    rows = measurement["data"]

    initials = rows[0][1:]
    data = rows[1:]

    timestamps = [row[0] for row in data]

    sensor_count = len(initials)

    sensors = []

    for sensor_idx in range(sensor_count):
        initial = initials[sensor_idx]

        values = [row[sensor_idx + 1] for row in data]

        sensors.append(
            SensorSeries(
                id=sensor_idx + 1,
                name=f"SID{sensor_idx + 1:04d}",
                initial=initial,
                values=values,
            )
        )

    return ReportRequest(
        header=Header(
            name=metadata["name"],
            device="eNose",
            object=metadata["name"],
            date=metadata["date"],
        ),
        timestamps=timestamps,
        sensors=sensors,
        interpretation=None,
    )
