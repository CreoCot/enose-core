"""
db_api — основной микросервис системы.

Владеет схемой PostgreSQL (sql/schema.sql) и предоставляет HTTP API,
которым пользуются:
  - сервисы import_csv / import_xml / import_xlsx (загрузка измерений);
  - любой будущий фронтенд (автодополнение, карточки измерений,
    выгрузка временных рядов, поиск "совместимых" измерений по
    group_key).

Эндпоинты:
    GET  /health
    POST /devices
    GET  /devices
    GET  /devices/{id}/sensors
    PUT  /devices/{id}/sensors
    GET  /measurement-objects/search?q=...   (автодополнение, ILIKE)
    POST /measurement-objects
    POST /measurements/ingest                (принимает ParsedMeasurement)
    GET  /measurements/{id}
    GET  /measurements/{id}/data
    GET  /groups/{group_key}/measurements
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from shared import models
from shared.database import Base, engine, get_db
from apps.backend.database.parsers.common import compute_group_key
from shared.schemas import (
    AutocompleteItem,
    DeviceOut,
    GroupInfo,
    MeasurementIngestRequest,
    MeasurementIngestResponse,
    MeasurementObjectIn,
    MeasurementObjectOut,
    MeasurementOut,
    SensorIn,
    SensorOut,
)

app = FastAPI(title="E-Nose db-api")


@app.on_event("startup")
def on_startup() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ----------------------------------------------------------------------
# Устройства и сенсоры
# ----------------------------------------------------------------------

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

    device_type = db.scalar(
        select(models.DeviceType).where(models.DeviceType.code == device_type_code.upper())
    )
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
        select(models.Sensor)
        .where(models.Sensor.device_id == device_id)
        .order_by(models.Sensor.position)
    ).all()


@app.put("/devices/{device_id}/sensors", response_model=list[SensorOut])
def upsert_sensors(device_id: int, sensors: list[SensorIn], db: Session = Depends(get_db)):
    """Создать/обновить конфигурацию сенсоров устройства (по position)."""
    _get_device_or_404(db, device_id)
    result: list[models.Sensor] = []
    for s in sensors:
        existing = db.scalar(
            select(models.Sensor).where(
                models.Sensor.device_id == device_id, models.Sensor.position == s.position
            )
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


# ----------------------------------------------------------------------
# Объекты измерения (с автодополнением)
# ----------------------------------------------------------------------

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
# Приём измерения (используется сервисами import_*)
# ----------------------------------------------------------------------

@app.post("/measurements/ingest", response_model=MeasurementIngestResponse, status_code=201)
def ingest_measurement(body: MeasurementIngestRequest, db: Session = Depends(get_db)):
    parsed = body.parsed

    # 1. устройство (find-or-create по serial_number)
    device = db.scalar(
        select(models.Device).where(models.Device.serial_number == parsed.device_serial)
    )
    if device is None:
        device_type = db.scalar(
            select(models.DeviceType).where(models.DeviceType.code == parsed.device_type_code)
        )
        if device_type is None:
            device_type = models.DeviceType(
                code=parsed.device_type_code, name=parsed.device_type_code
            )
            db.add(device_type)
            db.flush()
        device = models.Device(
            device_type_id=device_type.id,
            serial_number=parsed.device_serial,
            name=parsed.device_serial,
        )
        db.add(device)
        db.flush()

    # 2. сенсоры (find-or-create по device_id+position)
    sensor_by_position: dict[int, models.Sensor] = {}
    for s in parsed.sensors:
        sensor = db.scalar(
            select(models.Sensor).where(
                models.Sensor.device_id == device.id, models.Sensor.position == s.position
            )
        )
        if sensor is None:
            sensor = models.Sensor(device_id=device.id, position=s.position, name=s.label)
            db.add(sensor)
            db.flush()
        sensor_by_position[s.position] = sensor

    # 3. объект измерения (find-or-create, регистронезависимо)
    measurement_object = None
    if parsed.measurement_object:
        measurement_object = db.scalar(
            select(models.MeasurementObject).where(
                func.lower(models.MeasurementObject.name) == parsed.measurement_object.lower()
            )
        )
        if measurement_object is None:
            measurement_object = models.MeasurementObject(name=parsed.measurement_object)
            db.add(measurement_object)
            db.flush()

    # 4. group_key + группа измерений (find-or-create)
    group_key = compute_group_key(
        device_serial=parsed.device_serial,
        measurement_object=parsed.measurement_object,
        interval_ms=parsed.interval_ms,
        sensor_positions=[s.position for s in parsed.sensors],
        description=parsed.description,
    )
    group = db.scalar(
        select(models.MeasurementGroup).where(models.MeasurementGroup.group_key == group_key)
    )
    group_is_new = group is None
    if group is None:
        group = models.MeasurementGroup(
            name=parsed.measurement_object or parsed.measurement_name,
            group_key=group_key,
        )
        db.add(group)
        db.flush()

    # 5. само измерение
    duration_s = max((dp.time_offset_s for dp in parsed.data_points), default=0.0)
    measurement = models.Measurement(
        name=parsed.measurement_name,
        device_id=device.id,
        measurement_object_id=measurement_object.id if measurement_object else None,
        group_id=group.id,
        start_time=parsed.start_time,
        duration_s=duration_s,
        interval_ms=parsed.interval_ms,
        description=parsed.description,
        group_key=group_key,
    )
    db.add(measurement)
    db.flush()

    # 6. параметры измерения (какие сенсоры участвуют и в каком порядке)
    for s in parsed.sensors:
        db.add(
            models.MeasurementParameter(
                measurement_id=measurement.id,
                sensor_id=sensor_by_position[s.position].id,
                position=s.position,
                label=s.label,
                unit=s.unit,
            )
        )

    # 7. временной ряд — один bulk INSERT
    rows = [
        {
            "measurement_id": measurement.id,
            "sensor_id": sensor_by_position[dp.sensor_position].id,
            "time_offset_s": dp.time_offset_s,
            "value": dp.value,
        }
        for dp in parsed.data_points
    ]
    db.execute(models.MeasurementData.__table__.insert(), rows)

    db.commit()
    db.refresh(measurement)

    return MeasurementIngestResponse(
        measurement=MeasurementOut.model_validate(measurement),
        data_points_inserted=len(rows),
        group=GroupInfo(id=group.id, group_key=group.group_key, is_new=group_is_new),
    )


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

    return [
        {"time_offset_s": float(r.time_offset_s), "sensor_position": r.position, "value": r.value}
        for r in rows
    ]


@app.get("/groups/{group_key}/measurements", response_model=list[MeasurementOut])
def measurements_in_group(group_key: str, db: Session = Depends(get_db)):
    """Все измерения с данным group_key — кандидаты для совместного анализа."""
    return db.scalars(
        select(models.Measurement)
        .where(models.Measurement.group_key == group_key)
        .order_by(models.Measurement.start_time)
    ).all()
