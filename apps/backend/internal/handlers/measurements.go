package handlers

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// maxReportPointsPerSensor — верхняя граница числа точек на сенсор, отправляемых в report-сервис.
// Больше не нужно для PDF-графика, а payload на больших измерениях иначе раздувается.
const maxReportPointsPerSensor = 5000

type MeasurementsHandler struct {
	Registry *repository.Registry
	report   *services.ReportClient
	ml       *services.MLClient
}

func NewMeasurementsHandler(r *repository.Registry, report *services.ReportClient, ml *services.MLClient) *MeasurementsHandler {
	return &MeasurementsHandler{Registry: r, report: report, ml: ml}
}

type MeasurementsItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Date string `json:"date"`
}

// GetAll godoc
// @Summary      Список измерений
// @Description  Возвращает массив {id, name, start_time}
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      json
// @Success      200 {array} MeasurementsItem
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/entries [get]
func (h *MeasurementsHandler) GetAll(c *gin.Context) {
	ctx := c.Request.Context()

	var userID *int
	if claims, ok := c.Get("claims"); ok {
		cl := claims.(*services.Claims)
		if cl.Role != services.RoleAdmin {
			userID = &cl.UserID
		}
	}

	measurements, err := h.Registry.Measurements.GetAll(ctx, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}

	items := make([]MeasurementsItem, 0, len(measurements))
	for _, m := range measurements {
		items = append(items, MeasurementsItem{
			ID:   m.ID,
			Name: m.Name,
			Date: m.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, items)
}

// GetTable godoc
// @Summary      Таблица данных измерения
// @Description  Возвращает данные сенсоров измерения в табличном виде: каждая строка — момент времени, первый столбец — время, остальные — значения сенсоров
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      json
// @Param        id path int true "ID измерения"
// @Success      200 {object} TableResponse
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/table/{id} [get]
func (h *MeasurementsHandler) GetTable(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	data, timestamps, size, err := h.Registry.Measurements.GetMeasurementMatrix(c.Request.Context(), measurement.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}

	table := make([][]float64, len(timestamps))
	for i, t := range timestamps {
		row := make([]float64, 0, size+1)
		row = append(row, t)
		for s := 0; s < size; s++ {
			row = append(row, data[s][i])
		}
		table[i] = row
	}

	c.JSON(http.StatusOK, TableResponse{
		Table: table,
		Size:  size,
	})
}

// GetPlots godoc
// @Summary      Графики данных измерения
// @Description  Возвращает временные ряды каждого сенсора измерения для построения графиков
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      json
// @Param        id path int true "ID измерения"
// @Success      200 {object} PlotResponse
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/plots/{id} [get]
func (h *MeasurementsHandler) GetPlots(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	data, timestamps, size, err := h.Registry.Measurements.GetMeasurementMatrix(c.Request.Context(), measurement.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, PlotResponse{
		Data:       data,
		Timestamps: timestamps,
		Size:       size,
	})
}

// GetReport godoc
// @Summary      PDF-отчёт по измерению
// @Description  Собирает данные измерения, отправляет их в report-сервис и возвращает готовый PDF
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      application/pdf
// @Param        id path int true "ID измерения"
// @Success      200 {file} binary "PDF-файл отчёта"
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      422 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Failure      502 {object} ErrorResponse
// @Router       /api/v1/report/{id} [get]
func (h *MeasurementsHandler) GetReport(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	sensors, timestamps, err := h.Registry.Measurements.GetReportSeries(c.Request.Context(), measurement.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}
	if len(sensors) == 0 || len(timestamps) == 0 {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Error:   "empty_measurement",
			Message: "measurement has no data to report",
		})
		return
	}

	// Прореживаем общий ряд времени и применяем те же индексы ко всем сенсорам —
	// точки должны оставаться выровненными между timestamps и values.
	idx := downsampleIndices(len(timestamps), maxReportPointsPerSensor)

	reportSensors := make([]services.ReportSensor, 0, len(sensors))
	for _, s := range sensors {
		// initial — базовая частота сенсора; берём первое (самое раннее) значение серии
		// до прореживания. Отдельной колонки под baseline в модели нет.
		initial := 0.0
		if len(s.Values) > 0 {
			initial = s.Values[0]
		}
		reportSensors = append(reportSensors, services.ReportSensor{
			ID:      s.SensorID,
			Name:    s.Name,
			Initial: initial,
			Values:  pickFloat(s.Values, idx),
		})
	}

	object := ""
	if measurement.MeasurementObject != nil {
		object = measurement.MeasurementObject.Name
	}

	req := services.ReportRequest{
		Header: services.ReportHeader{
			Name:   measurement.Name,
			Device: measurement.Device.Name,
			Object: object,
			Date:   measurement.StartTime,
		},
		Timestamps: pickFloat(timestamps, idx),
		Sensors:    reportSensors,
		// Интерпретация появится вместе с авторским алгоритмом — пока nil.
		Interpretation: nil,
	}

	pdf, err := h.report.GenerateReport(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadGateway, ErrorResponse{
			Error:   "report_service_error",
			Message: err.Error(),
		})
		return
	}

	filename := fmt.Sprintf("report_%d.pdf", measurement.ID)
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
	c.Data(http.StatusOK, "application/pdf", pdf)
}

