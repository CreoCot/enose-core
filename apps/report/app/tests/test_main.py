import base64
from io import BytesIO

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pypdf import PdfReader  # noqa: E402

from app.main import REPORT_API_KEY, app  # noqa: E402
from app.tests.fixtures.report import create_masked_report, create_report  # noqa: E402

client = TestClient(app)
HEADERS = {"X-API-Key": REPORT_API_KEY}


def _png_b64() -> str:
    fig = plt.figure(figsize=(3, 3), dpi=60)
    fig.add_subplot(111).plot([0, 1], [0, 1])
    buffer = BytesIO()
    fig.savefig(buffer, format="png")
    plt.close(fig)
    return base64.b64encode(buffer.getvalue()).decode()


def _pdf_text(content: bytes) -> str:
    return "\n".join(p.extract_text() for p in PdfReader(BytesIO(content)).pages)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "report"}


def test_reports_require_api_key():
    payload = create_report().model_dump(mode="json")

    assert client.post("/reports", json=payload).status_code == 401
    assert (
        client.post(
            "/reports", json=payload, headers={"X-API-Key": "wrong"}
        ).status_code
        == 401
    )


def test_reports_without_images_use_the_generated_charts():
    payload = create_report().model_dump(mode="json")

    response = client.post("/reports", json=payload, headers=HEADERS)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert "Методика" not in _pdf_text(response.content)


def test_reports_with_site_images_add_the_russian_sections():
    payload = create_masked_report().model_dump(mode="json")
    payload["images"] = {"compare": _png_b64(), "max_radar": _png_b64()}
    payload["time_axis_min"] = -40.0

    response = client.post("/reports", json=payload, headers=HEADERS)

    assert response.status_code == 200
    text = _pdf_text(response.content)
    assert "Рисунок 1" in text and "Рисунок 2" in text
    assert "Методика расчёта и обоснование" in text
    assert "a_min = -40" in text


def test_reports_reject_images_that_are_not_base64():
    payload = create_report().model_dump(mode="json")
    payload["images"] = {"compare": "not base64 !!!"}

    response = client.post("/reports", json=payload, headers=HEADERS)

    assert response.status_code == 422


def test_reports_reject_mask_with_mismatched_lengths():
    payload = create_masked_report().model_dump(mode="json")
    payload["mask"]["indices"] = payload["mask"]["indices"][:-1]

    response = client.post("/reports", json=payload, headers=HEADERS)

    assert response.status_code == 422


def test_reports_content_disposition_keeps_the_russian_name():
    payload = create_report().model_dump(mode="json")
    payload["header"]["name"] = "мята россия"

    response = client.post("/reports", json=payload, headers=HEADERS)

    assert "filename*=UTF-8''" in response.headers["content-disposition"]
    assert "%D0%BC%D1%8F%D1%82%D0%B0" in response.headers["content-disposition"]
