from datetime import datetime

from pydantic import Base64Bytes, BaseModel, model_validator


class Header(BaseModel):
    name: str
    device: str
    object: str
    date: datetime


class SensorSeries(BaseModel):
    id: int
    name: str
    initial: float
    values: list[float]


class Interpretation(BaseModel):
    text: str


class MaskSelection(BaseModel):
    """Time mask resolved by the backend.

    ``indices[k]`` is the position of ``points[k]`` inside
    ``ReportRequest.timestamps`` and every ``SensorSeries.values`` — resolved
    in Go because only it knows about the baseline row and the downsampling.
    """

    id: int | None = None
    name: str | None = None
    points: list[float] = []
    indices: list[int] = []

    @model_validator(mode="after")
    def _same_length(self):
        if len(self.points) != len(self.indices):
            raise ValueError("mask points and indices must have the same length")
        return self


class ReportImages(BaseModel):
    """PNG figures captured on the site (300 dpi), base64 in JSON.

    Any missing figure is simply left out of the PDF.
    """

    compare: Base64Bytes | None = None
    plots: Base64Bytes | None = None
    max_radar: Base64Bytes | None = None
    time_radar: Base64Bytes | None = None

    def any(self) -> bool:
        return any((self.compare, self.plots, self.max_radar, self.time_radar))


class ReportRequest(BaseModel):
    header: Header
    timestamps: list[float]
    sensors: list[SensorSeries]
    interpretation: Interpretation | None = None
    # None → временная диаграмма строится по всем отсчётам, как в MAG-soft
    # без выбранной маски.
    mask: MaskSelection | None = None
    # Figures taken from the site: when present they replace the matplotlib
    # charts and the Russian justification text is added.
    images: ReportImages | None = None
    # Radial-axis minimum of the time diagram as drawn on the figure; the area
    # is measured from it, like on the site. None → minimum over all axes.
    time_axis_min: float | None = None
