package handlers

import (
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"sort"
	"strconv"
	"strings"

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
	h.sendReport(c, measurement, reportOptions{})
}

// reportOptions — что отличает отчёт, собранный из интерфейса, от отчёта «по
// умолчанию»: выбранная на экране маска, показанные сенсоры и картинки графиков.
type reportOptions struct {
	// overrideMask: true — использовать MaskID (nil = без маски) вместо маски
	// измерения по умолчанию.
	overrideMask bool
	maskID       *int
	// sensorIdx — индексы (0-based) сенсоров на экране; nil — все.
	sensorIdx   []int
	images      *services.ReportImages
	timeAxisMin *float64
}

func (h *MeasurementsHandler) sendReport(c *gin.Context, measurement *models.Measurement, opts reportOptions) {
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

	// Маска по умолчанию: по её точкам report-сервис построит временную
	// диаграмму. Удалённая маска отчёт не ломает — строим без неё.
	var maskPoints []float64
	var maskMeta *models.Mask
	maskID := measurement.DefaultMaskID
	if opts.overrideMask {
		maskID = opts.maskID
	}
	if maskID != nil {
		m, err := h.Registry.Masks.GetByID(c.Request.Context(), *maskID)
		switch {
		case err == nil:
			maskMeta = m
			maskPoints = make([]float64, len(m.Points))
			for i, p := range m.Points {
				maskPoints[i] = p.TimeS
			}
		case errors.Is(err, gorm.ErrRecordNotFound):
			// Маску удалили — отчёт строим по всем отсчётам.
		default:
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "fetch_error",
				Message: err.Error(),
			})
			return
		}
	}

	// Прореживаем общий ряд времени и применяем те же индексы ко всем сенсорам —
	// точки должны оставаться выровненными между timestamps и values. Точки
	// маски добавляем в набор, иначе прореживание их выбросит.
	keptPoints, maskIdx := resolveMaskSamples(timestamps, maskPoints)
	idx := mergeIndices(downsampleIndices(len(timestamps), maxReportPointsPerSensor), maskIdx)

	if opts.sensorIdx != nil {
		sensors = pickSensors(sensors, opts.sensorIdx)
		if len(sensors) == 0 {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Error:   "no_sensors",
				Message: "no sensors selected for the report",
			})
			return
		}
	}

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
		Images:         opts.images,
		TimeAxisMin:    opts.timeAxisMin,
	}
	if maskMeta != nil {
		req.Mask = &services.ReportMask{
			ID:      maskMeta.ID,
			Name:    maskMeta.Name,
			Points:  keptPoints,
			Indices: positionsIn(idx, maskIdx),
		}
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

// maxReportImageBytes — предел размера одной картинки графика (PNG, 300 dpi).
const maxReportImageBytes = 12 << 20

// reportImageFields — поля multipart с картинками → поле ReportImages.
var reportImageFields = []string{"compare", "plots", "max_radar", "time_radar"}

// PostReport godoc
// @Summary      PDF-отчёт с графиками из интерфейса
// @Description  Принимает PNG графиков, снятые на сайте (compare, plots, max_radar, time_radar), выбранную маску и список сенсоров, строит PDF с этими картинками и текстом обоснования
// @Tags         Measurements
// @Security     BearerAuth
// @Accept       multipart/form-data
// @Produce      application/pdf
// @Param        id path int true "ID измерения"
// @Param        mask_id formData string false "ID выбранной маски; пусто — без маски"
// @Param        sensors formData string false "Индексы показанных сенсоров через запятую (с нуля)"
// @Param        time_axis_min formData number false "Минимум оси временной диаграммы на рисунке"
// @Success      200 {file} binary "PDF-файл отчёта"
// @Failure      400 {object} ErrorResponse
// @Router       /api/v1/report/{id} [post]
func (h *MeasurementsHandler) PostReport(c *gin.Context) {
	measurement, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_form", Message: err.Error()})
		return
	}

	opts := reportOptions{images: &services.ReportImages{}}
	targets := map[string]*[]byte{
		"compare":    &opts.images.Compare,
		"plots":      &opts.images.Plots,
		"max_radar":  &opts.images.MaxRadar,
		"time_radar": &opts.images.TimeRadar,
	}
	for _, field := range reportImageFields {
		files := form.File[field]
		if len(files) == 0 {
			continue
		}
		data, err := readReportImage(files[0])
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_image", Message: field + ": " + err.Error()})
			return
		}
		*targets[field] = data
	}

	if values, present := form.Value["mask_id"]; present {
		opts.overrideMask = true
		if raw := values[0]; raw != "" {
			id, err := strconv.Atoi(raw)
			if err != nil {
				c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_mask_id", Message: "mask_id must be an integer"})
				return
			}
			opts.maskID = &id
		}
	}
	if values := form.Value["sensors"]; len(values) > 0 {
		idx, err := parseIndexList(values[0])
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_sensors", Message: err.Error()})
			return
		}
		opts.sensorIdx = idx
	}
	if values := form.Value["time_axis_min"]; len(values) > 0 && values[0] != "" {
		v, err := strconv.ParseFloat(values[0], 64)
		if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_axis_min", Message: "time_axis_min must be a finite number"})
			return
		}
		opts.timeAxisMin = &v
	}

	h.sendReport(c, measurement, opts)
}

