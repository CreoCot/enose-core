package repository

import (
	"context"
	"fmt"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"gorm.io/gorm"
)

// MeasurementRepository описывает контракты для работы с измерениями
type MeasurementRepository interface {
	CreateFullMeasurement(
		ctx context.Context,
		measurement *models.Measurement,
		params []models.MeasurementParameter,
		dataPoints []models.MeasurementData,
	) error
	GetAll(ctx context.Context) ([]models.Measurement, error)
	GetByID(ctx context.Context, id int) (*models.Measurement, error)
	GetSensorDataPoints(
		ctx context.Context,
		measurementID int,
		sensorID int,
	) ([]models.MeasurementData, error)
}

type measurementRepository struct {
	db *gorm.DB
}

// NewMeasurementRepository создает новый экземпляр репозитория
func NewMeasurementRepository(db *gorm.DB) MeasurementRepository {
	return &measurementRepository{db: db}
}

// CreateFullMeasurement сохраняет всё измерение атомарно в рамках одной транзакции.
// Если сохранение точек упадет (например, сбой сети), транзакция откатится, и база останется чистой.
func (r *measurementRepository) CreateFullMeasurement(
	ctx context.Context,
	measurement *models.Measurement,
	params []models.MeasurementParameter,
	dataPoints []models.MeasurementData,
) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Сохраняем "шапку" измерения
		if err := tx.Create(measurement).Error; err != nil {
			return fmt.Errorf("failed to insert measurement header: %w", err)
		}

		// Теперь у объекта measurement заполнился автоинкрементный ID.
		// Привязываем этот ID ко всем зависимым параметрам и точкам.
		for i := range params {
			params[i].MeasurementID = measurement.ID
		}

		// 2. Сохраняем параметры датчиков (начальные частоты, позиции и т.д.)
		if len(params) > 0 {
			if err := tx.Create(&params).Error; err != nil {
				return fmt.Errorf("failed to insert measurement parameters: %w", err)
			}
		}

		// 3. ПАКЕТНАЯ вставка точек тайм-серии (Batch Insert)
		// Передаем массив кусками (батчами) по 1000 записей за один SQL-запрос.
		if len(dataPoints) > 0 {
			for i := range dataPoints {
				dataPoints[i].MeasurementID = measurement.ID
			}

			if err := tx.CreateInBatches(&dataPoints, 1000).Error; err != nil {
				return fmt.Errorf("failed to batch insert measurement data points: %w", err)
			}
		}

		return nil
	})
}

// GetAll вытягивает список всех измерений с предзагрузкой связей для главной таблицы
func (r *measurementRepository) GetAll(ctx context.Context) ([]models.Measurement, error) {
	var list []models.Measurement
	// Preload автоматически делает JOIN-подобные запросы для связанных таблиц (Device, Object, User)
	err := r.db.WithContext(ctx).
		Preload("Device").
		Preload("MeasurementObject").
		Preload("User").
		Order("measured_at DESC").
		Find(&list).Error

	return list, err
}

// GetByID возвращает детальную информацию об одном измерении
func (r *measurementRepository) GetByID(ctx context.Context, id int) (*models.Measurement, error) {
	var m models.Measurement
	err := r.db.WithContext(ctx).
		Preload("Device").
		Preload("MeasurementObject").
		Preload("User").
		First(&m, id).Error

	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetSensorDataPoints вытягивает временной ряд конкретного сенсора для построения графиков кривых
func (r *measurementRepository) GetSensorDataPoints(ctx context.Context, measurementID int, sensorID int) ([]models.MeasurementData, error) {
	var points []models.MeasurementData
	err := r.db.WithContext(ctx).
		Where("measurement_id = ? AND sensor_id = ?", measurementID, sensorID).
		Order("time_offset_s ASC").
		Find(&points).Error

	return points, err
}
