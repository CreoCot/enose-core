from io import BytesIO
from pathlib import Path

from fastapi import UploadFile

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


class PDFGenerator:
    PAGE_WIDTH = 6.5 * inch

    def __init__(self) -> None:
        font_path = Path(__file__).parent / "fonts" / "DejaVuSans.ttf"

        pdfmetrics.registerFont(TTFont("DejaVu", str(font_path)))

        self.styles = self._create_styles()

    def _create_styles(self):
        styles = getSampleStyleSheet()

        styles.add(
            ParagraphStyle(
                name="ReportTitle",
                parent=styles["Title"],
                fontName="DejaVu",
                fontSize=24,
                leading=20,
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
                leading=20,
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
                spaceAfter=6,
            )
        )

        return styles

    def _generate(
        self,
        name: str,
        sensor_count: int,
        titles: list[str],
        images: list[bytes],
    ) -> bytes:
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            title=name,
            author="eNose Report Service",
        )

        story = []

        #
        # Title
        #

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

        #
        # Metadata
        #

        story.append(
            Paragraph(
                "<b>Measurement information</b>",
                self.styles["Section"],
            )
        )

        story.append(
            Paragraph(
                f"<b>Name:</b> {name}",
                self.styles["Body"],
            )
        )

        story.append(
            Paragraph(
                f"<b>Sensor count:</b> {sensor_count}",
                self.styles["Body"],
            )
        )

        story.append(Spacer(1, 0.25 * inch))

        story.append(
            HRFlowable(
                width="100%",
                thickness=0.5,
                color=colors.lightgrey,
            )
        )

        story.append(Spacer(1, 0.2 * inch))

        #
        # Plots
        #

        story.append(
            Paragraph(
                "Plots",
                self.styles["Section"],
            )
        )

        for title, image in zip(titles, images):
            story.append(
                Paragraph(
                    title,
                    self.styles["Body"],
                )
            )

            reader = ImageReader(BytesIO(image))
            width, height = reader.getSize()

            scale = min(self.PAGE_WIDTH / width, 1)

            story.append(
                Image(
                    BytesIO(image),
                    width=width * scale,
                    height=height * scale,
                )
            )

            story.append(Spacer(1, 0.3 * inch))

        doc.build(story)

        pdf = buffer.getvalue()
        buffer.close()

        return pdf

    async def generate(
        self,
        name: str,
        sensor_count: int,
        titles: list[str],
        images: list[UploadFile],
    ):
        plots = []

        for image in images:
            plots.append(await image.read())

        return self._generate(
            name,
            sensor_count,
            titles,
            plots,
        )

    def generate_from_paths(
        self,
        name: str,
        sensor_count: int,
        titles: list[str],
        images: list[Path],
    ):
        plots = [path.read_bytes() for path in images]

        return self._generate(
            name,
            sensor_count,
            titles,
            plots,
        )
