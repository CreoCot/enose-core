from datetime import datetime

from pydantic import BaseModel


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


class ReportRequest(BaseModel):
    header: Header
    timestamps: list[float]
    sensors: list[SensorSeries]
    interpretation: Interpretation | None = None
