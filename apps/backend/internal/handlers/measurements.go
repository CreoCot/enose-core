package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MeasurementsHandler struct {
	Registry *repository.Registry
}

func NewMeasurementsHandler(r *repository.Registry) *MeasurementsHandler {
	return &MeasurementsHandler{Registry: r}
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
