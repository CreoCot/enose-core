package models

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

type JSONB json.RawMessage

func (j JSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "{}", nil
	}
	return string(j), nil
}

func (j *JSONB) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append((*j)[0:0], v...)
	case string:
		*j = append((*j)[0:0], v...)
	default:
		return fmt.Errorf("scan JSONB: unsupported value type %T", value)
	}
	return nil
}

func (j JSONB) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSONB) UnmarshalJSON(data []byte) error {
	if !json.Valid(data) {
		return fmt.Errorf("invalid JSONB value")
	}
	*j = append((*j)[0:0], data...)
	return nil
}

func (JSONB) GormDataType() string {
	return "json"
}

func (JSONB) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db.Dialector.Name() == "postgres" {
		return "JSONB"
	}
	return "JSON"
}

func (j JSONB) GormValue(_ context.Context, _ *gorm.DB) clause.Expr {
	value := "{}"
	if len(j) > 0 {
		value = string(j)
	}
	return clause.Expr{SQL: "?::jsonb", Vars: []any{value}}
}

type DeviceType struct {
	ID          int     `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	Code        string  `gorm:"column:code;type:varchar(32);not null;unique"`
	Name        string  `gorm:"column:name;type:varchar(128);not null"`
	Description *string `gorm:"column:description;type:text"`

	Devices []Device `gorm:"foreignKey:DeviceTypeID"`
}

func (DeviceType) TableName() string {
	return "device_types"
}

type Coating struct {
	ID          int     `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	Name        string  `gorm:"column:name;type:varchar(128);not null;unique"`
	Description *string `gorm:"column:description;type:text"`

	Sensors []Sensor `gorm:"foreignKey:CoatingID"`
}

func (Coating) TableName() string {
	return "coatings"
}

type User struct {
	ID        int       `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	Username  string    `gorm:"column:username;type:varchar(64);not null;unique"`
	FullName  *string   `gorm:"column:full_name;type:varchar(255)"`
	Email     *string   `gorm:"column:email;type:varchar(255);unique"`
	Role      string    `gorm:"column:role;type:varchar(32);not null;default:operator"`
	CreatedAt time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()"`

	MeasurementObjects []MeasurementObject `gorm:"foreignKey:CreatedBy"`
	Measurements       []Measurement       `gorm:"foreignKey:UserID"`
}

func (User) TableName() string {
	return "users"
}

type Device struct {
	ID           int       `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	DeviceTypeID int       `gorm:"column:device_type_id;type:integer;not null"`
	SerialNumber string    `gorm:"column:serial_number;type:varchar(64);not null;unique"`
	Name         string    `gorm:"column:name;type:varchar(255);not null"`
	Description  *string   `gorm:"column:description;type:text"`
	CreatedAt    time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()"`

	DeviceType   DeviceType    `gorm:"foreignKey:DeviceTypeID"`
	Sensors      []Sensor      `gorm:"foreignKey:DeviceID"`
	Measurements []Measurement `gorm:"foreignKey:DeviceID"`
}

func (Device) TableName() string {
	return "devices"
}

type Sensor struct {
	ID          int     `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	DeviceID    int     `gorm:"column:device_id;type:integer;not null;uniqueIndex:idx_sensors_device_position"`
	Position    int     `gorm:"column:position;type:integer;not null;uniqueIndex:idx_sensors_device_position"`
	Name        string  `gorm:"column:name;type:varchar(128);not null"`
	CoatingID   *int    `gorm:"column:coating_id;type:integer"`
	CellConfig  JSONB   `gorm:"column:cell_config;type:jsonb;not null;default:'{}'::jsonb"`
	Description *string `gorm:"column:description;type:text"`

	Device                Device                 `gorm:"foreignKey:DeviceID;constraint:OnDelete:CASCADE"`
	Coating               *Coating               `gorm:"foreignKey:CoatingID"`
	MeasurementParameters []MeasurementParameter `gorm:"foreignKey:SensorID"`
	MeasurementData       []MeasurementData      `gorm:"foreignKey:SensorID"`
}

func (Sensor) TableName() string {
	return "sensors"
}

type MeasurementObject struct {
	ID          int       `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	Name        string    `gorm:"column:name;type:varchar(255);not null"`
	Category    *string   `gorm:"column:category;type:varchar(128)"`
	Description *string   `gorm:"column:description;type:text"`
	CreatedBy   *int      `gorm:"column:created_by;type:integer"`
	CreatedAt   time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()"`

	Creator      *User         `gorm:"foreignKey:CreatedBy"`
	Measurements []Measurement `gorm:"foreignKey:MeasurementObjectID"`
}

