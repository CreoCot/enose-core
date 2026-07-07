from app.charts import ChartGenerator
from app.tests.fixtures.report import create_report


def test_generate_chart():
    report = create_report()

    generator = ChartGenerator()
    chart = generator.generate(report)

    assert isinstance(chart, bytes)
    assert chart.startswith(b"\x89PNG")
    assert len(chart) > 1000
