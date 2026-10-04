"""Areas of the MAG-soft kinetic-fingerprint diagrams.

ΔF here uses the LEGACY sign: ``ΔF(t) = F0 - F(t)``, the same convention as
``apps/frontend/app/lib/utils.ts`` (``buildDeltaModel``) and the original
MAG-soft code.  Note that ``app/features.py`` and ``app/charts.py`` use the
opposite sign (``F(t) - F0``): for ``|ΔF|`` the two agree, but for the signed
time diagram they do not, so do not mix the two modules.

The formulas mirror ``apps/frontend/app/lib/masks.ts``.  Keep them numerically
identical to it: no numpy, no ``math.fsum``, and the ``sin(2π/N)/2`` factor
stays inside the accumulation loop's expression, so both languages round the
same way.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Sequence

from app.schemas import ReportRequest

AreaMode = Literal["abs", "signed"]


def radar_area(values: Sequence[float]) -> float:
    """Σ aᵢ·aᵢ₊₁·sin(2π/N)/2 around the full ring; fewer than 3 axes → 0.0.

    ``values`` must already be measured from the axis minimum.
    """
    n = len(values)
    if n < 3:
        return 0.0
    s = math.sin(2 * math.pi / n) / 2
    area = 0.0
    for i in range(n):
        area += values[i] * values[(i + 1) % n] * s
    return area


def axis_min_for(values: Sequence[float], mode: AreaMode) -> float:
    """Default radial-axis minimum (``AxeMinVal`` in the legacy code)."""
    if mode == "abs" or not values:
        return 0.0
    return min(values)


def fingerprint_radii(
    values: Sequence[float], mode: AreaMode, axis_min: float
) -> list[float]:
    """Axis radii measured from ``axis_min``.

    ``abs`` takes |ΔF| and clamps at zero, ``signed`` keeps the sign so that
    negative lobes shrink the radius instead of growing it.
    """
    if mode == "abs":
        return [max(0.0, abs(v) - axis_min) for v in values]
    return [v - axis_min for v in values]


def selected_deltas(report: ReportRequest) -> tuple[list[float], list[list[float]]]:
    """``(times, deltas[sensor][k])`` with the legacy sign.

    With a mask, only the sampled positions are used; without one, every
    sample at ``t >= 0`` is used, which is MAG-soft's no-mask behaviour.
    """
    mask = report.mask
    if mask is not None:
        positions = [
            (t, i)
            for t, i in zip(mask.points, mask.indices)
            if 0 <= i < len(report.timestamps)
        ]
    else:
        positions = [(t, i) for i, t in enumerate(report.timestamps) if t >= 0]

    times = [t for t, _ in positions]
    deltas = [
        [
            sensor.initial - sensor.values[i]
            for _, i in positions
            if i < len(sensor.values)
        ]
        for sensor in report.sensors
    ]
    return times, deltas


def max_diagram_values(deltas: Sequence[Sequence[float]]) -> list[float]:
    """max |ΔF| per sensor — radii of the «диаграмма максимумов»."""
    return [max((abs(v) for v in d), default=0.0) for d in deltas]


def time_diagram_values(deltas: Sequence[Sequence[float]]) -> list[float]:
    """Radii of the «временная диаграмма», time-major.

    Axis ``j`` is (time ``j // sensor_count``, sensor ``j % sensor_count``),
    matching the legacy ``Math.DivRem(j, DivMidGridAxes, out sensorIdx)``.
    """
    sensor_count = len(deltas)
    if sensor_count == 0:
        return []
    point_count = min(len(d) for d in deltas)
    return [
        deltas[j % sensor_count][j // sensor_count]
        for j in range(point_count * sensor_count)
    ]


@dataclass(frozen=True)
class FingerprintAreas:
    max_diagram: float
    time_diagram: float
    max_axes: int
    time_axes: int
    sample_count: int
    mask_name: str | None


def fingerprint_areas(report: ReportRequest) -> FingerprintAreas:
    """Both areas at the PDF's non-interactive auto scale.

    The maximum diagram uses axis minimum 0 (the UI's default ``plotMin``);
    the time diagram uses the minimum over all its axes, as MAG-soft's
    auto-scale does.
    """
    times, deltas = selected_deltas(report)
    max_vals = max_diagram_values(deltas)
    time_vals = time_diagram_values(deltas)

    return FingerprintAreas(
        max_diagram=radar_area(fingerprint_radii(max_vals, "abs", 0.0)),
        time_diagram=radar_area(
            fingerprint_radii(time_vals, "signed", axis_min_for(time_vals, "signed"))
        ),
        max_axes=len(max_vals),
        time_axes=len(time_vals),
        sample_count=len(times),
        mask_name=report.mask.name if report.mask is not None else None,
    )
