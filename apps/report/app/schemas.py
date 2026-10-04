from datetime import datetime

from pydantic import BaseModel, model_validator


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


class ReportRequest(BaseModel):
    header: Header
    timestamps: list[float]
    sensors: list[SensorSeries]
    interpretation: Interpretation | None = None
    # None → временная диаграмма строится по всем отсчётам, как в MAG-soft
    # без выбранной маски.
    mask: MaskSelection | None = None
