from app.schemas import Interpretation
from app.pdf import PDFGenerator
from app.tests.fixtures.report import create_report


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
