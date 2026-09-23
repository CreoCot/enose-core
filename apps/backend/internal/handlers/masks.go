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

type MasksHandler struct {
	Registry *repository.Registry
}

func NewMasksHandler(r *repository.Registry) *MasksHandler {
	return &MasksHandler{Registry: r}
}

// MaskRequest — тело создания/обновления маски.
type MaskRequest struct {
	Name   string    `json:"name" example:"Базовая 60 с"`
	Points []float64 `json:"points" example:"0,10,20,30,60"`
}

// MaskResponse — маска с точками по возрастанию времени.
type MaskResponse struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Points    []float64 `json:"points"`
	CreatedBy *int      `json:"created_by"`
	// Editable — может ли текущий пользователь менять/удалять маску
	// (создатель или admin).
	Editable bool `json:"editable"`
}

func toMaskResponse(m models.Mask, claims *services.Claims) MaskResponse {
	points := make([]float64, len(m.Points))
	for i, p := range m.Points {
		points[i] = p.TimeS
	}
	return MaskResponse{
		ID:        m.ID,
		Name:      m.Name,
		Points:    points,
		CreatedBy: m.CreatedBy,
		Editable:  canModifyMask(claims, &m),
	}
}

func claimsOf(c *gin.Context) *services.Claims {
	if v, ok := c.Get("claims"); ok {
		if cl, ok := v.(*services.Claims); ok {
			return cl
		}
	}
	return nil
}

// canModifyMask: маски общие для чтения, менять их может создатель или admin.
func canModifyMask(claims *services.Claims, m *models.Mask) bool {
	if claims == nil {
		return false
	}
	if claims.Role == services.RoleAdmin {
		return true
	}
	return m.CreatedBy != nil && *m.CreatedBy == claims.UserID
}

// validateMaskRequest разбирает тело запроса и нормализует имя и точки.
// При ошибке сам отвечает 400 и возвращает ok=false.
func validateMaskRequest(c *gin.Context) (name string, points []float64, ok bool) {
	var req MaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_body", Message: "invalid JSON body"})
		return "", nil, false
	}
	name, err := services.NormalizeMaskName(req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_mask_name", Message: err.Error()})
		return "", nil, false
	}
	points, err = services.NormalizeMaskPoints(req.Points)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_mask_points", Message: err.Error()})
		return "", nil, false
	}
	return name, points, true
}

// List godoc
// @Summary      Список масок
// @Description  Возвращает все маски времени с точками (маски общие для всех пользователей)
// @Tags         Masks
// @Security     BearerAuth
// @Produce      json
// @Success      200 {array} MaskResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/masks [get]
func (h *MasksHandler) List(c *gin.Context) {
	masks, err := h.Registry.Masks.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "fetch_error", Message: err.Error()})
		return
	}
	claims := claimsOf(c)
	out := make([]MaskResponse, 0, len(masks))
	for _, m := range masks {
		out = append(out, toMaskResponse(m, claims))
	}
	c.JSON(http.StatusOK, out)
}

// Create godoc
// @Summary      Создать маску
// @Description  Создаёт маску времени: имя уникально, минимум 2 различные точки (секунды, >= 0)
// @Tags         Masks
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body body MaskRequest true "Маска"
// @Success      201 {object} MaskResponse
// @Failure      400 {object} ErrorResponse
// @Failure      409 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/masks [post]
func (h *MasksHandler) Create(c *gin.Context) {
	name, points, ok := validateMaskRequest(c)
	if !ok {
		return
	}
	claims := claimsOf(c)
	var createdBy *int
	if claims != nil {
		createdBy = &claims.UserID
	}

	m, err := h.Registry.Masks.Create(c.Request.Context(), name, createdBy, points)
	if err != nil {
		if errors.Is(err, repository.ErrMaskNameTaken) {
			c.JSON(http.StatusConflict, ErrorResponse{Error: "mask_name_taken", Message: "mask with this name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "save_error", Message: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, toMaskResponse(*m, claims))
}

// loadEditableMask читает :id и проверяет право менять маску.
func (h *MasksHandler) loadEditableMask(c *gin.Context) (*models.Mask, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid_id", Message: "id must be a number"})
		return nil, false
	}
	m, err := h.Registry.Masks.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{Error: "not_found", Message: "mask not found"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "fetch_error", Message: err.Error()})
		return nil, false
	}
	if !canModifyMask(claimsOf(c), m) {
		c.JSON(http.StatusForbidden, ErrorResponse{Error: "forbidden", Message: "only the creator or an admin can change this mask"})
		return nil, false
	}
	return m, true
}

// Update godoc
// @Summary      Изменить маску
// @Description  Заменяет имя и точки маски. Доступно создателю маски и admin
// @Tags         Masks
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id path int true "ID маски"
// @Param        body body MaskRequest true "Маска"
// @Success      200 {object} MaskResponse
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      409 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/masks/{id} [put]
func (h *MasksHandler) Update(c *gin.Context) {
	existing, ok := h.loadEditableMask(c)
	if !ok {
		return
	}
	name, points, ok := validateMaskRequest(c)
	if !ok {
		return
	}
	m, err := h.Registry.Masks.Update(c.Request.Context(), existing.ID, name, points)
	if err != nil {
		if errors.Is(err, repository.ErrMaskNameTaken) {
			c.JSON(http.StatusConflict, ErrorResponse{Error: "mask_name_taken", Message: "mask with this name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "save_error", Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, toMaskResponse(*m, claimsOf(c)))
}

// Delete godoc
// @Summary      Удалить маску
// @Description  Удаляет маску; у измерений, где она была маской по умолчанию, привязка снимается. Доступно создателю и admin
// @Tags         Masks
// @Security     BearerAuth
// @Param        id path int true "ID маски"
// @Success      204 "Маска удалена"
// @Failure      400 {object} ErrorResponse
// @Failure      403 {object} ErrorResponse
// @Failure      404 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/masks/{id} [delete]
func (h *MasksHandler) Delete(c *gin.Context) {
	m, ok := h.loadEditableMask(c)
	if !ok {
		return
	}
	if err := h.Registry.Masks.Delete(c.Request.Context(), m.ID); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "delete_error", Message: err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