// GetFeatures godoc
// @Summary      Признаки измерения
// @Description  Считает признаки кривых сенсоров через ML-сервис и возвращает их
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      json
// @Param        id path int true "ID измерения"
// @Success      200 {object} services.MLAnalyzeResponse
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      422 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Failure      502 {object} ErrorResponse
// @Router       /api/v1/features/{id} [get]
func (h *MeasurementsHandler) GetFeatures(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	sensors, timestamps, err := h.Registry.Measurements.GetReportSeries(c.Request.Context(), measurement.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return
	}
	if len(sensors) == 0 || len(timestamps) == 0 {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Error:   "empty_measurement",
			Message: "measurement has no data to analyze",
		})
		return
	}

	series := make([]services.MLSensorSeries, 0, len(sensors))
	for _, s := range sensors {
		// ML-сервис трактует value как дельту (baseline не вычитает сам).
		// Считаем дельту как value - initial, initial = первое значение серии —
		// та же конвенция, что в report-сервисе, чтобы признаки совпадали.
		initial := 0.0
		if len(s.Values) > 0 {
			initial = s.Values[0]
		}
		points := make([]services.MLPoint, 0, len(s.Values))
		for i, v := range s.Values {
			if i >= len(timestamps) {
				break
			}
			points = append(points, services.MLPoint{T: timestamps[i], Value: v - initial})
		}
		series = append(series, services.MLSensorSeries{
			SensorID: s.SensorID,
			Points:   points,
		})
	}

	mid := measurement.ID
	name := measurement.Name
	req := services.MLAnalyzeRequest{
		Measurement: services.MLMeasurementMeta{
			ID:         &mid,
			Name:       &name,
			IntervalMS: &measurement.IntervalMS,
		},
		Series:   series,
		Metadata: map[string]any{},
	}

	result, err := h.ml.Analyze(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadGateway, ErrorResponse{
			Error:   "ml_service_error",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// downsampleIndices возвращает до maxPoints равномерно распределённых индексов из [0, n),
// всегда включая первый и последний. Если n <= maxPoints, возвращает все индексы.
func downsampleIndices(n, maxPoints int) []int {
	if n <= 0 {
		return nil
	}
	if maxPoints <= 0 || n <= maxPoints {
		idx := make([]int, n)
		for i := range idx {
			idx[i] = i
		}
		return idx
	}

	idx := make([]int, 0, maxPoints)
	step := float64(n-1) / float64(maxPoints-1)
	for i := 0; i < maxPoints; i++ {
		idx = append(idx, int(math.Round(float64(i)*step)))
	}
	return idx
}

// pickFloat выбирает значения по индексам (для согласованного прореживания серий).
func pickFloat(src []float64, idx []int) []float64 {
	out := make([]float64, 0, len(idx))
	for _, i := range idx {
		if i >= 0 && i < len(src) {
			out = append(out, src[i])
		}
	}
	return out
}

// Delete godoc
// @Summary      Удалить измерение
// @Description  Удаляет измерение; параметры датчиков и точки данных удаляются каскадно
// @Tags         Measurements
// @Security     BearerAuth
// @Param        id path int true "ID измерения"
// @Success      204 "Измерение удалено"
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/delete/{id} [delete]
func (h *MeasurementsHandler) Delete(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	if err := h.Registry.Measurements.Delete(c.Request.Context(), measurement.ID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "delete_error",
			Message: err.Error(),
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// loadAuthorizedMeasurement читает :id из пути, загружает измерение и проверяет права доступа:
// admin видит все измерения, остальные роли — только свои.
func (h *MeasurementsHandler) loadAuthorizedMeasurement(c *gin.Context) (*models.Measurement, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_id",
			Message: "id must be a number",
		})
		return nil, false
	}

	measurement, err := h.Registry.Measurements.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "not_found",
				Message: "measurement not found",
			})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_error",
			Message: err.Error(),
		})
		return nil, false
	}

	if claims, ok := c.Get("claims"); ok {
		cl := claims.(*services.Claims)
		if cl.Role != services.RoleAdmin && (measurement.UserID == nil || *measurement.UserID != cl.UserID) {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Error:   "forbidden",
				Message: "access denied",
			})
			return nil, false
		}
	}

	return measurement, true
}
