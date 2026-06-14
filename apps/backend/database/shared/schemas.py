"""
Pydantic-схемы.

ParsedMeasurement — общий "нормализованный" формат, в который парсеры
XML/CSV/XLSX (shared/parsers/*) приводят входные файлы независимо от
исходного формата. Именно его сервисы import_* отправляют в db_api.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------
# Справочники / устройства / сенсоры
# ---------------------------------------------------------------------

class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_type_id: int
    serial_number: str
    name: str
    description: Optional[str] = None


class SensorIn(BaseModel):
    position: int
    name: str
    coating_id: Optional[int] = None
    cell_config: dict = Field(default_factory=dict)
    description: Optional[str] = None


class SensorOut(SensorIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: int


# ---------------------------------------------------------------------
# Объекты измерения (образцы)
# ---------------------------------------------------------------------

class MeasurementObjectIn(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[int] = None


class MeasurementObjectOut(MeasurementObjectIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ---------------------------------------------------------------------
# Общий нормализованный формат измерения — выход парсеров XML/CSV/XLSX
# ---------------------------------------------------------------------

class ParsedSensor(BaseModel):
    position: int
    label: str
    unit: str = "Hz"


class ParsedDataPoint(BaseModel):
    time_offset_s: float
    sensor_position: int
    value: float


class ParsedMeasurement(BaseModel):
    """Унифицированное представление измерения для всех форматов ввода."""

    device_serial: str
    device_type_code: str
    measurement_name: str
    measurement_object: Optional[str] = None
    start_time: datetime
    interval_ms: int
    description: Optional[str] = None
    sensors: list[ParsedSensor]
    data_points: list[ParsedDataPoint]


# ---------------------------------------------------------------------
# db_api: приём измерения целиком (вызывается из import_* сервисов)
# ---------------------------------------------------------------------

class MeasurementIngestRequest(BaseModel):
    parsed: ParsedMeasurement


class MeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    device_id: int
    measurement_object_id: Optional[int]
    group_id: Optional[int]
    start_time: datetime
    duration_s: Optional[float]
    interval_ms: int
    status: str
    group_key: str


class GroupInfo(BaseModel):
    id: int
    group_key: str
    is_new: bool


class MeasurementIngestResponse(BaseModel):
    measurement: MeasurementOut
    data_points_inserted: int
    group: GroupInfo


class AutocompleteItem(BaseModel):
    id: int
    name: str
