package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pngBytes — минимальный набор байт с PNG-сигнатурой: хендлер проверяет только её.
var pngBytes = append([]byte("\x89PNG\r\n\x1a\n"), []byte("body")...)

type formFile struct {
	field string
	data  []byte
}

// buildForm собирает multipart-тело: текстовые поля и файлы.
func buildForm(t *testing.T, values map[string]string, files []formFile) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	for k, v := range values {
		require.NoError(t, mw.WriteField(k, v))
	}
	for _, f := range files {
		part, err := mw.CreateFormFile(f.field, f.field+".png")
		require.NoError(t, err)
		_, err = part.Write(f.data)
		require.NoError(t, err)
	}
	require.NoError(t, mw.Close())
	return body, mw.FormDataContentType()
}

// reportFixture — измерение с тремя сенсорами и фейковый report-сервис,
// запоминающий то, что ему отправил бэкенд.
type reportFixture struct {
	handler  *MeasurementsHandler
	received *services.ReportRequest
	calls    int
}

func newReportFixture(t *testing.T) *reportFixture {
	t.Helper()
	fx := &reportFixture{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fx.calls++
		var req services.ReportRequest
		assert.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		fx.received = &req
		w.Header().Set("Content-Type", "application/pdf")
		_, _ = w.Write([]byte("%PDF-fake"))
	}))
	t.Cleanup(srv.Close)

	timestamps := []float64{-1, 0, 1, 2, 3, 4, 5}
	series := []repository.ReportSensorSeries{
		{SensorID: 1, Name: "SID0001", Values: []float64{100, 99, 98, 97, 96, 95, 94}},
		{SensorID: 2, Name: "SID0002", Values: []float64{200, 199, 198, 197, 196, 195, 194}},
		{SensorID: 3, Name: "SID0003", Values: []float64{300, 299, 298, 297, 296, 295, 294}},
	}
	defaultMask := 7
	repo := &mockFullMeasRepo{
		measurements: []models.Measurement{{ID: 1, UserID: intPtr(2), DefaultMaskID: &defaultMask}},
		series:       series,
		timestamps:   timestamps,
	}
	masks := &mockMaskRepo{byID: map[int]*models.Mask{
		7: {ID: 7, Name: "default", Points: []models.MaskPoint{{TimeS: 0}, {TimeS: 2}}},
		9: {ID: 9, Name: "chosen", Points: []models.MaskPoint{{TimeS: 1}, {TimeS: 3}, {TimeS: 4}}},
	}}
	fx.handler = NewMeasurementsHandler(
		&repository.Registry{Measurements: repo, Masks: masks},
		services.NewReportClient(srv.URL, "key"),
		nil,
	)
	return fx
}

func (fx *reportFixture) post(t *testing.T, values map[string]string, files []formFile) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	body, contentType := buildForm(t, values, files)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/report/1", body)
	c.Request.Header.Set("Content-Type", contentType)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 2, Role: services.RoleOperator})

	fx.handler.PostReport(c)
	return w
}

func TestPostReport_ForwardsImagesAndReturnsPDF(t *testing.T) {
	fx := newReportFixture(t)

	w := fx.post(t, nil, []formFile{
		{"compare", pngBytes},
		{"time_radar", pngBytes},
	})

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/pdf", w.Header().Get("Content-Type"))
	assert.Contains(t, w.Header().Get("Content-Disposition"), "report_1.pdf")
	require.NotNil(t, fx.received)
	require.NotNil(t, fx.received.Images)
	assert.Equal(t, pngBytes, fx.received.Images.Compare)
	assert.Equal(t, pngBytes, fx.received.Images.TimeRadar)
	assert.Empty(t, fx.received.Images.Plots)
	assert.Empty(t, fx.received.Images.MaxRadar)
}

