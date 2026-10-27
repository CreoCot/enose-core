import json
from pathlib import Path

from app.schemas import (
    Header,
    MaskSelection,
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


def create_masked_report(
    points: list[float] | None = None, name: str = "Базовая 60 с"
) -> ReportRequest:
    """create_report() с маской, разрешённой так же, как это делает бэкенд.

    В фикстуре время начинается с 0 (строки базовой частоты нет), поэтому
    индекс точки совпадает с floor(t).
    """
    report = create_report()
    points = [0.0, 10.0, 20.0, 60.0] if points is None else points
    kept = [(t, int(t)) for t in points if 0 <= int(t) < len(report.timestamps)]
    report.mask = MaskSelection(
        id=1,
        name=name,
        points=[t for t, _ in kept],
        indices=[i for _, i in kept],
    )
    return report
