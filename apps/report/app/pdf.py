from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.charts import ChartGenerator
from app.schemas import ReportRequest


class PDFGenerator:
    PAGE_WIDTH = 6.5 * inch

    def __init__(self):
        font_path = Path(__file__).parent / "fonts" / "DejaVuSans.ttf"
        pdfmetrics.registerFont(TTFont("DejaVu", str(font_path)))

        self.styles = self._create_styles()
        self.chart_generator = ChartGenerator()

    def generate(self, report: ReportRequest) -> bytes:
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            title=report.header.name,
            author="eNose Report Service",
        )

        story = []

        self._build_header(story, report)
        self._build_chart(story, report)
        self._build_feature_table(story, report)

        if report.interpretation:
            self._build_interpretation(story, report)

        doc.build(story)

        pdf = buffer.getvalue()
        buffer.close()

        return pdf

    def _build_header(self, story, report: ReportRequest):
        story.append(
            Paragraph(
                "Measurement Report",
                self.styles["ReportTitle"],
            )
        )

        story.append(
            HRFlowable(
                width="100%",
                thickness=1,
                color=colors.grey,
            )
        )

        story.append(Spacer(1, 0.3 * inch))

        story.append(
            Paragraph(
                "Measurement information",
                self.styles["Section"],
            )
        )

        header = report.header

        story.append(Paragraph(f"<b>Name:</b> {header.name}", self.styles["Body"]))

        story.append(Paragraph(f"<b>Device:</b> {header.device}", self.styles["Body"]))

        story.append(Paragraph(f"<b>Object:</b> {header.object}", self.styles["Body"]))

        story.append(
            Paragraph(
                f"<b>Date:</b> {header.date.strftime('%Y-%m-%d %H:%M:%S')}",
                self.styles["Body"],
            )
        )

        story.append(Spacer(1, 0.2 * inch))

    def _build_chart(self, story, report: ReportRequest):
        story.append(
            Paragraph(
                "Sensor response",
                self.styles["Section"],
            )
        )

        chart = self.chart_generator.generate(report)

        reader = ImageReader(BytesIO(chart))
        width, height = reader.getSize()

        scale = self.PAGE_WIDTH / width

        story.append(
            Image(
                BytesIO(chart),
                width=width * scale,
                height=height * scale,
            )
        )

        story.append(Spacer(1, 0.3 * inch))

    def _build_feature_table(self, story, report: ReportRequest):
        story.append(
            Paragraph(
                "Sensor features",
                self.styles["Section"],
            )
        )

        feature_names = []

        for sensor in report.sensors:
            for feature in sensor.features:
                if feature not in feature_names:
                    feature_names.append(feature)

        table_data = [["Sensor", *feature_names]]

        for sensor in report.sensors:
            row = [sensor.name]

            for feature in feature_names:
                value = sensor.features.get(feature)

                if value is None:
                    row.append("-")
                else:
                    row.append(f"{value:.3f}")

            table_data.append(row)

        table = Table(table_data)

        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.whitesmoke),
                ]
            )
        )

        story.append(table)

        story.append(Spacer(1, 0.3 * inch))

    def _build_interpretation(self, story, report: ReportRequest):
        story.append(
            Paragraph(
                "Interpretation",
                self.styles["Section"],
            )
        )

        story.append(
            Paragraph(
                report.interpretation.text,
                self.styles["Body"],
            )
        )

    def _create_styles(self):
        styles = getSampleStyleSheet()

        styles.add(
            ParagraphStyle(
                name="ReportTitle",
                parent=styles["Title"],
                fontName="DejaVu",
                fontSize=24,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#1f2937"),
                spaceAfter=24,
            )
        )

        styles.add(
            ParagraphStyle(
                name="Section",
                parent=styles["Heading2"],
                fontName="DejaVu",
                fontSize=16,
                textColor=colors.HexColor("#2563eb"),
                spaceBefore=12,
                spaceAfter=8,
            )
        )

        styles.add(
            ParagraphStyle(
                name="Body",
                parent=styles["BodyText"],
                fontName="DejaVu",
                fontSize=11,
                leading=16,
            )
        )

        return styles
