from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.charts import ChartGenerator
from app.features import calculate_features
from app.schemas import ReportRequest


class PDFGenerator:
    PAGE_WIDTH, PAGE_HEIGHT = A4
    MARGIN = 15 * mm
    CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

    NAVY = colors.HexColor("#0F172A")
    SLATE = colors.HexColor("#475569")
    MUTED = colors.HexColor("#64748B")
    LINE = colors.HexColor("#DCE4EE")
    SURFACE = colors.HexColor("#F5F8FC")
    BLUE = colors.HexColor("#2563EB")
    TEAL = colors.HexColor("#0F766E")
    TEAL_SOFT = colors.HexColor("#F0FDFA")
    WHITE = colors.white

    FEATURE_COLUMNS = (
        ("max_abs", "Peak |Δf|", "Hz"),
        ("max_signed", "Signed peak", "Hz"),
        ("time_to_max", "Time to peak", "s"),
        ("end_value", "Final Δf", "Hz"),
        ("auc", "AUC", "Hz·s"),
        ("slope_init", "Initial slope", "Hz/s"),
        ("drop_from_max", "Peak − final", "Hz"),
        ("noise_std", "Noise σ", "Hz"),
    )

    def __init__(self):
        font_path = Path(__file__).parent / "fonts" / "DejaVuSans.ttf"
        if "DejaVu" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("DejaVu", str(font_path)))

        self.styles = self._create_styles()
        self.chart_generator = ChartGenerator()

    def generate(self, report: ReportRequest) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=19 * mm,
            bottomMargin=17 * mm,
            title=report.header.name,
            author="eNose Report Service",
            subject="Sensor measurement report",
        )

        story = []
        self._build_header(story, report)
        self._build_chart(story, report)
        story.append(PageBreak())
        self._build_feature_table(story, report)

        if report.interpretation:
            self._build_interpretation(story, report)

        doc.build(story, onFirstPage=self._draw_page, onLaterPages=self._draw_page)
        pdf = buffer.getvalue()
        buffer.close()
        return pdf

    def _draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(self.NAVY)
        canvas.rect(
            0, self.PAGE_HEIGHT - 7 * mm, self.PAGE_WIDTH, 7 * mm, fill=1, stroke=0
        )
        canvas.setFillColor(self.BLUE)
        canvas.rect(0, self.PAGE_HEIGHT - 7 * mm, 32 * mm, 7 * mm, fill=1, stroke=0)

        canvas.setFont("DejaVu", 7.5)
        canvas.setFillColor(self.MUTED)
        canvas.drawString(self.MARGIN, 9 * mm, "eNOSE  /  SENSOR ANALYTICS")
        canvas.drawRightString(
            self.PAGE_WIDTH - self.MARGIN,
            9 * mm,
            f"MEASUREMENT REPORT  ·  {doc.page}",
        )
        canvas.setStrokeColor(self.LINE)
        canvas.setLineWidth(0.5)
        canvas.line(self.MARGIN, 13 * mm, self.PAGE_WIDTH - self.MARGIN, 13 * mm)
        canvas.restoreState()

    def _build_header(self, story, report: ReportRequest):
        header = report.header
        story.append(Paragraph("MEASUREMENT REPORT", self.styles["Eyebrow"]))
        story.append(Paragraph(escape(header.name), self.styles["ReportTitle"]))
        story.append(
            Paragraph(
                "Sensor response profile and calculated signal features",
                self.styles["Subtitle"],
            )
        )
        story.append(Spacer(1, 7 * mm))

        metadata = [
            [
                self._metadata_cell("DEVICE", header.device),
                self._metadata_cell("OBJECT", header.object),
            ],
            [
                self._metadata_cell("MEASUREMENT", header.name),
                self._metadata_cell(
                    "RECORDED AT", header.date.strftime("%d %b %Y  ·  %H:%M:%S")
                ),
            ],
        ]
        metadata_table = Table(
            metadata,
            colWidths=[self.CONTENT_WIDTH / 2] * 2,
            rowHeights=[18 * mm, 18 * mm],
        )
        metadata_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.SURFACE),
                    ("BOX", (0, 0), (-1, -1), 0.6, self.LINE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.6, self.LINE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(metadata_table)
        story.append(Spacer(1, 5 * mm))

        duration = self._duration(report.timestamps)
        summary = [
            self._summary_cell(str(len(report.sensors)), "SENSORS"),
            self._summary_cell(str(len(report.timestamps)), "SAMPLES"),
            self._summary_cell(duration, "DURATION"),
        ]
        summary_table = Table([summary], colWidths=[self.CONTENT_WIDTH / 3] * 3)
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.NAVY),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LINEAFTER", (0, 0), (-2, -1), 0.5, colors.HexColor("#334155")),
                ]
            )
        )
        story.append(summary_table)
        story.append(Spacer(1, 8 * mm))

    def _build_chart(self, story, report: ReportRequest):
        story.append(self._section_heading("01", "Sensor response"))
        story.append(
            Paragraph(
                "Frequency shift from each sensor baseline across the measurement window.",
                self.styles["SectionLead"],
            )
        )
        story.append(Spacer(1, 3 * mm))

        chart = self.chart_generator.generate(report)
        reader = ImageReader(BytesIO(chart))
        width, height = reader.getSize()
        display_width = self.CONTENT_WIDTH
        display_height = display_width * height / width

        chart_table = Table(
            [
                [
                    Image(
                        BytesIO(chart),
                        width=display_width - 8,
                        height=display_height - 4,
                    )
                ]
            ],
            colWidths=[self.CONTENT_WIDTH],
        )
        chart_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.WHITE),
                    ("BOX", (0, 0), (-1, -1), 0.7, self.LINE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(chart_table)

    def _build_feature_table(self, story, report: ReportRequest):
        intro = [
            self._section_heading("02", "Calculated features"),
            Paragraph(
                "Signal descriptors calculated from baseline-corrected values (Δf).",
                self.styles["SectionLead"],
            ),
            Spacer(1, 4 * mm),
        ]

        sensor_features = [
            calculate_features(report.timestamps, sensor.initial, sensor.values)
            for sensor in report.sensors
        ]

        headers = [Paragraph("SENSOR", self.styles["TableHeader"])]
        headers.extend(
            Paragraph(
                f"{label}<br/><font size='6'>{unit}</font>", self.styles["TableHeader"]
            )
            for _, label, unit in self.FEATURE_COLUMNS
        )
        table_data = [headers]

        for sensor, features in zip(report.sensors, sensor_features):
            row = [Paragraph(escape(sensor.name), self.styles["SensorName"])]
            for key, _, _ in self.FEATURE_COLUMNS:
                row.append(self._format_number(features.get(key)))
            table_data.append(row)

        if not report.sensors:
            table_data.append(
                [Paragraph("No sensor data", self.styles["TableCell"])] + ["—"] * 8
            )

        col_widths = [
            25 * mm,
            18 * mm,
            20 * mm,
            20 * mm,
            18 * mm,
            19 * mm,
            20 * mm,
            20 * mm,
            17 * mm,
        ]
        table = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        commands = [
            ("BACKGROUND", (0, 0), (-1, 0), self.NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), self.WHITE),
            ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
            ("FONTSIZE", (0, 1), (-1, -1), 7.2),
            ("TEXTCOLOR", (0, 1), (-1, -1), self.SLATE),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("TOPPADDING", (0, 1), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, -1), 0.45, self.LINE),
            ("BOX", (0, 0), (-1, -1), 0.6, self.LINE),
        ]
        for row_index in range(2, len(table_data), 2):
            commands.append(
                ("BACKGROUND", (0, row_index), (-1, row_index), self.SURFACE)
            )
        table.setStyle(TableStyle(commands))

        intro.append(table)
        intro.append(Spacer(1, 3 * mm))
        intro.append(
            Paragraph(
                "AUC is the signed area under the Δf curve. Noise σ is calculated from "
                "successive signal differences.",
                self.styles["Footnote"],
            )
        )
        story.append(KeepTogether(intro))

    def _build_interpretation(self, story, report: ReportRequest):
        story.append(Spacer(1, 9 * mm))
        content = [
            Paragraph("03  ·  INTERPRETATION", self.styles["InterpretationLabel"]),
            Spacer(1, 2 * mm),
            Paragraph(
                escape(report.interpretation.text), self.styles["InterpretationBody"]
            ),
        ]
        block = Table([[content]], colWidths=[self.CONTENT_WIDTH])
        block.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), self.TEAL_SOFT),
                    ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#99F6E4")),
                    ("LINEBEFORE", (0, 0), (0, -1), 4, self.TEAL),
                    ("LEFTPADDING", (0, 0), (-1, -1), 16),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                    ("TOPPADDING", (0, 0), (-1, -1), 13),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 13),
                ]
            )
        )
        story.append(block)

    def _section_heading(self, number: str, title: str) -> Table:
        number_cell = Paragraph(number, self.styles["SectionNumber"])
        title_cell = Paragraph(escape(title), self.styles["Section"])
        table = Table(
            [[number_cell, title_cell]],
            colWidths=[13 * mm, self.CONTENT_WIDTH - 13 * mm],
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), self.BLUE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (0, 0), 0),
                    ("RIGHTPADDING", (0, 0), (0, 0), 0),
                    ("TOPPADDING", (0, 0), (0, 0), 6),
                    ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                    ("LEFTPADDING", (1, 0), (1, 0), 9),
                    ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ]
            )
        )
        return table

    def _metadata_cell(self, label: str, value: str) -> Paragraph:
        return Paragraph(
            f"<font color='#64748B' size='7'>{label}</font><br/>"
            f"<font color='#0F172A' size='10'>{escape(str(value))}</font>",
            self.styles["Metadata"],
        )

    def _summary_cell(self, value: str, label: str) -> Paragraph:
        return Paragraph(
            f"<font color='#FFFFFF' size='15'>{escape(value)}</font><br/>"
            f"<font color='#94A3B8' size='6.5'>{label}</font>",
            self.styles["Summary"],
        )

    @staticmethod
    def _duration(timestamps: list[float]) -> str:
        if len(timestamps) < 2:
            return "—"
        duration = max(timestamps) - min(timestamps)
        return f"{duration:,.0f} s" if duration >= 10 else f"{duration:.2f} s"

    @staticmethod
    def _format_number(value: float | None) -> str:
        if value is None:
            return "—"
        magnitude = abs(value)
        if magnitude >= 100_000 or (0 < magnitude < 0.001):
            return f"{value:.2e}"
        if magnitude >= 1_000:
            return f"{value:,.1f}"
        return f"{value:.3f}"

    def _create_styles(self):
        styles = getSampleStyleSheet()
        styles.add(
            ParagraphStyle(
                name="Eyebrow",
                fontName="DejaVu",
                fontSize=7.5,
                leading=10,
                textColor=self.BLUE,
                spaceAfter=5,
            )
        )
        styles.add(
            ParagraphStyle(
                name="ReportTitle",
                fontName="DejaVu",
                fontSize=25,
                leading=31,
                textColor=self.NAVY,
                spaceAfter=5,
            )
        )
        styles.add(
            ParagraphStyle(
                name="Subtitle",
                fontName="DejaVu",
                fontSize=9.5,
                leading=14,
                textColor=self.MUTED,
            )
        )
        styles.add(
            ParagraphStyle(
                name="Metadata",
                fontName="DejaVu",
                fontSize=9,
                leading=15,
                textColor=self.NAVY,
            )
        )
        styles.add(
            ParagraphStyle(
                name="Summary",
                fontName="DejaVu",
                fontSize=9,
                leading=14,
                alignment=TA_CENTER,
            )
        )
        styles.add(
            ParagraphStyle(
                name="SectionNumber",
                fontName="DejaVu",
                fontSize=9,
                leading=11,
                textColor=self.WHITE,
                alignment=TA_CENTER,
            )
        )
        styles.add(
            ParagraphStyle(
                name="Section",
                fontName="DejaVu",
                fontSize=15,
                leading=18,
                textColor=self.NAVY,
            )
        )
        styles.add(
            ParagraphStyle(
                name="SectionLead",
                fontName="DejaVu",
                fontSize=8.5,
                leading=13,
                textColor=self.MUTED,
                spaceBefore=5,
            )
        )
        styles.add(
            ParagraphStyle(
                name="TableHeader",
                fontName="DejaVu",
                fontSize=6.5,
                leading=8,
                textColor=self.WHITE,
                alignment=TA_CENTER,
            )
        )
        styles.add(
            ParagraphStyle(
                name="TableCell",
                fontName="DejaVu",
                fontSize=7.2,
                leading=9,
                textColor=self.SLATE,
                alignment=TA_RIGHT,
            )
        )
        styles.add(
            ParagraphStyle(
                name="SensorName",
                fontName="DejaVu",
                fontSize=7.5,
                leading=9,
                textColor=self.NAVY,
            )
        )
        styles.add(
            ParagraphStyle(
                name="Footnote",
                fontName="DejaVu",
                fontSize=6.8,
                leading=10,
                textColor=self.MUTED,
            )
        )
        styles.add(
            ParagraphStyle(
                name="InterpretationLabel",
                fontName="DejaVu",
                fontSize=7.5,
                leading=10,
                textColor=self.TEAL,
            )
        )
        styles.add(
            ParagraphStyle(
                name="InterpretationBody",
                fontName="DejaVu",
                fontSize=9.5,
                leading=15,
                textColor=self.NAVY,
                alignment=TA_LEFT,
            )
        )
        return styles
