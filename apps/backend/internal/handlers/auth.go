package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
)

const (
	cookieName         = "jwt"
	refreshCookieName  = "refresh_token"
	accessCookieMaxAge = 86400 // 24h — не связан с "remember me", см. auth.go

	// refreshCookieMaxAge — 30 дней, синхронизировано с refreshTokenTTL в services/auth.go.
	refreshCookieMaxAge = 30 * 24 * 3600
	// refreshCookiePath ограничивает refresh-cookie только auth-эндпоинтами —
	// в остальных запросах браузер её не отправляет (меньше поверхность атаки).
	refreshCookiePath = "/api/v1/auth"
)

type AuthHandler struct {
	auth         services.AuthService
	measurements repository.MeasurementRepository
	secureCookie bool
}

func NewAuthHandler(auth services.AuthService, measurements repository.MeasurementRepository, secureCookie bool) *AuthHandler {
	return &AuthHandler{auth: auth, measurements: measurements, secureCookie: secureCookie}
}

type registerRequest struct {
	Username string  `json:"username" binding:"required,min=3,max=64"`
	Password string  `json:"password" binding:"required,min=8"`
	FullName *string `json:"full_name"`
	Email    *string `json:"email"`
	Role     string  `json:"role"`
}

type loginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	// RememberMe — если true, дополнительно выдаётся refresh-токен (30 дней).
	// Отсутствует в запросе → false, поведение логина не меняется (как раньше).
	RememberMe bool `json:"remember_me"`
}

type userResponse struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	FullName  *string   `json:"full_name"`
	Email     *string   `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type profileResponse struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	FullName  *string   `json:"full_name"`
	Email     *string   `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	Count     int64     `json:"count"`
}

type messageResponse struct {
	Message string `json:"message"`
}

// Register godoc
// @Summary      Регистрация нового пользователя
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body body registerRequest true "Данные пользователя"
// @Success      201 {object} userResponse
// @Failure      400 {object} ErrorResponse
// @Failure      409 {object} ErrorResponse
// @Router       /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "validation_error", Message: err.Error()})
		return
	}

	user, err := h.auth.Register(c.Request.Context(), req.Username, req.Password, req.FullName, req.Email, req.Role)
	if err != nil {
		if errors.Is(err, services.ErrUserExists) {
			c.JSON(http.StatusConflict, ErrorResponse{Error: "conflict", Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error", Message: "failed to register user"})
		return
	}

	c.JSON(http.StatusCreated, userResponse{
		ID:        user.ID,
		Username:  user.Username,
		FullName:  user.FullName,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	})
}

// Login godoc
// @Summary      Вход в систему
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body body loginRequest true "Логин и пароль"
// @Success      200 {object} messageResponse
// @Failure      400 {object} ErrorResponse
// @Failure      401 {object} ErrorResponse
// @Router       /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "validation_error", Message: err.Error()})
		return
	}

	token, user, err := h.auth.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidPassword) || errors.Is(err, services.ErrUserNotFound) {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized", Message: "invalid username or password"})
			return
		}
		if errors.Is(err, services.ErrNoPasswordSet) {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized", Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error", Message: "failed to login"})
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, token, accessCookieMaxAge, "/", "", h.secureCookie, true)

	if req.RememberMe {
		raw, err := h.auth.IssueRefreshToken(c.Request.Context(), user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error", Message: "failed to issue refresh token"})
			return
		}
		c.SetCookie(refreshCookieName, raw, refreshCookieMaxAge, refreshCookiePath, "", h.secureCookie, true)
	}

	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Logout godoc
// @Summary      Выход из системы
// @Tags         Auth
// @Produce      json
// @Success      200 {object} messageResponse
// @Router       /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	if raw, err := c.Cookie(refreshCookieName); err == nil && raw != "" {
		// Лучшая попытка: не найден/уже отозван — не ошибка, всё равно чистим куки.
		_ = h.auth.RevokeRefreshToken(c.Request.Context(), raw)
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", h.secureCookie, true)
	c.SetCookie(refreshCookieName, "", -1, refreshCookiePath, "", h.secureCookie, true)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Refresh godoc
// @Summary      Обновить access-токен по refresh-токену
// @Description  Требует refresh_token cookie (выдаётся при login с remember_me=true). Ротирует refresh-токен.
// @Tags         Auth
// @Produce      json
// @Success      200 {object} messageResponse
// @Failure      401 {object} ErrorResponse
// @Router       /api/v1/auth/refresh [post]
func (h *AuthHandler) Refresh(c *gin.Context) {
	raw, err := c.Cookie(refreshCookieName)
	if err != nil || raw == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized", Message: "no refresh token"})
		return
	}

	accessToken, newRaw, err := h.auth.RefreshSession(c.Request.Context(), raw)
	if err != nil {
		// Невалидный/просроченный/переиспользованный токен — принудительно
		// заканчиваем сессию, чтобы фронтенд однозначно ушёл на /login.
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(cookieName, "", -1, "/", "", h.secureCookie, true)
		c.SetCookie(refreshCookieName, "", -1, refreshCookiePath, "", h.secureCookie, true)
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized", Message: "invalid or expired refresh token"})
		return
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, accessToken, accessCookieMaxAge, "/", "", h.secureCookie, true)
	c.SetCookie(refreshCookieName, newRaw, refreshCookieMaxAge, refreshCookiePath, "", h.secureCookie, true)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Me godoc
// @Summary      Информация о текущем пользователе
// @Tags         Auth
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} profileResponse
// @Failure      401 {object} ErrorResponse
// @Failure      500 {object} ErrorResponse
// @Router       /api/v1/auth/me [get]
func (h *AuthHandler) Me(c *gin.Context) {
	claims := c.MustGet("claims").(*services.Claims)

	user, err := h.auth.GetUserByID(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error", Message: "failed to load user"})
		return
	}
	if user == nil {
		// Токен валиден, но пользователь удалён — сессия больше не действительна.
		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "unauthorized", Message: "user no longer exists"})
		return
	}

	count, err := h.measurements.CountByUserID(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal_error", Message: "failed to count measurements"})
		return
	}

	c.JSON(http.StatusOK, profileResponse{
		ID:        user.ID,
		Username:  user.Username,
		FullName:  user.FullName,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		Count:     count,
	})
}
