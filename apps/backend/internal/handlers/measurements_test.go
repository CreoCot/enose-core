package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

// mockDeleteRepo мокает только методы, нужные для Delete-хендлера.
type mockDeleteRepo struct {
	repository.MeasurementRepository
	byID      map[int]*models.Measurement
	deletedID int
}

func (m *mockDeleteRepo) GetByID(ctx context.Context, id int) (*models.Measurement, error) {
	if mm, ok := m.byID[id]; ok {
		return mm, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockDeleteRepo) Delete(ctx context.Context, id int) error {
	m.deletedID = id
	return nil
}

func performDelete(t *testing.T, repo *mockDeleteRepo, id string, claims *services.Claims) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/v1/delete/"+id, nil)
	c.Params = gin.Params{{Key: "id", Value: id}}
	c.Set("claims", claims)

	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, nil, nil)
	h.Delete(c)
	// В юнит-тесте нет gin-движка, который флашит статус без тела (204) — делаем это явно.
	c.Writer.WriteHeaderNow()
	return w
}

func intPtr(v int) *int { return &v }

func TestDelete_AdminDeletesAny(t *testing.T) {
	repo := &mockDeleteRepo{byID: map[int]*models.Measurement{
		5: {ID: 5, UserID: intPtr(2)},
	}}

	w := performDelete(t, repo, "5", &services.Claims{UserID: 1, Role: services.RoleAdmin})

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, 5, repo.deletedID)
}

func TestDelete_OperatorDeletesOwn(t *testing.T) {
	repo := &mockDeleteRepo{byID: map[int]*models.Measurement{
		7: {ID: 7, UserID: intPtr(3)},
	}}

	w := performDelete(t, repo, "7", &services.Claims{UserID: 3, Role: services.RoleOperator})

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, 7, repo.deletedID)
}

func TestDelete_OperatorForeignMeasurementForbidden(t *testing.T) {
	repo := &mockDeleteRepo{byID: map[int]*models.Measurement{
		7: {ID: 7, UserID: intPtr(3)},
	}}

	w := performDelete(t, repo, "7", &services.Claims{UserID: 4, Role: services.RoleOperator})

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, 0, repo.deletedID) // Delete не вызывался
}

func TestDelete_UnknownIDReturns404(t *testing.T) {
	repo := &mockDeleteRepo{byID: map[int]*models.Measurement{}}

	w := performDelete(t, repo, "99", &services.Claims{UserID: 1, Role: services.RoleAdmin})

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, 0, repo.deletedID)
}

func TestDelete_InvalidIDReturns400(t *testing.T) {
	repo := &mockDeleteRepo{byID: map[int]*models.Measurement{}}

	w := performDelete(t, repo, "abc", &services.Claims{UserID: 1, Role: services.RoleAdmin})

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDownsampleIndices_ReturnsAllWhenUnderCap(t *testing.T) {
	idx := downsampleIndices(5, 5000)
	assert.Equal(t, []int{0, 1, 2, 3, 4}, idx)
}

func TestDownsampleIndices_CapsAndKeepsEndpoints(t *testing.T) {
	idx := downsampleIndices(10000, 5000)
	assert.Len(t, idx, 5000)
	assert.Equal(t, 0, idx[0])
	assert.Equal(t, 9999, idx[len(idx)-1])

	// Индексы строго не убывают и остаются в границах.
	for i := 1; i < len(idx); i++ {
		assert.GreaterOrEqual(t, idx[i], idx[i-1])
		assert.Less(t, idx[i], 10000)
	}
}

func TestDownsampleIndices_EmptyAndZeroCap(t *testing.T) {
	assert.Nil(t, downsampleIndices(0, 5000))

	// maxPoints <= 0 → все индексы.
	assert.Equal(t, []int{0, 1, 2}, downsampleIndices(3, 0))
}

func TestPickFloat_SelectsByIndex(t *testing.T) {
	src := []float64{10, 20, 30, 40}
	assert.Equal(t, []float64{10, 30}, pickFloat(src, []int{0, 2}))
	// Индексы вне границ пропускаются.
	assert.Equal(t, []float64{40}, pickFloat(src, []int{3, 99}))
}

type mockFullMeasRepo struct {
	repository.MeasurementRepository
	measurements []models.Measurement
	series       []repository.ReportSensorSeries
	timestamps   []float64
}

func (m *mockFullMeasRepo) GetAll(ctx context.Context, userID *int) ([]models.Measurement, error) {
	if userID == nil {
		return m.measurements, nil // Admin видит всё
	}
	var res []models.Measurement
	for _, meas := range m.measurements {
		if meas.UserID != nil && *meas.UserID == *userID {
			res = append(res, meas) // Operator видит только свои
		}
	}
	return res, nil
}

func (m *mockFullMeasRepo) GetByID(ctx context.Context, id int) (*models.Measurement, error) {
	for _, meas := range m.measurements {
		if meas.ID == id {
			return &meas, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockFullMeasRepo) GetReportSeries(ctx context.Context, measurementID int) ([]repository.ReportSensorSeries, []float64, error) {
	return m.series, m.timestamps, nil
}

// --- Тесты GetAll ---

func TestGetAll_RoleFiltering(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{
			{ID: 1, Name: "Admin Meas", UserID: intPtr(1)},
			{ID: 2, Name: "Operator Meas", UserID: intPtr(2)},
		},
	}
	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, nil, nil)

	t.Run("Admin sees all", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/entries", nil)
		c.Set("claims", &services.Claims{UserID: 1, Role: services.RoleAdmin})

		h.GetAll(c)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Contains(t, w.Body.String(), "Admin Meas")
		assert.Contains(t, w.Body.String(), "Operator Meas")
	})

	t.Run("Operator sees only own", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/entries", nil)
		c.Set("claims", &services.Claims{UserID: 2, Role: services.RoleOperator})

		h.GetAll(c)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.NotContains(t, w.Body.String(), "Admin Meas")
		assert.Contains(t, w.Body.String(), "Operator Meas")
	})
}

