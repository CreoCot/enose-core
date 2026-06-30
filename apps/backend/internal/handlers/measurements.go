package handlers

import (
	"net/http"

	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
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
