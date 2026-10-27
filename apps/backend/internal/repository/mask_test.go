package repository

import (
	"context"
	"testing"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func TestMaskRepository_CRUD(t *testing.T) {
	tx := database.DB().Begin()
	defer tx.Rollback()

	repo := NewMaskRepository(tx)
	ctx := context.Background()

	created, err := repo.Create(ctx, "Базовая 60 с", nil, []float64{0, 10, 20, 60})
	assert.NoError(t, err)
	assert.NotZero(t, created.ID)
	assert.Len(t, created.Points, 4)

	// Точки возвращаются по возрастанию времени.
	assert.Equal(t, 0.0, created.Points[0].TimeS)
	assert.Equal(t, 60.0, created.Points[3].TimeS)

	// Имена уникальны.
	_, err = repo.Create(ctx, "Базовая 60 с", nil, []float64{1, 2})
	assert.ErrorIs(t, err, ErrMaskNameTaken)
}

func TestMaskRepository_UpdateReplacesPoints(t *testing.T) {
	tx := database.DB().Begin()
	defer tx.Rollback()

	repo := NewMaskRepository(tx)
	ctx := context.Background()

	m, err := repo.Create(ctx, "M1", nil, []float64{0, 10, 20})
	assert.NoError(t, err)
	_, err = repo.Create(ctx, "M2", nil, []float64{5, 15})
	assert.NoError(t, err)

	updated, err := repo.Update(ctx, m.ID, "M1 v2", []float64{30, 40})
	assert.NoError(t, err)
	assert.Equal(t, "M1 v2", updated.Name)
	assert.Len(t, updated.Points, 2)
	assert.Equal(t, 30.0, updated.Points[0].TimeS)

	// Переименование в занятое имя.
	_, err = repo.Update(ctx, m.ID, "M2", []float64{1, 2})
	assert.ErrorIs(t, err, ErrMaskNameTaken)

	_, err = repo.Update(ctx, 999999, "nope", []float64{1, 2})
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestMaskRepository_DeleteClearsMeasurementDefault(t *testing.T) {
	tx := database.DB().Begin()
	defer tx.Rollback()

	repo := NewMaskRepository(tx)
	ctx := context.Background()

	dt := models.DeviceType{Code: "TEST_MASK_MAG8", Name: "Тестовый тип"}
	assert.NoError(t, tx.Create(&dt).Error)
	dev := models.Device{DeviceTypeID: dt.ID, SerialNumber: "TEST-MASK-SN", Name: "Тестовый прибор"}
	assert.NoError(t, tx.Create(&dev).Error)
	meas := models.Measurement{
		Name: "m", DeviceID: dev.ID, StartTime: time.Now(), IntervalMS: 1000, GroupKey: "k", Status: "completed",
	}
	assert.NoError(t, tx.Create(&meas).Error)

	mask, err := repo.Create(ctx, "ToDelete", nil, []float64{0, 10})
	assert.NoError(t, err)

	assert.NoError(t, repo.SetMeasurementDefault(ctx, meas.ID, &mask.ID))
	var got models.Measurement
	assert.NoError(t, tx.First(&got, meas.ID).Error)
	if assert.NotNil(t, got.DefaultMaskID) {
		assert.Equal(t, mask.ID, *got.DefaultMaskID)
	}

	// Удаление маски снимает привязку (ON DELETE SET NULL) и чистит точки (CASCADE).
	assert.NoError(t, repo.Delete(ctx, mask.ID))
	assert.NoError(t, tx.First(&got, meas.ID).Error)
	assert.Nil(t, got.DefaultMaskID)
	var n int64
	tx.Model(&models.MaskPoint{}).Where("mask_id = ?", mask.ID).Count(&n)
	assert.Zero(t, n)

	assert.ErrorIs(t, repo.Delete(ctx, mask.ID), gorm.ErrRecordNotFound)

	// Явный сброс маски по умолчанию.
	assert.NoError(t, repo.SetMeasurementDefault(ctx, meas.ID, nil))
}
