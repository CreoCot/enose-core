package handlers

import (
	"bytes"
	"context"
	"encoding/json"
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

// mockMaskRepo мокает только методы, нужные хендлерам масок.
type mockMaskRepo struct {
	repository.MaskRepository
	byID      map[int]*models.Mask
	created   *models.Mask
	nameTaken bool
	deleted   int
}

func (m *mockMaskRepo) GetByID(ctx context.Context, id int) (*models.Mask, error) {
	if mk, ok := m.byID[id]; ok {
		return mk, nil
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockMaskRepo) Create(ctx context.Context, name string, createdBy *int, points []float64) (*models.Mask, error) {
	if m.nameTaken {
		return nil, repository.ErrMaskNameTaken
	}
	mk := &models.Mask{ID: 1, Name: name, CreatedBy: createdBy}
	for _, p := range points {
		mk.Points = append(mk.Points, models.MaskPoint{TimeS: p})
	}
	m.created = mk
	return mk, nil
}

func (m *mockMaskRepo) Delete(ctx context.Context, id int) error {
	m.deleted = id
	return nil
}

func doMaskRequest(t *testing.T, method, path string, params gin.Params, body any, claims *services.Claims, handler func(*MasksHandler) gin.HandlerFunc, repo *mockMaskRepo) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var buf bytes.Buffer
	if body != nil {
		assert.NoError(t, json.NewEncoder(&buf).Encode(body))
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = params
	c.Set("claims", claims)

	h := NewMasksHandler(&repository.Registry{Masks: repo})
	handler(h)(c)
	c.Writer.WriteHeaderNow()
	return w
}

func createHandler(h *MasksHandler) gin.HandlerFunc { return h.Create }
func deleteHandler(h *MasksHandler) gin.HandlerFunc { return h.Delete }

func TestCreateMask_Valid(t *testing.T) {
	repo := &mockMaskRepo{}
	w := doMaskRequest(t, http.MethodPost, "/api/v1/masks", nil,
		MaskRequest{Name: "  Базовая  ", Points: []float64{60, 0, 10, 10}},
		&services.Claims{UserID: 4, Role: services.RoleOperator}, createHandler, repo)

	assert.Equal(t, http.StatusCreated, w.Code)
	var resp MaskResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "Базовая", resp.Name)
	assert.Equal(t, []float64{0, 10, 60}, resp.Points)
	assert.True(t, resp.Editable)
	if assert.NotNil(t, repo.created.CreatedBy) {
		assert.Equal(t, 4, *repo.created.CreatedBy)
	}
}

func TestCreateMask_Validation(t *testing.T) {
	claims := &services.Claims{UserID: 1, Role: services.RoleOperator}
	cases := []struct {
		name string
		body any
		code string
	}{
		{"empty name", MaskRequest{Name: " ", Points: []float64{0, 1}}, "invalid_mask_name"},
		{"one point", MaskRequest{Name: "x", Points: []float64{5}}, "invalid_mask_points"},
		{"negative point", MaskRequest{Name: "x", Points: []float64{-1, 2}}, "invalid_mask_points"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doMaskRequest(t, http.MethodPost, "/api/v1/masks", nil, tc.body, claims, createHandler, &mockMaskRepo{})
			assert.Equal(t, http.StatusBadRequest, w.Code)
			var resp ErrorResponse
			assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
			assert.Equal(t, tc.code, resp.Error)
		})
	}
}

func TestCreateMask_NameTaken(t *testing.T) {
	repo := &mockMaskRepo{nameTaken: true}
	w := doMaskRequest(t, http.MethodPost, "/api/v1/masks", nil,
		MaskRequest{Name: "dup", Points: []float64{0, 1}},
		&services.Claims{UserID: 1, Role: services.RoleOperator}, createHandler, repo)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestDeleteMask_Permissions(t *testing.T) {
	newRepo := func() *mockMaskRepo {
		return &mockMaskRepo{byID: map[int]*models.Mask{
			7: {ID: 7, Name: "m", CreatedBy: intPtr(3)},
			8: {ID: 8, Name: "legacy"}, // без владельца
		}}
	}
	params := func(id string) gin.Params { return gin.Params{{Key: "id", Value: id}} }

	t.Run("owner deletes own", func(t *testing.T) {
		repo := newRepo()
		w := doMaskRequest(t, http.MethodDelete, "/api/v1/masks/7", params("7"), nil,
			&services.Claims{UserID: 3, Role: services.RoleOperator}, deleteHandler, repo)
		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.Equal(t, 7, repo.deleted)
	})
	t.Run("operator cannot delete foreign", func(t *testing.T) {
		repo := newRepo()
		w := doMaskRequest(t, http.MethodDelete, "/api/v1/masks/7", params("7"), nil,
			&services.Claims{UserID: 9, Role: services.RoleOperator}, deleteHandler, repo)
		assert.Equal(t, http.StatusForbidden, w.Code)
		assert.Zero(t, repo.deleted)
	})
	t.Run("admin deletes any, even ownerless", func(t *testing.T) {
		repo := newRepo()
		w := doMaskRequest(t, http.MethodDelete, "/api/v1/masks/8", params("8"), nil,
			&services.Claims{UserID: 1, Role: services.RoleAdmin}, deleteHandler, repo)
		assert.Equal(t, http.StatusNoContent, w.Code)
		assert.Equal(t, 8, repo.deleted)
	})
	t.Run("ownerless mask is admin-only", func(t *testing.T) {
		repo := newRepo()
		w := doMaskRequest(t, http.MethodDelete, "/api/v1/masks/8", params("8"), nil,
			&services.Claims{UserID: 3, Role: services.RoleOperator}, deleteHandler, repo)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})
	t.Run("not found and bad id", func(t *testing.T) {
		w := doMaskRequest(t, http.MethodDelete, "/api/v1/masks/99", params("99"), nil,
			&services.Claims{UserID: 1, Role: services.RoleAdmin}, deleteHandler, newRepo())
		assert.Equal(t, http.StatusNotFound, w.Code)
		w = doMaskRequest(t, http.MethodDelete, "/api/v1/masks/abc", params("abc"), nil,
			&services.Claims{UserID: 1, Role: services.RoleAdmin}, deleteHandler, newRepo())
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
