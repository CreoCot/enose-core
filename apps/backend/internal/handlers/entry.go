package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// EntryDetails — данные одного измерения для страницы записи.
type EntryDetails struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	StartTime time.Time `json:"start_time"`
	// DefaultMaskID — маска по умолчанию (null, если не задана).
	DefaultMaskID *int `json:"default_mask_id"`
}

// SetEntryMaskRequest — mask_id = null снимает маску по умолчанию.
type SetEntryMaskRequest struct {
	MaskID *int `json:"mask_id"`
}

// GetEntry godoc
// @Summary      Детали измерения
// @Description  Возвращает имя, время старта и маску по умолчанию
// @Tags         Measurements
// @Security     BearerAuth
// @Produce      json
// @Param        id path int true "ID измерения"
// @Success      200 {object} EntryDetails
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/entries/{id} [get]
func (h *MeasurementsHandler) GetEntry(c *gin.Context) {
	m, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, EntryDetails{
		ID:            m.ID,
		Name:          m.Name,
		StartTime:     m.StartTime,
		DefaultMaskID: m.DefaultMaskID,
	})
}

// SetEntryMask godoc
// @Summary      Маска измерения по умолчанию
// @Description  Запоминает маску по умолчанию для измерения (mask_id = null — снять)
// @Tags         Measurements
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path int true "ID измерения"
// @Param        body body SetEntryMaskRequest true "Маска"
// @Success      200 {object} EntryDetails
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/entries/{id}/mask [put]
func (h *MeasurementsHandler) SetEntryMask(c *gin.Context) {
	m, ok := h.loadAuthorizedMeasurement(c)
	if !ok {
		return
	}
	var req SetEntryMaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_body", Message: "invalid JSON body"})
		return
	}
	ctx := c.Request.Context()
	if req.MaskID != nil {
		if _, err := h.Registry.Masks.GetByID(ctx, *req.MaskID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, ErrorResponse{Error: "mask_not_found", Message: "mask not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "fetch_error", Message: err.Error()})
			return
		}
	}
	if err := h.Registry.Masks.SetMeasurementDefault(ctx, m.ID, req.MaskID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "save_error", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, EntryDetails{
		ID:            m.ID,
		Name:          m.Name,
		StartTime:     m.StartTime,
		DefaultMaskID: req.MaskID,
	})
}
