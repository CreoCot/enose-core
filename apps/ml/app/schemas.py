from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, Field, field_validator, model_validator


class Point(BaseModel):
    t: float
    value: float

    @field_validator("t", "value")
    @classmethod
    def finite_number(cls, v: float) -> float:
        if math.isnan(v) or math.isinf(v):
            raise ValueError("t and value must be finite numbers (no NaN/Infinity)")
        return v


class SensorSeries(BaseModel):
    sensor_id: int
    position: Optional[int] = None
    label: Optional[str] = None
    points: list[Point]

    @field_validator("points")
    @classmethod
    def points_not_empty(cls, v: list[Point]) -> list[Point]:
        if not v:
            raise ValueError("series.points must not be empty")
        return v

    @model_validator(mode="after")
    def points_sorted_by_time(self) -> "SensorSeries":
        times = [p.t for p in self.points]
        if any(times[i] > times[i + 1] for i in range(len(times) - 1)):
            raise ValueError(
                f"points for sensor_id={self.sensor_id} must be sorted by time (t)"
            )
        return self


class MeasurementMeta(BaseModel):
    id: Optional[Union[int, str]] = None
    name: Optional[str] = None
    interval_ms: Optional[int] = None


class AnalyzeRequest(BaseModel):
    measurement: MeasurementMeta
    series: list[SensorSeries]
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("series")
    @classmethod
    def series_not_empty(cls, v: list[SensorSeries]) -> list[SensorSeries]:
        if not v:
            raise ValueError("series must not be empty")
        return v


class FeatureItem(BaseModel):
    sensor_id: int
    name: str
    value: float


class AnalyzeResponse(BaseModel):
    features: list[FeatureItem]
    computed_at: datetime
