"""Russian captions and methodology text for the figures taken from the site.

Pure functions over the request, so the wording and the numbers in it are unit
testable without rendering a PDF.  Numbers are formatted like in the UI
(``toFixed(2)``, dot as the decimal separator) so the page and the report read
identically.
"""

from __future__ import annotations

from dataclasses import dataclass
from xml.sax.saxutils import escape

from app.areas import (
    axis_min_for,
    fingerprint_areas,
    selected_deltas,
    time_diagram_values,
)
from app.schemas import ReportRequest


@dataclass(frozen=True)
class Figure:
    key: str  # compare | plots | max_radar | time_radar
    caption: str


def _num(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


def _plural(n: int, one: str, few: str, many: str) -> str:
    if 11 <= n % 100 <= 14:
        return many
    return {1: one, 2: few, 3: few, 4: few}.get(n % 10, many)


def _points_word(n: int) -> str:
    return f"{n} {_plural(n, 'точка', 'точки', 'точек')}"


def _points_dative(n: int) -> str:
    """«по 1 точке», «по 14 точкам» — после предлога «по» нужен дательный."""
    one = n % 10 == 1 and n % 100 != 11
    return f"{n} {'точке' if one else 'точкам'}"


def _axes_word(n: int) -> str:
    return f"{n} {_plural(n, 'ось', 'оси', 'осей')}"


def _sample_scope(report: ReportRequest, times: list[float]) -> str:
    """«по 14 точкам маски «X» (0–130 с)» / «по всем отсчётам (…)»."""
    span = f"{_num(times[0])}–{_num(times[-1])} с" if times else "—"
    if report.mask is not None:
        name = escape(report.mask.name or f"№{report.mask.id}")
        return f"по {_points_dative(len(times))} маски «{name}» ({span})"
    return f"по всем отсчётам ({_points_word(len(times))}, {span})"


def sensor_names(report: ReportRequest) -> str:
    return ", ".join(escape(s.name) for s in report.sensors) or "—"


def figure_captions(report: ReportRequest) -> list[Figure]:
    """Captions for the figures that were actually sent, numbered in order."""
    images = report.images
    if images is None:
        return []

    times, _ = selected_deltas(report)
    areas = fingerprint_areas(report)
    n = len(report.sensors)
    scope = _sample_scope(report, times)

    text = {
        "compare": (
            "Сравнение кривых отклика сенсоров. По оси X — время, с; по оси Y — "
            f"сдвиг частоты ΔF, Гц. Показаны все выбранные сенсоры ({n}): "
            f"{sensor_names(report)}."
        ),
        "plots": (
            "Кривые отклика каждого сенсора по отдельности. Масштаб оси Y "
            "подобран для каждого графика независимо, что позволяет оценить "
            "форму отклика и у слабо реагирующих сенсоров."
        ),
        "max_radar": (
            "Диаграмма максимумов. Каждая ось соответствует сенсору, радиус — "
            "максимальное по модулю отклонение max|ΔF| на кривой сенсора, Гц "
            f"({scope}). Осей: {areas.max_axes}. Площадь кинетического "
            f"отпечатка: {_num(areas.max_diagram)} Гц²."
        ),
        "time_radar": (
            "Временная диаграмма. Оси образуют моменты времени и сенсоры "
            f"({scope}; {_axes_word(areas.time_axes)}); радиус — ΔF со знаком, Гц. "
            "Подпись момента времени стоит у первого сенсора каждой группы. "
            f"Площадь кинетического отпечатка: {_num(areas.time_diagram)} Гц²."
        ),
    }

    figures: list[Figure] = []
    for key in ("compare", "plots", "max_radar", "time_radar"):
        if getattr(images, key):
            figures.append(Figure(key, f"Рисунок {len(figures) + 1} — {text[key]}"))
    return figures


def _time_axis_min(report: ReportRequest) -> float:
    if report.time_axis_min is not None:
        return report.time_axis_min
    _, deltas = selected_deltas(report)
    return axis_min_for(time_diagram_values(deltas), "signed")


def methodology(report: ReportRequest) -> list[str]:
    """Paragraphs of the «Методика расчёта» section (ReportLab mini-markup)."""
    times, _ = selected_deltas(report)
    areas = fingerprint_areas(report)
    axis_min = _time_axis_min(report)

    if report.mask is not None:
        name = escape(report.mask.name or f"№{report.mask.id}")
        mask_text = (
            f"Использована маска времени «{name}»: {_points_word(len(times))}"
            + (f" в диапазоне {_num(times[0])}–{_num(times[-1])} с" if times else "")
            + ". Маска задаёт моменты времени, в которые оцениваются кривые; "
            "если шаг записи отличается от 1 с, момент маски сопоставляется "
            "с ближайшим по времени отсчётом."
        )
    else:
        mask_text = (
            "Маска времени не использовалась: кривые оцениваются по всем "
            f"отсчётам записи ({_points_word(len(times))})."
        )

    return [
        "<b>Измеряемая величина.</b> Отклик сенсора — сдвиг частоты "
        "ΔF(t) = F₀ − F(t), где F₀ — базовая частота сенсора до начала "
        "измерения, F(t) — частота в момент t. ΔF выражается в герцах, время — "
        "в секундах.",
        f"<b>Выбор точек.</b> {mask_text}",
        "<b>Кинетический отпечаток.</b> Набор откликов сенсоров массива "
        "отображается лепестковой диаграммой: каждая ось соответствует "
        "величине отклика, а замкнутая фигура служит «отпечатком» "
        "анализируемого образца и позволяет сравнивать измерения между собой.",
        "<b>Площадь отпечатка.</b> Площадь вычисляется как сумма площадей "
        "треугольников между соседними осями: S = ½ · sin(2π/N) · Σ rᵢ · rᵢ₊₁, "
        "где N — число осей, rᵢ — радиус i-й оси (последняя ось замыкается на "
        "первую). Радиусы отсчитываются от минимума шкалы: rᵢ = aᵢ − a_min. "
        "Для диаграммы максимумов aᵢ = max|ΔF| сенсора, a_min = 0 (режим «по "
        f"модулю»), S = {_num(areas.max_diagram)} Гц². Для временной диаграммы "
        "aᵢ — ΔF со знаком в момент времени на данной оси, "
        f"a_min = {_num(axis_min)} Гц (минимум шкалы на рисунке), "
        f"S = {_num(areas.time_diagram)} Гц². Единица площади — Гц². "
        "При числе осей меньше трёх площадь принимается равной нулю.",
        "<b>Ограничения.</b> Площадь зависит от порядка осей, выбранного "
        "минимума шкалы и набора сенсоров, поэтому отпечатки корректно "
        "сравнивать только при одинаковых маске, сенсорах и шкале. Знак ΔF "
        "сохраняется только на временной диаграмме; на диаграмме максимумов "
        "используется модуль.",
        "<b>Примечание к таблице признаков.</b> Признаки в таблице ниже "
        "вычислены по отклонению F(t) − F₀, поэтому знак у них противоположен "
        "ΔF на рисунках; величины, зависящие от модуля (например, пик |Δf|), "
        "от знака не зависят.",
        f"<b>Сенсоры в отчёте:</b> {sensor_names(report)}.",
    ]
