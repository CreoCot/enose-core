from __future__ import annotations
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
import pandas as pd


def _to_float(s: str) -> float:
    return float(s.strip().replace(",", "."))


def load_long(path) -> pd.DataFrame:
    txt = Path(path).read_text(encoding="utf-8-sig").lstrip("\ufeff")
    root = ET.fromstring(txt)
    name = root.findtext("name", default="")
    rows = []
    for sensor in root.findall("sensor"):
        sid = sensor.get("sid", "")
        init = _to_float(sensor.get("initial", "0"))
        for p in sensor.findall("point"):
            t = _to_float(p.get("time", "0"))
            v = _to_float(p.get("value", "0"))
            rows.append({"timestamp": t, "sensor_id": sid, "delta": v - init})
    df = pd.DataFrame(rows)
    df["name"] = name
    return df


def curve_features(times: np.ndarray, delta: np.ndarray) -> dict:
    m = times >= 0
    t, d = times[m], delta[m]
    if len(d) == 0:
        return {}
    i_max = int(np.argmax(np.abs(d)))
    auc = float(np.trapezoid(d, t) if hasattr(np, "trapezoid") else np.trapz(d, t))
    end_val = float(d[-1])
    max_val = float(d[i_max])
    n0 = max(2, len(d) // 10)
    slope0 = float((d[n0 - 1] - d[0]) / (t[n0 - 1] - t[0] + 1e-9))
    return {
        "max_abs": float(np.max(np.abs(d))),
        "max_signed": max_val,
        "time_to_max": float(t[i_max]),
        "end_value": end_val,
        "auc": auc,
        "slope_init": slope0,
        "drop_from_max": float(max_val - end_val),
        "noise_std": float(np.std(np.diff(d))),
    }


def measurement_features(path) -> dict:
    df = load_long(path)
    feats = {"name": df["name"].iloc[0], "file": Path(path).stem}
    for sid, g in df.groupby("sensor_id"):
        g = g.sort_values("timestamp")
        cf = curve_features(g["timestamp"].to_numpy(), g["delta"].to_numpy())
        for k, v in cf.items():
            feats[f"{sid}_{k}"] = v
    return feats


def build_feature_table(folder) -> pd.DataFrame:
    rows = [measurement_features(p) for p in sorted(Path(folder).glob("*.XML"))]
    return pd.DataFrame(rows)
