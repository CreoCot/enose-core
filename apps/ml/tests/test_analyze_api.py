import json
import os

os.environ.setdefault("ML_API_KEY", "test-key")

from fastapi.testclient import TestClient
from app.main import app, ML_API_KEY

client = TestClient(app)
HEADERS = {"X-API-Key": ML_API_KEY}


def _rising_series(sensor_id: int = 1, n: int = 50) -> dict:
    points = [{"t": float(i), "value": float(i) * sensor_id} for i in range(n)]
    return {
        "sensor_id": sensor_id,
        "position": sensor_id,
        "label": f"S{sensor_id}",
        "points": points,
    }


def _request_body(series: list[dict]) -> dict:
    return {
        "measurement": {"id": 1, "name": "test", "interval_ms": 1000},
        "series": series,
        "metadata": {},
    }


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "ml"}


def test_analyze_requires_api_key():
    r = client.post("/analyze", json=_request_body([_rising_series()]))
    assert r.status_code == 401


def test_analyze_happy_path():
    body = _request_body([_rising_series(1), _rising_series(2)])
    r = client.post("/analyze", json=body, headers=HEADERS)
    assert r.status_code == 200

    data = r.json()
    assert "features" in data and "computed_at" in data

    names_sensor_1 = {f["name"] for f in data["features"] if f["sensor_id"] == 1}
    expected = {
        "max_abs",
        "max_signed",
        "time_to_max",
        "end_value",
        "auc",
        "slope_init",
        "drop_from_max",
        "noise_std",
    }
    assert expected <= names_sensor_1

    sensor_ids = {f["sensor_id"] for f in data["features"]}
    assert sensor_ids == {1, 2}


def test_analyze_stronger_sensor_has_larger_max_abs():
    body = _request_body([_rising_series(1), _rising_series(3)])
    r = client.post("/analyze", json=body, headers=HEADERS)
    data = r.json()

    def max_abs_for(sid):
        return next(
            f["value"]
            for f in data["features"]
            if f["sensor_id"] == sid and f["name"] == "max_abs"
        )

    assert max_abs_for(3) > max_abs_for(1)


def test_analyze_empty_series_returns_422():
    r = client.post("/analyze", json=_request_body([]), headers=HEADERS)
    assert r.status_code == 422


def test_analyze_empty_points_returns_422():
    body = _request_body([{"sensor_id": 1, "points": []}])
    r = client.post("/analyze", json=body, headers=HEADERS)
    assert r.status_code == 422


def _post_raw(body: dict):
    raw = json.dumps(body, allow_nan=True)
    return client.post(
        "/analyze",
        content=raw,
        headers={**HEADERS, "Content-Type": "application/json"},
    )


def test_analyze_nan_value_returns_422():
    body = _request_body(
        [{"sensor_id": 1, "points": [{"t": 0.0, "value": float("nan")}]}]
    )
    r = _post_raw(body)
    assert r.status_code == 422


def test_analyze_infinite_value_returns_422():
    body = _request_body(
        [{"sensor_id": 1, "points": [{"t": 0.0, "value": float("inf")}]}]
    )
    r = _post_raw(body)
    assert r.status_code == 422


def test_analyze_unsorted_time_returns_422():
    body = _request_body(
        [
            {
                "sensor_id": 1,
                "points": [{"t": 1.0, "value": 0.0}, {"t": 0.0, "value": 1.0}],
            }
        ]
    )
    r = client.post("/analyze", json=body, headers=HEADERS)
    assert r.status_code == 422


def test_analyze_never_returns_500_on_bad_input():
    bad_bodies = [
        _request_body([]),
        _request_body([{"sensor_id": 1, "points": []}]),
    ]
    for body in bad_bodies:
        r = client.post("/analyze", json=body, headers=HEADERS)
        assert r.status_code == 422
        assert r.status_code != 500

    nan_body = _request_body(
        [{"sensor_id": 1, "points": [{"t": 0.0, "value": float("nan")}]}]
    )
    r = _post_raw(nan_body)
    assert r.status_code == 422
    assert r.status_code != 500
