from app.pdf import PDFGenerator
from app.tests.fixtures.report import create_report


def test_generate_pdf():
    report = create_report()

    generator = PDFGenerator()
    pdf = generator.generate(report)

    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 5000
