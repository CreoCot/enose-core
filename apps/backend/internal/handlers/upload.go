package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// sidPattern вытаскивает физический идентификатор сенсора (SID) из ярлыка,
// который присылает parser-сервис. Формат ярлыка отличается по источнику:
// XML-парсер кладёт туда голый sid ("SID0001"), CSV/XLSX — "Название
// [SID0001]". В обоих случаях сам токен ищется одинаково; не найден —
// значит источник не сообщает SID, и резолвинг сенсора падает обратно на
// позицию (см. saveToDB).
var sidPattern = regexp.MustCompile(`SID[A-Za-z0-9_-]+`)

func extractSID(label string) *string {
	sid := sidPattern.FindString(label)
	if sid == "" {
		return nil
	}
	return &sid
}

type UploadHandler struct {
	ParserClient *services.ParserClient
	Registry     *repository.Registry
}

func NewUploadHandler(pc *services.ParserClient, r *repository.Registry) *UploadHandler {
	return &UploadHandler{ParserClient: pc, Registry: r}
}

// Upload godoc
// @Summary      Загрузить файл измерения
// @Description  Принимает файл (CSV, XML, XLSX), отправляет в parser-сервис и возвращает распарсенные данные
// @Tags         Measurements
// @Security     BearerAuth
// @Accept       multipart/form-data
// @Produce      json
// @Param        file formData file true "Файл измерения (CSV, XML или XLSX)"
// @Success      200 {object} services.ParsedMeasurement
// @Failure      400 {object} ErrorResponse
// @Failure      422 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/upload [post]
func (h *UploadHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_file",
			Message: "File not found, Field \"File\" is mandatory",
		})
		return
	}

	defer file.Close()

	const maxSize = 50 << 20 // 50 MB - max size
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "too_large_file",
			Message: "File size should be not greater than 50 MB",
		})
		return
	}

	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "read_error",
			Message: "Failed to read content of the file",
		})
		return
	}

	parsed, err := h.ParserClient.ParseFile(c.Request.Context(), header.Filename, content)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "parse_error",
			Message: err.Error(),
		})
		return
	}

	var userID *int
	if claims, ok := c.Get("claims"); ok {
		id := claims.(*services.Claims).UserID
		userID = &id
	}

	measurementID, err := h.saveToDB(c.Request.Context(), parsed, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "save_error",
			Message: "Failed to save measurement: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "File accepted",
		"filename":       header.Filename,
		"measurement_id": measurementID,
	})

}

func (h *UploadHandler) saveToDB(ctx context.Context, parsed *services.ParsedMeasurement, userID *int) (int, error) {

	device, err := h.Registry.Lookups.GetOrCreateDevice(ctx, parsed.DeviceSerial, parsed.DeviceTypeCode, parsed.MeasurementName)
	if err != nil {
		return 0, fmt.Errorf("find device %s: %w", parsed.DeviceSerial, err)
	}

	var obj *models.MeasurementObject

	if parsed.MeasurementObject != nil && *parsed.MeasurementObject != "" {
		obj, err = h.Registry.Lookups.GetOrCreateObject(ctx, *parsed.MeasurementObject)
		if err != nil {
			return 0, err
		}
	}

	sensorIDs := make([]int, len(parsed.Sensors))
	for i, ps := range parsed.Sensors {
		sid := extractSID(ps.Label)

		var sensor *models.Sensor
		if sid != nil {
			// SID — надёжная идентичность физического сенсора: один и тот же
			// сенсор может занимать разные позиции в разных измерениях (см.
			// комментарий к Sensor.SID в models.go), поэтому это первичный
			// путь резолвинга, когда источник его сообщает.
			sensor, err = h.Registry.Sensors.GetByDeviceAndSID(ctx, device.ID, *sid)
		} else {
			// Источник не сообщает SID (например, старый CSV без метки) —
			// откатываемся к позиции, как раньше.
			sensor, err = h.Registry.Sensors.GetByDeviceAndPosition(ctx, device.ID, ps.Position)
		}

		if err == gorm.ErrRecordNotFound {
			sensor, err = h.Registry.Sensors.CreateForDevice(ctx, device.ID, ps.Position, ps.Label, sid)
			if err != nil {
				return 0, err
			}

		} else if err != nil {
			return 0, err
		}
		sensorIDs[i] = sensor.ID
	}

	positions := make([]int, len(parsed.Sensors))
	for i, s := range parsed.Sensors {
		positions[i] = s.Position
	}

	description := ""
	if parsed.Description != nil {
		description = *parsed.Description
	}

	measurementObject := ""
	if parsed.MeasurementObject != nil {
		measurementObject = *parsed.MeasurementObject
	}

	groupKey := services.ComputeGroupKey(
		parsed.DeviceSerial,
		measurementObject,
		parsed.IntervalMs,
		positions,
		description,
	)

	measurement := &models.Measurement{
		Name:       parsed.MeasurementName,
		DeviceID:   device.ID,
		UserID:     userID,
		StartTime:  parsed.StartTime.Time,
		IntervalMS: parsed.IntervalMs,
		Status:     "completed",
		GroupKey:   groupKey,
	}
	if obj != nil {
		measurement.MeasurementObjectID = &obj.ID
	}
	if parsed.Description != nil {
		measurement.Description = parsed.Description
	}

	params := make([]models.MeasurementParameter, len(parsed.Sensors))
	for i, ps := range parsed.Sensors {
		params[i] = models.MeasurementParameter{
			SensorID: sensorIDs[i],
			Position: ps.Position,
			Label:    &ps.Label,
			Unit:     ps.Unit,
		}
	}

	dataPoints := make([]models.MeasurementData, len(parsed.DataPoints))
	for i, dp := range parsed.DataPoints {
		sensorIdx := dp.SensorPosition - 1
		if sensorIdx < 0 || sensorIdx >= len(sensorIDs) {
			continue
		}
		dataPoints[i] = models.MeasurementData{
			SensorID:    sensorIDs[sensorIdx],
			TimeOffsetS: dp.TimeOffsetS,
			Value:       dp.Value,
		}
	}

	err = h.Registry.Measurements.CreateFullMeasurement(ctx, measurement, params, dataPoints)
	if err != nil {
		return 0, err
	}

	return measurement.ID, nil
}