// --- Тесты GetReport ---

func TestGetReport_Forbidden403(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{{ID: 1, UserID: intPtr(2)}}, // Владелец: 2
	}
	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/report/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	// Пытаемся зайти под юзером 3 (не владелец)
	c.Set("claims", &services.Claims{UserID: 3, Role: services.RoleOperator})

	h.GetReport(c)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGetReport_DownstreamError502(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Мокаем Report Service, который падает с 500
	mockReport := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer mockReport.Close()

	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{{ID: 1, UserID: intPtr(2)}},
		series:       []repository.ReportSensorSeries{{SensorID: 1, Values: []float64{1.0, 2.0}}},
		timestamps:   []float64{0.0, 1.0},
	}
	reportClient := services.NewReportClient(mockReport.URL, "fake-key")
	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, reportClient, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/report/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 2, Role: services.RoleOperator})

	h.GetReport(c)

	assert.Equal(t, http.StatusBadGateway, w.Code)
	assert.Contains(t, w.Body.String(), "report_service_error")
}

// --- Тесты GetFeatures ---

func TestGetFeatures_Forbidden403(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{{ID: 1, UserID: intPtr(2)}},
	}
	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/features/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 3, Role: services.RoleOperator})

	h.GetFeatures(c)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGetFeatures_DownstreamError502(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Мокаем ML Service, который падает с 500
	mockML := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer mockML.Close()

	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{{ID: 1, UserID: intPtr(2)}},
		series:       []repository.ReportSensorSeries{{SensorID: 1, Values: []float64{1.0, 2.0}}},
		timestamps:   []float64{0.0, 1.0},
	}
	mlClient := services.NewMLClient(mockML.URL, "fake-key")
	h := NewMeasurementsHandler(&repository.Registry{Measurements: repo}, nil, mlClient)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/features/1", nil)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 2, Role: services.RoleOperator})

	h.GetFeatures(c)

	assert.Equal(t, http.StatusBadGateway, w.Code)
	assert.Contains(t, w.Body.String(), "ml_service_error")
}
func TestResolveMaskSamples(t *testing.T) {
	// Ряд с базовой точкой t=-1: отсчёт 0 — это индекс 1.
	timestamps := []float64{-1, 0, 1, 2, 3, 4, 5}

	tests := []struct {
		name    string
		points  []float64
		kept    []float64
		origIdx []int
	}{
		{"точки в пределах данных", []float64{1, 3, 5}, []float64{1, 3, 5}, []int{2, 4, 6}},
		{"дробное время усекается", []float64{1.9, 4.2}, []float64{1.9, 4.2}, []int{2, 5}},
		{"обрыв на первой вышедшей за данные", []float64{2, 6, 100}, []float64{2}, []int{3}},
		{"пустая маска", nil, []float64{}, []int{}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			kept, idx := resolveMaskSamples(timestamps, tc.points)
			assert.Equal(t, tc.kept, kept)
			assert.Equal(t, tc.origIdx, idx)
		})
	}

	t.Run("без базовой точки индекс совпадает с floor(t)", func(t *testing.T) {
		kept, idx := resolveMaskSamples([]float64{0, 1, 2}, []float64{0, 2})
		assert.Equal(t, []float64{0, 2}, kept)
		assert.Equal(t, []int{0, 2}, idx)
	})
}

func TestMergeIndices(t *testing.T) {
	assert.Equal(t, []int{0, 1, 2, 4}, mergeIndices([]int{0, 2, 4}, []int{1, 2}))
	assert.Equal(t, []int{}, mergeIndices(nil, nil))
	// downsampleIndices может повторить индекс — объединение их схлопывает
	assert.Equal(t, []int{3, 7}, mergeIndices([]int{3, 3, 7}, []int{7}))
}

func TestPositionsIn(t *testing.T) {
	assert.Equal(t, []int{1, 3}, positionsIn([]int{0, 1, 2, 4}, []int{1, 4}))
	assert.Equal(t, []int{}, positionsIn([]int{0, 1}, []int{9}))
}

// Точки маски должны пережить прореживание: иначе отчёт посчитал бы площадь
// по другим отсчётам.
func TestMaskSurvivesDownsampling(t *testing.T) {
	n := 2*maxReportPointsPerSensor + 1
	timestamps := make([]float64, n)
	for i := range timestamps {
		timestamps[i] = float64(i)
	}

	_, maskIdx := resolveMaskSamples(timestamps, []float64{7777})
	idx := mergeIndices(downsampleIndices(n, maxReportPointsPerSensor), maskIdx)
	pos := positionsIn(idx, maskIdx)

	if assert.Len(t, pos, 1) {
		assert.Equal(t, 7777.0, pickFloat(timestamps, idx)[pos[0]])
	}
}
