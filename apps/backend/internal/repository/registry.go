package repository

import "gorm.io/gorm"

type Registry struct {
	Measurements MeasurementRepository
	Sensors      SensorRepository
	Lookups      LookupRepository
}

func NewRegistry(db *gorm.DB) *Registry {
	return &Registry{
		Measurements: NewMeasurementRepository(db),
		Sensors:      NewSensorRepository(db),
		Lookups:      NewLookupRepository(db),
	}
}
