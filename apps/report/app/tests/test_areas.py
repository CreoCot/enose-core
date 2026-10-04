import math

from app.areas import (
    axis_min_for,
    fingerprint_areas,
    fingerprint_radii,
    max_diagram_values,
    radar_area,
    selected_deltas,
    time_diagram_values,
)
from app.schemas import Header, MaskSelection, ReportRequest, SensorSeries
from datetime import datetime


def canonical_report(with_mask: bool = False) -> ReportRequest:
    """Two sensors, a baseline row at t = -1 and two measured points.

    Legacy ΔF: sensor A [1, 2], sensor B [-1, 1]  →  time-major axes
    [1, -1, 2, 1]  →  axis min -1  →  radii [2, 0, 3, 2]  →  area 5.
    """
    return ReportRequest(
        header=Header(
            name="test", device="MAG-8", object="", date=datetime(2026, 1, 1)
        ),
        timestamps=[-1.0, 0.0, 1.0],
        sensors=[
            SensorSeries(
                id=1, name="SID0001", initial=100.0, values=[100.0, 99.0, 98.0]
            ),
            SensorSeries(
                id=2, name="SID0002", initial=200.0, values=[200.0, 201.0, 199.0]
            ),
        ],
        mask=MaskSelection(id=7, name="Базовая", points=[0.0, 1.0], indices=[1, 2])
        if with_mask
        else None,
    )


def test_radar_area_four_equal_axes():
    assert radar_area([1, 1, 1, 1]) == 2.0


def test_radar_area_six_axes_matches_closed_form():
    # Сверка с алгеброй — только с допуском: сумма по кругу накапливает
    # округление и отличается от замкнутой формулы в последнем бите.
    assert math.isclose(
        radar_area([2] * 6), 6 * 4 * math.sin(math.pi / 3) / 2, rel_tol=1e-12
    )


def test_radar_area_fewer_than_three_axes_is_zero():
    assert radar_area([1, 2]) == 0.0
    assert radar_area([5]) == 0.0
    assert radar_area([]) == 0.0


def test_radar_area_matches_frontend_golden():
    # Этот литерал продублирован в apps/frontend/app/lib/masks.test.ts —
    # менять только вместе, он и доказывает совпадение языков.
    assert radar_area([1.5, 2.25, 0.75, 3.0, 2.0]) == 7.757054711032346
    assert f"{radar_area([1.5, 2.25, 0.75, 3.0, 2.0]):.2f}" == "7.76"


def test_axis_min_for():
    assert axis_min_for([1, -1, 2, 1], "abs") == 0.0
    assert axis_min_for([1, -1, 2, 1], "signed") == -1
    assert axis_min_for([], "signed") == 0.0


def test_fingerprint_radii_modes():
    assert fingerprint_radii([1, -1, 2, 1], "abs", 0.0) == [1, 1, 2, 1]
    assert fingerprint_radii([3, -5, 2], "abs", 2.0) == [1, 3, 0]
    assert fingerprint_radii([1, -1, 2, 1], "signed", -1) == [2, 0, 3, 2]


def test_time_diagram_values_are_time_major():
    assert time_diagram_values([[1, 2], [-1, 1]]) == [1, -1, 2, 1]
    assert time_diagram_values([[1, 2, 3], [4]]) == [1, 4]
    assert time_diagram_values([]) == []


def test_time_diagram_area_subtracts_axis_minimum():
    values = time_diagram_values([[1, 2], [-1, 1]])
    radii = fingerprint_radii(values, "signed", axis_min_for(values, "signed"))
    assert radii == [2, 0, 3, 2]
    assert radar_area(radii) == 5.0


def test_max_diagram_values_use_absolute_delta():
    assert max_diagram_values([[1, -4, 2], [0, 0, 0], []]) == [4, 0, 0]


def test_selected_deltas_without_mask_drops_baseline_and_uses_legacy_sign():
    times, deltas = selected_deltas(canonical_report())
    assert times == [0.0, 1.0]
    # ΔF = initial - value, то есть падение частоты положительно
    assert deltas == [[1.0, 2.0], [-1.0, 1.0]]


def test_selected_deltas_uses_mask_indices():
    times, deltas = selected_deltas(canonical_report(with_mask=True))
    assert times == [0.0, 1.0]
    assert deltas == [[1.0, 2.0], [-1.0, 1.0]]


def test_selected_deltas_ignores_out_of_range_index():
    report = canonical_report(with_mask=True)
    report.mask.points = [0.0, 99.0]
    report.mask.indices = [1, 999]
    times, deltas = selected_deltas(report)
    assert times == [0.0]
    assert deltas == [[1.0], [-1.0]]


def test_fingerprint_areas_on_canonical_report():
    areas = fingerprint_areas(canonical_report(with_mask=True))
    assert areas.time_axes == 4
    assert areas.time_diagram == 5.0
    # два сенсора — меньше трёх осей, площадь диаграммы максимумов нулевая
    assert areas.max_axes == 2
    assert areas.max_diagram == 0.0
    assert areas.sample_count == 2
    assert areas.mask_name == "Базовая"


def test_fingerprint_areas_without_mask_has_no_mask_name():
    areas = fingerprint_areas(canonical_report())
    assert areas.mask_name is None
    assert areas.sample_count == 2