func TestPostReport_MaskOverride(t *testing.T) {
	t.Run("без mask_id — маска измерения по умолчанию", func(t *testing.T) {
		fx := newReportFixture(t)
		fx.post(t, nil, []formFile{{"compare", pngBytes}})
		require.NotNil(t, fx.received.Mask)
		assert.Equal(t, 7, fx.received.Mask.ID)
	})
	t.Run("mask_id выбирает другую маску", func(t *testing.T) {
		fx := newReportFixture(t)
		fx.post(t, map[string]string{"mask_id": "9"}, []formFile{{"compare", pngBytes}})
		require.NotNil(t, fx.received.Mask)
		assert.Equal(t, 9, fx.received.Mask.ID)
		assert.Equal(t, []float64{1, 3, 4}, fx.received.Mask.Points)
	})
	t.Run("пустой mask_id — без маски, даже если есть по умолчанию", func(t *testing.T) {
		fx := newReportFixture(t)
		fx.post(t, map[string]string{"mask_id": ""}, []formFile{{"compare", pngBytes}})
		assert.Nil(t, fx.received.Mask)
	})
	t.Run("нечисловой mask_id — 400", func(t *testing.T) {
		fx := newReportFixture(t)
		w := fx.post(t, map[string]string{"mask_id": "abc"}, nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Equal(t, 0, fx.calls)
	})
}

func TestPostReport_SensorSubset(t *testing.T) {
	fx := newReportFixture(t)

	w := fx.post(t, map[string]string{"sensors": "2,0"}, []formFile{{"compare", pngBytes}})

	require.Equal(t, http.StatusOK, w.Code)
	require.Len(t, fx.received.Sensors, 2)
	assert.Equal(t, "SID0001", fx.received.Sensors[0].Name)
	assert.Equal(t, "SID0003", fx.received.Sensors[1].Name)
}

func TestPostReport_NoSensorsSelected(t *testing.T) {
	fx := newReportFixture(t)

	w := fx.post(t, map[string]string{"sensors": ""}, []formFile{{"compare", pngBytes}})

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
	assert.Contains(t, w.Body.String(), "no_sensors")
	assert.Equal(t, 0, fx.calls)
}

func TestPostReport_TimeAxisMin(t *testing.T) {
	t.Run("передаётся в report-сервис", func(t *testing.T) {
		fx := newReportFixture(t)
		fx.post(t, map[string]string{"time_axis_min": "-40"}, []formFile{{"time_radar", pngBytes}})
		require.NotNil(t, fx.received.TimeAxisMin)
		assert.Equal(t, -40.0, *fx.received.TimeAxisMin)
	})
	t.Run("не число — 400", func(t *testing.T) {
		fx := newReportFixture(t)
		w := fx.post(t, map[string]string{"time_axis_min": "NaN"}, nil)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
	t.Run("не задан — nil", func(t *testing.T) {
		fx := newReportFixture(t)
		fx.post(t, nil, []formFile{{"compare", pngBytes}})
		assert.Nil(t, fx.received.TimeAxisMin)
	})
}

func TestPostReport_RejectsNonPNG(t *testing.T) {
	fx := newReportFixture(t)

	w := fx.post(t, nil, []formFile{{"compare", []byte("<html>not an image</html>")}})

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid_image")
	assert.Equal(t, 0, fx.calls)
}

func TestPostReport_Forbidden(t *testing.T) {
	fx := newReportFixture(t)
	gin.SetMode(gin.TestMode)
	body, contentType := buildForm(t, nil, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/report/1", body)
	c.Request.Header.Set("Content-Type", contentType)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 3, Role: services.RoleOperator}) // не владелец

	fx.handler.PostReport(c)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, 0, fx.calls)
}

func TestPostReport_NotMultipart(t *testing.T) {
	fx := newReportFixture(t)
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/report/1", bytes.NewBufferString("{}"))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Set("claims", &services.Claims{UserID: 2, Role: services.RoleOperator})

	fx.handler.PostReport(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "invalid_form")
}

func TestPostReport_MaskPointsSurviveDownsampling(t *testing.T) {
	fx := newReportFixture(t)

	fx.post(t, map[string]string{"mask_id": "9"}, []formFile{{"compare", pngBytes}})

	require.NotNil(t, fx.received.Mask)
	// Индексы маски указывают на те же отсчёты в ПЕРЕДАННЫХ рядах
	for k, idx := range fx.received.Mask.Indices {
		require.Less(t, idx, len(fx.received.Timestamps))
		assert.Equal(t, fx.received.Mask.Points[k], fx.received.Timestamps[idx])
	}
}

func TestMaskSampleIndex(t *testing.T) {
	twoSeconds := make([]float64, 0, 10)
	for s := 2.0; s <= 20; s += 2 {
		twoSeconds = append(twoSeconds, s)
	}
	oneSecond := []float64{0, 1, 2, 3, 4, 5}

	tests := []struct {
		name  string
		times []float64
		t     float64
		want  int
	}{
		{"шаг 1 с: floor(t)", oneSecond, 3.9, 3},
		{"шаг 1 с: за данными", oneSecond, 6, -1},
		{"шаг 1 с: отрицательное время", oneSecond, -1, -1},
		{"шаг 0.9 с считается секундным", []float64{0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3, 7.2, 8.1, 9, 9.9, 10.8}, 10, 10},
		{"шаг 2 с: ближайший отсчёт", twoSeconds, 10, 4},
		{"шаг 2 с: середина шага", twoSeconds, 11, 4},
		{"шаг 2 с: последний отсчёт", twoSeconds, 20, 9},
		{"шаг 2 с: полшага за концом допустимо", twoSeconds, 21, 9},
		{"шаг 2 с: дальше полшага — за данными", twoSeconds, 21.5, -1},
		{"пустой ряд", nil, 0, -1},
		{"один отсчёт", []float64{0}, 0, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, maskSampleIndex(tc.times, tc.t))
		})
	}
}

func TestMedianStep(t *testing.T) {
	assert.Equal(t, 0.0, medianStep(nil))
	assert.Equal(t, 0.0, medianStep([]float64{5}))
	assert.Equal(t, 2.0, medianStep([]float64{0, 2, 4, 6}))
	// медиана устойчива к одному выбросу
	assert.Equal(t, 1.0, medianStep([]float64{0, 1, 2, 3, 100}))
}
