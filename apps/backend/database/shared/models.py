"""
SQLAlchemy ORM-модели.

`Base.metadata.create_all(engine)` создаёт всю структуру БД — см.
scripts/init_db.py. Логически модели соответствуют sql/schema.sql,
с маппингом на legacy-схему E-Nose/MAG-8:

    legacy Sensors             -> sensors (+ devices, coatings)
    legacy GroupTree            -> measurement_groups
    legacy Measures              -> measurements
    legacy Data                  -> measurement_data
    legacy Mask/MeasureProfile*   -> measurement_parameters
"""
from sqlalchemy import (
    BigInteger,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from shared.database import Base


class DeviceType(Base):
    __tablename__ = "device_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(32), nullable=False, unique=True)  # 'MAG8', 'BIOSCAN', ...
    name = Column(String(128), nullable=False)
    description = Column(Text)

    devices = relationship("Device", back_populates="device_type")


class Coating(Base):
    __tablename__ = "coatings"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text)

    sensors = relationship("Sensor", back_populates="coating")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), nullable=False, unique=True)
    full_name = Column(String(255))
    email = Column(String(255), unique=True)
    role = Column(String(32), nullable=False, default="operator")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index(
            "idx_devices_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    id = Column(Integer, primary_key=True)
    device_type_id = Column(Integer, ForeignKey("device_types.id"), nullable=False)
    serial_number = Column(String(64), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    device_type = relationship("DeviceType", back_populates="devices")
    sensors = relationship("Sensor", back_populates="device", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="device")


class Sensor(Base):
    __tablename__ = "sensors"
    __table_args__ = (
        UniqueConstraint("device_id", "position", name="uq_sensor_device_position"),
        Index(
            "idx_sensors_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)  # номер канала на устройстве (1..N)
    name = Column(String(128), nullable=False)
    coating_id = Column(Integer, ForeignKey("coatings.id"))
    # Полиморфные параметры ячейки/сенсора, разные для разных типов
    # устройств (МАГ-8 / bioscan / nanovesicle) — без отдельных таблиц.
    cell_config = Column(JSONB, nullable=False, default=dict, server_default="{}")
    description = Column(Text)

    device = relationship("Device", back_populates="sensors")
    coating = relationship("Coating", back_populates="sensors")


class MeasurementObject(Base):
    __tablename__ = "measurement_objects"
    __table_args__ = (
        Index(
            "idx_measurement_objects_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(128))
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class MeasurementGroup(Base):
    __tablename__ = "measurement_groups"

    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("measurement_groups.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    group_key = Column(String(64), index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    children = relationship("MeasurementGroup")


class Measurement(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        Index(
            "idx_measurements_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    measurement_object_id = Column(Integer, ForeignKey("measurement_objects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("measurement_groups.id"))
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    duration_s = Column(Numeric(12, 3))
    interval_ms = Column(Integer, nullable=False)
    description = Column(Text)
    status = Column(String(32), nullable=False, default="completed")
    # sha256 от "сигнатуры" измерения без start_time/id — см.
    # shared/parsers/common.py:compute_group_key(). Измерения с
    # одинаковым group_key считаются повторами одного эксперимента
    # и автоматически попадают в одну группу/сравнение.
    group_key = Column(String(64), nullable=False, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="measurements")
    parameters = relationship(
        "MeasurementParameter", back_populates="measurement", cascade="all, delete-orphan"
    )
    data_points = relationship(
        "MeasurementData", back_populates="measurement", cascade="all, delete-orphan"
    )


class MeasurementParameter(Base):
    __tablename__ = "measurement_parameters"
    __table_args__ = (
        UniqueConstraint("measurement_id", "sensor_id", name="uq_param_measurement_sensor"),
    )

    id = Column(Integer, primary_key=True)
    measurement_id = Column(Integer, ForeignKey("measurements.id", ondelete="CASCADE"), nullable=False)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    position = Column(Integer, nullable=False)
    label = Column(String(128))
    unit = Column(String(32), nullable=False, default="Hz")

    measurement = relationship("Measurement", back_populates="parameters")
    sensor = relationship("Sensor")


class MeasurementData(Base):
    __tablename__ = "measurement_data"

    id = Column(BigInteger, primary_key=True)
    measurement_id = Column(
        Integer, ForeignKey("measurements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    time_offset_s = Column(Numeric(12, 4), nullable=False)
    value = Column(Float, nullable=False)

    measurement = relationship("Measurement", back_populates="data_points")
