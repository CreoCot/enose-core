package services

import (
	"context"
	"errors"
	"time"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"github.com/CreoCot/enose-core/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleAdmin    = "admin"
	RoleOperator = "operator"
)

var (
	ErrUserExists      = errors.New("username already taken")
	ErrInvalidPassword = errors.New("invalid username or password")
	ErrUserNotFound    = errors.New("invalid username or password")
	ErrNoPasswordSet   = errors.New("account has no password — contact admin")
)

type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type AuthService interface {
	Register(ctx context.Context, username, password string, fullName, email *string, role string) (*models.User, error)
	Login(ctx context.Context, username, password string) (string, error)
	ValidateToken(tokenStr string) (*Claims, error)
	GetUserByID(ctx context.Context, id int) (*models.User, error)
}

type authService struct {
	users     repository.UserRepository
	jwtSecret []byte
	tokenTTL  time.Duration
}

func NewAuthService(users repository.UserRepository, jwtSecret string) AuthService {
	return &authService{
		users:     users,
		jwtSecret: []byte(jwtSecret),
		tokenTTL:  24 * time.Hour,
	}
}

func (s *authService) Register(ctx context.Context, username, password string, fullName, email *string, role string) (*models.User, error) {
	existing, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	hashStr := string(hash)

	if role == "" {
		role = RoleOperator
	}

	user := &models.User{
		Username:     username,
		FullName:     fullName,
		Email:        email,
		Role:         role,
		PasswordHash: &hashStr,
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *authService) Login(ctx context.Context, username, password string) (string, error) {
	user, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", ErrUserNotFound
	}
	if user.PasswordHash == nil {
		return "", ErrNoPasswordSet
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidPassword
	}

	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.tokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *authService) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	return s.users.FindByID(ctx, id)
}

func (s *authService) ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}
	return claims, nil
}
