from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ParsedSensor(BaseModel):
    position: int
    label: str
    unit: str = "Hz"

class ParsedDataPoint(BaseModel):
    time_offset_s: float
    sensor_position: int
    value: float

class ParsedMeasurement(BaseModel):
    device_serial: str
    device_type_code: str
    measurement_name: str
    measurement_object: Optional[str] = None
    start_time: datetime
    interval_ms: int
    description: Optional[str] = None
    sensors: list[ParsedSensor]
    data_points: list[ParsedDataPoint]