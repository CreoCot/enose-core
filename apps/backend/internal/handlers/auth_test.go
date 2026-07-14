package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type mockAuthService struct {
	userByID map[int]*models.User
	err      error
}

func (m *mockAuthService) Register(ctx context.Context, username, password string, fullName, email *string, role string) (*models.User, error) {
	return nil, nil
}

func (m *mockAuthService) Login(ctx context.Context, username, password string) (string, *models.User, error) {
	return "", nil, nil
}

func (m *mockAuthService) ValidateToken(tokenStr string) (*services.Claims, error) {
	return nil, nil
}

func (m *mockAuthService) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.userByID[id], nil
}

func (m *mockAuthService) IssueRefreshToken(ctx context.Context, userID int) (string, error) {
	return "", nil
}

func (m *mockAuthService) RefreshSession(ctx context.Context, rawToken string) (string, string, error) {
	return "", "", nil
}

func (m *mockAuthService) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	return nil
}

type mockMeasurementRepo struct {
	repository.MeasurementRepository
	countByUser map[int]int64
}

func (m *mockMeasurementRepo) CountByUserID(ctx context.Context, userID int) (int64, error) {
	return m.countByUser[userID], nil
}

func performMe(t *testing.T, svc services.AuthService, counts map[int]int64, claims *services.Claims) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	c.Set("claims", claims)

	NewAuthHandler(svc, &mockMeasurementRepo{countByUser: counts}, false).Me(c)
	return w
}

func TestMe_ReturnsFullProfile(t *testing.T) {
	fullName := "Иван Иванов"
	email := "ivan@example.com"
	createdAt := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	svc := &mockAuthService{userByID: map[int]*models.User{
		42: {
			ID:        42,
			Username:  "ivan",
			FullName:  &fullName,
			Email:     &email,
			Role:      services.RoleOperator,
			CreatedAt: createdAt,
		},
	}}

	w := performMe(t, svc, map[int]int64{42: 5}, &services.Claims{UserID: 42, Username: "ivan", Role: services.RoleOperator})

	assert.Equal(t, http.StatusOK, w.Code)

	var resp profileResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 42, resp.ID)
	assert.Equal(t, "ivan", resp.Username)
	assert.Equal(t, &fullName, resp.FullName)
	assert.Equal(t, &email, resp.Email)
	assert.Equal(t, services.RoleOperator, resp.Role)
	assert.True(t, createdAt.Equal(resp.CreatedAt))
	assert.Equal(t, int64(5), resp.Count)
	assert.NotContains(t, w.Body.String(), "password_hash")
}

func TestMe_NullableFieldsStayNull(t *testing.T) {
	svc := &mockAuthService{userByID: map[int]*models.User{
		7: {ID: 7, Username: "bare", Role: services.RoleOperator},
	}}

	w := performMe(t, svc, map[int]int64{}, &services.Claims{UserID: 7, Username: "bare", Role: services.RoleOperator})

	assert.Equal(t, http.StatusOK, w.Code)

	var raw map[string]json.RawMessage
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &raw))
	assert.Equal(t, "null", string(raw["full_name"]))
	assert.Equal(t, "null", string(raw["email"]))
}

func TestMe_DeletedUserReturns401(t *testing.T) {
	svc := &mockAuthService{userByID: map[int]*models.User{}}

	w := performMe(t, svc, map[int]int64{}, &services.Claims{UserID: 99, Username: "ghost", Role: services.RoleOperator})

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var resp ErrorResponse
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "unauthorized", resp.Error)
}
