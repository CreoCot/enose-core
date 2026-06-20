package repository

import (
	"context"
	"log"
	"os"
	"testing"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/config"
	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestMain(m *testing.M) {
	// 1. Инициализируем конфиг через ваш родной метод
	cfg, err := config.NewConfig()
	if err != nil {
		log.Printf("⚠️ Пропуск интеграционных тестов: ошибка загрузки конфигурации: %v", err)
		os.Exit(0)
	}

	// 2. Подключаемся к базе данных, используя конфиг
	if err := database.Connect(cfg.Database); err != nil {
		log.Printf("⚠️ Пропуск интеграционных тестов: PostgreSQL недоступен: %v", err)
		os.Exit(0)
	}

	// 3. Запускаем тесты
	code := m.Run()

	// 4. Закрываем пул соединений после прогона всех тестов
	_ = database.Close()

	os.Exit(code)
}

func TestMeasurementRepository_CreateFullMeasurement(t *testing.T) {
	// Получаем инициализированный gorm.DB инстанс из вашего пакета database
	db := database.DB()

	// Открываем изолированную транзакцию для теста.
	// defer tx.Rollback() гарантирует, что тестовый мусор сотрется из базы в любом случае.
	tx := db.Begin()
	defer tx.Rollback()

	repo := NewMeasurementRepository(tx)
	ctx := context.Background()

	// 1. Создаем необходимые связи (Foreign Keys) прямо внутри транзакции теста
	testDeviceType := models.DeviceType{
		Code: "TEST_MAG8",
		Name: "Тестовый тип прибора",
	}
	err := tx.Create(&testDeviceType).Error
	assert.NoError(t, err, "Не удалось создать тестовый тип прибора")

	testDevice := models.Device{
		DeviceTypeID: testDeviceType.ID,
		SerialNumber: "TEST-SN-12345",
		Name:         "Тестовый прибор Э-Нос",
	}
	err = tx.Create(&testDevice).Error
	assert.NoError(t, err, "Не удалось создать тестовое устройство")

	testSensor := models.Sensor{
		DeviceID: testDevice.ID,
		Position: 1,
		Name:     "Сенсор 1 (Тест)",
	}
	err = tx.Create(&testSensor).Error
	assert.NoError(t, err, "Не удалось создать тестовый сенсор")

	// 2. Заполняем структуру измерения
	measurement := models.Measurement{
		Name:       "Тестовый эксперимент XML",
		StartTime:  time.Now(),
		DeviceID:   testDevice.ID, // Ссылаемся на созданный выше девайс
		IntervalMS: 500,
		GroupKey:   "test_group_key_123",
		Status:     "completed",
	}

	params := []models.MeasurementParameter{
		{
			SensorID: testSensor.ID, // Ссылаемся на созданный выше сенсор
			Position: 1,
			Unit:     "Hz",
		},
	}

	// Генерируем 1050 точек, чтобы проверить, как GORM бьет их на пачки по 1000
	dataPoints := make([]models.MeasurementData, 1050)
	for i := range 1050 {
		dataPoints[i] = models.MeasurementData{
			SensorID:    testSensor.ID,
			TimeOffsetS: float64(i) * 0.5,
			Value:       100.0 + float64(i),
		}
	}

	// 3. Вызываем наш пакетный метод репозитория
	err = repo.CreateFullMeasurement(ctx, &measurement, params, dataPoints)

	// 4. Проверяем результаты
	assert.NoError(t, err)
	assert.NotZero(t, measurement.ID, "База данных должна была сгенерировать ID для измерения")

	// Проверяем, что все точки долетели до таблицы
	var count int64
	tx.Model(&models.MeasurementData{}).Where("measurement_id = ?", measurement.ID).Count(&count)
	assert.Equal(t, int64(1050), count, "Количество записанных точек должно строго равняться 1050")
}
