from __future__ import annotations

import pathlib
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from shared import models
from shared.database import Base, engine, get_db
from apps.backend.database.services.importer.parsers.common import compute_group_key
from shared.schemas import (
    AutocompleteItem,
    DeviceOut,
    GroupInfo,
    MeasurementIngestResponse,
    MeasurementObjectIn,
    MeasurementObjectOut,
    MeasurementOut,
    ParsedMeasurement,
    SensorIn,
    SensorOut,
)

from apps.backend.database.services.importer.parsers.csv_parser import parse_csv
from apps.backend.database.services.importer.parsers.xml_parser import parse_xml
from apps.backend.database.services.importer.parsers.xlsx_parser import parse_xlsx

app = FastAPI(title="E-Nose API (Monolith)")

@app.on_event("startup")
def on_startup() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "monolith"}

def _get_device_or_404(db: Session, device_id: int) -> models.Device:
    device = db.get(models.Device, device_id)
    if device is None:
        raise HTTPException(404, f"Устройство id={device_id} не найдено")
    return device

@app.post("/devices", response_model=DeviceOut, status_code=201)
def create_device(
    serial_number: str,
    name: str,
    device_type_code: str,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if db.scalar(select(models.Device).where(models.Device.serial_number == serial_number)):
        raise HTTPException(409, f"Устройство с serial_number={serial_number!r} уже существует")

    device_type = db.scalar(select(models.DeviceType).where(models.DeviceType.code == device_type_code.upper()))
    if device_type is None:
        device_type = models.DeviceType(code=device_type_code.upper(), name=device_type_code.upper())
        db.add(device_type)
        db.flush()

    device = models.Device(
        device_type_id=device_type.id,
        serial_number=serial_number,
        name=name,
        description=description,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

@app.get("/devices", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    return db.scalars(select(models.Device).order_by(models.Device.id)).all()

@app.get("/devices/{device_id}/sensors", response_model=list[SensorOut])
def list_sensors(device_id: int, db: Session = Depends(get_db)):
    _get_device_or_404(db, device_id)
    return db.scalars(
        select(models.Sensor).where(models.Sensor.device_id == device_id).order_by(models.Sensor.position)
    ).all()

@app.put("/devices/{device_id}/sensors", response_model=list[SensorOut])
def upsert_sensors(device_id: int, sensors: list[SensorIn], db: Session = Depends(get_db)):
    _get_device_or_404(db, device_id)
    result: list[models.Sensor] = []
    for s in sensors:
        existing = db.scalar(
            select(models.Sensor).where(models.Sensor.device_id == device_id, models.Sensor.position == s.position)
        )
        if existing is None:
            existing = models.Sensor(device_id=device_id, position=s.position)
            db.add(existing)
        existing.name = s.name
        existing.coating_id = s.coating_id
        existing.cell_config = s.cell_config
        existing.description = s.description
        result.append(existing)
    db.commit()
    for r in result:
        db.refresh(r)
    return result

@app.get("/measurement-objects/search", response_model=list[AutocompleteItem])
def search_measurement_objects(
    q: str = Query(..., min_length=1, description="Подстрока для ILIKE-поиска"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(models.MeasurementObject)
        .where(models.MeasurementObject.name.ilike(f"%{q}%"))
        .order_by(models.MeasurementObject.name)
        .limit(limit)
    ).all()
    return [AutocompleteItem(id=r.id, name=r.name) for r in rows]

@app.post("/measurement-objects", response_model=MeasurementObjectOut, status_code=201)
def create_measurement_object(body: MeasurementObjectIn, db: Session = Depends(get_db)):
    obj = models.MeasurementObject(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

# ----------------------------------------------------------------------
# Чтение измерений и временных рядов
# ----------------------------------------------------------------------

@app.get("/measurements/{measurement_id}", response_model=MeasurementOut)
def get_measurement(measurement_id: int, db: Session = Depends(get_db)):
    m = db.get(models.Measurement, measurement_id)
    if m is None:
        raise HTTPException(404, "Измерение не найдено")
    return m

@app.get("/measurements/{measurement_id}/data")
def get_measurement_data(measurement_id: int, db: Session = Depends(get_db)):
    if db.get(models.Measurement, measurement_id) is None:
        raise HTTPException(404, "Измерение не найдено")

    rows = db.execute(
        select(
            models.MeasurementData.time_offset_s,
            models.Sensor.position,
            models.MeasurementData.value,
        )
        .join(models.Sensor, models.Sensor.id == models.MeasurementData.sensor_id)
        .where(models.MeasurementData.measurement_id == measurement_id)
        .order_by(models.MeasurementData.time_offset_s, models.Sensor.position)
    ).all()

    return [{"time_offset_s": float(r.time_offset_s), "sensor_position": r.position, "value": r.value} for r in rows]

@app.get("/groups/{group_key}/measurements", response_model=list[MeasurementOut])
def measurements_in_group(group_key: str, db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Measurement).where(models.Measurement.group_key == group_key).order_by(models.Measurement.start_time)
    ).all()