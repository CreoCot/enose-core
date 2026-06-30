from __future__ import annotations

import numpy as np

from .schemas import ParsedMeasurement, SensorFeatures


def _curve_features(times: np.ndarray, values: np.ndarray) -> dict:
    order = np.argsort(times)
    t, v = times[order], values[order]

    baseline = float(v[0])
    d = v - baseline

    measured = t >= 0
    if measured.any():
        t, d = t[measured], d[measured]
    if len(d) == 0:
        return dict(
            max_abs=0.0,
            max_signed=0.0,
            time_to_max=0.0,
            end_value=0.0,
            auc=0.0,
            slope_init=0.0,
            drop_from_max=0.0,
            noise_std=0.0,
        )

    i_max = int(np.argmax(np.abs(d)))
    max_signed = float(d[i_max])
    end_value = float(d[-1])
    auc = float(np.trapezoid(d, t) if hasattr(np, "trapezoid") else np.trapz(d, t))

    n0 = max(2, len(d) // 10)
    dt = float(t[n0 - 1] - t[0]) or 1e-9
    slope_init = float((d[n0 - 1] - d[0]) / dt)

    return dict(
        max_abs=float(np.max(np.abs(d))),
        max_signed=max_signed,
        time_to_max=float(t[i_max]),
        end_value=end_value,
        auc=auc,
        slope_init=slope_init,
        drop_from_max=float(max_signed - end_value),
        noise_std=float(np.std(np.diff(d))) if len(d) > 1 else 0.0,
    )


def extract_features(parsed: ParsedMeasurement) -> list[SensorFeatures]:
    by_pos: dict[int, list] = {s.position: [] for s in parsed.sensors}
    for dp in parsed.data_points:
        by_pos.setdefault(dp.sensor_position, []).append(dp)

    out: list[SensorFeatures] = []
    for position in sorted(by_pos):
        pts = by_pos[position]
        if not pts:
            continue
        times = np.fromiter((p.time_offset_s for p in pts), dtype=float)
        values = np.fromiter((p.value for p in pts), dtype=float)
        feats = _curve_features(times, values)
        out.append(SensorFeatures(sensor_position=position, **feats))
    return out
