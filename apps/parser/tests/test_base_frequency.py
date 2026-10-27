from app.parsers.csv_parser import parse_csv

CSV = (
    "Title;test\r\n"
    "Duration;4\r\n"
    "Start;6/29/2009 5:24:40 PM\r\n"
    "\r\n"
    "Sensors;Датчик 1 [SID0001];Датчик 2 [SID0002]\r\n"
    "Base frequency;9952200;10004399\r\n"
    "\r\n"
    "Time;?F;?F\r\n"
    "0;1;0\r\n"
    "2;2;-7\r\n"
)


def _series(parsed, position):
    return [
        (dp.time_offset_s, dp.value)
        for dp in parsed.data_points
        if dp.sensor_position == position
    ]


def test_csv_base_frequency_becomes_absolute_series():
    """MAG-soft кладёт в CSV уже посчитанные ΔF, а частоты — отдельной строкой.

    Парсер приводит это к виду XML: точка time = -1 с базовой частотой и
    абсолютные частоты F = F0 - ΔF дальше.
    """
    parsed = parse_csv(CSV.encode("utf-8"))

    assert _series(parsed, 1) == [(-1.0, 9952200.0), (0.0, 9952199.0), (2.0, 9952198.0)]
    assert _series(parsed, 2) == [
        (-1.0, 10004399.0),
        (0.0, 10004399.0),
        (2.0, 10004406.0),
    ]
    assert [s.unit for s in parsed.sensors] == ["Hz", "Hz"]


def test_csv_without_base_frequency_row_is_unchanged():
    """Без строки базовых частот поведение прежнее — данные как есть."""
    csv = CSV.replace("Base frequency;9952200;10004399\r\n", "")
    parsed = parse_csv(csv.encode("utf-8"))

    assert _series(parsed, 1) == [(0.0, 1.0), (2.0, 2.0)]


def _xlsx_bytes(with_base: bool) -> bytes:
    """Мини-файл в том же виде, в каком его пишет MAG-soft."""
    from io import BytesIO

    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Title", "test"])
    ws.append(["Start", "6/29/2009 5:24:40 PM"])
    ws.append(["Sensors", "Датчик 1 [SID0001]", "Датчик 2 [SID0002]"])
    if with_base:
        ws.append(["Base frequency", 9952200, 10004399])
    ws.append(["Time", "?F", "?F"])
    ws.append([0, 1, 0])
    ws.append([2, 2, -7])

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def test_xlsx_base_frequency_becomes_absolute_series():
    from app.parsers.xlsx_parser import parse_xlsx

    parsed = parse_xlsx(_xlsx_bytes(with_base=True))

    assert _series(parsed, 1) == [(-1.0, 9952200.0), (0.0, 9952199.0), (2.0, 9952198.0)]
    assert [s.unit for s in parsed.sensors] == ["Hz", "Hz"]


def test_xlsx_without_base_frequency_row_is_unchanged():
    from app.parsers.xlsx_parser import parse_xlsx

    parsed = parse_xlsx(_xlsx_bytes(with_base=False))

    assert _series(parsed, 1) == [(0.0, 1.0), (2.0, 2.0)]
