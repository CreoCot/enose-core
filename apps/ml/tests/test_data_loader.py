from data_loader import parse_measurement_xml


MOCK_XML = """\ufeff<measure>
    <name>test_sample</name>
    <description />
    <length>5</length>
    <ismeasured>True</ismeasured>
    <mask>3</mask>
    <start>23.03.2025 0:42:32</start>
    <sensor sid="SID0001" initial="9965895,00">
        <point time="-1" value="9965895,00" />
        <point time="0,00" value="9965895,00" />
        <point time="1,00" value="9965894,00" />
    </sensor>
    <sensor sid="SID0002" initial="9991955,00">
        <point time="-1" value="9991955,00" />
        <point time="0,00" value="9991956,00" />
        <point time="1,00" value="9991960,00" />
    </sensor>
</measure>
"""


def test_dataframe_dimensions():
    """2 sensors x 3 points => 6 rows, 8 columns."""
    df = parse_measurement_xml(MOCK_XML)
    assert df.shape == (6, 8)


def test_expected_columns():
    df = parse_measurement_xml(MOCK_XML)
    expected = {
        "timestamp",
        "sensor_id",
        "frequency",
        "delta",
        "name",
        "start",
        "length",
        "ismeasured",
    }
    assert set(df.columns) == expected


def test_sensor_count():
    df = parse_measurement_xml(MOCK_XML)
    assert df["sensor_id"].nunique() == 2
    assert set(df["sensor_id"].unique()) == {"SID0001", "SID0002"}


def test_comma_decimal_parsing():
    """Comma decimal separator must be converted to float correctly."""
    df = parse_measurement_xml(MOCK_XML)
    row = df[(df["sensor_id"] == "SID0001") & (df["timestamp"] == 1.0)].iloc[0]
    assert row["frequency"] == 9965894.0


def test_delta_computation():
    """delta = frequency - initial; SID0002 rises by 5 Hz at t=1."""
    df = parse_measurement_xml(MOCK_XML)
    row = df[(df["sensor_id"] == "SID0002") & (df["timestamp"] == 1.0)].iloc[0]
    assert row["delta"] == 5.0


def test_metadata_propagation():
    df = parse_measurement_xml(MOCK_XML)
    assert (df["name"] == "test_sample").all()
    assert (df["length"] == 5).all()
    assert df["ismeasured"].all()


def test_baseline_point_kept():
    """The pre-measurement point (time=-1) is retained."""
    df = parse_measurement_xml(MOCK_XML)
    assert (df["timestamp"] == -1).sum() == 2


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASSED  {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