func (MeasurementObject) TableName() string {
	return "measurement_objects"
}

type MeasurementGroup struct {
	ID          int       `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	ParentID    *int      `gorm:"column:parent_id;type:integer"`
	Name        string    `gorm:"column:name;type:varchar(255);not null"`
	Description *string   `gorm:"column:description;type:text"`
	GroupKey    *string   `gorm:"column:group_key;type:varchar(64);index:idx_measurement_groups_key"`
	CreatedAt   time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()"`

	Parent       *MeasurementGroup  `gorm:"foreignKey:ParentID;constraint:OnDelete:CASCADE"`
	Children     []MeasurementGroup `gorm:"foreignKey:ParentID"`
	Measurements []Measurement      `gorm:"foreignKey:GroupID"`
}

func (MeasurementGroup) TableName() string {
	return "measurement_groups"
}

type Measurement struct {
	ID                  int       `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	Name                string    `gorm:"column:name;type:varchar(255);not null"`
	DeviceID            int       `gorm:"column:device_id;type:integer;not null;index:idx_measurements_device"`
	MeasurementObjectID *int      `gorm:"column:measurement_object_id;type:integer;index:idx_measurements_object"`
	UserID              *int      `gorm:"column:user_id;type:integer"`
	GroupID             *int      `gorm:"column:group_id;type:integer"`
	StartTime           time.Time `gorm:"column:start_time;type:timestamptz;not null"`
	DurationS           *float64  `gorm:"column:duration_s;type:numeric(12,3)"`
	IntervalMS          int       `gorm:"column:interval_ms;type:integer;not null"`
	Description         *string   `gorm:"column:description;type:text"`
	Status              string    `gorm:"column:status;type:varchar(32);not null;default:completed"`
	GroupKey            string    `gorm:"column:group_key;type:varchar(64);not null;index:idx_measurements_group_key"`
	CreatedAt           time.Time `gorm:"column:created_at;type:timestamptz;not null;default:now()"`

	Device                Device                 `gorm:"foreignKey:DeviceID"`
	MeasurementObject     *MeasurementObject     `gorm:"foreignKey:MeasurementObjectID"`
	User                  *User                  `gorm:"foreignKey:UserID"`
	Group                 *MeasurementGroup      `gorm:"foreignKey:GroupID"`
	MeasurementParameters []MeasurementParameter `gorm:"foreignKey:MeasurementID"`
	MeasurementData       []MeasurementData      `gorm:"foreignKey:MeasurementID"`
}

func (Measurement) TableName() string {
	return "measurements"
}

type MeasurementParameter struct {
	ID            int     `gorm:"column:id;type:integer;primaryKey;autoIncrement"`
	MeasurementID int     `gorm:"column:measurement_id;type:integer;not null;uniqueIndex:idx_measurement_parameters_measurement_sensor"`
	SensorID      int     `gorm:"column:sensor_id;type:integer;not null;uniqueIndex:idx_measurement_parameters_measurement_sensor"`
	Position      int     `gorm:"column:position;type:integer;not null"`
	Label         *string `gorm:"column:label;type:varchar(128)"`
	Unit          string  `gorm:"column:unit;type:varchar(32);not null;default:Hz"`

	Measurement Measurement `gorm:"foreignKey:MeasurementID;constraint:OnDelete:CASCADE"`
	Sensor      Sensor      `gorm:"foreignKey:SensorID"`
}

func (MeasurementParameter) TableName() string {
	return "measurement_parameters"
}

type MeasurementData struct {
	ID            int64   `gorm:"column:id;type:bigint;primaryKey;autoIncrement"`
	MeasurementID int     `gorm:"column:measurement_id;type:integer;not null;index:idx_measurement_data_meas,priority:1"`
	SensorID      int     `gorm:"column:sensor_id;type:integer;not null;index:idx_measurement_data_meas,priority:2"`
	TimeOffsetS   float64 `gorm:"column:time_offset_s;type:numeric(12,4);not null;index:idx_measurement_data_meas,priority:3"`
	Value         float64 `gorm:"column:value;type:double precision;not null"`

	Measurement Measurement `gorm:"foreignKey:MeasurementID;constraint:OnDelete:CASCADE"`
	Sensor      Sensor      `gorm:"foreignKey:SensorID"`
}

func (MeasurementData) TableName() string {
	return "measurement_data"
}
