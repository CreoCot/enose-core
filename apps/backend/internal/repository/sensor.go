package repository

import (
	"context"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"gorm.io/gorm"
)

type SensorRepository interface {
	GetByName(ctx context.Context, name string) (*models.Sensor, error)
	GetOrCreateSensor(ctx context.Context, name string, coatingID *int) (*models.Sensor, error)
	GetAllSensors(ctx context.Context) ([]models.Sensor, error)
	GetByDeviceAndPosition(ctx context.Context, deviceID int, position int) (*models.Sensor, error)
	CreateForDevice(ctx context.Context, deviceID int, position int, name string) (*models.Sensor, error)
}

type sensorRepository struct {
	db *gorm.DB
}

func NewSensorRepository(db *gorm.DB) SensorRepository {
	return &sensorRepository{db: db}
}

// GetByName ищет сенсор по его уникальному текстовому имени (или sid из XML)
func (r *sensorRepository) GetByName(ctx context.Context, name string) (*models.Sensor, error) {
	var s models.Sensor
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetOrCreateSensor автоматизирует добавление новых датчиков в систему при парсинге
func (r *sensorRepository) GetOrCreateSensor(ctx context.Context, name string, coatingID *int) (*models.Sensor, error) {
	var s models.Sensor
	err := r.db.WithContext(ctx).Where("name = ?", name).First(&s).Error
	if err == gorm.ErrRecordNotFound {
		s = models.Sensor{
			Name:      name,
			CoatingID: coatingID, // Опциональная связь с покрытием
		}
		if err := r.db.WithContext(ctx).Create(&s).Error; err != nil {
			return nil, err
		}
		return &s, nil
	}
	return &s, err
}

func (r *sensorRepository) GetAllSensors(ctx context.Context) ([]models.Sensor, error) {
	var list []models.Sensor
	err := r.db.WithContext(ctx).Preload("Coating").Find(&list).Error
	return list, err
}

func (r *sensorRepository) GetByDeviceAndPosition(ctx context.Context, deviceID int, position int) (*models.Sensor, error) {
	var s models.Sensor
	err := r.db.WithContext(ctx).
		Where("device_id = ? AND position = ?", deviceID, position).
		First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *sensorRepository) CreateForDevice(ctx context.Context, deviceID int, position int, name string) (*models.Sensor, error) {
	s := models.Sensor{
		DeviceID: deviceID,
		Position: position,
		Name:     name,
	}
	if err := r.db.WithContext(ctx).Create(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}
