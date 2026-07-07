import os
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.responses import Response

from app.pdf import PDFGenerator
from app.schemas import ReportRequest

app = FastAPI(
    title="Report Service",
    version="0.1.0",
)

generator = PDFGenerator()

REPORT_API_KEY = os.getenv("REPORT_API_KEY", "example_api_key")


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Middleware для проверки API ключа"""
    if x_api_key != REPORT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "parser-pure"}


@app.post(
    "/reports",
    response_class=Response,
)
async def generate_report(
    report: ReportRequest,
    _: bool = Depends(verify_api_key),
):
    pdf = generator.generate(report)
    filename = quote(f"{report.header.name}.pdf")

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@app.get("/example")
async def example_report():
    report_path = Path(__file__).parent.parent / "report.json"

    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Example report not found.",
        )

    report = ReportRequest.model_validate_json(report_path.read_text(encoding="utf-8"))

    pdf = generator.generate(report)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="example.pdf"',
        },
    )
