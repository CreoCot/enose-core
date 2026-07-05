from typing import Annotated
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import Response
from pydantic import WithJsonSchema

from app.pdf import PDFGenerator


app = FastAPI(
    title="Report Service",
    version="0.1.0",
)

UploadFile = Annotated[
    UploadFile, WithJsonSchema({"type": "string", "format": "binary"})
]

generator = PDFGenerator()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/reports")
async def generate_report(
    name: str = Form(...),
    sensor_count: int = Form(...),
    titles: list[str] = Form(...),
    images: list[UploadFile] = File(...),  # type: ignore
):
    if len(titles) != len(images):
        raise HTTPException(
            status_code=400,
            detail="Number of titles must match number of images.",
        )
    pdf = await generator.generate(name, sensor_count, titles, images)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
    )


@app.get("/example")
async def example_report():
    images = [
        Path("app/examples/1.png"),
        Path("app/examples/2.png"),
        Path("app/examples/3.png"),
    ]

    titles = [
        "Strongest per-measurement sensor response - the peak detection (delta) feature across substances.",
        "A single response curve with the extracted features marked: AUC (shaded area), response time, and the curve maximum.",
        "Baseline normalization: the raw frequency signal (left) is normalized against its own baseline to produce the delta curve (right) used for feature extraction.",
    ]

    pdf = generator.generate_from_paths(
        name="Lemon",
        sensor_count=16,
        titles=titles,
        images=images,
    )

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="example.pdf"',
        },
    )
