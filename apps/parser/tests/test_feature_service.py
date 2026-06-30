from __future__ import annotations

import time

from app.feature_service import extract_features
from app.schemas import ParsedDataPoint, ParsedMeasurement, ParsedSensor


def _measurement(n_sensors: int = 8, n_points: int = 300) -> ParsedMeasurement:
    sensors = [
        ParsedSensor(position=p, label=f"SID000{p}", unit="Hz")
        for p in range(1, n_sensors + 1)
    ]
    points = []
    for p in range(1, n_sensors + 1):
        base = 10_000_000 + p
        points.append(
            ParsedDataPoint(time_offset_s=-1, sensor_position=p, value=float(base))
        )
        for i in range(n_points):
            points.append(
                ParsedDataPoint(
                    time_offset_s=float(i),
                    sensor_position=p,
                    value=float(base + (p * i) / n_points),
                )
            )
    return ParsedMeasurement(
        device_serial="TEST",
        device_type_code="MAG8",
        measurement_name="synthetic",
        measurement_object="synthetic",
        start_time="2025-01-01T00:00:00",
        interval_ms=1000,
        description=None,
        sensors=sensors,
        data_points=points,
    )


def test_one_feature_row_per_sensor():
    m = _measurement(n_sensors=8)
    feats = extract_features(m)
    assert len(feats) == 8
    assert {f.sensor_position for f in feats} == set(range(1, 9))


def test_expected_feature_fields():
    feats = extract_features(_measurement())
    f = feats[0]
    for field in (
        "sensor_position",
        "max_abs",
        "max_signed",
        "time_to_max",
        "end_value",
        "auc",
        "slope_init",
        "drop_from_max",
        "noise_std",
    ):
        assert hasattr(f, field)


def test_rising_curve_peaks_at_end():
    feats = extract_features(_measurement(n_sensors=3, n_points=100))
    for f in feats:
        assert abs(f.max_signed - f.end_value) < 1e-6
        assert f.drop_from_max == 0.0


def test_stronger_sensor_has_larger_deflection():
    feats = {f.sensor_position: f for f in extract_features(_measurement(n_sensors=4))}
    assert feats[4].max_abs > feats[1].max_abs


def test_performance_under_500ms():
    m = _measurement(n_sensors=8, n_points=300)
    t0 = time.perf_counter()
    extract_features(m)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < 500, f"feature extraction took {elapsed_ms:.1f}ms (limit 500ms)"


def test_response_time_present_and_ordered():
    feats = extract_features(_measurement(n_sensors=3, n_points=100))
    for f in feats:
        assert f.response_time <= f.time_to_max + 1e-6
        assert f.response_time >= 0


def test_average_baseline_uses_pre_points():
    sensors = [ParsedSensor(position=1, label="S1", unit="Hz")]
    pts = [
        ParsedDataPoint(time_offset_s=-3, sensor_position=1, value=100.0),
        ParsedDataPoint(time_offset_s=-2, sensor_position=1, value=102.0),
        ParsedDataPoint(time_offset_s=-1, sensor_position=1, value=98.0),
    ]
    for i in range(50):
        pts.append(
            ParsedDataPoint(time_offset_s=float(i), sensor_position=1, value=100.0 + i)
        )
    m = ParsedMeasurement(
        device_serial="T",
        device_type_code="MAG8",
        measurement_name="x",
        measurement_object="x",
        start_time="2025-01-01T00:00:00",
        interval_ms=1000,
        description=None,
        sensors=sensors,
        data_points=pts,
    )
    f = extract_features(m)[0]
    assert abs(f.end_value - 49.0) < 1.0
