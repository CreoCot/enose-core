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
	// GetAll возвращает измерения. userID == nil → все записи (admin), иначе только записи пользователя.
	GetAll(ctx context.Context, userID *int) ([]models.Measurement, error)
	GetByID(ctx context.Context, id int) (*models.Measurement, error)
	CountByUserID(ctx context.Context, userID int) (int64, error)
	GetSensorDataPoints(
		ctx context.Context,
		measurementID int,
		sensorID int,
	) ([]models.MeasurementData, error)
	// GetMeasurementMatrix возвращает данные всех сенсоров измерения, отсортированных по позиции.
	// data[i] — временной ряд значений i-го сенсора, timestamps — общий ряд смещений времени (от первого сенсора).
	GetMeasurementMatrix(ctx context.Context, measurementID int) (data [][]float64, timestamps []float64, sensorCount int, err error)
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

// GetAll вытягивает измерения. userID == nil → все (admin), иначе только записи пользователя.
func (r *measurementRepository) GetAll(ctx context.Context, userID *int) ([]models.Measurement, error) {
	var list []models.Measurement
	q := r.db.WithContext(ctx).
		Preload("Device").
		Preload("MeasurementObject").
		Preload("User").
		Order("created_at DESC")

	if userID != nil {
		q = q.Where("user_id = ?", *userID)
	}

	return list, q.Find(&list).Error
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

// CountByUserID возвращает количество измерений, принадлежащих пользователю
func (r *measurementRepository) CountByUserID(ctx context.Context, userID int) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.Measurement{}).
		Where("user_id = ?", userID).
		Count(&count).Error
	return count, err
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

// GetMeasurementMatrix вытягивает данные всех сенсоров измерения, упорядоченных по позиции датчика.
func (r *measurementRepository) GetMeasurementMatrix(ctx context.Context, measurementID int) ([][]float64, []float64, int, error) {
	var params []models.MeasurementParameter
	err := r.db.WithContext(ctx).
		Where("measurement_id = ?", measurementID).
		Order("position ASC").
		Find(&params).Error
	if err != nil {
		return nil, nil, 0, err
	}

	sensorCount := len(params)
	data := make([][]float64, sensorCount)
	var timestamps []float64

	for i, p := range params {
		points, err := r.GetSensorDataPoints(ctx, measurementID, p.SensorID)
		if err != nil {
			return nil, nil, 0, err
		}

		values := make([]float64, len(points))
		for j, pt := range points {
			values[j] = pt.Value
		}
		data[i] = values

		if i == 0 {
			timestamps = make([]float64, len(points))
			for j, pt := range points {
				timestamps[j] = pt.TimeOffsetS
			}
		}
	}

	return data, timestamps, sensorCount, nil
}
