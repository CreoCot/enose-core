from app.areas import max_diagram_values, selected_deltas
from app.charts import ChartGenerator
from app.features import calculate_features
from app.tests.fixtures.report import create_masked_report, create_report


def test_generate_chart():
    report = create_report()

    generator = ChartGenerator()
    chart = generator.generate(report)

    assert isinstance(chart, bytes)
    assert chart.startswith(b"\x89PNG")
    assert len(chart) > 1000


def test_generate_radar_chart():
    report = create_report()

    chart = ChartGenerator().generate_radar(report)

    assert isinstance(chart, bytes)
    assert chart.startswith(b"\x89PNG")
    assert len(chart) > 1000


def test_generate_radar_with_mask():
    chart = ChartGenerator().generate_radar(create_masked_report())

    assert chart[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(chart) > 1000


def test_generate_radar_without_mask_matches_feature_max_abs():
    """Без маски радиусы радара не изменились: max|F0-v| == max|v-F0|."""
    report = create_report()
    _, deltas = selected_deltas(report)
    from_areas = max_diagram_values(deltas)
    from_features = [
        calculate_features(report.timestamps, sensor.initial, sensor.values).get(
            "max_abs", 0.0
        )
        for sensor in report.sensors
    ]

    assert len(from_areas) == len(from_features)
    for a, b in zip(from_areas, from_features):
        assert abs(a - b) < 1e-9
