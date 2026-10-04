from app.schemas import Interpretation
from app.pdf import PDFGenerator
from app.tests.fixtures.report import create_masked_report, create_report


def test_generate_pdf():
    report = create_report()

    generator = PDFGenerator()
    pdf = generator.generate(report)

    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 5000


def test_generate_pdf_with_interpretation_and_markup_characters():
    report = create_report().model_copy(
        update={"interpretation": Interpretation(text="Result < 5 & signal > 0")}
    )

    pdf = PDFGenerator().generate(report)

    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 5000


def test_generate_pdf_with_mask():
    pdf = PDFGenerator().generate(create_masked_report())

    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 5000


def test_area_rows_name_the_mask_and_axis_counts():
    report = create_masked_report()
    rows = dict(PDFGenerator()._area_rows(report))

    assert "MAXIMUM DIAGRAM AREA" in rows
    assert "TIME DIAGRAM AREA" in rows
    sensors = len(report.sensors)
    points = len(report.mask.points)
    assert rows["AXES (MAX / TIME)"] == f"{sensors} / {sensors * points}"
    assert rows["EVALUATED AT"] == f"mask «Базовая 60 с» · {points} points"


def test_area_rows_without_mask_say_all_samples():
    rows = dict(PDFGenerator()._area_rows(create_report()))

    assert rows["EVALUATED AT"].startswith("all samples ·")


def test_format_area_two_decimals():
    assert PDFGenerator._format_area(7.757054711032346) == "7.76"
    assert PDFGenerator._format_area(0.0) == "0.00"
