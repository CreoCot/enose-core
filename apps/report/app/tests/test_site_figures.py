import base64
from io import BytesIO

import matplotlib
from pypdf import PdfReader

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from app.pdf import PDFGenerator  # noqa: E402
from app.report_text import figure_captions, methodology  # noqa: E402
from app.schemas import ReportImages  # noqa: E402
from app.tests.fixtures.report import create_masked_report, create_report  # noqa: E402


def _png(width_in: float, height_in: float) -> bytes:
    fig = plt.figure(figsize=(width_in, height_in), dpi=100)
    fig.add_subplot(111).plot([0, 1, 2], [0, 1, 0])
    buffer = BytesIO()
    fig.savefig(buffer, format="png")
    plt.close(fig)
    return buffer.getvalue()


def _with_images(report, **figures):
    # В JSON картинки приходят base64, модель их декодирует
    encoded = {k: base64.b64encode(v) for k, v in figures.items()}
    return report.model_copy(update={"images": ReportImages(**encoded)})


def _pdf_text(pdf: bytes, tmp_path=None) -> str:
    # pypdf, а не pdftotext: в CI системных утилит нет
    reader = PdfReader(BytesIO(pdf))
    return "\n".join(page.extract_text() for page in reader.pages)


def test_images_are_decoded_from_base64_json():
    raw = _png(2, 2)
    payload = {
        **create_report().model_dump(mode="json"),
        "images": {"max_radar": base64.b64encode(raw).decode()},
    }
    from app.schemas import ReportRequest

    parsed = ReportRequest.model_validate(payload)

    assert parsed.images.max_radar == raw
    assert parsed.images.compare is None


def test_captions_follow_sent_figures_in_order():
    report = _with_images(
        create_masked_report(), compare=_png(4, 2), time_radar=_png(3, 3)
    )

    captions = [f.caption for f in figure_captions(report)]

    assert len(captions) == 2
    assert captions[0].startswith("Рисунок 1 — Сравнение")
    assert captions[1].startswith("Рисунок 2 — Временная диаграмма")
    assert "Гц²" in captions[1]


def test_no_images_no_captions():
    assert figure_captions(create_report()) == []


def test_methodology_names_mask_formula_and_units():
    report = _with_images(create_masked_report(), max_radar=_png(3, 3))
    text = " ".join(methodology(report))

    assert "Базовая 60 с" in text
    assert "ΔF(t) = F₀ − F(t)" in text
    assert "sin(2π/N)" in text
    assert "Гц²" in text


def test_methodology_uses_axis_minimum_from_the_figure():
    report = _with_images(create_masked_report(), time_radar=_png(3, 3)).model_copy(
        update={"time_axis_min": -40.0}
    )

    assert "a_min = -40 Гц" in " ".join(methodology(report))


def test_methodology_escapes_user_supplied_names():
    report = create_masked_report()
    report = report.model_copy(
        update={"mask": report.mask.model_copy(update={"name": "A < B & C"})}
    )

    text = " ".join(methodology(_with_images(report, compare=_png(2, 2))))

    assert "A &lt; B &amp; C" in text


def test_axis_minimum_override_changes_time_area():
    from app.areas import fingerprint_areas

    report = create_masked_report()
    default = fingerprint_areas(report).time_diagram
    shifted = fingerprint_areas(
        report.model_copy(update={"time_axis_min": -1000.0})
    ).time_diagram

    assert shifted != default


def test_pdf_with_site_figures_has_russian_text():
    report = _with_images(
        create_masked_report(),
        compare=_png(10, 4),
        plots=_png(10, 14),  # очень высокий — ужимается по высоте страницы
        max_radar=_png(4, 4),
        time_radar=_png(4, 4),
    )

    pdf = PDFGenerator().generate(report)
    text = _pdf_text(pdf)

    assert pdf[:4] == b"%PDF"
    assert "Рисунок 1" in text and "Рисунок 4" in text
    assert "Методика расчёта и обоснование" in text
    assert "Площадь кинетического отпечатка" in text
    # старый matplotlib-график заменён: его подписи в отчёте нет
    assert "Frequency shift from each sensor baseline" not in text
    # feature-таблица и нумерация сдвинулись
    assert "Calculated features" in text


def test_pdf_without_images_keeps_the_old_layout():
    text = _pdf_text(PDFGenerator().generate(create_report()))

    assert "Frequency shift from each sensor baseline" in text
    assert "Методика" not in text


def test_russian_declension_in_captions():
    report = _with_images(create_masked_report(), time_radar=_png(3, 3))
    caption = figure_captions(report)[0].caption

    # фикстура: маска из 4 точек, 8 сенсоров → 32 оси
    assert "по 4 точкам маски" in caption
    assert "32 оси" in caption


def test_captions_without_a_mask_say_all_samples():
    report = _with_images(create_report(), compare=_png(2, 2), max_radar=_png(3, 3))

    captions = [f.caption for f in figure_captions(report)]

    assert "по всем отсчётам" in captions[1]
    assert "маски" not in captions[1]


def test_methodology_without_a_mask_says_no_mask_used():
    report = _with_images(create_report(), compare=_png(2, 2))

    assert "Маска времени не использовалась" in " ".join(methodology(report))


def test_methodology_lists_the_sensors_of_the_report():
    report = _with_images(create_masked_report(), compare=_png(2, 2))

    text = " ".join(methodology(report))

    for sensor in report.sensors:
        assert sensor.name in text


def test_methodology_mentions_the_sign_convention_of_the_feature_table():
    report = _with_images(create_report(), compare=_png(2, 2))

    assert "F(t) − F₀" in " ".join(methodology(report))


def test_numbers_use_the_ui_format():
    from app.report_text import _num

    assert _num(186.678) == "186.68"
    assert _num(-40.0) == "-40"
    assert _num(0.0) == "0"
    assert _num(-0.001) == "0"
    assert _num(2.5) == "2.5"


def test_russian_plural_forms():
    from app.report_text import _axes_word, _points_dative, _points_word

    assert [_points_word(n) for n in (1, 2, 5, 11, 21)] == [
        "1 точка",
        "2 точки",
        "5 точек",
        "11 точек",
        "21 точка",
    ]
    assert [_axes_word(n) for n in (1, 3, 8, 12, 32)] == [
        "1 ось",
        "3 оси",
        "8 осей",
        "12 осей",
        "32 оси",
    ]
    assert [_points_dative(n) for n in (1, 4, 11, 21, 14)] == [
        "1 точке",
        "4 точкам",
        "11 точкам",
        "21 точке",
        "14 точкам",
    ]


def test_images_any_is_false_when_empty():
    assert not ReportImages().any()
    assert ReportImages(compare=base64.b64encode(_png(1, 1))).any()


def test_a_report_with_empty_images_object_keeps_the_old_layout():
    report = create_report().model_copy(update={"images": ReportImages()})

    text = _pdf_text(PDFGenerator().generate(report))

    assert "Frequency shift from each sensor baseline" in text
    assert "Методика" not in text
