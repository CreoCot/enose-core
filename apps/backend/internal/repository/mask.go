package repository

import (
	"context"
	"errors"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

// ErrMaskNameTaken — маска с таким именем уже есть (имена уникальны).
var ErrMaskNameTaken = errors.New("mask name already exists")

type MaskRepository interface {
	// List возвращает все маски с точками (по возрастанию времени).
	List(ctx context.Context) ([]models.Mask, error)
	GetByID(ctx context.Context, id int) (*models.Mask, error)
	// Create сохраняет маску и её точки в одной транзакции. points уже
	// нормализованы (см. services.NormalizeMaskPoints).
	Create(ctx context.Context, name string, createdBy *int, points []float64) (*models.Mask, error)
	// Update заменяет имя и набор точек маски.
	Update(ctx context.Context, id int, name string, points []float64) (*models.Mask, error)
	// Delete удаляет маску; у измерений default_mask_id обнуляется на уровне БД.
	Delete(ctx context.Context, id int) error
	// SetMeasurementDefault задаёт (или, при nil, снимает) маску по умолчанию.
	SetMeasurementDefault(ctx context.Context, measurementID int, maskID *int) error
}

type maskRepository struct {
	db *gorm.DB
}

func NewMaskRepository(db *gorm.DB) MaskRepository {
	return &maskRepository{db: db}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (r *maskRepository) List(ctx context.Context) ([]models.Mask, error) {
	var masks []models.Mask
	err := r.db.WithContext(ctx).
		Preload("Points", func(db *gorm.DB) *gorm.DB { return db.Order("time_s ASC") }).
		Order("name ASC").
		Find(&masks).Error
	return masks, err
}

func (r *maskRepository) GetByID(ctx context.Context, id int) (*models.Mask, error) {
	var m models.Mask
	err := r.db.WithContext(ctx).
		Preload("Points", func(db *gorm.DB) *gorm.DB { return db.Order("time_s ASC") }).
		First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func toPoints(maskID int, points []float64) []models.MaskPoint {
	out := make([]models.MaskPoint, len(points))
	for i, p := range points {
		out[i] = models.MaskPoint{MaskID: maskID, TimeS: p}
	}
	return out
}

func (r *maskRepository) Create(ctx context.Context, name string, createdBy *int, points []float64) (*models.Mask, error) {
	m := &models.Mask{Name: name, CreatedBy: createdBy}
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(m).Error; err != nil {
			return err
		}
		return tx.Create(toPoints(m.ID, points)).Error
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrMaskNameTaken
		}
		return nil, err
	}
	return r.GetByID(ctx, m.ID)
}

func (r *maskRepository) Update(ctx context.Context, id int, name string, points []float64) (*models.Mask, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.Mask{}).Where("id = ?", id).Update("name", name)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Where("mask_id = ?", id).Delete(&models.MaskPoint{}).Error; err != nil {
			return err
		}
		return tx.Create(toPoints(id, points)).Error
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrMaskNameTaken
		}
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *maskRepository) Delete(ctx context.Context, id int) error {
	res := r.db.WithContext(ctx).Delete(&models.Mask{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *maskRepository) SetMeasurementDefault(ctx context.Context, measurementID int, maskID *int) error {
	return r.db.WithContext(ctx).
		Model(&models.Measurement{}).
		Where("id = ?", measurementID).
		Update("default_mask_id", maskID).Error
}
