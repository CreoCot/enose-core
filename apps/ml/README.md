# ML workspace (`apps/ml`)

Exploratory data analysis and modeling for the e-nose piezo-sensor framework.

## Local setup

This workspace uses [`uv`](https://github.com/astral-sh/uv) for dependency
management.

```bash
# from apps/ml
uv sync
```

This installs the base data-science stack: `pandas`, `numpy`, `scipy`,
`matplotlib`, `seaborn`.

## Loading a measurement

The legacy device exports each measurement as an XML file. Use
`data_loader.py` to read one into a tidy long-form DataFrame:

```python
from data_loader import load_measurement

df = load_measurement("path/to/measurement.xml")
print(df.head())
```

The returned DataFrame has one row per (sensor, point):

| column      | type  | meaning                                            |
|-------------|-------|----------------------------------------------------|
| `timestamp` | float | seconds from measurement start (−1 = baseline)     |
| `sensor_id` | str   | sensor identifier, e.g. `SID0001`                  |
| `frequency` | float | raw sensor frequency in Hz (~10 MHz)               |
| `delta`     | float | `frequency − initial` in Hz — the useful signal    |
| `name`      | str   | measured object name                               |
| `start`     | str   | measurement start datetime                         |
| `length`    | int   | declared measurement length in seconds             |
| `ismeasured`| bool  | device quality flag                                |

### Why `delta`?

The raw frequency sits around 10 MHz while the odor response is only a few Hz.
Working with the absolute frequency would drown the signal in baseline offset,
so `delta = frequency − initial` isolates the actual sensor response.

### Format notes

* Files are UTF-8 **with a BOM** (handled automatically).
* The decimal separator is a **comma** (`"1,00"`), converted on load.
* The first point per sensor is usually `time = -1` (a pre-measurement
  baseline). Filter `df[df.timestamp >= 0]` if you want only the measured run.

## Plotting sensor curves

`plot_curves.py` loads a measurement XML and saves a line plot of every
sensor's `delta` signal over time.

```bash
# from apps/ml
uv run python src/plot_curves.py tests/data/sample_lemon.XML
```

This writes a PNG (`sample_lemon.png`) in the current directory. To plot a real
measurement, pass its path instead:

```bash
uv run python src/plot_curves.py "path/to/real measurement.XML"
```

### Sample data

`tests/data/sample_lemon.XML` is a small **synthetic** measurement ("lemon oil",
which is not part of the real dataset). It is generated noise in the exact
device format and is committed only so the loader and plotting script can be run
without access to the real, private measurements. **Do not treat it as real data.**

The real measurement files are confidential and are **not** committed to the
repository.

## Running tests

```bash
# from apps/ml
uv run pytest tests/
```

The `pythonpath = ["src"]` setting in `pyproject.toml` lets the tests import
`data_loader` directly.
