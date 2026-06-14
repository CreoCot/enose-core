package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/CreoCot/enose-core/backend/internal/handlers"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// setupRouter - вспомогательная функция для создания роутера
func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode) // Отключает цветной вывод и лишние логи
	r := gin.New()
	r.GET("/api/v1/health", handlers.Health)
	return r
}

func TestHealthHandler(t *testing.T) {
	router := setupRouter()

	// 1. Создаем фейковый запрос
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health", nil)

	// 2. Выполняем запрос
	router.ServeHTTP(w, req)

	// 3. Проверяем статус-код
	assert.Equal(t, http.StatusOK, w.Code)

	// 4. Проверяем тело ответа
	var response handlers.HealthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "OK", response.Status)
	assert.NotEmpty(t, response.Timestamp)
	assert.Equal(t, "1.0.0-mvp", response.Version)
}

func TestHealthHandlerNotFound(t *testing.T) {
	router := setupRouter()

	w := httptest.NewRecorder()
	// Делаем запрос на несуществующий роут
	req, _ := http.NewRequest("GET", "/api/v1/non-exist", nil)

	router.ServeHTTP(w, req)

	// Gin вернет 404 по умолчанию
	assert.Equal(t, http.StatusNotFound, w.Code)
}
