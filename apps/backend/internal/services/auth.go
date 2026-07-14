package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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

	// refreshTokenTTL — срок жизни refresh-токена ("remember me"). Access-token
	// TTL остаётся прежним (24ч, ниже) — сокращать его нельзя, пока фронтенд не
	// поставил silent-refresh интерцептор: без него укороченный access token
	// был бы чистой регрессией сессии, а не улучшением.
	refreshTokenTTL = 30 * 24 * time.Hour
)

var (
	ErrUserExists          = errors.New("username already taken")
	ErrInvalidPassword     = errors.New("invalid username or password")
	ErrUserNotFound        = errors.New("invalid username or password")
	ErrNoPasswordSet       = errors.New("account has no password — contact admin")
	ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")
)

type Claims struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type AuthService interface {
	Register(ctx context.Context, username, password string, fullName, email *string, role string) (*models.User, error)
	Login(ctx context.Context, username, password string) (token string, user *models.User, err error)
	ValidateToken(tokenStr string) (*Claims, error)
	GetUserByID(ctx context.Context, id int) (*models.User, error)

	// IssueRefreshToken создаёт новый refresh-токен для пользователя и возвращает
	// его в открытом виде (в БД хранится только хеш).
	IssueRefreshToken(ctx context.Context, userID int) (rawToken string, err error)
	// RefreshSession проверяет refresh-токен, ротирует его (старый отзывается,
	// выдаётся новый) и выпускает новый access-токен. Повторное предъявление уже
	// отозванного токена трактуется как компрометация — отзываются ВСЕ
	// refresh-токены пользователя.
	RefreshSession(ctx context.Context, rawToken string) (accessToken string, newRawToken string, err error)
	// RevokeRefreshToken отзывает конкретный refresh-токен (logout). Не найден —
	// не ошибка (идемпотентно).
	RevokeRefreshToken(ctx context.Context, rawToken string) error
}

type authService struct {
	users         repository.UserRepository
	refreshTokens repository.RefreshTokenRepository
	jwtSecret     []byte
	tokenTTL      time.Duration
}

func NewAuthService(users repository.UserRepository, refreshTokens repository.RefreshTokenRepository, jwtSecret string) AuthService {
	return &authService{
		users:         users,
		refreshTokens: refreshTokens,
		jwtSecret:     []byte(jwtSecret),
		tokenTTL:      24 * time.Hour,
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

func (s *authService) Login(ctx context.Context, username, password string) (string, *models.User, error) {
	user, err := s.users.FindByUsername(ctx, username)
	if err != nil {
		return "", nil, err
	}
	if user == nil {
		return "", nil, ErrUserNotFound
	}
	if user.PasswordHash == nil {
		return "", nil, ErrNoPasswordSet
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return "", nil, ErrInvalidPassword
	}

	token, err := s.signAccessToken(user)
	if err != nil {
		return "", nil, err
	}
	return token, user, nil
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

func (s *authService) signAccessToken(user *models.User) (string, error) {
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

// newRawRefreshToken генерирует криптостойкий случайный токен и его SHA-256
// хеш (в БД хранится только хеш — компрометация БД не раскрывает токены).
func newRawRefreshToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}

func (s *authService) IssueRefreshToken(ctx context.Context, userID int) (string, error) {
	raw, hash, err := newRawRefreshToken()
	if err != nil {
		return "", err
	}

	token := &models.RefreshToken{
		UserID:    userID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(refreshTokenTTL),
	}
	if err := s.refreshTokens.Create(ctx, token); err != nil {
		return "", err
	}
	return raw, nil
}

func (s *authService) RefreshSession(ctx context.Context, rawToken string) (string, string, error) {
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])

	existing, err := s.refreshTokens.FindByHash(ctx, hash)
	if err != nil {
		return "", "", err
	}
	if existing == nil {
		return "", "", ErrInvalidRefreshToken
	}
	if existing.RevokedAt != nil {
		// Токен уже был использован (или отозван) — предъявление старого токена
		// повторно означает, что он мог быть украден. Отзываем все токены
		// пользователя, чтобы принудить полный повторный вход везде.
		_ = s.refreshTokens.RevokeAllForUser(ctx, existing.UserID)
		return "", "", ErrInvalidRefreshToken
	}
	if time.Now().After(existing.ExpiresAt) {
		return "", "", ErrInvalidRefreshToken
	}

	user, err := s.users.FindByID(ctx, existing.UserID)
	if err != nil {
		return "", "", err
	}
	if user == nil {
		return "", "", ErrInvalidRefreshToken
	}

	// Ротация: старый токен отзывается, новый выдаётся — реюз-обнаружение выше
	// работает только если каждый refresh-токен одноразовый.
	if err := s.refreshTokens.Revoke(ctx, existing.ID); err != nil {
		return "", "", err
	}

	accessToken, err := s.signAccessToken(user)
	if err != nil {
		return "", "", err
	}
	newRaw, err := s.IssueRefreshToken(ctx, user.ID)
	if err != nil {
		return "", "", err
	}

	return accessToken, newRaw, nil
}

func (s *authService) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])

	existing, err := s.refreshTokens.FindByHash(ctx, hash)
	if err != nil {
		return err
	}
	if existing == nil || existing.RevokedAt != nil {
		return nil
	}
	return s.refreshTokens.Revoke(ctx, existing.ID)
}
