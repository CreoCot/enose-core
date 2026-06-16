package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/database"
	"github.com/CreoCot/enose-core/backend/internal/tools"
	"github.com/gin-gonic/gin"
)

// For Health endpoint
type HealthResponse struct {
	Status    string `json:"status" example:"OK"`                               // Общий статус приложения
	Timestamp string `json:"timestamp" example:"Sun, 14 Jun 2026 16:25:56 UTC"` // Время генерации ответа
	Version   string `json:"version" example:"1.0.0-mvp"`                       // Версия сборки
	Uptime    string `json:"uptime,omitempty" example:"55.332075718s"`          // Время работы с момента запуска
	Database  string `json:"database" example:"ok"`                             // Статус подключения к БД
}

// For Table endpoint
type TableResponse struct {
	Table [][]float64 `json:"table"`
	// Массив временных рядов (каждая строка — один сенсор)
	Length int `json:"length" example:"2"` // Количество сенсоров (строк в таблице)
}

var startTime = time.Now()

// Health godoc
// @Summary      Проверка работоспособности бэкенда
// @Description  Возвращает статус сервиса, версию, время работы и состояние БД.
// @Description  Используется для liveness/readiness probes и мониторинга.
// @Tags         Heartbeat
// @Accept       json
// @Produce      json
// @Success      200 {object} HealthResponse "Сервер работает"
// @Failure      500 {object} HealthResponse "Внутренняя ошибка"
// @Router       /api/v1/health [get]
func Health(c *gin.Context) {
	databaseStatus := "ok"
	if err := database.Ping(context.Background()); err != nil {
		databaseStatus = "unavailable"
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:    "OK",
		Timestamp: time.Now().UTC().Format(time.RFC1123),
		Version:   "1.0.0-mvp",
		Uptime:    time.Since(startTime).String(),
		Database:  databaseStatus,
	})
}

// Table godoc
// @Summary      Получить демо-таблицу данных сенсоров
// @Description  Возвращает матрицу временных рядов от пьезосенсоров для визуализации.
// @Description  Каждая строка матрицы — данные одного сенсора.
// @Tags         Data
// @Accept       json
// @Produce      json
// @Success      200 {object} TableResponse "Пример ответа"
// @Failure      500 {object} ErrorResponse "Ошибка генерации данных"
// @Router       /api/v1/table [get]
// @Example      200 {object} TableResponse {
// @Example        "table": [[0.1, 0.2, 0.3], [1.1, 1.2, 1.3]],
// @Example        "length": 2
// @Example      }
func Table(c *gin.Context) {
	table := tools.MakeData()

	num_of_sensors := len(table[0]) - 1

	c.JSON(http.StatusOK, TableResponse{
		Table:  table,
		Length: num_of_sensors,
	})
}

// ErrorResponse — стандартная структура ошибки
type ErrorResponse struct {
	Error   string `json:"error" example:"internal_error"`
	Message string `json:"message" example:"Something went wrong"`
}