// readReportImage читает загруженный PNG и проверяет размер и сигнатуру.
func readReportImage(fh *multipart.FileHeader) ([]byte, error) {
	if fh.Size > maxReportImageBytes {
		return nil, fmt.Errorf("image is larger than %d MB", maxReportImageBytes>>20)
	}
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxReportImageBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) < 8 || string(data[:8]) != "\x89PNG\r\n\x1a\n" {
		return nil, errors.New("not a PNG image")
	}
	return data, nil
}

// parseIndexList разбирает «0,1,5» в неотрицательные индексы без повторов.
// Пустая строка — пустой (не nil) список: «сенсоры не выбраны».
func parseIndexList(raw string) ([]int, error) {
	out := []int{}
	seen := map[int]bool{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		v, err := strconv.Atoi(part)
		if err != nil || v < 0 {
			return nil, fmt.Errorf("invalid sensor index %q", part)
		}
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out, nil
}

// pickSensors оставляет сенсоры с заданными индексами в порядке возрастания;
// индексы за пределами списка игнорируются.
func pickSensors(sensors []repository.ReportSensorSeries, idx []int) []repository.ReportSensorSeries {
	sorted := append([]int(nil), idx...)
	sort.Ints(sorted)
	out := make([]repository.ReportSensorSeries, 0, len(sorted))
	for _, i := range sorted {
		if i < len(sensors) {
			out = append(out, sensors[i])
		}
	}
	return out
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

// maskSampleEPS — та же поправка, что в apps/frontend/app/lib/masks.ts.
const maskSampleEPS = 1e-9

// maskLegacyStepTolerance — допуск на «шаг около секунды» (как в masks.ts).
const maskLegacyStepTolerance = 0.2

// medianStep — медианный шаг по времени; 0, если отсчётов меньше двух.
func medianStep(times []float64) float64 {
	if len(times) < 2 {
		return 0
	}
	steps := make([]float64, 0, len(times)-1)
	for i := 1; i < len(times); i++ {
		steps = append(steps, times[i]-times[i-1])
	}
	sort.Float64s(steps)
	return steps[len(steps)/2]
}

// maskSampleIndex — номер отсчёта (среди отсчётов после базовой точки) для
// момента маски t или -1 за пределами данных. Правило то же, что в
// apps/frontend/app/lib/masks.ts: при шаге около 1 с (записи MAG-soft) отсчёт
// равен floor(t), при другом шаге t — секунды, берётся ближайший по времени.
func maskSampleIndex(times []float64, t float64) int {
	if len(times) == 0 {
		return -1
	}
	step := medianStep(times)
	if step <= 0 || math.Abs(step-1) <= maskLegacyStepTolerance {
		k := int(math.Floor(t + maskSampleEPS))
		if k < 0 || k >= len(times) {
			return -1
		}
		return k
	}
	if t > times[len(times)-1]+step/2+maskSampleEPS {
		return -1
	}
	best := 0
	for k := 1; k < len(times); k++ {
		if math.Abs(times[k]-t) < math.Abs(times[best]-t) {
			best = k
		}
	}
	return best
}

// resolveMaskSamples переводит точки маски в индексы исходного ряда. Базовые
// точки — ведущие точки с отрицательным временем. Точки маски отсортированы,
// поэтому на первой вышедшей за пределы данных обход прекращается.
func resolveMaskSamples(timestamps, points []float64) ([]float64, []int) {
	kept := make([]float64, 0, len(points))
	origIdx := make([]int, 0, len(points))

	baseline := 0
	for baseline < len(timestamps) && timestamps[baseline] < 0 {
		baseline++
	}
	usable := timestamps[baseline:]

	for _, t := range points {
		k := maskSampleIndex(usable, t)
		if k < 0 {
			break
		}
		kept = append(kept, t)
		origIdx = append(origIdx, baseline+k)
	}
	return kept, origIdx
}

// mergeIndices объединяет наборы индексов в один отсортированный без дублей:
// точки маски обязаны пережить прореживание, иначе отчёт посчитает площадь
// по другим отсчётам.
func mergeIndices(base, extra []int) []int {
	seen := make(map[int]struct{}, len(base)+len(extra))
	out := make([]int, 0, len(base)+len(extra))
	for _, group := range [][]int{base, extra} {
		for _, v := range group {
			if _, ok := seen[v]; ok {
				continue
			}
			seen[v] = struct{}{}
			out = append(out, v)
		}
	}
	sort.Ints(out)
	return out
}

// positionsIn ищет позиции wanted внутри отсортированного sorted; отсутствующие
// пропускаются (в норме их нет — mergeIndices это гарантирует).
func positionsIn(sorted, wanted []int) []int {
	out := make([]int, 0, len(wanted))
	for _, w := range wanted {
		if i := sort.SearchInts(sorted, w); i < len(sorted) && sorted[i] == w {
			out = append(out, i)
		}
	}
	return out
}
