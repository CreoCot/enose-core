package repository

import (
	"context"
	"testing"

	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

// TestSensorRepository_SIDIsThePhysicalIdentity проверяет, что один и тот же
// физический сенсор (SID) резолвится через GetByDeviceAndSID независимо от
// позиции, а разные позиции для разных сенсоров с тем же SID больше не
// блокируются уникальностью (device_id, position) — см. миграцию
// 000004_add_sensor_sid.
func TestSensorRepository_SIDIsThePhysicalIdentity(t *testing.T) {
	db := database.DB()
	tx := db.Begin()
	defer tx.Rollback()

	repo := NewSensorRepository(tx)
	ctx := context.Background()

	testDeviceType := models.DeviceType{Code: "TEST_SID_MAG8", Name: "Тестовый тип прибора"}
	assert.NoError(t, tx.Create(&testDeviceType).Error)

	testDevice := models.Device{
		DeviceTypeID: testDeviceType.ID,
		SerialNumber: "TEST-SID-SN-1",
		Name:         "Тестовый прибор",
	}
	assert.NoError(t, tx.Create(&testDevice).Error)

	sid := "SID0001"

	// Не найден до создания.
	_, err := repo.GetByDeviceAndSID(ctx, testDevice.ID, sid)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

	created, err := repo.CreateForDevice(ctx, testDevice.ID, 1, "Sensor 1 [SID0001]", &sid)
	assert.NoError(t, err)
	assert.NotZero(t, created.ID)

	// Тот же физический сенсор снова встречается, но уже на другой позиции
	// (как при повторной загрузке того же прибора с другим профилем) —
	// должен резолвиться в ту же запись по SID, а не создавать новую.
	found, err := repo.GetByDeviceAndSID(ctx, testDevice.ID, sid)
	assert.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)

	// Другой физический сенсор может занять ту же позицию (1) на том же
	// устройстве без конфликта — раньше это блокировалось UNIQUE(device_id,
	// position).
	otherSID := "SID0002"
	other, err := repo.CreateForDevice(ctx, testDevice.ID, 1, "Sensor 2 [SID0002]", &otherSID)
	assert.NoError(t, err, "разные SID на одной позиции больше не должны конфликтовать")
	assert.NotEqual(t, created.ID, other.ID)

	// Повторный SID на том же устройстве всё ещё запрещён (частичный
	// уникальный индекс idx_sensors_device_sid).
	_, err = repo.CreateForDevice(ctx, testDevice.ID, 2, "Sensor 1 duplicate", &sid)
	assert.Error(t, err, "дублирующийся SID на одном устройстве должен быть отклонён")
}

// TestSensorRepository_NilSIDFallsBackToPosition проверяет, что источники
// без SID (например, старый CSV) продолжают резолвиться по позиции, как до
// миграции — множественные сенсоры без SID на разных позициях не конфликтуют.
func TestSensorRepository_NilSIDFallsBackToPosition(t *testing.T) {
	db := database.DB()
	tx := db.Begin()
	defer tx.Rollback()

	repo := NewSensorRepository(tx)
	ctx := context.Background()

	testDeviceType := models.DeviceType{Code: "TEST_NOSID_MAG8", Name: "Тестовый тип прибора"}
	assert.NoError(t, tx.Create(&testDeviceType).Error)

	testDevice := models.Device{
		DeviceTypeID: testDeviceType.ID,
		SerialNumber: "TEST-NOSID-SN-1",
		Name:         "Тестовый прибор",
	}
	assert.NoError(t, tx.Create(&testDevice).Error)

	s1, err := repo.CreateForDevice(ctx, testDevice.ID, 1, "Sensor 1", nil)
	assert.NoError(t, err)

	found, err := repo.GetByDeviceAndPosition(ctx, testDevice.ID, 1)
	assert.NoError(t, err)
	assert.Equal(t, s1.ID, found.ID)

	s2, err := repo.CreateForDevice(ctx, testDevice.ID, 2, "Sensor 2", nil)
	assert.NoError(t, err)
	assert.NotEqual(t, s1.ID, s2.ID)
}
