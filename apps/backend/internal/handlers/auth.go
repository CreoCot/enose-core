package handlers

import (
	"errors"
	"net/http"

	"github.com/CreoCot/enose-core/backend/internal/services"
	"github.com/gin-gonic/gin"
)

const cookieName = "jwt"

type AuthHandler struct {
	auth         services.AuthService
	secureCookie bool
}

func NewAuthHandler(auth services.AuthService, secureCookie bool) *AuthHandler {
	return &AuthHandler{auth: auth, secureCookie: secureCookie}
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
}

type userResponse struct {
	ID       int     `json:"id"`
	Username string  `json:"username"`
	FullName *string `json:"full_name"`
	Email    *string `json:"email"`
	Role     string  `json:"role"`
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
		ID:       user.ID,
		Username: user.Username,
		FullName: user.FullName,
		Email:    user.Email,
		Role:     user.Role,
	})
}

// Login godoc
// @Summary      Вход в систему
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body body loginRequest true "Логин и пароль"
// @Success      200 {object} tokenResponse
// @Failure      400 {object} ErrorResponse
// @Failure      401 {object} ErrorResponse
// @Router       /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "validation_error", Message: err.Error()})
		return
	}

	token, err := h.auth.Login(c.Request.Context(), req.Username, req.Password)
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
	c.SetCookie(cookieName, token, 86400, "/", "", h.secureCookie, true)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Logout godoc
// @Summary      Выход из системы
// @Tags         Auth
// @Success      200
// @Router       /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", h.secureCookie, true)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// Me godoc
// @Summary      Информация о текущем пользователе
// @Tags         Auth
// @Security     BearerAuth
// @Produce      json
// @Success      200 {object} userResponse
// @Failure      401 {object} ErrorResponse
// @Router       /api/v1/auth/me [get]
func (h *AuthHandler) Me(c *gin.Context) {
	claims := c.MustGet("claims").(*services.Claims)
	c.JSON(http.StatusOK, gin.H{
		"id":       claims.UserID,
		"username": claims.Username,
		"role":     claims.Role,
	})
}
